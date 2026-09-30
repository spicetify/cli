const DEFINITION = /\bnew\s+[\w$]+(?:\.[\w$]+)*\(\s*"([_A-Za-z][_0-9A-Za-z]*)"\s*,\s*"(query|mutation)"\s*,\s*"([a-fA-F0-9]{64})"\s*,\s*null\s*\)/g;

export function extractGraphQLDefinitions(source) {
  return Array.from(source.matchAll(DEFINITION), ([, name, operation, sha256Hash]) => Object.freeze({ name, operation, sha256Hash, value: null }));
}

// Read metadata without requiring modules or rewriting client code. A stable
// dictionary keeps destructured references useful when later chunks arrive.
export function createGraphQLDefinitions(getFactories) {
  const definitions = Object.create(null);
  const parsed = new WeakMap();
  let previous = new Set();

  function refresh() {
    const factories = new Set(Object.values(getFactories() ?? {}).filter((factory) => typeof factory === "function"));
    if (factories.size === previous.size && [...factories].every((factory) => previous.has(factory))) return;
    previous = factories;
    for (const name of Object.keys(definitions)) delete definitions[name];
    const conflicts = new Set();
    for (const factory of factories) {
      if (!parsed.has(factory)) parsed.set(factory, extractGraphQLDefinitions(Function.prototype.toString.call(factory)));
      for (const definition of parsed.get(factory)) {
        const existing = definitions[definition.name];
        if (existing && (existing.operation !== definition.operation || existing.sha256Hash !== definition.sha256Hash)) {
          conflicts.add(definition.name);
        }
        definitions[definition.name] = definition;
      }
    }
    for (const name of conflicts) delete definitions[name];
  }

  return new Proxy(definitions, {
    get(target, name) {
      if (typeof name === "string") refresh();
      return Reflect.get(target, name);
    },
    has(target, name) {
      refresh();
      return Reflect.has(target, name);
    },
    ownKeys(target) {
      refresh();
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(target, name) {
      refresh();
      return Reflect.getOwnPropertyDescriptor(target, name);
    },
    set: () => false,
    defineProperty: () => false,
    deleteProperty: () => false,
    preventExtensions: () => false,
    setPrototypeOf: () => false,
  });
}
