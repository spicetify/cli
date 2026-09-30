import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { loadChecks, navigationSucceeded } from "./classmap-cdp-verify.mjs";

const source = readFileSync(new URL("./classmap-cdp-verify.mjs", import.meta.url), "utf8");
const verifier = fileURLToPath(new URL("./classmap-cdp-verify.mjs", import.meta.url));

test("CDP reports bind deep mode and the exact classmap digest", () => {
  assert.match(source, /deep:\s*args\.deep/);
  assert.match(source, /classmap:\s*\{\s*sha256:/);
});

test("help works without report paths", () => {
  const result = spawnSync(process.execPath, [verifier, "--help"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
});

test("an explicit classmap and output do not require a migrate report", () => {
  const result = spawnSync(process.execPath, [verifier, "--classmap", "/tmp/classmap.json", "--out", "/tmp/cdp.json", "--timeout-ms", "1"], {
    encoding: "utf8",
  });
  assert.doesNotMatch(result.stderr, /Pass --report/);
});

test("out-dir does not silently consume a stale migrate report", () => {
  const dir = mkdtempSync(join(tmpdir(), "classmap-cdp-test-"));
  try {
    writeFileSync(join(dir, "classmap.json"), '{"leaf":"hashValueAA"}\n');
    writeFileSync(join(dir, "report.json"), "not json\n");
    const result = spawnSync(process.execPath, [verifier, "--out-dir", dir, "--timeout-ms", "1"], {
      encoding: "utf8",
    });
    assert.doesNotMatch(result.stderr, /Unexpected token|JSON/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("semantic class conjunction is mapped token by token", () => {
  assert.match(source, /semanticClassName\(hash, cssMap\)/);
  assert.match(source, /split\(\/\\s\+\/\).*cssMap\[token\] \|\| token/s);
});

test("navigation success excludes explicit failure sentinels", () => {
  assert.match(source, /function navigationSucceeded\(result\)/);
  assert.match(source, /nav-failed\|context-menu-dispatched\|no-track-row\|sort-not-found\|no-settings-scroll-target/);
  assert.match(source, /if \(!navigationSucceeded\(navResult\)\)/);
});

for (const args of [
  ["--mode", "invalid"],
  ["--min-hit-rate", "NaN"],
  ["--min-hit-rate", "2"],
  ["--timeout-ms", "0"],
  ["--port", "70000"],
]) {
  test(`rejects invalid arguments: ${args.join(" ")}`, () => {
    const result = spawnSync(process.execPath, [verifier, "--classmap", "/tmp/map.json", "--out", "/tmp/out.json", ...args], {
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /invalid/i);
  });
}

test("an overlay renames classes on top of the CLI css-map", () => {
  const dir = mkdtempSync(join(tmpdir(), "classmap-cdp-test-"));
  try {
    writeFileSync(join(dir, "classmap.json"), '{"topbar":"hashTopAA","nav":"hashNavBB"}\n');
    writeFileSync(join(dir, "css-map.json"), '{"hashTopAA":"main-topBar-old","hashNavBB":"main-navBar-navBar"}\n');
    writeFileSync(join(dir, "overlay.json"), '{"hashTopAA":"Root__globalNav"}\n');
    const checks = loadChecks({
      reportPath: null,
      classmapPath: join(dir, "classmap.json"),
      cssMapPath: join(dir, "css-map.json"),
      overlayPath: join(dir, "overlay.json"),
    });
    assert.deepEqual(
      checks.map(({ path, semantic }) => ({ path, semantic })),
      [
        { path: "topbar", semantic: "Root__globalNav" },
        { path: "nav", semantic: "main-navBar-navBar" },
      ],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a step that could not open its surface does not count as navigation", () => {
  for (const result of ["context-menu-open", "credits-open", "embed-open", "settings-open", "scrolled-settings", "clicked-home"]) {
    assert.equal(navigationSucceeded(result), true, result);
  }
  for (const result of ["context-menu-dispatched", "credits-not-found", "embed-not-found", "settings-not-rendered", "no-track-row", "nav-failed:/"]) {
    assert.equal(navigationSucceeded(result), false, result);
  }
});
