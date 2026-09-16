import assert from "node:assert/strict";
import test from "node:test";

import { createGraphQLDefinitions, extractGraphQLDefinitions } from "./graphql-definitions.js";
import { createSpicetifyBindings } from "./spicetify-bindings.js";

declare const api: { Document: new (name: string, operation: string, hash: string, value: null) => unknown };

function albumFactory() {
  new api.Document("getAlbum", "query", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", null);
  throw new Error("discovery must not execute factories");
}

function searchFactory() {
  return new api.Document("searchDesktop", "query", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", null);
}

function mutationFactory() {
  return new api.Document("saveRecentSearches", "mutation", "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc", null);
}

test("discovers current-client definitions without executing factories", () => {
  const definitions = createGraphQLDefinitions(() => ({ album: albumFactory, mutation: mutationFactory }));
  assert.deepEqual(definitions.getAlbum, {
    name: "getAlbum",
    operation: "query",
    sha256Hash: "a".repeat(64),
    value: null,
  });
  assert.equal(definitions.saveRecentSearches.operation, "mutation");
  assert.deepEqual(Object.keys(definitions).sort(), ["getAlbum", "saveRecentSearches"]);
  assert.equal(definitions.missingOperation, undefined);
});

test("late chunks are discovered and replaced or removed factories do not leave stale definitions", () => {
  const factories: Record<string, () => unknown> = { current: albumFactory };
  const definitions = createGraphQLDefinitions(() => factories);
  const album = definitions.getAlbum;
  assert.ok(album);
  assert.equal(definitions.getAlbum, album, "unchanged definitions keep their identity");
  factories.current = searchFactory;
  assert.equal(definitions.getAlbum, undefined);
  assert.equal(definitions.searchDesktop.name, "searchDesktop");
  delete factories.current;
  assert.deepEqual(Object.keys(definitions), []);
});

test("deduplicates identical definitions but refuses conflicting operation hashes", () => {
  function conflict() {
    return new api.Document("getAlbum", "query", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", null);
  }
  const factories: Record<string, () => unknown> = { first: albumFactory, duplicate: albumFactory };
  const definitions = createGraphQLDefinitions(() => factories);
  assert.equal(definitions.getAlbum.sha256Hash, "a".repeat(64));
  factories.duplicate = conflict;
  assert.equal(definitions.getAlbum, undefined);
  assert.equal("getAlbum" in definitions, false);
  delete factories.duplicate;
  assert.equal(definitions.getAlbum.sha256Hash, "a".repeat(64));
});

test("own-property inspection discovers late chunks and drops removed definitions", () => {
  const factories: Record<string, () => unknown> = {};
  const definitions = createGraphQLDefinitions(() => factories);
  assert.equal(Object.hasOwn(definitions, "getAlbum"), false);
  factories.album = albumFactory;
  assert.equal(Object.hasOwn(definitions, "getAlbum"), true);
  assert.equal(Object.getOwnPropertyDescriptor(definitions, "getAlbum")?.value.name, "getAlbum");
  delete factories.album;
  assert.equal(Object.hasOwn(definitions, "getAlbum"), false);
});

test("conflicting operation types are omitted even when the hashes match", () => {
  function conflict() {
    return new api.Document("getAlbum", "mutation", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", null);
  }
  const definitions = createGraphQLDefinitions(() => ({ album: albumFactory, conflict }));
  assert.equal(definitions.getAlbum, undefined);
});

test("invalid metadata is ignored and the registry tolerates unavailable capture", () => {
  function invalid() {
    const badHash = new api.Document("badHash", "query", "not-a-hash", null);
    const subscription = new api.Document("stream", "subscription", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", null);
    return [badHash, subscription];
  }
  let factories: Record<string, () => unknown> | undefined;
  const definitions = createGraphQLDefinitions(() => factories);
  assert.deepEqual(Object.keys(definitions), []);
  factories = { invalid, album: albumFactory };
  assert.deepEqual(Object.keys(definitions), ["getAlbum"]);
});

test("definitions and their registry cannot be modified by consumers", () => {
  const definitions = createGraphQLDefinitions(() => ({ album: albumFactory }));
  assert.equal(Object.getPrototypeOf(definitions), null);
  assert.equal(Reflect.setPrototypeOf(definitions, { fake: {} }), false);
  assert.equal(Reflect.set(definitions, "getAlbum", {}), false);
  assert.throws(() => {
    definitions.getAlbum = {};
  }, TypeError);
  assert.equal(Reflect.defineProperty(definitions, "fake", { value: {} }), false);
  assert.equal(Reflect.deleteProperty(definitions, "getAlbum"), false);
  assert.equal(Reflect.preventExtensions(definitions), false);
  assert.equal(Reflect.set(definitions.getAlbum, "sha256Hash", "b".repeat(64)), false);
  assert.equal(definitions.getAlbum.sha256Hash, "a".repeat(64));
  assert.equal(definitions.fake, undefined);
});

test("recognizes the compact persisted-operation shape used by Spotify bundles", () => {
  const source = 'var a=new n.Ay("getAlbum","query","aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",null);';
  assert.deepEqual(extractGraphQLDefinitions(source), [
    {
      name: "getAlbum",
      operation: "query",
      sha256Hash: "a".repeat(64),
      value: null,
    },
  ]);
});

for (const mode of [undefined, "direct", "snapshot"]) {
  test(`wrapper GraphQL binding preserves the ${mode ?? "v2"} contract`, (t) => {
    const legacyDefinitions = { legacy: { name: "legacy" } };
    for (const [name, value] of Object.entries({
      Spicetify: { GraphQL: { Definitions: legacyDefinitions } },
      __SPICETIFY_CLIENT_BUNDLE_MODE__: mode,
    })) {
      const original = Object.getOwnPropertyDescriptor(globalThis, name);
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
      t.after(() => {
        if (original) Object.defineProperty(globalThis, name, original);
        else Reflect.deleteProperty(globalThis, name);
      });
    }
    const require = Object.assign(
      () => {
        throw new Error("must not execute factories");
      },
      { m: { album: albumFactory } },
    );
    const bindings = createSpicetifyBindings({
      cache: [],
      chunks: [],
      modules: [],
      functionModules: [],
      require,
      exportedMemos: [],
      exportedMemoFRefs: [],
      reactComponentsUI: {},
      scrollableContainer: undefined,
    });
    if (mode === undefined) {
      assert.equal(bindings.GraphQL.Definitions, legacyDefinitions);
      assert.equal(Reflect.set(bindings.GraphQL.Definitions, "extra", {}), true);
    } else {
      assert.equal(bindings.GraphQL.Definitions.getAlbum.sha256Hash, "a".repeat(64));
      assert.equal(Reflect.set(bindings.GraphQL.Definitions, "extra", {}), false);
    }
  });
}
