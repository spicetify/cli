import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const loaderSource = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const captureModule = await import("./webpackCapture.ts").catch(() => undefined);
const queueModule = await import("../shared/webpackChunkQueue.js");

describe("modular loader boot order", () => {
  it("waits for webpack capture before loading modules", () => {
    assert.match(loaderSource, /await captureWebpackRequire\(\);\s*await registry\.runLoads\(report\);/);
  });

  it("boots Spotify 1.3 from its direct xpui bundle", () => {
    assert.match(loaderSource, /__SPICETIFY_CLIENT_BUNDLE_MODE__/);
    assert.match(loaderSource, /kind:\s*["']direct["']/);
    assert.match(loaderSource, /bundle:\s*["']\/xpui\.js["']/);
  });

  it("selects only a queue whose runtime is ready", () => {
    const unready = [];
    const scoped = [];
    scoped.push = () => 1;
    const direct = [];
    direct.push = () => 2;

    assert.equal(queueModule.getWebpackChunkQueue({ rspackChunk: unready, rspackChunkclient_web: scoped }), scoped);
    assert.equal(queueModule.getWebpackChunkQueue({ rspackChunk: direct, rspackChunkclient_web: scoped }), direct);
    assert.equal(queueModule.getWebpackChunkQueue({ webpackChunkclient_web: scoped }), scoped);
    assert.equal(queueModule.getWebpackChunkQueue({ rspackChunk: unready }), undefined);
  });

  it("reports success only after the rspack callback supplies webpack require", async () => {
    assert.equal(typeof captureModule?.captureWebpackRequire, "function");
    let now = 0;
    let runtime: ((require: unknown) => unknown) | undefined;
    let captured: unknown;
    const ok = await captureModule!.captureWebpackRequire({
      maxWaitMs: 100,
      now: () => now,
      wait: async () => {
        now += 10;
        runtime?.(() => "webpack");
      },
      getQueue: () => ({
        push: (chunk: unknown[]) => {
          runtime = chunk[2] as (require: unknown) => unknown;
          return 1;
        },
      }),
      getCaptured: () => captured,
      setCaptured: (require) => (captured = require),
    });
    assert.equal(ok, true);
    assert.equal(typeof captured, "function");
  });

  it("times out when queue push never invokes the runtime callback", async () => {
    assert.equal(typeof captureModule?.captureWebpackRequire, "function");
    let now = 0;
    const ok = await captureModule!.captureWebpackRequire({
      maxWaitMs: 20,
      now: () => now,
      wait: async () => {
        now += 10;
      },
      getQueue: () => ({ push: () => 1 }),
      getCaptured: () => undefined,
      setCaptured: () => assert.fail("capture callback should not run"),
    });
    assert.equal(ok, false);
  });
});
