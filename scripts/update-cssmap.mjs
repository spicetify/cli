import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const classNameSource = String.raw`[A-Za-z_][A-Za-z0-9_-]{11,23}`;

function getFiles(root, extension) {
  const result = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const filePath = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(filePath);
      else if (entry.name.endsWith(extension)) result.push(filePath);
    }
  };

  visit(root);
  return result.sort((left, right) => left.localeCompare(right));
}

function readSources(root, extension) {
  return getFiles(root, extension).map((filePath) => ({
    file: relative(root, filePath).replaceAll("\\", "/"),
    source: readFileSync(filePath, "utf8"),
  }));
}

export function collectCssClasses(cssSources) {
  const classes = new Set();
  const pattern = new RegExp(String.raw`\.(${classNameSource})(?![A-Za-z0-9_-])`, "g");

  for (const { source } of cssSources) for (const match of source.matchAll(pattern)) classes.add(match[1]);

  return classes;
}

export function collectRuntimeClasses(jsSources, cssClasses) {
  const classes = new Set();
  const pattern = new RegExp(String.raw`(?<![A-Za-z0-9_-])(${classNameSource})(?![A-Za-z0-9_-])`, "g");

  for (const { source } of jsSources) for (const match of source.matchAll(pattern)) if (cssClasses.has(match[1])) classes.add(match[1]);

  return classes;
}

function getLatestPreviousHashBySemantic(cssMap, previousRuntimeClasses, previousExportedClasses) {
  const hashes = new Map();

  for (const [hash, semantic] of Object.entries(cssMap)) {
    if (!previousRuntimeClasses.has(hash)) continue;
    const existingHash = hashes.get(semantic);
    if (existingHash && previousExportedClasses.has(existingHash) && !previousExportedClasses.has(hash)) continue;
    hashes.set(semantic, hash);
  }

  return hashes;
}

function getCssModuleObjects(jsSources, cssClasses) {
  const objects = new Map();
  const objectPattern = /[A-Za-z_$][A-Za-z0-9_$]*\.d\([^,]+,\{\},\{(?:"[^"]+"|[A-Za-z_$][A-Za-z0-9_$]*):\{([^{}]*)\}\}\)/g;
  const pairPattern = /(?:^|,)\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][A-Za-z0-9_$]*))\s*:\s*(?:"([^"]*)"|'([^']*)')/g;

  for (const { file, source } of jsSources) {
    for (const objectMatch of source.matchAll(objectPattern)) {
      const pairs = new Map();
      const matches = [...objectMatch[1].matchAll(pairPattern)];
      const remainder = objectMatch[1].replace(pairPattern, "").replaceAll(",", "").trim();
      if (remainder) continue;

      for (const match of matches) {
        const key = match[1] ?? match[2] ?? match[3];
        const className = match[4] ?? match[5];
        if (cssClasses.has(className)) pairs.set(key, className);
      }

      if (pairs.size === 0) continue;

      const signature = [...pairs]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${value}`)
        .join(";");

      if (!objects.has(signature)) objects.set(signature, { file, pairs });
    }
  }

  return [...objects.values()];
}

function getExportData(objects) {
  const classes = new Set();
  const keysByClass = new Map();

  for (const object of objects) {
    for (const [key, className] of object.pairs) {
      classes.add(className);
      const keys = keysByClass.get(className) ?? new Set();
      keys.add(key);
      keysByClass.set(className, keys);
    }
  }

  return { classes, keysByClass };
}

function getHashesBySemantic(cssMap, cssClasses) {
  const hashesBySemantic = new Map();

  for (const className of cssClasses) {
    const semantic = cssMap[className];
    if (semantic === undefined) continue;
    const hashes = hashesBySemantic.get(semantic) ?? [];
    hashes.push(className);
    hashesBySemantic.set(semantic, hashes);
  }

  return hashesBySemantic;
}

function addCandidate(candidates, conflicts, hash, semantic, evidence) {
  const existingHash = candidates.get(hash);
  if (existingHash && existingHash.semantic !== semantic) {
    if (evidence.type === "rule" && existingHash.evidence.some(({ type }) => type === "object")) return;
    conflicts.push({ hash, first: existingHash, second: { semantic, evidence }, type: "hash" });
    return;
  }

  const existingSemantic = [...candidates].find(([, candidate]) => candidate.semantic === semantic);
  if (existingSemantic && existingSemantic[0] !== hash) {
    if (evidence.type === "rule" && existingSemantic[1].evidence.some(({ type }) => type === "object")) return;
    conflicts.push({
      semantic,
      first: { hash: existingSemantic[0], ...existingSemantic[1] },
      second: { hash, evidence },
      type: "semantic",
    });
    return;
  }

  if (!existingHash) candidates.set(hash, { semantic, evidence: [evidence] });
  else existingHash.evidence.push(evidence);
}

function proposeCandidate(state, hash, semantic, evidence) {
  if (!state.currentRuntimeClasses.has(hash)) {
    state.rejected.push({ hash, semantic, evidence, reason: "missing-runtime-reference" });
    return;
  }

  const exportKeys = state.currentExportKeys.get(hash);
  if (!exportKeys) {
    state.rejected.push({ hash, semantic, evidence, reason: "missing-css-module-export" });
    return;
  }

  if (evidence.key && !exportKeys.has(evidence.key)) {
    state.rejected.push({ hash, semantic, evidence, reason: "css-module-export-key-mismatch" });
    return;
  }

  const existingHashes = state.currentHashesBySemantic.get(semantic) ?? [];
  if (existingHashes.some((existingHash) => existingHash !== hash)) {
    state.rejected.push({ hash, semantic, evidence, existingHashes, reason: "duplicate-semantic-in-current-version" });
    return;
  }

  if (state.previousCssClasses.has(hash)) {
    const previousSemantic = state.cssMap[hash];
    if (previousSemantic !== semantic || !state.previousExportedClasses.has(hash)) {
      state.rejected.push({ hash, semantic, evidence, previousSemantic, reason: "previous-version-export-conflict" });
      return;
    }
  }

  addCandidate(state.candidates, state.conflicts, hash, semantic, evidence);
}

function deriveFromObjects(previousObjects, currentObjects, latestPreviousHashes, cssMap, state) {
  const annotatedPrevious = previousObjects
    .map((object) => ({
      ...object,
      semantics: new Map(
        [...object.pairs].flatMap(([key, hash]) => {
          const semantic = cssMap[hash];
          return semantic && latestPreviousHashes.get(semantic) === hash ? [[key, { hash, semantic }]] : [];
        }),
      ),
    }))
    .filter((object) => object.semantics.size > 0);

  let matchedObjects = 0;

  for (const previous of annotatedPrevious) {
    const previousKeys = new Set(previous.pairs.keys());
    const ranked = currentObjects
      .map((current) => {
        const currentKeys = new Set(current.pairs.keys());
        const overlap = [...previousKeys].filter((key) => currentKeys.has(key)).length;
        const difference = currentKeys.size + previousKeys.size - 2 * overlap;
        const exact = difference === 0;
        return { current, overlap, difference, exact, score: (exact ? 100_000 : 0) + overlap * 100 - difference };
      })
      .filter((match) => match.overlap > 0)
      .sort((left, right) => right.score - left.score);

    if (ranked.length === 0) continue;

    const best = ranked[0];
    const tied = ranked.filter((match) => match.score === best.score);
    const requiredOverlap = Math.max(2, Math.ceil(Math.min(previous.pairs.size, best.current.pairs.size) * 0.75));
    if (tied.length !== 1 || (!best.exact && best.overlap < requiredOverlap)) continue;

    let additions = 0;
    for (const [key, { hash: previousHash, semantic }] of previous.semantics) {
      const hash = best.current.pairs.get(key);
      if (!hash) continue;

      proposeCandidate(state, hash, semantic, {
        type: "object",
        previousFile: previous.file,
        currentFile: best.current.file,
        previousHash,
        exact: best.exact,
        overlap: best.overlap,
        previousSize: previous.pairs.size,
        currentSize: best.current.pairs.size,
        key,
      });
      additions += 1;
    }

    if (additions > 0) matchedObjects += 1;
  }

  return { annotatedPreviousObjects: annotatedPrevious.length, matchedObjects };
}

function getSimpleCssRules(cssSources) {
  const result = [];
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;

  for (const { file, source } of cssSources) {
    for (const match of source.matchAll(rulePattern)) {
      const selector = match[1].trim();
      const body = match[2].replace(/\s+/g, "").trim();
      if (!selector || !body || selector.startsWith("@")) continue;
      result.push({ file, selector, body });
    }
  }

  return result;
}

function getSelectorTokens(selector, cssClasses) {
  const tokens = [];
  const pattern = new RegExp(String.raw`\.(${classNameSource})(?![A-Za-z0-9_-])`, "g");
  const shape = selector
    .replace(pattern, (whole, token) => {
      if (!cssClasses.has(token)) return whole;
      tokens.push(token);
      return ".CLASS";
    })
    .replace(/\s+/g, "");

  return { shape, tokens };
}

function indexRules(rules) {
  const result = new Map();

  for (const rule of rules) {
    if (rule.tokens.length === 0) continue;
    const signature = `${rule.file}\n${rule.shape}\n${rule.body}`;
    const bucket = result.get(signature) ?? [];
    bucket.push(rule);
    result.set(signature, bucket);
  }

  return result;
}

function deriveFromRules(previousCssSources, currentCssSources, previousCssClasses, currentCssClasses, latestPreviousHashes, cssMap, state) {
  const previousRules = getSimpleCssRules(previousCssSources).map((rule) => ({
    ...rule,
    ...getSelectorTokens(rule.selector, previousCssClasses),
  }));
  const currentRules = getSimpleCssRules(currentCssSources).map((rule) => ({
    ...rule,
    ...getSelectorTokens(rule.selector, currentCssClasses),
  }));
  const previousBySignature = indexRules(previousRules);
  const currentBySignature = indexRules(currentRules);
  let matchedRules = 0;

  for (const [signature, matchingPreviousRules] of previousBySignature) {
    const matchingCurrentRules = currentBySignature.get(signature);
    if (matchingPreviousRules.length !== 1 || matchingCurrentRules?.length !== 1) continue;

    const previous = matchingPreviousRules[0];
    const current = matchingCurrentRules[0];
    if (previous.tokens.length !== current.tokens.length) continue;

    let additions = 0;
    for (let index = 0; index < previous.tokens.length; index += 1) {
      const previousHash = previous.tokens[index];
      const semantic = cssMap[previousHash];
      if (!semantic || latestPreviousHashes.get(semantic) !== previousHash) continue;

      proposeCandidate(state, current.tokens[index], semantic, {
        type: "rule",
        previousFile: previous.file,
        currentFile: current.file,
        previousHash,
        selectorShape: previous.shape,
      });
      additions += 1;
    }

    if (additions > 0) matchedRules += 1;
  }

  return { previousRules: previousRules.length, currentRules: currentRules.length, matchedRules };
}

function escapePattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function deriveGlobalNavClasses(currentJsSources, currentCssClasses, state) {
  const navLink = [...state.candidates].find(([, candidate]) => candidate.semantic === "main-globalNav-navLink");
  if (!navLink) return 0;

  const [navLinkHash] = navLink;
  const activePattern = new RegExp(`"${escapePattern(navLinkHash)}"[^)]{0,240}?\\{(${classNameSource}):`);
  let additions = 0;

  for (const { file, source } of currentJsSources) {
    const homeButtonIndex = source.indexOf('"data-testid":"home-button"');
    if (homeButtonIndex === -1) continue;

    const componentStart = Math.max(0, homeButtonIndex - 3_000);
    const componentSource = source.slice(componentStart, homeButtonIndex + 500);
    const activeMatch = activePattern.exec(componentSource);
    if (!activeMatch || !currentCssClasses.has(activeMatch[1])) continue;

    proposeCandidate(state, activeMatch[1], "main-globalNav-navLinkActive", {
      type: "global-nav-home-button",
      currentFile: file,
      navLinkHash,
    });
    additions += 1;

    const definitionPattern = new RegExp(
      String.raw`(?:let|const|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)=\(\{className:[A-Za-z_$][A-Za-z0-9_$]*\}\)=>`,
      "g",
    );
    const definitions = [...componentSource.matchAll(definitionPattern)];
    const componentName = definitions.at(-1)?.[1];
    if (!componentName) continue;

    const callPattern = new RegExp(String.raw`\)\(${escapePattern(componentName)},\{className:"(${classNameSource})"`, "g");
    const classNames = [...source.matchAll(callPattern)].map((match) => match[1]).filter((className) => currentCssClasses.has(className));
    const uniqueClassNames = [...new Set(classNames)];
    if (uniqueClassNames.length !== 1) continue;

    proposeCandidate(state, uniqueClassNames[0], "main-globalNav-link-icon", {
      type: "global-nav-component-call",
      currentFile: file,
      componentName,
      navLinkHash,
    });
    additions += 1;
  }

  return additions;
}

export function deriveCssMap({ previousRoot, currentRoot, cssMap }) {
  const previousCssSources = readSources(previousRoot, ".css");
  const currentCssSources = readSources(currentRoot, ".css");
  const previousJsSources = readSources(previousRoot, ".js");
  const currentJsSources = readSources(currentRoot, ".js");

  if (previousCssSources.length === 0 || currentCssSources.length === 0) throw new Error("Both roots must contain extracted CSS files.");
  if (previousJsSources.length === 0 || currentJsSources.length === 0) throw new Error("Both roots must contain extracted JavaScript files.");

  const previousCssClasses = collectCssClasses(previousCssSources);
  const currentCssClasses = collectCssClasses(currentCssSources);
  const previousRuntimeClasses = collectRuntimeClasses(previousJsSources, previousCssClasses);
  const currentRuntimeClasses = collectRuntimeClasses(currentJsSources, currentCssClasses);
  const previousObjects = getCssModuleObjects(previousJsSources, previousCssClasses);
  const currentObjects = getCssModuleObjects(currentJsSources, currentCssClasses);
  const previousExports = getExportData(previousObjects);
  const currentExports = getExportData(currentObjects);
  const latestPreviousHashes = getLatestPreviousHashBySemantic(cssMap, previousRuntimeClasses, previousExports.classes);
  const currentHashesBySemantic = getHashesBySemantic(cssMap, currentCssClasses);
  const state = {
    candidates: new Map(),
    conflicts: [],
    rejected: [],
    cssMap,
    currentExportKeys: currentExports.keysByClass,
    currentHashesBySemantic,
    currentRuntimeClasses,
    previousCssClasses,
    previousExportedClasses: previousExports.classes,
  };
  const objectStats = deriveFromObjects(previousObjects, currentObjects, latestPreviousHashes, cssMap, state);
  const ruleStats = deriveFromRules(
    previousCssSources,
    currentCssSources,
    previousCssClasses,
    currentCssClasses,
    latestPreviousHashes,
    cssMap,
    state,
  );
  const globalNavClasses = deriveGlobalNavClasses(currentJsSources, currentCssClasses, state);
  const candidates = [...state.candidates]
    .map(([hash, candidate]) => ({ hash, ...candidate }))
    .sort((left, right) => left.semantic.localeCompare(right.semantic) || left.hash.localeCompare(right.hash));

  return {
    stats: {
      previousCssClasses: previousCssClasses.size,
      currentCssClasses: currentCssClasses.size,
      previousRuntimeClasses: previousRuntimeClasses.size,
      currentRuntimeClasses: currentRuntimeClasses.size,
      previousObjects: previousObjects.length,
      currentObjects: currentObjects.length,
      previousExportedClasses: previousExports.classes.size,
      currentExportedClasses: currentExports.classes.size,
      existingDuplicateSemantics: [...currentHashesBySemantic.values()].filter((hashes) => hashes.length > 1).length,
      latestPreviousHashes: latestPreviousHashes.size,
      ...objectStats,
      ...ruleStats,
      globalNavClasses,
      candidates: candidates.length,
      conflicts: state.conflicts.length,
      rejected: state.rejected.length,
    },
    conflicts: state.conflicts,
    rejected: state.rejected,
    candidates,
  };
}

export function addCandidatesToMap(cssMap, candidates) {
  const additions = candidates.filter(({ hash }) => cssMap[hash] === undefined);
  const additionsBySemantic = new Map();
  for (const candidate of additions) {
    const semanticAdditions = additionsBySemantic.get(candidate.semantic) ?? [];
    semanticAdditions.push(candidate);
    additionsBySemantic.set(candidate.semantic, semanticAdditions);
  }
  const entries = Object.entries(cssMap);
  const lastIndexBySemantic = new Map();

  entries.forEach(([, semantic], index) => lastIndexBySemantic.set(semantic, index));

  for (const semantic of additionsBySemantic.keys())
    if (!lastIndexBySemantic.has(semantic)) throw new Error(`Cannot place mapping for unknown semantic class ${semantic}.`);

  const updatedEntries = entries.flatMap((entry, index) => {
    const [hash, semantic] = entry;
    if (lastIndexBySemantic.get(semantic) !== index) return [[hash, semantic]];

    const semanticAdditions = additionsBySemantic.get(semantic) ?? [];
    return [
      [hash, semantic],
      ...semanticAdditions.sort((left, right) => left.hash.localeCompare(right.hash)).map(({ hash: newHash }) => [newHash, semantic]),
    ];
  });

  return { cssMap: Object.fromEntries(updatedEntries), additions };
}

function parseArguments(args) {
  const options = { mapPath: resolve("css-map.json"), write: false, json: false };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--previous") options.previousRoot = resolve(args[++index]);
    else if (argument === "--current") options.currentRoot = resolve(args[++index]);
    else if (argument === "--map") options.mapPath = resolve(args[++index]);
    else if (argument === "--write") options.write = true;
    else if (argument === "--json") options.json = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }

  if (!options.previousRoot || !options.currentRoot)
    throw new Error("Usage: node scripts/update-css-map.mjs --previous <directory> --current <directory> [--map <file>] [--write] [--json]");

  return options;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  for (const directory of [options.previousRoot, options.currentRoot])
    if (!existsSync(directory)) throw new Error(`Directory does not exist: ${directory}`);
  if (!existsSync(options.mapPath)) throw new Error(`CSS map does not exist: ${options.mapPath}`);

  const cssMap = JSON.parse(readFileSync(options.mapPath, "utf8"));
  const report = deriveCssMap({ previousRoot: options.previousRoot, currentRoot: options.currentRoot, cssMap });

  if (options.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(JSON.stringify(report.stats));
    for (const { hash, semantic } of report.candidates) console.log(`${hash}: ${semantic}`);
  }

  if (report.conflicts.length > 0) {
    console.error(JSON.stringify(report.conflicts, null, 2));
    process.exitCode = 1;
    return;
  }

  if (!options.write) return;

  const updated = addCandidatesToMap(cssMap, report.candidates);
  writeFileSync(options.mapPath, `${JSON.stringify(updated.cssMap, null, 2)}\n`);
  console.log(`Added ${updated.additions.length} mappings to ${options.mapPath}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
