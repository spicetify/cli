import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { managedSpotify } from "./managedSpotify.js";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  delete globalThis.__SPICETIFY_DAEMON_TOKEN__;
});

test("managed package calls authenticate and never use Spotify's native updater", async () => {
  globalThis.__SPICETIFY_DAEMON_TOKEN__ = "test-token";
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push([String(url), options.method, options.headers["x-spicetify-token"]]);
    return Response.json({ kind: "current", version: "1.2.96" });
  };
  await managedSpotify.status();
  await managedSpotify.check();
  await managedSpotify.update();
  assert.deepEqual(calls, [
    ["http://127.0.0.1:7967/spotify", "GET", "test-token"],
    ["http://127.0.0.1:7967/spotify/check", "POST", "test-token"],
    ["http://127.0.0.1:7967/spotify/update", "POST", "test-token"],
  ]);
});

test("missing daemon capability degrades only the status probe", async () => {
  globalThis.__SPICETIFY_DAEMON_TOKEN__ = "test-token";
  globalThis.fetch = async () => new Response("unsupported", { status: 404 });
  assert.equal(await managedSpotify.status(), null);
  await assert.rejects(managedSpotify.update(), /unsupported/);
});

test("a missing token never sends an update request", async () => {
  globalThis.fetch = async () => {
    throw new Error("must not fetch");
  };
  await assert.rejects(managedSpotify.update(), /no daemon token/);
});
