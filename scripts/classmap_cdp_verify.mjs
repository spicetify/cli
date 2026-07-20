#!/usr/bin/env node
/**
 * E2E classmap verification against a live Spotify desktop client via CDP.
 *
 * Requires Node.js >= 22 (uses the global WebSocket client).
 *
 * Prerequisites
 * -------------
 * 1. Spicetify applied (for classic/semantic mode) or stock client (hash mode)
 * 2. Remote debugging enabled:
 *      spotify_launch_flags = --remote-debugging-port=9222
 *    (edit config-xpui.ini; `spicetify config` cannot set this field.
 *    --remote-allow-origins is NOT needed: this script connects without an
 *    Origin header, which Chrome allows by default.)
 * 3. Start Spotify via: spicetify restart
 *
 * Usage
 * -----
 *   node scripts/classmap_cdp_verify.mjs --out-dir classmaps/1020092
 *   node scripts/classmap_cdp_verify.mjs --port 9222 --mode both --out-dir classmaps/1020092
 *   node scripts/classmap_cdp_verify.mjs --report <report.json> --classmap <classmap.json> --out <cdp-report.json>
 *   CLASSMAP_OUT_DIR=classmaps/1020092 node scripts/classmap_cdp_verify.mjs --navigate --min-hit-rate 0.3
 *
 * Paths
 * -----
 *   --report/--classmap/--out may be given explicitly, or derived from
 *   --out-dir / CLASSMAP_OUT_DIR as report.json, classmap.json and
 *   cdp-e2e-report.json inside that directory. One of the two is required.
 *
 * Exit codes
 * ----------
 *   0  hit rate >= --min-hit-rate
 *   1  CDP/runtime failure
 *   2  hit rate below threshold
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = {
    port: 9222,
    host: "127.0.0.1",
    mode: "both", // hash | semantic | both
    outDir: process.env.CLASSMAP_OUT_DIR || null,
    report: null,
    classmap: null,
    cssMap: path.join(CLI_ROOT, "css-map.json"),
    out: null,
    navigate: false,
    deep: false,
    restart: false,
    minHitRate: 0.25,
    timeoutMs: 15000,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    const take = () => {
      i++;
      return next;
    };
    switch (a) {
      case "--port":
        args.port = Number(take());
        break;
      case "--host":
        args.host = take();
        break;
      case "--mode":
        args.mode = take();
        break;
      case "--report":
        args.report = path.resolve(take());
        break;
      case "--classmap":
        args.classmap = path.resolve(take());
        break;
      case "--css-map":
        args.cssMap = path.resolve(take());
        break;
      case "--out":
        args.out = path.resolve(take());
        break;
      case "--out-dir":
        args.outDir = path.resolve(take());
        break;
      case "--navigate":
        args.navigate = true;
        break;
      case "--deep":
        args.navigate = true;
        args.deep = true;
        break;
      case "--restart":
        args.restart = true;
        break;
      case "--min-hit-rate":
        args.minHitRate = Number(take());
        break;
      case "--timeout-ms":
        args.timeoutMs = Number(take());
        break;
      case "-h":
      case "--help":
        args.help = true;
        break;
      default:
        if (a.startsWith("-")) throw new Error(`Unknown flag: ${a}`);
    }
  }
  // Derive report/classmap/out from --out-dir when not given explicitly.
  if (!args.report || !args.classmap || !args.out) {
    if (!args.outDir) {
      throw new Error(
        "Pass --report/--classmap/--out explicitly, or set --out-dir (or CLASSMAP_OUT_DIR) " +
          "to derive them as <out-dir>/{report,classmap,cdp-e2e-report}.json",
      );
    }
    args.report ??= path.join(args.outDir, "report.json");
    args.classmap ??= path.join(args.outDir, "classmap.json");
    args.out ??= path.join(args.outDir, "cdp-e2e-report.json");
  }
  return args;
}

function httpGetJson(url, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(d));
        } catch (e) {
          reject(new Error(`Invalid JSON from ${url}: ${e.message}`));
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForCdp(host, port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const version = await httpGetJson(`http://${host}:${port}/json/version`);
      const targets = await httpGetJson(`http://${host}:${port}/json`);
      return { version, targets };
    } catch (e) {
      lastErr = e;
      await sleep(500);
    }
  }
  throw new Error(
    `CDP not reachable at http://${host}:${port} within ${timeoutMs}ms` +
      (lastErr ? ` (${lastErr.message})` : "") +
      `\nStart Spotify with remote debugging:\n` +
      `  1. Set in ~/.config/spicetify/config-xpui.ini:\n` +
      `       spotify_launch_flags = --remote-debugging-port=${port}\n` +
      `  2. spicetify restart\n`,
  );
}

function pickXpuiTarget(targets) {
  const pages = targets.filter((t) => t.type === "page");
  return (
    pages.find((t) => (t.url || "").includes("xpui.app.spotify.com")) ||
    pages.find((t) => (t.url || "").includes("index.html")) ||
    pages[0]
  );
}

function loadChecks({ reportPath, classmapPath, cssMapPath }) {
  const cssMap = fs.existsSync(cssMapPath)
    ? JSON.parse(fs.readFileSync(cssMapPath, "utf8"))
    : {};

  /** @type {{path:string, hash:string, semantic:string|null, confidence:string}[]} */
  let checks = [];

  if (fs.existsSync(reportPath)) {
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    for (const m of [...(report.matched || []), ...(report.identity || [])]) {
      const hash = m.new || m.class;
      checks.push({
        path: m.path,
        hash,
        semantic: cssMap[hash] || null,
        confidence: m.confidence || "",
      });
    }
  } else if (fs.existsSync(classmapPath)) {
    const classmap = JSON.parse(fs.readFileSync(classmapPath, "utf8"));
    const walk = (node, parts = []) => {
      if (node && typeof node === "object" && !Array.isArray(node)) {
        for (const [k, v] of Object.entries(node)) walk(v, [...parts, k]);
      } else if (typeof node === "string") {
        checks.push({
          path: parts.join("."),
          hash: node,
          semantic: cssMap[node] || null,
          confidence: "",
        });
      }
    };
    walk(classmap);
  } else {
    throw new Error(`No report (${reportPath}) or classmap (${classmapPath}) found`);
  }

  // de-dupe by path
  const byPath = new Map();
  for (const c of checks) byPath.set(c.path, c);
  return [...byPath.values()];
}

class CdpSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve);
      this.ws.addEventListener("error", reject);
    });
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(Object.assign(new Error(msg.error.message), msg.error));
        else resolve(msg.result);
      }
    });
    await this.call("Runtime.enable");
    await this.call("Page.enable").catch(() => {});
  }

  call(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.call("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      const text =
        result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text ||
        "evaluate failed";
      throw new Error(text);
    }
    return result.result?.value;
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
  }
}

/** Shared helpers injected into page for navigation recipes. */
const NAV_HELPERS = `
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const visible = (el) => {
    if (!el) return false;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const click = (el) => {
    if (!el) return false;
    el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true, view: window }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    el.click();
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    return true;
  };
  const findClickable = (preds) => {
    const nodes = $$("a,button,[role='link'],[role='button'],[data-testid]");
    for (const pred of preds) {
      const hit = nodes.find((el) => visible(el) && pred(el));
      if (hit) return hit;
    }
    return null;
  };
  const textOf = (el) => ((el.getAttribute("aria-label") || "") + " " + (el.textContent || "")).trim();
  const navigateSpa = (pathname) => {
    try {
      // Spicetify / Spotify platform history if present
      const hist =
        window.Spicetify?.Platform?.History ||
        window.Spicetify?.Platform?.PlayerAPI?._history ||
        null;
      if (hist?.push) {
        hist.push(pathname);
        return "platform-history:" + pathname;
      }
    } catch {}
    try {
      history.pushState({}, "", pathname);
      window.dispatchEvent(new PopStateEvent("popstate"));
      return "pushState:" + pathname;
    } catch {
      return "nav-failed:" + pathname;
    }
  };
`;

const NAV_STEPS = [
  {
    name: "home",
    waitMs: 1000,
    expr: `(() => {
      ${NAV_HELPERS}
      const el = findClickable([
        (e) => e.getAttribute("data-testid") === "home-button" || e.getAttribute("data-testid") === "global-nav-home",
        (e) => /\\bhome\\b/i.test(textOf(e)) && e.tagName === "A",
        (e) => (e.getAttribute("href") || "") === "/" || (e.getAttribute("href") || "").endsWith("/home"),
      ]);
      if (click(el)) return "clicked-home";
      return navigateSpa("/");
    })()`,
  },
  {
    name: "search",
    waitMs: 1200,
    expr: `(() => {
      ${NAV_HELPERS}
      const el = findClickable([
        (e) => (e.getAttribute("data-testid") || "").includes("search"),
        (e) => /\\bsearch\\b/i.test(textOf(e)),
        (e) => (e.getAttribute("href") || "").includes("/search"),
      ]);
      if (click(el)) return "clicked-search";
      const input = $$("input").find((i) => visible(i) && (/search/i.test(i.getAttribute("data-testid") || "") || i.getAttribute("role") === "searchbox" || /search/i.test(i.placeholder || "")));
      if (input) {
        input.focus();
        input.value = "a";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return "typed-search";
      }
      return navigateSpa("/search");
    })()`,
  },
  {
    name: "library",
    waitMs: 1200,
    expr: `(() => {
      ${NAV_HELPERS}
      const el = findClickable([
        (e) => (e.getAttribute("data-testid") || "").includes("library") || (e.getAttribute("data-testid") || "") === "your-library-button",
        (e) => /your library|library/i.test(textOf(e)),
        (e) => (e.getAttribute("href") || "").includes("/collection"),
      ]);
      if (click(el)) return "clicked-library";
      return navigateSpa("/collection");
    })()`,
  },
  {
    name: "playlist",
    waitMs: 1800,
    expr: `(() => {
      ${NAV_HELPERS}
      // Prefer an in-library playlist / liked songs / card link
      const el = findClickable([
        (e) => (e.getAttribute("href") || "").includes("/playlist/"),
        (e) => (e.getAttribute("href") || "").includes("/collection/tracks"),
        (e) => /liked songs|playlist/i.test(textOf(e)) && (e.getAttribute("href") || "").startsWith("/"),
        (e) => (e.getAttribute("data-testid") || "").includes("playlist") || (e.getAttribute("data-testid") || "") === "internal-tracklist-row",
      ]);
      if (click(el)) return "clicked-playlist-or-liked:" + (el.getAttribute("href") || el.getAttribute("data-testid") || el.tagName);
      // Fallback: open a well-known public playlist route (Today's Top Hits-ish may 404; use search results cards)
      const card = $$('[data-testid="card-click-handler"], [data-testid="top-result-card"], a[href*="playlist"], a[href*="album"]').find(visible);
      if (click(card)) return "clicked-card:" + (card.getAttribute("href") || card.getAttribute("data-testid"));
      return navigateSpa("/collection/tracks");
    })()`,
  },
  {
    name: "context_menu",
    waitMs: 900,
    expr: `(() => {
      ${NAV_HELPERS}
      // Right-click a track row / more button to open context menu
      const row =
        $$('[data-testid="tracklist-row"], [data-testid="internal-tracklist-row"], [role="row"]').find(visible) ||
        $$('div[aria-selected], [data-testid*="track"]').find(visible);
      if (row) {
        const rect = row.getBoundingClientRect();
        const x = rect.left + Math.min(40, rect.width / 2);
        const y = rect.top + rect.height / 2;
        const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 2, buttons: 2 };
        row.dispatchEvent(new MouseEvent("contextmenu", opts));
        // also try the "more" button in the row
        const more = row.querySelector('button[aria-label*="More" i], button[data-testid="more-button"]');
        if (more) click(more);
        const menu = $$('[data-testid="context-menu"], [role="menu"], #context-menu, .main-contextMenu-menu').find(visible);
        return menu ? "context-menu-open" : "context-menu-dispatched";
      }
      // Fallback: more button anywhere in main view
      const more = findClickable([(e) => /more options|more/i.test(textOf(e)) && e.tagName === "BUTTON"]);
      if (click(more)) return "clicked-more";
      return "no-track-row";
    })()`,
  },
  {
    name: "sort_or_filter",
    waitMs: 800,
    expr: `(() => {
      ${NAV_HELPERS}
      const el = findClickable([
        (e) => /sort|filter|custom order|recently|title|artist/i.test(textOf(e)),
        (e) => (e.getAttribute("data-testid") || "").includes("sort"),
      ]);
      if (click(el)) return "clicked-sort-filter";
      return "sort-not-found";
    })()`,
  },
  {
    name: "settings",
    waitMs: 1500,
    expr: `(() => {
      ${NAV_HELPERS}
      // Profile chip → Settings
      const profile = findClickable([
        (e) => (e.getAttribute("data-testid") || "") === "user-widget-link",
        (e) => /profile|account menu/i.test(textOf(e)),
      ]);
      if (profile) click(profile);
      const pref = findClickable([
        (e) => (e.getAttribute("href") || "").includes("/preferences"),
        (e) => /settings|preferences/i.test(textOf(e)),
      ]);
      if (click(pref)) return "clicked-settings";
      return navigateSpa("/preferences");
    })()`,
  },
  {
    name: "settings_scroll",
    waitMs: 600,
    expr: `(() => {
      ${NAV_HELPERS}
      // Scroll settings main to mount more sections
      const main = document.querySelector('main, [data-testid="preferences-page"], [class*="settings"]') || document.scrollingElement;
      if (main) {
        main.scrollTop = main.scrollHeight / 2;
        window.scrollTo(0, document.body.scrollHeight / 2);
        return "scrolled-settings";
      }
      return "no-settings-scroll-target";
    })()`,
  },
];

function buildProbeExpression(checks) {
  return `(() => {
    const checks = ${JSON.stringify(checks)};
    const probeOne = (cls) => {
      if (!cls) return { count: 0, sample: null };
      const nodes = document.getElementsByClassName(cls);
      const el = nodes[0];
      if (!el) return { count: 0, sample: null };
      return {
        count: nodes.length,
        sample: {
          tag: el.tagName,
          className: String(el.className).slice(0, 160),
          text: (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 80),
          aria: el.getAttribute("aria-label"),
        },
      };
    };
    return {
      meta: {
        ready: document.readyState,
        href: location.href,
        title: document.title,
        mainLike: document.querySelectorAll('[class*="main-"]').length,
      },
      rows: checks.map((c) => {
        const hash = probeOne(c.hash);
        const semantic = probeOne(c.semantic);
        return {
          path: c.path,
          hash: c.hash,
          semantic: c.semantic,
          confidence: c.confidence,
          byHash: hash.count,
          bySem: semantic.count,
          sample: semantic.sample || hash.sample,
        };
      }),
    };
  })()`;
}

function summarize(rows, mode) {
  const scored = rows.map((r) => {
    const hashHit = r.byHash > 0;
    const semHit = r.bySem > 0;
    let hit = false;
    if (mode === "hash") hit = hashHit;
    else if (mode === "semantic") hit = semHit;
    else hit = hashHit || semHit;
    return { ...r, hit, hashHit, semHit };
  });
  const hits = scored.filter((r) => r.hit).length;
  return {
    total: scored.length,
    hits,
    hitRate: scored.length ? hits / scored.length : 0,
    hashHits: scored.filter((r) => r.hashHit).length,
    semanticHits: scored.filter((r) => r.semHit).length,
    rows: scored,
  };
}

function mergeBest(acc, next) {
  // Keep max counts per path across navigation steps
  const byPath = new Map(acc.map((r) => [r.path, r]));
  for (const r of next) {
    const prev = byPath.get(r.path);
    if (!prev) {
      byPath.set(r.path, r);
      continue;
    }
    byPath.set(r.path, {
      ...prev,
      byHash: Math.max(prev.byHash, r.byHash),
      bySem: Math.max(prev.bySem, r.bySem),
      sample: r.bySem || r.byHash ? r.sample || prev.sample : prev.sample,
    });
  }
  return [...byPath.values()];
}

function maybeRestartSpicetify() {
  const bin = process.env.SPICETIFY || `${process.env.HOME}/.spicetify/spicetify`;
  if (!fs.existsSync(bin)) {
    console.warn(`spicetify binary not found at ${bin}; skip --restart`);
    return;
  }
  console.log(`Restarting Spotify via ${bin} …`);
  const r = spawnSync(bin, ["restart"], { encoding: "utf8" });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    throw new Error(`spicetify restart failed with status ${r.status}`);
  }
}

async function main() {
  if (typeof WebSocket === "undefined") {
    console.error(
      `This script needs Node.js >= 22 (global WebSocket client). Current: ${process.version}. ` +
        `Upgrade Node or run with a newer runtime.`,
    );
    process.exit(1);
  }

  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").slice(0, 1200));
    process.exit(0);
  }

  if (args.restart) maybeRestartSpicetify();

  console.log(`Waiting for CDP at ${args.host}:${args.port} …`);
  const { version, targets } = await waitForCdp(args.host, args.port, args.timeoutMs);
  console.log(`Connected: ${version.Browser || version["User-Agent"] || "ok"}`);

  const page = pickXpuiTarget(targets);
  if (!page?.webSocketDebuggerUrl) {
    throw new Error(`No xpui page target in CDP list (${targets.length} targets)`);
  }
  console.log(`Page: ${page.url}`);

  const checks = loadChecks({
    reportPath: args.report,
    classmapPath: args.classmap,
    cssMapPath: args.cssMap,
  });
  console.log(`Loaded ${checks.length} classmap paths`);

  const session = new CdpSession(page.webSocketDebuggerUrl);
  await session.connect();

  const steps = [];
  let rows = [];

  const runProbe = async (label) => {
    const result = await session.evaluate(buildProbeExpression(checks));
    steps.push({ label, meta: result.meta, at: new Date().toISOString() });
    rows = rows.length ? mergeBest(rows, result.rows) : result.rows;
    const summary = summarize(result.rows, args.mode);
    console.log(
      `  [${label}] hits=${summary.hits}/${summary.total} (hash=${summary.hashHits}, semantic=${summary.semanticHits}) href=${result.meta?.href || "?"}`,
    );
    return result;
  };

  await runProbe("initial");

  if (args.navigate) {
    // --deep runs the full recipe list; plain --navigate keeps shell-level steps only.
    const stepsToRun = args.deep
      ? NAV_STEPS
      : NAV_STEPS.filter((s) =>
          ["home", "search", "library", "settings"].includes(s.name),
        );
    for (const step of stepsToRun) {
      try {
        const navResult = await session.evaluate(step.expr);
        console.log(`  navigate:${step.name} -> ${navResult}`);
        await sleep(step.waitMs || 1200);
        await runProbe(`after:${step.name}`);
      } catch (e) {
        console.warn(`  navigate:${step.name} failed: ${e.message}`);
      }
    }
  }

  const summary = summarize(rows, args.mode);
  const report = {
    generatedAt: new Date().toISOString(),
    cdp: { host: args.host, port: args.port, page: page.url, browser: version },
    mode: args.mode,
    minHitRate: args.minHitRate,
    navigate: args.navigate,
    steps,
    summary: {
      total: summary.total,
      hits: summary.hits,
      hitRate: Number(summary.hitRate.toFixed(4)),
      hashHits: summary.hashHits,
      semanticHits: summary.semanticHits,
    },
    rows: summary.rows.sort((a, b) => Number(b.hit) - Number(a.hit) || a.path.localeCompare(b.path)),
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify(report, null, 2) + "\n");
  console.log(`\nWrote ${args.out}`);
  console.log(
    `Overall hit rate (${args.mode}): ${(summary.hitRate * 100).toFixed(1)}% ` +
      `(${summary.hits}/${summary.total})`,
  );

  console.log("\nPresent:");
  for (const r of summary.rows.filter((r) => r.hit)) {
    console.log(
      `  ✓ ${r.path}  hash=${r.byHash} sem=${r.bySem}  ${r.semantic || r.hash}`,
    );
  }
  console.log("\nMissing on probed pages:");
  for (const r of summary.rows.filter((r) => !r.hit)) {
    console.log(`  ✗ ${r.path}  (${r.semantic || r.hash})`);
  }

  session.close();

  if (summary.hitRate + 1e-9 < args.minHitRate) {
    console.error(
      `\nFAIL: hit rate ${summary.hitRate.toFixed(3)} < min ${args.minHitRate}`,
    );
    process.exit(2);
  }
  console.log("\nPASS");
  process.exit(0);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
