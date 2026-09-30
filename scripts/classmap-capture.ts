#!/usr/bin/env node
/**
 * Capture / migrate / verify Spicetify classmaps between Spotify CSS builds.
 *
 * Requires Node.js >= 24 (runs as TypeScript through type stripping).
 *
 * Commands
 * --------
 *   inventory   List class tokens from CSS/spa
 *   migrate     Migrate a classmap (CSS signatures + optional css-map.json)
 *   verify      Score a classmap or migrate report against css-map + live CSS
 *   flatten     Bridge a classmap into a flat css-map overlay
 *   key         Print classmap folder key for a version
 *   devtools    Print DevTools snippets to manually verify matched paths
 *
 * css-map.json signal
 * -------------------
 * The CLI css-map maps *current* hashed classes -> stable semantic names
 * (e.g. main-topBar-container). During migrate we:
 *   1. Prefer target candidates that appear as keys in css-map
 *   2. Boost candidates whose semantic name token-overlaps the classmap path
 *   3. Penalize / reject high CSS similarity when semantic tokens conflict
 *
 * Examples
 * --------
 *   node scripts/classmap-capture.ts migrate \
 *     --base-classmap ../classmaps/1030001/classmap.json \
 *     --base-spa /path/to/1.3.1/xpui.spa \
 *     --target-spa "/Applications/Spotify.app/Contents/Resources/Apps/xpui.spa" \
 *     --css-map css-map.json \
 *     --out classmaps/1020092/classmap.json \
 *     --report classmaps/1020092/report.json \
 *     --allow-partial
 *
 *   node scripts/classmap-capture.ts verify \
 *     --classmap classmaps/1020092/classmap.json \
 *     --report classmaps/1020092/report.json \
 *     --css-map css-map.json \
 *     --target-spa "/Applications/Spotify.app/Contents/Resources/Apps/xpui.spa" \
 *     --target-version 1.2.92.148 \
 *     --out classmaps/1020092/verify.json
 *
 *   node scripts/classmap-capture.ts devtools --report classmaps/1020092/report.json
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import zlib from "node:zlib";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Classmap = { [key: string]: Classmap | string };
type Row = Record<string, Json>;
type Report = { matched?: Row[]; identity?: Row[]; unmatched?: Row[]; stats?: Row };
/** A rule body as a set of `prop\0value` pairs. */
type Signature = Set<string>;
/** Class -> its distinct signatures, keyed by their canonical form. */
type Signatures = Map<string, Map<string, Signature>>;

const PROP_RE = /([a-zA-Z-]+)\s*:\s*([^;]+);/g;
const CLASS_RE = /\.([A-Za-z0-9_-]+)/g;
const SKIPPED_PROPS = new Set(["content", "src", "animation-name"]);

/** Python's round(): the exact binary value, halves to even. */
export function pyRound(x: number, digits: number): number {
  // toFixed accepts up to 100 digits, enough for the exact decimal expansion that decides a half.
  // oxlint-disable-next-line number-arg-out-of-range
  const [int, frac] = Math.abs(x).toFixed(100).split(".");
  let n = BigInt(int + frac.slice(0, digits));
  const rest = frac.slice(digits);
  const half = "5".padEnd(rest.length, "0");
  if (rest > half || (rest === half && n % 2n === 1n)) n += 1n;
  const out = Number(n) / 10 ** digits;
  return x < 0 ? -out : out;
}

function isLowerCased(token: string): boolean {
  return token.toLowerCase() === token && token.toUpperCase() !== token;
}

export function isHashLike(token: string): boolean {
  // Min length 4: real Spotify hashes can be short (e.g. the 1.2.45
  // play button class "cLkUmr" is 6 chars). Semantic/Encore classes are
  // filtered by the lowercase-dash and prefix rules below, and matchers
  // still require CSS or semantic evidence, so a low bound is safe here.
  const length = Array.from(token).length;
  if (length < 4 || length > 25) return false;
  if (token.includes("-") && isLowerCased(token)) return false;
  if (token.startsWith("spotify") || token.startsWith("encore")) return false;
  const hasUpper = /\p{Lu}/u.test(token);
  const hasLower = /\p{Ll}/u.test(token);
  const hasDigit = /\p{Nd}/u.test(token);
  if (hasUpper && hasLower) return true;
  return token.includes("_") && (hasDigit || hasUpper);
}

/** Decodes UTF-8 dropping invalid bytes, as Python's errors="ignore" does. */
function decodeIgnoringErrors(buf: Buffer): string {
  const text = buf.toString("utf8");
  return buf.includes(Buffer.from([0xef, 0xbf, 0xbd])) ? text : text.replaceAll("�", "");
}

/** Reads every `.css` entry of a zip archive in central-directory order. */
function readZipCss(file: string): string[] {
  const zip = fs.readFileSync(file);
  let end = zip.length - 22;
  while (end >= 0 && zip.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error(`${file}: not a zip archive`);
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  const chunks: string[] = [];
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) throw new Error(`${file}: corrupt central directory`);
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString("utf8", offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;
    if (!name.endsWith(".css")) continue;
    const dataStart = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
    const data = zip.subarray(dataStart, dataStart + compressedSize);
    if (method === 0) chunks.push(decodeIgnoringErrors(data));
    else if (method === 8) chunks.push(decodeIgnoringErrors(zlib.inflateRawSync(data)));
    else throw new Error(`${file}: ${name} uses unsupported compression method ${method}`);
  }
  return chunks;
}

/** Orders paths segment by segment, as Python sorts pathlib paths. */
function comparePaths(a: string, b: string): number {
  const pa = a.split(path.sep);
  const pb = b.split(path.sep);
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return pa.length - pb.length;
}

function cssFilesUnder(dir: string): string[] {
  return (fs.readdirSync(dir, { recursive: true, encoding: "utf8" }) as string[])
    .filter((name) => name.endsWith(".css"))
    .sort(comparePaths)
    .map((name) => path.join(dir, name))
    .filter((file) => fs.statSync(file).isFile());
}

/** Reads a loose CSS file with the newline translation of Python's read_text. */
function readTextFile(file: string): string {
  return decodeIgnoringErrors(fs.readFileSync(file)).replace(/\r\n?/g, "\n");
}

export function readCssSources(spa?: string, cssDir?: string, cssFiles: string[] = []): string {
  const chunks: string[] = [];
  if (spa) chunks.push(...readZipCss(spa));
  if (cssDir) for (const file of cssFilesUnder(cssDir)) chunks.push(readTextFile(file));
  for (const file of cssFiles) chunks.push(readTextFile(file));
  if (!chunks.length) throw new Error("no CSS sources provided (use --spa, --css-dir, or --css)");
  return chunks.join("\n");
}

export function splitRules(source: string): [string, string][] {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: [string, string][] = [];
  let i = 0;
  const n = css.length;
  while (i < n) {
    const start = css.indexOf("{", i);
    if (start < 0) break;
    const selector = css.slice(i, start).trim();
    let depth = 1;
    let j = start + 1;
    while (j < n && depth) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    const body = css.slice(start + 1, j - 1);
    if (selector && !selector.startsWith("@")) rules.push([selector, body]);
    i = j;
  }
  return rules;
}

const GROUPING_AT_RULE = /^@(?:layer|media|supports|container|scope|document)\b/;

/**
 * Every style rule, including those nested in grouping at-rules such as
 * `@layer encore { ... }`, where Spotify ships its Encore component styles.
 * A statement at-rule (`@layer a, b;`) ends at its semicolon.
 */
export function allRules(source: string): [string, string][] {
  const rules: [string, string][] = [];
  for (const [prelude, body] of splitBlocks(source.replace(/\/\*[\s\S]*?\*\//g, ""))) {
    if (GROUPING_AT_RULE.test(prelude)) rules.push(...allRules(body));
    else if (!prelude.startsWith("@")) rules.push([prelude, body]);
  }
  return rules;
}

function splitBlocks(css: string): [string, string][] {
  const blocks: [string, string][] = [];
  let i = 0;
  while (i < css.length) {
    const start = css.indexOf("{", i);
    if (start < 0) break;
    const prelude = css.slice(i, start);
    let depth = 1;
    let j = start + 1;
    while (j < css.length && depth) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    const selector = prelude.slice(prelude.lastIndexOf(";") + 1).trim();
    if (selector) blocks.push([selector, css.slice(start + 1, j - 1)]);
    i = j;
  }
  return blocks;
}

function normalizeProps(body: string): Signature {
  const props: Signature = new Set();
  for (const m of body.matchAll(PROP_RE)) {
    const prop = m[1].trim().toLowerCase();
    const value = m[2].trim().toLowerCase().replace(/\s+/g, " ");
    if (prop.startsWith("--") || SKIPPED_PROPS.has(prop)) continue;
    props.add(`${prop}\0${value}`);
  }
  return props;
}

const signatureKey = (sig: Signature) => [...sig].sort().join("\u0001");

export function classSignatures(css: string): Signatures {
  const out: Signatures = new Map();
  for (const [selector, body] of splitRules(css)) {
    const props = normalizeProps(body);
    if (!props.size) continue;
    const key = signatureKey(props);
    for (const m of selector.matchAll(CLASS_RE)) {
      let sigs = out.get(m[1]);
      if (!sigs) out.set(m[1], (sigs = new Map()));
      sigs.set(key, props);
    }
  }
  return out;
}

export function inventoryClasses(css: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const [selector] of allRules(css)) {
    for (const m of selector.matchAll(CLASS_RE)) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  }
  return new Map([...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));
}

function jaccard(a: Signature, b: Signature): number {
  if (!a.size && !b.size) return 1;
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const item of a) if (b.has(item)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

export function loadCssMap(file?: string | null): Map<string, string> {
  if (!file) return new Map();
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (typeof data !== "object" || data === null || Array.isArray(data)) throw new Error("css-map must be a JSON object");
  return new Map(Object.entries(data).map(([k, v]) => [String(k), String(v)]));
}

// Path segment -> semantic tokens expected in css-map values.
const PATH_HINTS: Record<string, string[]> = {
  topbar: ["topbar", "topbarcontent", "globalnav"],
  playbar: ["nowplayingbar", "playercontrols", "playbackbar"],
  navbar: ["navbar", "navlink", "navitem", "yourlibraryx"],
  search_chips: ["searchcategory", "chip", "filterchips"],
  search_box: ["search", "filterbox", "searchinput", "globalnav"],
  widget_generator: ["embedwidgetgenerator", "embedwidget"],
  track_credits: ["trackcredits"],
  settings: ["settings", "desktopsettings"],
  sort_box: ["sortbox", "sortdropdown", "sort"],
  scrollable_text: ["marquee"],
  context_menu: ["contextmenu"],
  tracklist: ["tracklist"],
  chip: ["chip"],
  close: ["closebtn", "close"],
  menu_item: ["menuitem", "contextmenu"],
  expand_button: ["expandbutton", "searchinput"],
  upgrade_button: ["upgradebutton", "upgrade"],
  indicator: ["indicator"],
};

// Region segment -> required substrings in the lowercased full semantic name.
// Matching is against the full css-map value, not tokenized pieces, so
// "nowPlayingBar" and "actionBar" stay distinct.
const REGION_REQUIRED: Record<string, string[]> = {
  topbar: ["topbar", "globalnav"],
  playbar: ["nowplayingbar", "player-controls", "playercontrols", "playbackbar"],
  navbar: ["navbar", "navlink", "navitem", "yourlibraryx", "mainnav"],
  track_credits: ["trackcredits"],
  widget_generator: ["embedwidget"],
  settings: ["settings"],
  tracklist: ["tracklist"],
  search_chips: ["search", "chip", "filterchip"],
  search_box: ["search", "filterbox", "globalnav"],
  context_menu: ["contextmenu"],
  sort_box: ["sort"],
};

// If path contains the region, reject semantics that match these substrings.
const REGION_FORBIDDEN: Record<string, string[]> = {
  playbar: ["actionbar", "tracklist", "watchfeed", "entityheader", "rowplay", "rowimage"],
  topbar: ["actionbar", "entityheader", "watchfeed"],
  settings: ["equalizer", "nowplayingview", "actionbar"],
  widget_generator: ["watchfeed", "filterbox", "sortbox"],
  search_chips: ["nowplaying", "actionbar", "tracklist"],
  search_box: ["yourlibrary", "actionbar", "tracklist"],
  navbar: ["topbar", "nowplaying", "actionbar"],
  tracklist: ["actionbar", "nowplayingbar", "globalnav"],
  context_menu: ["settings", "equalizer", "sortbox"],
};

// Leaf segment requirements against full semantic string.
const LEAF_REQUIRED: Record<string, string[]> = {
  close: ["close"],
  content: ["content", "body", "iframe", "code"],
  header: ["header", "title"],
  chip: ["chip"],
  indicator: ["indicator", "active", "playing"],
  expand_button: ["expand", "search", "filter", "clear"],
};

// Leaf forbidden when this leaf is the path tail.
const LEAF_FORBIDDEN: Record<string, string[]> = {
  content: ["close"], // content container must not resolve to closeBtn only
};

function lookup<T>(table: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}

const GENERIC_SEGMENTS = new Set(["main", "wrapper", "container", "button", "left", "right", "list", "button_t"]);

/** Lowercase and strip separators so nowPlayingBar -> nowplayingbar. */
function normalizeSemantic(name: string): string {
  return name.replace(/[-_.\s]+/g, "").toLowerCase();
}

function pathSegments(parts: string[]): string[] {
  return parts.map((seg) => seg.split("__")[0]);
}

/**
 * Return 0..1 agreement between a nested classmap path and a css-map name.
 *
 * Uses full-string substring checks (not bag-of-tokens) so ActionBar cannot
 * satisfy a playbar requirement meant for nowPlayingBar.
 */
export function semanticFit(parts: string[], semantic: string): number {
  if (!semantic) return 0;
  const segs = pathSegments(parts);
  const full = normalizeSemantic(semantic);
  const rawLower = semantic.toLowerCase();

  for (const seg of segs) {
    const forbidden = lookup(REGION_FORBIDDEN, seg);
    if (forbidden?.some((f) => full.includes(f))) return 0;
    const required = lookup(REGION_REQUIRED, seg);
    if (required && !required.some((r) => full.includes(r.replaceAll("-", "")) || rawLower.includes(r))) return 0;
  }

  for (const [i, seg] of segs.entries()) {
    const isTail = i === segs.length - 1;
    // For non-tail "content", still require content-ish names
    if (seg === "content") {
      if (!["content", "body", "iframe", "code"].some((x) => full.includes(x))) return 0;
      // pure close button is never a content node
      if (full.includes("close") && !full.includes("content")) return 0;
    }
    if (isTail) {
      const required = lookup(LEAF_REQUIRED, seg);
      if (required && !required.some((r) => full.includes(r))) return 0;
      const forbidden = lookup(LEAF_FORBIDDEN, seg);
      if (forbidden?.some((f) => full.includes(f)) && !(required ?? []).some((r) => full.includes(r))) return 0;
    }
  }

  // Score: count how many specific path segments are reflected in the name.
  let specific = segs.filter((s) => !GENERIC_SEGMENTS.has(s));
  if (!specific.length) specific = segs.slice(-1);

  let hits = 0;
  for (const s of specific) {
    const hints = new Set([...(lookup(PATH_HINTS, s) ?? [s.replaceAll("_", "")]), s.replaceAll("_", ""), s]);
    if ([...hints].some((h) => Array.from(h).length >= 3 && (full.includes(normalizeSemantic(h)) || rawLower.includes(h.toLowerCase())))) {
      hits++;
    }
  }
  if (!hits) return 0;
  return Math.min(1, hits / Math.max(1, specific.length));
}

function pathHintTokens(parts: string[]): Set<string> {
  const hints = new Set<string>();
  for (const seg of pathSegments(parts)) {
    hints.add(seg.toLowerCase().replaceAll("-", "").replaceAll("_", ""));
    for (const hint of lookup(PATH_HINTS, seg) ?? []) hints.add(hint);
  }
  return hints;
}

function cssSimilarity(src?: Map<string, Signature>, tgt?: Map<string, Signature>): number {
  if (!src?.size || !tgt?.size) return 0;
  let best = 0;
  for (const s of src.values()) for (const t of tgt.values()) best = Math.max(best, jaccard(s, t));
  return best;
}

const hasStrictRegion = (parts: string[]) => pathSegments(parts).some((seg) => Object.hasOwn(REGION_REQUIRED, seg));

function scoreCandidate(parts: string[], cand: string, src: Map<string, Signature>, target: Signatures, cssMap: Map<string, string>): Row {
  const cssScore = cssSimilarity(src, target.get(cand));
  const inMap = cssMap.has(cand);
  const semantic = cssMap.get(cand) ?? "";
  const semScore = semantic ? semanticFit(parts, semantic) : 0;

  // Combined score: css similarity is base; css-map presence and semantic agreement boost.
  let score = cssScore;
  if (inMap && semScore > 0) score += 0.15;
  if (semScore > 0) score += 0.45 * semScore;
  else {
    // css-map hit with zero semantic fit is usually a false friend.
    if (inMap && cssScore >= 0.5) score -= 0.35;
    // For strict regions (playbar/topbar/...), refuse pure CSS matches
    // without semantic agreement — that is how actionBar leaks in.
    if (hasStrictRegion(parts)) score = Math.min(score, cssScore * 0.25);
  }

  return {
    class: cand,
    score: pyRound(Math.max(0, Math.min(score, 1.5)), 4),
    css_score: pyRound(cssScore, 4),
    semantic_score: pyRound(semScore, 4),
    in_css_map: inMap,
    semantic: semantic || null,
  };
}

function bestMatch(
  parts: string[],
  src: Map<string, Signature>,
  target: Signatures,
  targetIndex: Map<string, Set<string>>,
  cssMap: Map<string, string>,
  threshold: number,
): Row | null {
  if (!src.size) return null;

  const candidates = new Set<string>();
  for (const key of src.keys()) for (const cls of targetIndex.get(key) ?? []) candidates.add(cls);

  // Always consider css-map keys that have decent semantic overlap as
  // candidates, but only when they actually exist in the target CSS:
  // a css-map entry with zero target presence has no evidence behind it.
  if (pathHintTokens(parts).size && cssMap.size) {
    for (const [h, sem] of cssMap) {
      if (isHashLike(h) && target.has(h) && semanticFit(parts, sem) >= 0.5) candidates.add(h);
    }
  }

  // Candidates are visited in name order so ties rank the same on every run.
  const pool = [...(candidates.size ? candidates : target.keys())].sort();
  const scored = pool.filter((cand) => isHashLike(cand) && target.has(cand)).map((cand) => scoreCandidate(parts, cand, src, target, cssMap));
  if (!scored.length) return null;
  const num = (row: Row, field: string) => row[field] as number;
  scored.sort(
    (a, b) => num(b, "score") - num(a, "score") || num(b, "semantic_score") - num(a, "semantic_score") || num(b, "css_score") - num(a, "css_score"),
  );
  const best = scored[0];
  // Require either solid css match or solid semantic agreement.
  // Strict regions need semantic_score > 0 to avoid actionBar/etc. leaks.
  if (num(best, "score") < threshold) return { ...best, rejected: true, next: scored.slice(1, 4) };
  if (hasStrictRegion(parts) && num(best, "semantic_score") <= 0) {
    return { ...best, rejected: true, reason: "strict region requires semantic agreement", next: scored.slice(1, 4) };
  }
  if (num(best, "semantic_score") <= 0 && num(best, "css_score") < 0.75) return { ...best, rejected: true, next: scored.slice(1, 4) };
  // An exact tie gives no evidence for either class, so the leaf is left for a human to decide.
  const same = (row: Row) => ["score", "semantic_score", "css_score"].every((field) => row[field] === best[field]);
  const tied = scored
    .slice(1)
    .filter(same)
    .map((row) => row.class as string);
  if (tied.length) return { ...best, rejected: true, reason: `tied with ${tied.length} other candidate(s)`, tied, next: scored.slice(1, 4) };
  return { ...best, alternatives: scored.slice(1, 4) };
}

function buildTargetIndex(target: Signatures): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const [cls, sigs] of target) {
    for (const key of sigs.keys()) {
      let classes = index.get(key);
      if (!classes) index.set(key, (classes = new Set()));
      classes.add(cls);
    }
  }
  return index;
}

export function iterLeaves(node: unknown, parts: string[] = []): [string[], string][] {
  if (typeof node === "string") return [[parts, node]];
  if (typeof node !== "object" || node === null || Array.isArray(node)) return [];
  return Object.entries(node).flatMap(([key, value]) => iterLeaves(value, [...parts, key]));
}

function setLeaf(root: Classmap, parts: string[], value: string): void {
  let cur = root;
  for (const key of parts.slice(0, -1)) {
    const next = cur[key];
    if (typeof next === "object") cur = next;
    else cur = cur[key] = {};
  }
  cur[parts.at(-1) as string] = value;
}

export function migrateClassmap(
  baseMap: Classmap,
  baseSigs: Signatures,
  targetSigs: Signatures,
  cssMap: Map<string, string>,
  threshold: number,
): [Classmap, Required<Report>] {
  const targetIndex = buildTargetIndex(targetSigs);
  const out: Classmap = structuredClone(baseMap);
  const report: Required<Report> = { matched: [], unmatched: [], identity: [], stats: {} };

  const leaves = iterLeaves(baseMap);
  let matched = 0;
  let identity = 0;
  for (const [parts, oldHash] of leaves) {
    const dotted = parts.join(".");

    if (targetSigs.has(oldHash) && isHashLike(oldHash)) {
      setLeaf(out, parts, oldHash);
      report.identity.push({
        path: dotted,
        class: oldHash,
        in_css_map: cssMap.has(oldHash),
        semantic: cssMap.get(oldHash) ?? null,
        method: "identity",
      });
      identity++;
      matched++;
      continue;
    }

    const src = baseSigs.get(oldHash);
    if (!src?.size) {
      // No base CSS signature for the old class. Fall back to a
      // semantic-only match via css-map, with a higher bar (0.75)
      // because there is zero CSS similarity evidence behind it.
      let bestSem: [string, string, number] | null = null;
      let bestScore = 0;
      let tied: string[] = [];
      for (const [h, sem] of cssMap) {
        if (!targetSigs.has(h) || !isHashLike(h)) continue;
        const s = semanticFit(parts, sem);
        if (s > bestScore) {
          bestScore = s;
          bestSem = [h, sem, s];
          tied = [];
        } else if (s === bestScore && bestSem) {
          tied.push(h);
        }
      }
      if (bestSem && bestScore >= 0.75 && tied.length) {
        report.unmatched.push({
          path: dotted,
          old: oldHash,
          reason: `${tied.length + 1} semantic-only candidates tie`,
          tied: [bestSem[0], ...tied],
          stale: true,
          kept: oldHash,
        });
        setLeaf(out, parts, oldHash);
        continue;
      }
      if (bestSem && bestScore >= 0.75) {
        const [newCls, sem, s] = bestSem;
        setLeaf(out, parts, newCls);
        report.matched.push({
          path: dotted,
          old: oldHash,
          new: newCls,
          score: pyRound(0.2 + 0.5 * s, 4),
          css_score: 0,
          semantic_score: pyRound(s, 4),
          in_css_map: true,
          semantic: sem,
          method: "semantic-only",
          css_evidence: false,
        });
        matched++;
        continue;
      }
      report.unmatched.push({ path: dotted, old: oldHash, reason: "old class not found in base CSS", stale: true, kept: oldHash });
      setLeaf(out, parts, oldHash);
      continue;
    }

    const best = bestMatch(parts, src, targetSigs, targetIndex, cssMap, threshold);
    if (!best || best.rejected) {
      report.unmatched.push({ path: dotted, old: oldHash, reason: "no confident target", best, stale: true, kept: oldHash });
      setLeaf(out, parts, oldHash);
      continue;
    }

    setLeaf(out, parts, best.class as string);
    report.matched.push({
      path: dotted,
      old: oldHash,
      new: best.class,
      score: best.score,
      css_score: best.css_score,
      semantic_score: best.semantic_score,
      in_css_map: best.in_css_map,
      semantic: best.semantic,
      method: "css+semantic",
      alternatives: best.alternatives ?? [],
    });
    matched++;
  }

  report.stats = {
    leaves: leaves.length,
    matched,
    identity,
    migrated: matched - identity,
    unmatched: leaves.length - matched,
    stale_kept: leaves.length - matched,
    match_rate: leaves.length ? pyRound(matched / leaves.length, 4) : 0,
    threshold,
    css_map_entries: cssMap.size,
    matched_in_css_map: report.matched.filter((m) => m.in_css_map).length,
  };
  return [out, report];
}

export function versionToKey(version: string): string {
  const parts = version.trim().split(".");
  if (parts.length < 3 || !parts.slice(0, 3).every((p) => /^\d+$/.test(p))) {
    throw new Error(`need major.minor.patch, got ${JSON.stringify(version)}`);
  }
  const [major, minor, patch] = parts.slice(0, 3).map(Number);
  return `${major}${String(minor).padStart(2, "0")}${String(patch).padStart(4, "0")}`;
}

export function confidenceLabel(m: Row): string {
  // Class survived unchanged in the target CSS: strongest evidence.
  if (m.method === "identity") return "high";
  const sem = (m.semantic_score as number) || 0;
  const css = (m.css_score as number) || 0;
  const inMap = Boolean(m.in_css_map);
  // No CSS similarity evidence at all (semantic-only guess).
  if (css === 0) return "low";
  if (inMap && sem >= 0.5 && css >= 0.35) return "high";
  if (inMap && sem >= 0.5) return "medium-semantic";
  if (css >= 0.75 && isHashLike(((m.new || m.class) as string) || "")) return "medium-css";
  if (css >= 0.55) return "low";
  return "reject";
}

export function verifyClassmap(
  classmap: Classmap,
  targetCss: string,
  cssMap: Map<string, string>,
  report: Report | null = null,
  targetVersion: string | null = null,
  classmapSha256: string | null = null,
): { target: Row; summary: Record<string, number>; rows: Row[] } {
  const targetSigs = classSignatures(targetCss);
  const inventory = inventoryClasses(targetCss);
  const matchedRows = report ? [...(report.matched ?? []), ...(report.identity ?? [])] : [];

  const rows = iterLeaves(classmap).map(([parts, cls]) => {
    const dotted = parts.join(".");
    const classes = cls.split(/\s+/).filter(Boolean);
    const semantics = classes.filter((token) => cssMap.has(token)).map((token) => cssMap.get(token) as string);
    const missingClasses = classes.filter((token) => !targetSigs.has(token) && !inventory.has(token));
    const row: Row = {
      path: dotted,
      class: cls,
      classes,
      missing_classes: missingClasses,
      in_target_css: !missingClasses.length,
      css_rule_count: classes.reduce((sum, token) => sum + (targetSigs.get(token)?.size ?? 0), 0),
      selector_hits: classes.reduce((sum, token) => sum + (inventory.get(token) ?? 0), 0),
      in_css_map: semantics.length > 0,
      semantics,
      semantic: cssMap.get(cls) || (semantics.length ? semantics.join(" ") : null),
      semantic_score: pyRound(Math.max(0, ...semantics.map((name) => semanticFit(parts, name))), 4),
    };
    if (report) {
      const m = matchedRows.find((entry) => entry.path === dotted);
      if (m) {
        row.migrate_score = m.score ?? null;
        row.migrate_confidence = (m.confidence as string) || confidenceLabel(m);
        row.method = m.method ?? null;
      } else {
        // unmatched leaves keep old hash often
        row.migrate_confidence = "unmatched-or-stale";
      }
    }
    const confidence = row.migrate_confidence as string | undefined;
    if (row.in_css_map && (row.semantic_score as number) >= 0.5 && row.in_target_css && (confidence === "high" || confidence === "medium-semantic")) {
      row.verdict = "likely_good";
    } else if (row.in_target_css && ["high", "medium-semantic", "medium-css"].includes(confidence ?? "")) {
      row.verdict = "plausible";
    } else if (!row.in_target_css) {
      row.verdict = "missing_in_css";
    } else {
      row.verdict = "needs_manual_check";
    }
    return row;
  });

  const summary: Record<string, number> = {};
  for (const row of rows) summary[row.verdict as string] = (summary[row.verdict as string] ?? 0) + 1;
  return {
    target: {
      spotify_version: targetVersion,
      css_sha256: crypto.createHash("sha256").update(targetCss, "utf8").digest("hex"),
      classmap_sha256: classmapSha256,
    },
    summary,
    rows,
  };
}

/**
 * Bridge a nested classmap into a flat css-map overlay (hash -> semantic).
 *
 * The semantic name for a leaf is the name themes already target, resolved
 * in priority order:
 *   1. css-map name of the BASE classmap's hash at the same path (the
 *      established, theme-facing name for that component),
 *   2. the migrate report's semantic for the path.
 * Leaves whose new hash is already in the global css-map are skipped: the
 * global map already rewrites them, so the overlay only carries verified
 * per-version corrections the global map lacks. Leaves with no resolvable
 * semantic are skipped with a warning. Stale leaves and leaves not yet
 * verified (per META.json) are skipped; an unverified required path is a
 * loud warning.
 */
export function flattenClassmap(
  classmap: Classmap,
  baseMap: Classmap | null,
  cssMap: Map<string, string>,
  report: Report | null,
  meta: Record<string, unknown> | null,
): [Record<string, string>, string[]] {
  const stale = new Set<string>((meta?.stale_leaves as string[]) ?? []);
  const unverified = new Set<string>((meta?.unverified_leaves as string[]) ?? []);
  for (const u of report?.unmatched ?? []) if (u.stale) stale.add((u.path as string) ?? "");

  const baseAt = new Map(baseMap ? iterLeaves(baseMap).map(([parts, h]) => [parts.join("."), h]) : []);
  const reportSemantic = new Map<string, string>();
  for (const m of [...(report?.matched ?? []), ...(report?.identity ?? [])]) {
    if (m.semantic) reportSemantic.set((m.path as string) ?? "", m.semantic as string);
  }

  const overlay: Record<string, string> = {};
  const skipped: string[] = [];
  for (const [parts, h] of iterLeaves(classmap)) {
    const dotted = parts.join(".");
    if (stale.has(dotted) || unverified.has(dotted)) continue;
    if (!isHashLike(h)) {
      skipped.push(`${dotted}: '${h}' not hash-like`);
      continue;
    }
    if (cssMap.has(h)) continue;
    const semantic = cssMap.get(baseAt.get(dotted) ?? "") || reportSemantic.get(dotted);
    if (!semantic) {
      skipped.push(`${dotted}: no semantic name for ${h}`);
      continue;
    }
    if (Object.hasOwn(overlay, h) && overlay[h] !== semantic) {
      skipped.push(`${dotted}: ${h} already named '${overlay[h]}', ignoring conflicting '${semantic}'`);
      continue;
    }
    overlay[h] = semantic;
  }

  for (const [leaf, status] of Object.entries((meta?.required_paths as Record<string, unknown>) ?? {})) {
    if (!String(status).startsWith("verified")) skipped.push(`WARNING: required path ${leaf} is ${String(status)}`);
  }
  return [overlay, skipped];
}

function sortedKeys(value: Json): Json {
  if (Array.isArray(value)) return value.map(sortedKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortedKeys(value[key])]),
    );
  }
  return value;
}

function writeJson(file: string, value: unknown, sortKeys = false): void {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(sortKeys ? sortedKeys(value as Json) : value, null, 2)}\n`);
}

/** Formats a report value for console output. */
function text(value: Json | undefined): string {
  return typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
}

const readJson = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));

const cssMapPath = (value: string | undefined) => (value === "" ? null : value);

const COMMANDS: Record<string, (argv: string[]) => number> = {
  inventory(argv) {
    const { values } = parseArgs({
      args: argv,
      options: {
        spa: { type: "string" },
        "css-dir": { type: "string" },
        css: { type: "string", multiple: true },
        top: { type: "string", default: "40" },
        out: { type: "string" },
      },
    });
    const counts = inventoryClasses(readCssSources(values.spa, values["css-dir"], values.css));
    const items = [...counts].filter(([cls]) => isHashLike(cls));
    console.log(`hash-like classes: ${items.length} (of ${counts.size} selector tokens)`);
    for (const [cls, n] of items.slice(0, Number(values.top))) console.log(`${String(n).padStart(5)}  ${cls}`);
    if (values.out) {
      writeJson(values.out, Object.fromEntries(items));
      console.log(`wrote ${values.out}`);
    }
    return 0;
  },

  migrate(argv) {
    const { values } = parseArgs({
      args: argv,
      options: {
        "base-classmap": { type: "string" },
        "base-spa": { type: "string" },
        "base-css-dir": { type: "string" },
        "base-css": { type: "string", multiple: true },
        "target-spa": { type: "string" },
        "target-css-dir": { type: "string" },
        "target-css": { type: "string", multiple: true },
        "css-map": { type: "string", default: "css-map.json" },
        out: { type: "string" },
        report: { type: "string" },
        threshold: { type: "string", default: "0.5" },
        "allow-partial": { type: "boolean", default: false },
      },
    });
    if (!values["base-classmap"] || !values.out) throw new Error("migrate requires --base-classmap and --out");
    const baseMap: Classmap = readJson(values["base-classmap"]);
    const baseCss = readCssSources(values["base-spa"], values["base-css-dir"], values["base-css"]);
    const targetCss = readCssSources(values["target-spa"], values["target-css-dir"], values["target-css"]);
    const cssMap = loadCssMap(cssMapPath(values["css-map"]));

    console.log("Parsing base CSS signatures…");
    const baseSigs = classSignatures(baseCss);
    console.log(`  base classes with signatures: ${baseSigs.size}`);
    console.log("Parsing target CSS signatures…");
    const targetSigs = classSignatures(targetCss);
    console.log(`  target classes with signatures: ${targetSigs.size}`);
    console.log(`  css-map entries: ${cssMap.size}`);

    const [migrated, report] = migrateClassmap(baseMap, baseSigs, targetSigs, cssMap, Number(values.threshold));
    for (const m of report.matched) m.confidence = confidenceLabel(m);

    writeJson(values.out, migrated, true);
    console.log(`wrote classmap ${values.out}`);
    if (values.report) {
      writeJson(values.report, report);
      console.log(`wrote report ${values.report}`);
    }

    const stats = report.stats;
    console.log(
      `stats: leaves=${text(stats.leaves)} matched=${text(stats.matched)} identity=${text(stats.identity)} migrated=${text(stats.migrated)} ` +
        `unmatched=${text(stats.unmatched)} rate=${text(stats.match_rate)} in_css_map=${text(stats.matched_in_css_map)}`,
    );
    if (stats.stale_kept) {
      console.log(`warning: ${text(stats.stale_kept)} leaves kept their old (stale) hash; see report.unmatched entries marked stale=true`);
    }
    const confidence: Record<string, number> = {};
    for (const m of report.matched) confidence[m.confidence as string] = (confidence[m.confidence as string] ?? 0) + 1;
    console.log("confidence:", JSON.stringify(confidence));
    return stats.unmatched === 0 || values["allow-partial"] ? 0 : 1;
  },

  verify(argv) {
    const { values } = parseArgs({
      args: argv,
      options: {
        classmap: { type: "string" },
        report: { type: "string" },
        "css-map": { type: "string", default: "css-map.json" },
        "target-spa": { type: "string" },
        "target-css-dir": { type: "string" },
        "target-css": { type: "string", multiple: true },
        out: { type: "string" },
        "target-version": { type: "string" },
      },
    });
    if (!values.classmap) throw new Error("verify requires --classmap");
    const cssMap = loadCssMap(cssMapPath(values["css-map"]));
    const targetCss = readCssSources(values["target-spa"], values["target-css-dir"], values["target-css"]);
    const report: Report | null = values.report ? readJson(values.report) : null;
    const classmapBytes = fs.readFileSync(values.classmap);
    const out = verifyClassmap(
      JSON.parse(classmapBytes.toString("utf8")),
      targetCss,
      cssMap,
      report,
      values["target-version"] ?? null,
      crypto.createHash("sha256").update(classmapBytes).digest("hex"),
    );
    if (values.out) {
      writeJson(values.out, out);
      console.log(`wrote ${values.out}`);
    }

    console.log("verify summary:", JSON.stringify(out.summary));
    console.log();
    console.log(`${"VERDICT".padEnd(20)} ${"CONF".padEnd(16)} ${"PATH".padEnd(45)} CLASS -> semantic`);
    const sortKey = (r: Row) => [text(r.verdict), text(r.path)];
    const byVerdictThenPath = (a: Row, b: Row) => {
      const [ka, kb] = [sortKey(a), sortKey(b)];
      return ka[0] !== kb[0] ? (ka[0] < kb[0] ? -1 : 1) : ka[1] < kb[1] ? -1 : ka[1] > kb[1] ? 1 : 0;
    };
    for (const r of [...out.rows].sort(byVerdictThenPath)) {
      console.log(
        `${text(r.verdict).padEnd(20)} ${text(r.migrate_confidence ?? "-").padEnd(16)} ${text(r.path).padEnd(45)} ` +
          `${text(r.class)} -> ${text(r.semantic || "-")}  (sem=${text(r.semantic_score)}, css_hits=${text(r.selector_hits)})`,
      );
    }
    return 0;
  },

  flatten(argv) {
    const { values } = parseArgs({
      args: argv,
      options: {
        classmap: { type: "string" },
        "base-classmap": { type: "string" },
        "css-map": { type: "string", default: "css-map.json" },
        report: { type: "string" },
        meta: { type: "string" },
        out: { type: "string" },
        "allow-partial": { type: "boolean", default: false },
      },
    });
    if (!values.classmap || !values.out) throw new Error("flatten requires --classmap and --out");
    const [overlay, skipped] = flattenClassmap(
      readJson(values.classmap),
      values["base-classmap"] ? readJson(values["base-classmap"]) : null,
      loadCssMap(cssMapPath(values["css-map"])),
      values.report ? readJson(values.report) : null,
      values.meta ? readJson(values.meta) : null,
    );
    writeJson(values.out, overlay, true);
    console.log(`wrote ${values.out} (${Object.keys(overlay).length} overlay entries)`);
    for (const s of skipped) console.log(`  skipped: ${s}`);
    return skipped.length && !values["allow-partial"] ? 1 : 0;
  },

  devtools(argv) {
    const { values } = parseArgs({ args: argv, options: { report: { type: "string" } } });
    if (!values.report) throw new Error("devtools requires --report");
    const report: Report = readJson(values.report);
    const matched = [...(report.matched ?? []), ...(report.identity ?? [])];
    if (!matched.length) {
      console.log("no matched entries in report");
      return 1;
    }
    console.log("// Paste into Spotify DevTools console (Ctrl+Shift+I / Cmd+Opt+I)");
    console.log("// Requires spicetify enable-devtools or employee/devtools flags.");
    console.log("(function verifyClassmapMatches() {");
    console.log("  const checks = [");
    for (const m of matched) {
      const cls = JSON.stringify(m.new || m.class);
      const confidence = JSON.stringify((m.confidence as string) || confidenceLabel(m));
      console.log(`    { path: ${JSON.stringify(m.path)}, cls: ${cls}, confidence: ${confidence} },`);
    }
    console.log("  ];");
    console.log(`  const rows = checks.map(({path, cls, confidence}) => {
    const nodes = document.getElementsByClassName(cls);
    let sample = null;
    if (nodes[0]) {
      const el = nodes[0];
      sample = {
        tag: el.tagName,
        id: el.id || null,
        aria: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || null,
        text: (el.textContent || '').trim().slice(0, 60),
        parent: el.parentElement && el.parentElement.className,
      };
    }
    return { path, cls, confidence, count: nodes.length, sample };
  });
  console.table(rows.map(r => ({
    path: r.path,
    cls: r.cls,
    confidence: r.confidence,
    count: r.count,
    tag: r.sample && r.sample.tag,
    text: r.sample && r.sample.text,
  })));
  console.log('Full detail', rows);
  return rows;
})();`);
    console.log();
    console.log("// Tip: count===0 means the class is not in the current DOM (may be route-specific).");
    console.log("// Tip: open Home / Now Playing / Settings / a modal before running.");
    return 0;
  },

  key(argv) {
    const { positionals } = parseArgs({ args: argv, allowPositionals: true, options: {} });
    if (positionals.length !== 1) throw new Error("key requires one Spotify version");
    console.log(versionToKey(positionals[0]));
    return 0;
  },
};

export function main(argv: string[]): number {
  const [command, ...rest] = argv;
  const run = command ? COMMANDS[command] : undefined;
  if (!run) {
    const header = fs.readFileSync(import.meta.filename, "utf8").split("*/")[0];
    console.log(header.replace(/^#!.*\n\/\*\*\n/, "").replace(/^ \* ?/gm, ""));
    return command && command !== "--help" && command !== "-h" ? 2 : 0;
  }
  try {
    return run(rest);
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    return 1;
  }
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
