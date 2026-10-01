import { fnStr } from "../shared/string.js";

const SAMPLE_URI_ID = "4uLU6hMCjMI75M1A2tKUQC";
const SAMPLE_URI = `spotify:track:${SAMPLE_URI_ID}`;
const HEX_ID_PATTERN = /^[\da-f]{32}$/i;

function getObjectValues(value) {
  try {
    return Object.values(value);
  } catch {
    return [];
  }
}

function isObject(value) {
  return value !== null && typeof value === "object";
}

function isFunction(value) {
  return typeof value === "function";
}

function isURIType(value) {
  return isObject(value) && Boolean(value.PLAYLIST_V2);
}

function isURIExports(module) {
  const values = getObjectValues(module);
  return values.some(isFunction) && values.some(isURIType);
}

function getURIExports(cache) {
  return cache.filter(isObject).find(isURIExports);
}

function getFunctionModules(modules) {
  return modules.flatMap((module) => {
    if (isFunction(module)) return [module];
    return getObjectValues(module).filter(isFunction);
  });
}

function normalizeInventory(input) {
  const cache = Array.isArray(input) ? input : (input.cache ?? []);
  const modules = Array.isArray(input) ? cache.flatMap(getObjectValues) : (input.modules ?? cache.flatMap(getObjectValues));
  const functionModules = Array.isArray(input) ? getFunctionModules(modules) : (input.functionModules ?? getFunctionModules(modules));

  return {
    cache,
    modules,
    functionModules,
    moduleCandidates: [...cache, ...modules],
  };
}

function getURIType(uriExports) {
  return uriExports.NQG ?? getObjectValues(uriExports).find(isURIType);
}

function getURIFunctions(uriExports) {
  return getObjectValues(uriExports).filter(isFunction);
}

function isSameFunction(left, right) {
  return left === right;
}

function withPreferredFunctions(preferred, functions) {
  return [...preferred.filter(isFunction), ...functions.filter((func) => !preferred.some((candidate) => isSameFunction(candidate, func)))];
}

function canParseURI(func) {
  try {
    const uri = func(SAMPLE_URI);
    return isObject(uri) && uri.type !== undefined && (typeof uri.toURI !== "function" || uri.toURI() === SAMPLE_URI);
  } catch {
    return false;
  }
}

function isFlexibleURIParser(func) {
  try {
    const uri = func(SAMPLE_URI);
    const parsedURI = func(uri);
    return isObject(parsedURI) && parsedURI.type === uri.type && parsedURI.id === uri.id;
  } catch {
    return false;
  }
}

function isStrictStringParser(func) {
  if (!canParseURI(func)) return false;

  try {
    func({});
    return false;
  } catch (error) {
    return error instanceof TypeError || String(error).includes("Argument");
  }
}

function findURIFrom(uriExports, functions) {
  const preferred = withPreferredFunctions([uriExports.o_h, uriExports.from], functions);
  return preferred.find(isFlexibleURIParser) ?? preferred.find((func) => fnStr(func).includes("allowedTypes")) ?? preferred.find(canParseURI);
}

function findURIFromString(uriExports, functions) {
  const preferred = withPreferredFunctions([uriExports.Lce, uriExports.fromString], functions);
  return (
    preferred.find(isStrictStringParser) ??
    preferred.find((func) => fnStr(func).includes("Argument") && fnStr(func).includes("uri")) ??
    preferred.find(canParseURI)
  );
}

function getIDToHexResult(func) {
  try {
    const value = func(SAMPLE_URI_ID);
    if (typeof value === "string" && HEX_ID_PATTERN.test(value)) return value;
  } catch {
    return undefined;
  }

  return undefined;
}

function findIDToHex(functions) {
  return functions.find((func) => getIDToHexResult(func) !== undefined) ?? functions.find((func) => fnStr(func).includes("22==="));
}

function findHexToID(functions, idToHex) {
  const sampleHex = idToHex ? getIDToHexResult(idToHex) : undefined;
  const hexToID = sampleHex
    ? functions.find((func) => {
        try {
          return func(sampleHex) === SAMPLE_URI_ID;
        } catch {
          return false;
        }
      })
    : undefined;

  return hexToID ?? functions.find((func) => fnStr(func).includes("32==="));
}

function getBase62Hex(base62) {
  try {
    const value = base62.toHex(SAMPLE_URI_ID, 32);
    if (typeof value === "string" && HEX_ID_PATTERN.test(value)) return value;
  } catch {
    return undefined;
  }

  return undefined;
}

function findBase62Module(modules) {
  return modules.filter(isObject).find((module) => {
    if (!isFunction(module.toHex) || !isFunction(module.fromHex)) return false;

    const sampleHex = getBase62Hex(module);
    if (sampleHex === undefined) return false;

    try {
      return module.fromHex(sampleHex, 22) === SAMPLE_URI_ID;
    } catch {
      return false;
    }
  });
}

function createIDToHex(base62) {
  return (id) => {
    if (typeof id !== "string" || id.length !== 22) return id;
    return base62.toHex(id, 32);
  };
}

function createHexToID(base62) {
  return (hex) => {
    if (typeof hex !== "string" || hex.length !== 32) return hex;
    return base62.fromHex(hex, 22);
  };
}

function toCamelCase(type, capitalizeFirst = false) {
  return type
    .toLowerCase()
    .split("_")
    .map((word, index) => {
      if (index > 0 || capitalizeFirst) return word[0].toUpperCase() + word.slice(1);
      return word;
    })
    .join("");
}

export function waitForURI(cache) {
  const inventory = normalizeInventory(cache);

  (function waitForURI(attempt = 0) {
    if (!Spicetify.URI) {
      setTimeout(() => waitForURI(attempt + 1), Math.min(10 * 2 ** Math.min(attempt, 6), 500));
      return;
    }

    // The client's own URI class can lack the helpers this fills in.
    const uri = /** @type {Partial<typeof Spicetify.URI>} */ (Spicetify.URI);
    if (uri.Type && uri.from && uri.fromString && uri.idToHex && uri.hexToId) return;

    const URIExports = getURIExports(inventory.cache);
    if (!URIExports) {
      setTimeout(() => waitForURI(attempt + 1), Math.min(100 * 2 ** Math.min(attempt, 4), 1000));
      return;
    }

    Spicetify.URI.Type ??= getURIType(URIExports);
    if (!Spicetify.URI.Type) {
      setTimeout(() => waitForURI(attempt + 1), Math.min(100 * 2 ** Math.min(attempt, 4), 1000));
      return;
    }

    const URIModules = getURIFunctions(URIExports);
    const allFunctions = [...new Set([...URIModules, ...inventory.functionModules])];

    Spicetify.URI.fromString ??= findURIFromString(URIExports, allFunctions);
    Spicetify.URI.from ??= findURIFrom(URIExports, allFunctions) ?? Spicetify.URI.fromString;

    // createURI functions
    const createURIFunctions = URIModules.filter((m) => fnStr(m).match(/\([\w$]+\./));
    for (const type of Object.keys(Spicetify.URI.Type)) {
      const func = createURIFunctions.find((m) => fnStr(m).match(new RegExp(`\\([\\w$]+\\.${type}(?!_)`)));
      if (!func) continue;

      const camelCaseType = toCamelCase(type);
      Spicetify.URI[`${camelCaseType}URI`] = func;
    }

    // isURI functions
    const isURIFunctions = URIModules.filter((m) => fnStr(m).match(/=[\w$]+\./));
    for (const type of Object.keys(Spicetify.URI.Type)) {
      const func = isURIFunctions.find((m) => fnStr(m).match(new RegExp(`===[\\w$]+\\.${type}(?!_)\\}`)));
      const camelCaseType = toCamelCase(type, true);

      Spicetify.URI[`is${camelCaseType}`] =
        func ??
        ((uri) => {
          let uriObj;
          try {
            uriObj = Spicetify.URI.from?.(uri) ?? Spicetify.URI.fromString?.(uri);
          } catch {
            return false;
          }
          if (!uriObj) return false;
          return uriObj.type === Spicetify.URI.Type[type];
        });
    }

    Spicetify.URI.isPlaylistV1OrV2 = (uri) => Spicetify.URI.isPlaylist(uri) || Spicetify.URI.isPlaylistV2(uri);

    const base62 = findBase62Module(inventory.moduleCandidates);

    Spicetify.URI.idToHex ??= findIDToHex(allFunctions) ?? (base62 ? createIDToHex(base62) : undefined);
    Spicetify.URI.hexToId ??= findHexToID(allFunctions, Spicetify.URI.idToHex) ?? (base62 ? createHexToID(base62) : undefined);

    // isSameIdentity
    Spicetify.URI.isSameIdentity ??= URIModules.find((m) => fnStr(m).match(/[\w$]+\.id===[\w$]+\.id/));
  })();
}
