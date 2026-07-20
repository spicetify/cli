"""Unit tests for classmap_capture.py.

Run with: python3 -m unittest scripts.test_classmap_capture -v
(or: python3 scripts/test_classmap_capture.py)
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import classmap_capture as cc  # noqa: E402


class TestIsHashLike(unittest.TestCase):
    def test_real_hashes(self):
        # Short real hash from the 1.2.45 fixture (play button).
        self.assertTrue(cc.is_hash_like("cLkUmr"))
        self.assertTrue(cc.is_hash_like("AbCdEfGh"))
        self.assertTrue(cc.is_hash_like("Xy1_abC"))
        self.assertTrue(cc.is_hash_like("aB3d"))

    def test_rejects_semantic_and_encore(self):
        self.assertFalse(cc.is_hash_like("main-topbar"))
        self.assertFalse(cc.is_hash_like("spotify-play-button"))
        self.assertFalse(cc.is_hash_like("encore-text"))
        self.assertFalse(cc.is_hash_like("abc"))  # too short
        self.assertFalse(cc.is_hash_like("alllower"))
        self.assertFalse(cc.is_hash_like("A" * 26))  # too long


class TestSplitRulesAndSignatures(unittest.TestCase):
    CSS = """
    .cLkUmr, .other_Class { color: red; padding: 4px; }
    /* comment { ignored } */
    .main-topbar { --custom: 1; background: blue; }
    @media (min-width: 100px) { .ignoredAtRule { color: green; } }
    """

    def test_split_rules(self):
        rules = cc.split_rules(self.CSS)
        selectors = [s for s, _ in rules]
        self.assertTrue(any("cLkUmr" in s for s in selectors))
        self.assertFalse(any(s.startswith("@") for s in selectors))

    def test_signatures_skip_css_vars(self):
        sigs = cc.class_signatures(".foo { --x: 1; color: red; }")
        self.assertIn("foo", sigs)
        flat = {p for sig in sigs["foo"] for p, _ in sig}
        self.assertEqual(flat, {"color"})


class TestSemanticFitFalseFriends(unittest.TestCase):
    def test_actionbar_rejected_for_playbar(self):
        path = ("main", "playbar", "controls")
        self.assertEqual(cc.semantic_fit(path, "actionBar"), 0.0)

    def test_nowplayingbar_accepted_for_playbar(self):
        path = ("main", "playbar", "controls")
        self.assertGreater(cc.semantic_fit(path, "nowPlayingBar"), 0.0)

    def test_close_leaf_requires_close(self):
        path = ("main", "topbar", "close")
        self.assertEqual(cc.semantic_fit(path, "topBarButton"), 0.0)
        self.assertGreater(cc.semantic_fit(path, "topBarCloseBtn"), 0.0)

    def test_empty_semantic(self):
        self.assertEqual(cc.semantic_fit(("a", "b"), ""), 0.0)


class TestVersionToKey(unittest.TestCase):
    def test_keys(self):
        self.assertEqual(cc.version_to_key("1.2.45"), "1020045")
        self.assertEqual(cc.version_to_key("1.2.93"), "1020093")
        self.assertEqual(cc.version_to_key("1.2.8"), "1020008")


class TestMigrateClassmap(unittest.TestCase):
    BASE_CSS = ".oldHashAA { color: red; padding: 4px; } .keepMe99 { margin: 0; }"
    TARGET_CSS = ".newHashBB { color: red; padding: 4px; } .keepMe99 { margin: 0; }"

    def _migrate(self, base_map, css_map, threshold=0.5):
        base_sigs = cc.class_signatures(self.BASE_CSS)
        target_sigs = cc.class_signatures(self.TARGET_CSS)
        return cc.migrate_classmap(base_map, base_sigs, target_sigs, css_map, threshold)

    def test_identity_kept(self):
        base_map = {"main": {"widget": "keepMe99"}}
        out, report = cc.migrate_classmap(
            base_map,
            cc.class_signatures(self.BASE_CSS),
            cc.class_signatures(self.TARGET_CSS),
            {},
            0.5,
        )
        self.assertEqual(out["main"]["widget"], "keepMe99")
        self.assertEqual(report["stats"]["identity"], 1)
        self.assertEqual(report["identity"][0]["method"], "identity")
        self.assertEqual(cc.confidence_label(report["identity"][0]), "high")

    def test_css_evidence_match(self):
        base_map = {"main": {"widget": "oldHashAA"}}
        out, report = self._migrate(base_map, {})
        self.assertEqual(out["main"]["widget"], "newHashBB")
        self.assertEqual(report["stats"]["matched"], 1)

    def test_unmatched_marks_stale_and_keeps_old_hash(self):
        base_map = {"main": {"widget": "notInBase1"}}
        out, report = self._migrate(base_map, {})
        # Old hash kept for incremental re-runs, but explicitly marked stale.
        self.assertEqual(out["main"]["widget"], "notInBase1")
        self.assertEqual(report["stats"]["unmatched"], 1)
        self.assertEqual(report["stats"]["stale_kept"], 1)
        entry = report["unmatched"][0]
        self.assertTrue(entry["stale"])
        self.assertEqual(entry["kept"], "notInBase1")

    def test_semantic_only_requires_target_presence(self):
        # css-map claims a great semantic fit, but the class does not exist
        # in the target CSS at all: must not be matched.
        base_map = {"main": {"playbar": {"controls": "notInBase1"}}}
        css_map = {"ghostHash1": "nowPlayingBarControls"}
        out, report = self._migrate(base_map, css_map)
        self.assertEqual(out["main"]["playbar"]["controls"], "notInBase1")
        self.assertEqual(report["stats"]["matched"], 0)

    def test_semantic_only_low_confidence(self):
        # Old hash absent from base CSS; semantic-only fallback via css-map
        # with the candidate present in target CSS: matched but low confidence.
        target_sigs = cc.class_signatures(".newHashBB { color: red; }")
        base_map = {"main": {"playbar": {"controls": "notInBase1"}}}
        css_map = {"newHashBB": "nowPlayingBarControls"}
        out, report = cc.migrate_classmap(base_map, {}, target_sigs, css_map, 0.5)
        self.assertEqual(out["main"]["playbar"]["controls"], "newHashBB")
        m = report["matched"][0]
        self.assertEqual(m["method"], "semantic-only")
        self.assertEqual(cc.confidence_label(m), "low")


if __name__ == "__main__":
    unittest.main()
