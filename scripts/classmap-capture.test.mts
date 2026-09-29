import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, test } from "node:test";

import {
  classSignatures,
  confidenceLabel,
  flattenClassmap,
  isHashLike,
  migrateClassmap,
  pyRound,
  semanticFit,
  splitRules,
  verifyClassmap,
  versionToKey,
} from "./classmap-capture.ts";

const map = (entries: Record<string, string>) => new Map(Object.entries(entries));

describe("isHashLike", () => {
  test("accepts real hashes", () => {
    // Short real hash from the 1.2.45 fixture (play button).
    for (const token of ["cLkUmr", "AbCdEfGh", "Xy1_abC", "aB3d"]) assert.ok(isHashLike(token), token);
  });

  test("rejects semantic and Encore classes", () => {
    for (const token of ["main-topbar", "spotify-play-button", "encore-text", "abc", "alllower", "A".repeat(26)]) {
      assert.ok(!isHashLike(token), token);
    }
  });
});

describe("rules and signatures", () => {
  const css = `
    .cLkUmr, .other_Class { color: red; padding: 4px; }
    /* comment { ignored } */
    .main-topbar { --custom: 1; background: blue; }
    @media (min-width: 100px) { .ignoredAtRule { color: green; } }
  `;

  test("splits rules and skips at-rules", () => {
    const selectors = splitRules(css).map(([selector]) => selector);
    assert.ok(selectors.some((s) => s.includes("cLkUmr")));
    assert.ok(!selectors.some((s) => s.startsWith("@")));
  });

  test("signatures skip CSS variables", () => {
    const sigs = classSignatures(".foo { --x: 1; color: red; }");
    const props = [...(sigs.get("foo")?.values() ?? [])].flatMap((sig) => [...sig].map((pair) => pair.split("\0")[0]));
    assert.deepEqual(props, ["color"]);
  });
});

describe("semanticFit false friends", () => {
  test("rejects actionBar for the playbar", () => assert.equal(semanticFit(["main", "playbar", "controls"], "actionBar"), 0));
  test("accepts nowPlayingBar for the playbar", () => assert.ok(semanticFit(["main", "playbar", "controls"], "nowPlayingBar") > 0));
  test("a close leaf requires close", () => {
    assert.equal(semanticFit(["main", "topbar", "close"], "topBarButton"), 0);
    assert.ok(semanticFit(["main", "topbar", "close"], "topBarCloseBtn") > 0);
  });
  test("an empty semantic scores zero", () => assert.equal(semanticFit(["a", "b"], ""), 0));
});

test("versionToKey pads minor and patch", () => {
  assert.equal(versionToKey("1.2.45"), "1020045");
  assert.equal(versionToKey("1.2.93"), "1020093");
  assert.equal(versionToKey("1.2.8"), "1020008");
  assert.equal(versionToKey("1.3.1.234"), "1030001");
});

test("pyRound matches Python's round on exact binary halves", () => {
  assert.equal(pyRound(0.03125, 4), 0.0312);
  assert.equal(pyRound(0.09375, 4), 0.0938);
  assert.equal(pyRound(1 / 3, 4), 0.3333);
  assert.equal(pyRound(0.00015, 4), 0.0001);
});

describe("verifyClassmap", () => {
  test("a multi-class leaf is present when every token exists", () => {
    const { rows } = verifyClassmap(
      { settings: { text_input: "formInputAA formControlBB encore-text-body-medium" } },
      ".formInputAA { color: red; } .formControlBB { color: blue; } .encore-text-body-medium { font-size: 1rem; }",
      new Map(),
    );
    assert.equal(rows[0].in_target_css, true);
    assert.deepEqual(rows[0].missing_classes, []);
    assert.equal(rows[0].selector_hits, 3);
  });

  test("a multi-class leaf reports only the missing tokens", () => {
    const { rows } = verifyClassmap({ settings: { text_input: "formInputAA missingControlBB" } }, ".formInputAA { color: red; }", new Map());
    assert.equal(rows[0].in_target_css, false);
    assert.deepEqual(rows[0].missing_classes, ["missingControlBB"]);
    assert.equal(rows[0].verdict, "missing_in_css");
  });

  test("a multi-class leaf reports each token's semantic", () => {
    const { rows } = verifyClassmap(
      { settings: { text_input: "formInputAA formControlBB" } },
      ".formInputAA { color: red; } .formControlBB { color: blue; }",
      map({ formInputAA: "x-settings-input", formControlBB: "x-settings-control" }),
    );
    assert.equal(rows[0].in_css_map, true);
    assert.deepEqual(rows[0].semantics, ["x-settings-input", "x-settings-control"]);
  });

  test("the static report records the target build and CSS digest", () => {
    const css = ".topbarHashAA { color: red; }";
    const { target } = verifyClassmap({ main: { topbar: { wrapper: "topbarHashAA" } } }, css, new Map(), null, "1.2.96.518");
    assert.equal(target.spotify_version, "1.2.96.518");
    assert.equal(target.css_sha256, crypto.createHash("sha256").update(css).digest("hex"));
  });
});

describe("migrateClassmap", () => {
  const baseCss = ".oldHashAA { color: red; padding: 4px; } .keepMe99 { margin: 0; }";
  const targetCss = ".newHashBB { color: red; padding: 4px; } .keepMe99 { margin: 0; }";
  const migrate = (baseMap: Record<string, any>, cssMap: Map<string, string>) =>
    migrateClassmap(baseMap, classSignatures(baseCss), classSignatures(targetCss), cssMap, 0.5);

  test("keeps a class that survived unchanged", () => {
    const [out, report] = migrate({ main: { widget: "keepMe99" } }, new Map());
    assert.deepEqual(out, { main: { widget: "keepMe99" } });
    assert.equal(report.stats.identity, 1);
    assert.equal(report.identity[0].method, "identity");
    assert.equal(confidenceLabel(report.identity[0]), "high");
  });

  test("follows CSS evidence to the renamed class", () => {
    const [out, report] = migrate({ main: { widget: "oldHashAA" } }, new Map());
    assert.deepEqual(out, { main: { widget: "newHashBB" } });
    assert.equal(report.stats.matched, 1);
  });

  test("marks an unmatched leaf stale and keeps its old hash", () => {
    const [out, report] = migrate({ main: { widget: "notInBase1" } }, new Map());
    // Old hash kept for incremental re-runs, but explicitly marked stale.
    assert.deepEqual(out, { main: { widget: "notInBase1" } });
    assert.equal(report.stats.unmatched, 1);
    assert.equal(report.stats.stale_kept, 1);
    assert.equal(report.unmatched[0].stale, true);
    assert.equal(report.unmatched[0].kept, "notInBase1");
  });

  test("a semantic-only match requires the class in the target CSS", () => {
    // css-map claims a great semantic fit, but the class does not exist in the target CSS at all.
    const [out, report] = migrate({ main: { playbar: { controls: "notInBase1" } } }, map({ ghostHash1: "nowPlayingBarControls" }));
    assert.deepEqual(out, { main: { playbar: { controls: "notInBase1" } } });
    assert.equal(report.stats.matched, 0);
  });

  test("a semantic-only match has low confidence", () => {
    const [out, report] = migrateClassmap(
      { main: { playbar: { controls: "notInBase1" } } },
      new Map(),
      classSignatures(".newHashBB { color: red; }"),
      map({ newHashBB: "nowPlayingBarControls" }),
      0.5,
    );
    assert.deepEqual(out, { main: { playbar: { controls: "newHashBB" } } });
    assert.equal(report.matched[0].method, "semantic-only");
    assert.equal(confidenceLabel(report.matched[0]), "low");
  });
});

describe("flattenClassmap", () => {
  const base = { main: { topbar: { wrapper: "oldHashAA11" } }, settings: { button: { wrapper: "oldHashBB22" } } };
  const cssMap = map({ oldHashAA11: "main-topBar-topbarContent", newHashCC33: "x-settings-button" });
  const report = {
    matched: [{ path: "settings.button.wrapper", new: "newHashCC33", semantic: "x-settings-button" }],
    unmatched: [{ path: "main.topbar.icon", old: "staleHash99", stale: true }],
    identity: [],
  };

  test("the base hash's css-map name wins", () => {
    const [overlay, skipped] = flattenClassmap({ main: { topbar: { wrapper: "newHashAA44" } } }, base, cssMap, null, null);
    assert.deepEqual(overlay, { newHashAA44: "main-topBar-topbarContent" });
    assert.deepEqual(skipped, []);
  });

  test("skips a hash the global css-map already renames", () => {
    const [overlay] = flattenClassmap({ settings: { button: { wrapper: "newHashCC33" } } }, base, cssMap, report, null);
    assert.deepEqual(overlay, {});
  });

  test("falls back to the report's semantic for hand-edited leaves", () => {
    const handEdited = { matched: [{ path: "settings.header.container", semantic: "x-settings-header" }], unmatched: [], identity: [] };
    const [overlay] = flattenClassmap({ settings: { header: { container: "newHashHH77" } } }, base, cssMap, handEdited, null);
    assert.deepEqual(overlay, { newHashHH77: "x-settings-header" });
  });

  test("excludes stale leaves from the report and META", () => {
    assert.deepEqual(flattenClassmap({ main: { topbar: { icon: "staleHash99" } } }, base, cssMap, report, null)[0], {});
    const meta = { stale_leaves: ["main.topbar.wrapper"] };
    assert.deepEqual(flattenClassmap({ main: { topbar: { wrapper: "newHashAA44" } } }, base, cssMap, null, meta)[0], {});
  });

  test("skips an unresolvable leaf with a warning", () => {
    const [overlay, skipped] = flattenClassmap({ main: { mystery: { leaf: "newHashZZ99" } } }, base, cssMap, null, null);
    assert.deepEqual(overlay, {});
    assert.equal(skipped.length, 1);
  });

  test("excludes unverified leaves and warns about an unverified required path", () => {
    const meta = { unverified_leaves: ["settings.button.wrapper"], required_paths: { "settings.button.wrapper": "unverified" } };
    const semantic = { matched: [{ path: "settings.button.wrapper", semantic: "x-settings-button" }], unmatched: [], identity: [] };
    const [overlay, skipped] = flattenClassmap({ settings: { button: { wrapper: "newHashUU55" } } }, base, cssMap, semantic, meta);
    assert.deepEqual(overlay, {});
    assert.ok(skipped.some((s) => s.includes("required path")));
  });

  test("keeps the first of two conflicting names and warns", () => {
    const [overlay, skipped] = flattenClassmap(
      { a: { leaf: "sharedHash1" }, b: { leaf: "sharedHash1" } },
      { a: { leaf: "oldA1" }, b: { leaf: "oldB1" } },
      map({ oldA1: "name-a", oldB1: "name-b" }),
      null,
      null,
    );
    assert.deepEqual(overlay, { sharedHash1: "name-a" });
    assert.ok(skipped.some((s) => s.includes("conflicting")));
  });
});
