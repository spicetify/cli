export function getObjectValues(value) {
  if (typeof value !== "object" || !value) return [];
  try {
    return Object.values(value);
  } catch {
    return [];
  }
}

export function getModuleInventory(require) {
  const chunks = Object.entries(require.m);
  const cache = Object.keys(require.m).map((id) => require(id));
  const webpackFactories = new Set(Object.values(require.m));
  const modules = cache.flatMap(getObjectValues);
  const functionModules = modules.flatMap((module) => {
    if (typeof module === "function") return [module];
    return getObjectValues(module).filter((value) => typeof value === "function" && !webpackFactories.has(value));
  });

  return { chunks, cache, modules, functionModules };
}

export function createModuleInventoryScanner() {
  const processedIds = new Set();
  const chunks = [];
  const cache = [];
  const modules = [];
  const functionModules = [];

  return {
    chunks,
    cache,
    modules,
    functionModules,
    scan(require) {
      const webpackFactories = new Set(Object.values(require.m));
      const newChunks = [];
      const newModules = [];
      const newFunctionModules = [];

      for (const id of Object.keys(require.m)) {
        if (processedIds.has(id)) continue;
        processedIds.add(id);

        const factory = require.m[id];
        const chunkEntry = [id, factory];
        chunks.push(chunkEntry);
        newChunks.push(chunkEntry);

        const exported = require(id);
        cache.push(exported);

        for (const value of getObjectValues(exported)) {
          modules.push(value);
          newModules.push(value);

          if (typeof value === "function") {
            functionModules.push(value);
            newFunctionModules.push(value);
            continue;
          }

          for (const inner of getObjectValues(value)) {
            if (typeof inner === "function" && !webpackFactories.has(inner)) {
              functionModules.push(inner);
              newFunctionModules.push(inner);
            }
          }
        }
      }

      return { chunks: newChunks, modules: newModules, functionModules: newFunctionModules };
    },
  };
}

export function groupBy(values, keyFinder) {
  // Object.groupBy is newer than the es2022 lib the wrapper is checked against.
  const object = /** @type {{ groupBy?: (values: any[], keyFinder: any) => Record<PropertyKey, any[]> }} */ (Object);
  if (typeof object.groupBy === "function") return object.groupBy(values, keyFinder);
  return values.reduce((a, b) => {
    const key = typeof keyFinder === "function" ? keyFinder(b) : b[keyFinder];
    a[key] = a[key] ? [...a[key], b] : [b];
    return a;
  }, {});
}
