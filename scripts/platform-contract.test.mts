import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import {
  type ContractEntry,
  DEFAULT_CONTRACT,
  checkContract,
  classify,
  formatResults,
  loadContract,
  probePaths,
  summarize,
} from "./platform-contract.ts";

const script = fileURLToPath(new URL("./platform-contract.ts", import.meta.url));

const entry = (fields: Partial<ContractEntry>): ContractEntry => ({
  type: "function",
  required: true,
  usedBy: ["src/jsHelper/spicetifyWrapper/core.js:1"],
  feature: "test",
  ...fields,
});

/** A page whose evaluate runs the expression in a separate realm holding `globals`, as Runtime.evaluate does. */
const fakePage = (globals: Record<string, unknown>) => {
  const context = vm.createContext(globals);
  return { evaluate: async (expression: string) => vm.runInContext(expression, context) };
};

const client = () => ({
  Spicetify: {
    _platform: {},
    Platform: {
      version: "1.3.0.277",
      operatingSystem: "macOS",
      PlatformData: { app_platform: "OSX_ARM64" },
      Registry: { _map: new Map(), resolve() {} },
      UserAPI: { _product_state_service: {} },
      PlaybackAPI: { _volume: "loud" },
      get Exploding() {
        throw new Error("getter threw");
      },
    },
  },
});

describe("checkContract against a fake page", () => {
  test("reports present, missing and type-mismatch paths", async () => {
    const entries = [
      entry({ path: "Spicetify.Platform.version", type: "string" }),
      entry({ path: "Spicetify.Platform.Registry._map", type: "map" }),
      entry({ path: "Spicetify.Platform.Registry.resolve" }),
      entry({ path: "Spicetify.Platform.PlatformData.os_name", type: "string", required: false }),
      entry({ path: "Spicetify.Platform.PlaybackAPI._volume", type: "number" }),
      entry({ path: "Spicetify.Platform.PlayerAPI.seekTo" }),
    ];
    const { version, results } = await checkContract(fakePage(client()), entries);
    assert.equal(version, "1.3.0.277");
    assert.deepEqual(
      results.map(({ path, status, actual, missingAt }) => ({ path, status, actual, missingAt })),
      [
        { path: "Spicetify.Platform.version", status: "present", actual: "string", missingAt: undefined },
        { path: "Spicetify.Platform.Registry._map", status: "present", actual: "map", missingAt: undefined },
        { path: "Spicetify.Platform.Registry.resolve", status: "present", actual: "function", missingAt: undefined },
        { path: "Spicetify.Platform.PlatformData.os_name", status: "missing", actual: "undefined", missingAt: undefined },
        { path: "Spicetify.Platform.PlaybackAPI._volume", status: "type-mismatch", actual: "string", missingAt: undefined },
        { path: "Spicetify.Platform.PlayerAPI.seekTo", status: "missing", actual: "undefined", missingAt: "Spicetify.Platform.PlayerAPI" },
      ],
    );
  });

  test("anyOf is present when any alternative matches", async () => {
    const [result] = await checkContract(fakePage(client()), [
      entry({
        anyOf: ["Spicetify.Platform.UserAPI._product_state", "Spicetify.Platform.UserAPI._product_state_service"],
        type: "object",
      }),
    ]).then((r) => r.results);
    assert.equal(result.status, "present");
    assert.equal(result.matched, "Spicetify.Platform.UserAPI._product_state_service");
  });

  test("a client without the Spicetify global is an error, not a list of missing paths", async () => {
    await assert.rejects(checkContract(fakePage({}), [entry({ path: "Spicetify.Platform.version" })]), /no Spicetify global/);
  });

  test("a throwing getter reports the path as missing", () => {
    const [probe] = probePaths(client(), ["Spicetify.Platform.Exploding.thing"]);
    assert.equal(probe.type, "undefined");
    assert.match(probe.error ?? "", /getter threw/);
  });
});

describe("summary and exit code", () => {
  const results = (statuses: [string, boolean][]) =>
    classify(
      statuses.map(([path, required]) => entry({ path, required })),
      statuses.map(([path]) => ({ path, type: path.startsWith("ok") ? "function" : "undefined" })),
    );

  test("passes when only optional paths are missing", () => {
    const summary = summarize(
      results([
        ["ok.a", true],
        ["gone.b", false],
      ]),
    );
    assert.deepEqual(summary, { total: 2, present: 1, missing: 1, typeMismatch: 0, failures: 0, warnings: 1, exitCode: 0 });
  });

  test("fails with exit code 2 when a required path is missing", () => {
    const summary = summarize(
      results([
        ["ok.a", true],
        ["gone.b", true],
      ]),
    );
    assert.equal(summary.failures, 1);
    assert.equal(summary.exitCode, 2);
  });

  test("the text report lists failures before warnings with their wrapper citations", () => {
    const text = formatResults(
      results([
        ["gone.optional", false],
        ["gone.required", true],
      ]),
    );
    assert.match(text, /Present: 0\/2\n {2}FAIL gone\.required: missing\n.*core\.js:1\n {2}WARN gone\.optional/);
  });
});

describe("contract file", () => {
  test("the shipped contract is well formed", () => {
    assert.ok(loadContract(DEFAULT_CONTRACT).length > 0);
  });

  test("rejects an entry with both path and anyOf, or an unknown type", () => {
    const dir = mkdtempSync(join(tmpdir(), "platform-contract-test-"));
    try {
      for (const bad of [entry({ path: "a", anyOf: ["b"] }), { ...entry({ path: "a" }), type: "array" }]) {
        const file = join(dir, "contract.json");
        writeFileSync(file, JSON.stringify({ entries: [bad] }));
        assert.throws(() => loadContract(file));
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("CLI", () => {
  test("help exits 0", () => {
    const result = spawnSync(process.execPath, [script, "--help"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  });

  for (const args of [
    ["--port", "70000"],
    ["--timeout-ms", "0"],
  ]) {
    test(`rejects invalid arguments: ${args.join(" ")}`, () => {
      const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /invalid/i);
    });
  }

  test("an unreachable CDP endpoint exits 1", () => {
    const result = spawnSync(process.execPath, [script, "--port", "1", "--timeout-ms", "1"], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /CDP not reachable/);
  });
});
