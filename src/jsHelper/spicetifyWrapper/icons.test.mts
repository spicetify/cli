import { buildSync } from "esbuild";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const source = buildSync({
  entryPoints: [fileURLToPath(new URL("./icons.js", import.meta.url))],
  bundle: true,
  format: "iife",
  write: false,
}).outputFiles[0].text;

type Pairs = Record<string, string>;
type Listener = { keys: string[]; callback: (update: { pairs: Pairs }) => void };

// In-memory stand-in for Spotify's product state service: overrides shadow the account values, and subscribers hear
// about every change to the keys they watch.
function createProductState(initial: Pairs) {
  const values: Pairs = { ...initial };
  const overrides: Pairs = {};
  const listeners = new Set<Listener>();
  let writes = 0;
  const current = (): Pairs => ({ ...values, ...overrides });
  const notify = (keys: string[]) => {
    if (++writes > 50) throw new Error("product state writes did not settle");
    const pairs = current();
    for (const listener of [...listeners]) {
      if (listener.keys.some((key) => keys.includes(key))) listener.callback({ pairs });
    }
  };
  return {
    async getValues() {
      return { pairs: current() };
    },
    async putOverridesValues({ pairs }: { pairs: Pairs }) {
      Object.assign(overrides, pairs);
      notify(Object.keys(pairs));
    },
    async delOverridesValues({ keys }: { keys: string[] }) {
      for (const key of keys) delete overrides[key];
      notify(keys);
    },
    subValues({ keys }: { keys: string[] }, callback: Listener["callback"]) {
      const listener = { keys, callback };
      listeners.add(listener);
      return { cancel: () => listeners.delete(listener) };
    },
    clientRenames(name: string) {
      delete overrides.name;
      values.name = name;
      notify(["name"]);
    },
  };
}

async function loadAppTitle(serviceKey = "_product_state") {
  const productState = createProductState({ name: "Spotify" });
  const Spicetify: any = { Platform: { UserAPI: { [serviceKey]: productState } } };
  runInNewContext(source, { Spicetify, setTimeout });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(Spicetify.AppTitle, "AppTitle was not exposed");
  return { AppTitle: Spicetify.AppTitle, productState };
}

describe("AppTitle", () => {
  it("sets the title and keeps re-applying it until the subscription is cancelled", async () => {
    const { AppTitle, productState } = await loadAppTitle();
    const subscription = await AppTitle.set("Focus");
    assert.equal(await AppTitle.get(), "Focus");

    productState.clientRenames("Spotify Premium");
    assert.equal(await AppTitle.get(), "Focus");

    subscription.cancel();
    productState.clientRenames("Spotify Free");
    assert.equal(await AppTitle.get(), "Spotify Free");
  });

  it("only keeps the latest title when set is called again", async () => {
    const { AppTitle, productState } = await loadAppTitle();
    await AppTitle.set("First");
    await AppTitle.set("Second");

    productState.clientRenames("Spotify");
    assert.equal(await AppTitle.get(), "Second");
  });

  it("stops forcing the title on reset and falls back to the client's", async () => {
    const { AppTitle, productState } = await loadAppTitle();
    await AppTitle.set("Focus");
    await AppTitle.reset();
    assert.equal(await AppTitle.get(), "Spotify");

    productState.clientRenames("Spotify Premium");
    assert.equal(await AppTitle.get(), "Spotify Premium");
  });

  it("reports title changes to sub listeners until they cancel", async () => {
    const { AppTitle, productState } = await loadAppTitle("_product_state_service");
    const titles: string[] = [];
    const subscription = AppTitle.sub((title: string) => titles.push(title));

    productState.clientRenames("Spotify Premium");
    subscription.cancel();
    productState.clientRenames("Spotify Free");

    assert.deepEqual(titles, ["Spotify Premium"]);
  });
});
