#!/usr/bin/env python3
"""Capture / migrate / verify Spicetify classmaps between Spotify CSS builds.

Commands
--------
  inventory   List class tokens from CSS/spa
  migrate     Migrate a classmap (CSS signatures + optional css-map.json)
  verify      Score a classmap or migrate report against css-map + live CSS
  key         Print classmap folder key for a version
  devtools    Print DevTools snippets to manually verify matched paths

css-map.json signal
-------------------
The CLI css-map maps *current* hashed classes -> stable semantic names
(e.g. main-topBar-container). During migrate we:
  1. Prefer target candidates that appear as keys in css-map
  2. Boost candidates whose semantic name token-overlaps the classmap path
  3. Penalize / reject high CSS similarity when semantic tokens conflict

Examples
--------
  python3 scripts/classmap_capture.py migrate \\
    --base-classmap ../classmaps/1020040/classmap-190747c4b8f.json \\
    --base-css-dir ../xpui-archive/1.2.40.599 \\
    --target-spa "/Applications/Spotify.app/Contents/Resources/Apps/xpui.spa" \\
    --css-map css-map.json \\
    --out classmaps/1020092/classmap.json \\
    --report classmaps/1020092/report.json \\
    --allow-partial

  python3 scripts/classmap_capture.py verify \\
    --classmap classmaps/1020092/classmap.json \\
    --report classmaps/1020092/report.json \\
    --css-map css-map.json \\
    --target-spa "/Applications/Spotify.app/Contents/Resources/Apps/xpui.spa" \\
    --out classmaps/1020092/verify.json

  python3 scripts/classmap_capture.py devtools \\
    --report classmaps/1020092/report.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from collections import defaultdict
from pathlib import Path
from typing import Any

PROP_RE = re.compile(r"([a-zA-Z-]+)\s*:\s*([^;]+);")


def is_hash_like(token: str) -> bool:
    # Min length 4: real Spotify hashes can be short (e.g. the 1.2.45
    # play button class "cLkUmr" is 6 chars). Semantic/Encore classes are
    # filtered by the lowercase-dash and prefix rules below, and matchers
    # still require CSS or semantic evidence, so a low bound is safe here.
    if len(token) < 4 or len(token) > 25:
        return False
    if "-" in token and token.islower():
        return False
    if token.startswith("spotify") or token.startswith("encore"):
        return False
    has_upper = any(c.isupper() for c in token)
    has_lower = any(c.islower() for c in token)
    has_digit = any(c.isdigit() for c in token)
    if has_upper and has_lower:
        return True
    if "_" in token and (has_digit or has_upper):
        return True
    return False


def read_css_sources(spa: str | None, css_dir: str | None, css_files: list[str] | None) -> str:
    chunks: list[str] = []
    if spa:
        with zipfile.ZipFile(spa) as zf:
            for name in zf.namelist():
                if name.endswith(".css"):
                    chunks.append(zf.read(name).decode("utf-8", errors="ignore"))
    if css_dir:
        for path in sorted(Path(css_dir).rglob("*.css")):
            chunks.append(path.read_text(encoding="utf-8", errors="ignore"))
    for f in css_files or []:
        chunks.append(Path(f).read_text(encoding="utf-8", errors="ignore"))
    if not chunks:
        raise SystemExit("no CSS sources provided (use --spa, --css-dir, or --css)")
    return "\n".join(chunks)


def split_rules(css: str) -> list[tuple[str, str]]:
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    rules: list[tuple[str, str]] = []
    i, n = 0, len(css)
    while i < n:
        start = css.find("{", i)
        if start < 0:
            break
        selector = css[i:start].strip()
        depth = 1
        j = start + 1
        while j < n and depth:
            if css[j] == "{":
                depth += 1
            elif css[j] == "}":
                depth -= 1
            j += 1
        body = css[start + 1 : j - 1]
        if selector and not selector.lstrip().startswith("@"):
            rules.append((selector, body))
        i = j
    return rules


def normalize_props(body: str) -> frozenset[tuple[str, str]]:
    props = []
    for m in PROP_RE.finditer(body):
        prop = m.group(1).strip().lower()
        val = re.sub(r"\s+", " ", m.group(2).strip().lower())
        if prop.startswith("--") or prop in {"content", "src", "animation-name"}:
            continue
        props.append((prop, val))
    return frozenset(props)


def class_signatures(css: str) -> dict[str, set[frozenset[tuple[str, str]]]]:
    out: dict[str, set[frozenset[tuple[str, str]]]] = defaultdict(set)
    for selector, body in split_rules(css):
        props = normalize_props(body)
        if not props:
            continue
        for cls in re.findall(r"\.([A-Za-z0-9_-]+)", selector):
            out[cls].add(props)
    return out


def inventory_classes(css: str) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for selector, _ in split_rules(css):
        for cls in re.findall(r"\.([A-Za-z0-9_-]+)", selector):
            counts[cls] += 1
    return dict(sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])))


def jaccard(a: frozenset, b: frozenset) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def load_css_map(path: str | None) -> dict[str, str]:
    if not path:
        return {}
    data = json.loads(Path(path).read_text())
    if not isinstance(data, dict):
        raise SystemExit("css-map must be a JSON object")
    return {str(k): str(v) for k, v in data.items()}


def tokenize_semantic(name: str) -> set[str]:
    parts = re.split(r"[-_.\s]+", name)
    tokens: set[str] = set()
    for p in parts:
        if not p:
            continue
        sub = re.findall(r"[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+", p)
        if not sub:
            tokens.add(p.lower())
        else:
            for s in sub:
                tokens.add(s.lower())
    return tokens


# Path segment -> semantic tokens expected in css-map values.
PATH_HINTS: dict[str, set[str]] = {
    "topbar": {"topbar", "topbarcontent", "globalnav"},
    "playbar": {"nowplayingbar", "playercontrols", "playbackbar"},
    "navbar": {"navbar", "navlink", "navitem", "yourlibraryx"},
    "search_chips": {"searchcategory", "chip", "filterchips"},
    "search_box": {"search", "filterbox", "searchinput", "globalnav"},
    "widget_generator": {"embedwidgetgenerator", "embedwidget"},
    "track_credits": {"trackcredits"},
    "settings": {"settings", "desktopsettings"},
    "sort_box": {"sortbox", "sortdropdown", "sort"},
    "scrollable_text": {"marquee"},
    "context_menu": {"contextmenu"},
    "tracklist": {"tracklist"},
    "chip": {"chip"},
    "close": {"closebtn", "close"},
    "menu_item": {"menuitem", "contextmenu"},
    "expand_button": {"expandbutton", "searchinput"},
    "upgrade_button": {"upgradebutton", "upgrade"},
    "indicator": {"indicator"},
}

# Region segment -> required substrings in the lowercased full semantic name.
# Matching is against the full css-map value, not tokenized pieces, so
# "nowPlayingBar" and "actionBar" stay distinct.
REGION_REQUIRED: dict[str, tuple[str, ...]] = {
    "topbar": ("topbar", "globalnav"),
    "playbar": ("nowplayingbar", "player-controls", "playercontrols", "playbackbar"),
    "navbar": ("navbar", "navlink", "navitem", "yourlibraryx", "mainnav"),
    "track_credits": ("trackcredits",),
    "widget_generator": ("embedwidget",),
    "settings": ("settings",),
    "tracklist": ("tracklist",),
    "search_chips": ("search", "chip", "filterchip"),
    "search_box": ("search", "filterbox", "globalnav"),
    "context_menu": ("contextmenu",),
    "sort_box": ("sort",),
}

# If path contains the region, reject semantics that match these substrings.
REGION_FORBIDDEN: dict[str, tuple[str, ...]] = {
    "playbar": (
        "actionbar",
        "tracklist",
        "watchfeed",
        "entityheader",
        "rowplay",
        "rowimage",
    ),
    "topbar": ("actionbar", "entityheader", "watchfeed"),
    "settings": ("equalizer", "nowplayingview", "actionbar"),
    "widget_generator": ("watchfeed", "filterbox", "sortbox"),
    "search_chips": ("nowplaying", "actionbar", "tracklist"),
    "search_box": ("yourlibrary", "actionbar", "tracklist"),
    "navbar": ("topbar", "nowplaying", "actionbar"),
    "tracklist": ("actionbar", "nowplayingbar", "globalnav"),
    "context_menu": ("settings", "equalizer", "sortbox"),
}

# Leaf segment requirements against full semantic string.
LEAF_REQUIRED: dict[str, tuple[str, ...]] = {
    "close": ("close",),
    "content": ("content", "body", "iframe", "code"),
    "header": ("header", "title"),
    "chip": ("chip",),
    "indicator": ("indicator", "active", "playing"),
    "expand_button": ("expand", "search", "filter", "clear"),
}

# Leaf forbidden when this leaf is the path tail.
LEAF_FORBIDDEN: dict[str, tuple[str, ...]] = {
    "content": ("close",),  # content container must not resolve to closeBtn only
}


def normalize_semantic(name: str) -> str:
    """Lowercase and strip separators so nowPlayingBar -> nowplayingbar."""
    return re.sub(r"[-_.\s]+", "", name).lower()


def path_segments(path: tuple[str, ...]) -> list[str]:
    return [seg.split("__")[0] for seg in path]


def semantic_fit(path: tuple[str, ...], semantic: str) -> float:
    """Return 0..1 agreement between a nested classmap path and a css-map name.

    Uses full-string substring checks (not bag-of-tokens) so ActionBar cannot
    satisfy a playbar requirement meant for nowPlayingBar.
    """
    if not semantic:
        return 0.0

    segs = path_segments(path)
    full = normalize_semantic(semantic)
    raw_lower = semantic.lower()

    # Region required / forbidden
    for seg in segs:
        forb = REGION_FORBIDDEN.get(seg)
        if forb and any(f in full for f in forb):
            return 0.0
        req = REGION_REQUIRED.get(seg)
        if req and not any(r.replace("-", "") in full or r in raw_lower for r in req):
            return 0.0

    # Intermediate + leaf structural roles
    for i, seg in enumerate(segs):
        is_tail = i == len(segs) - 1
        # For non-tail "content", still require content-ish names
        if seg == "content":
            if not any(x in full for x in ("content", "body", "iframe", "code")):
                return 0.0
            # pure close button is never a content node
            if "close" in full and "content" not in full:
                return 0.0
        if is_tail:
            req = LEAF_REQUIRED.get(seg)
            if req and not any(r in full for r in req):
                return 0.0
            forb = LEAF_FORBIDDEN.get(seg)
            if forb and any(f in full for f in forb) and not any(
                r in full for r in (LEAF_REQUIRED.get(seg) or ())
            ):
                return 0.0

    # Score: count how many specific path segments are reflected in the name.
    specific = [
        s
        for s in segs
        if s
        not in {
            "main",
            "wrapper",
            "container",
            "button",
            "left",
            "right",
            "list",
            "button_t",
        }
    ]
    if not specific:
        specific = segs[-1:]

    hits = 0
    for s in specific:
        hints = PATH_HINTS.get(s, {s.replace("_", "")})
        hints = set(hints) | {s.replace("_", ""), s}
        if any(normalize_semantic(h) in full or h.lower() in raw_lower for h in hints if len(h) >= 3):
            hits += 1

    if hits == 0:
        return 0.0
    return min(1.0, hits / max(1, len(specific)))


def path_hint_tokens(path: tuple[str, ...]) -> set[str]:
    """Legacy helper used by scoring diagnostics."""
    hints: set[str] = set()
    for seg in path_segments(path):
        hints.add(seg.lower().replace("-", "").replace("_", ""))
        if seg in PATH_HINTS:
            hints |= PATH_HINTS[seg]
    return hints


def semantic_overlap(path: tuple[str, ...], semantic: str) -> float:
    """Back-compat name used throughout scoring."""
    return semantic_fit(path, semantic)


def css_similarity(
    src_sigs: set[frozenset[tuple[str, str]]],
    tgt_sigs: set[frozenset[tuple[str, str]]],
) -> float:
    if not src_sigs or not tgt_sigs:
        return 0.0
    return max(jaccard(s, t) for s in src_sigs for t in tgt_sigs)


def score_candidate(
    path: tuple[str, ...],
    cand: str,
    src_sigs: set[frozenset[tuple[str, str]]],
    target_sigs: dict[str, set[frozenset[tuple[str, str]]]],
    css_map: dict[str, str],
) -> dict[str, Any]:
    css_score = css_similarity(src_sigs, target_sigs.get(cand, set()))
    in_map = cand in css_map
    semantic = css_map.get(cand, "")
    sem_score = semantic_overlap(path, semantic) if semantic else 0.0

    segs = set(path_segments(path))
    strict_region = bool(segs & set(REGION_REQUIRED))

    # Combined score: css similarity is base; css-map presence and semantic agreement boost.
    score = css_score
    if in_map and sem_score > 0:
        score += 0.15
    if sem_score > 0:
        score += 0.45 * sem_score
    else:
        # css-map hit with zero semantic fit is usually a false friend.
        if in_map and css_score >= 0.5:
            score -= 0.35
        # For strict regions (playbar/topbar/...), refuse pure CSS matches
        # without semantic agreement — that is how actionBar leaks in.
        if strict_region:
            score = min(score, css_score * 0.25)

    return {
        "class": cand,
        "score": round(max(0.0, min(score, 1.5)), 4),
        "css_score": round(css_score, 4),
        "semantic_score": round(sem_score, 4),
        "in_css_map": in_map,
        "semantic": semantic or None,
    }


def best_match(
    path: tuple[str, ...],
    src_sigs: set[frozenset[tuple[str, str]]],
    target_sigs: dict[str, set[frozenset[tuple[str, str]]]],
    target_index: dict[frozenset[tuple[str, str]], set[str]],
    css_map: dict[str, str],
    threshold: float,
) -> dict[str, Any] | None:
    if not src_sigs:
        return None

    candidates: set[str] = set()
    for sig in src_sigs:
        candidates |= target_index.get(sig, set())

    # Always consider css-map keys that have decent semantic overlap as
    # candidates, but only when they actually exist in the target CSS:
    # a css-map entry with zero target presence has no evidence behind it.
    hints = path_hint_tokens(path)
    if hints and css_map:
        for h, sem in css_map.items():
            if not is_hash_like(h):
                continue
            if h not in target_sigs:
                continue
            if semantic_overlap(path, sem) >= 0.5:
                candidates.add(h)

    scored: list[dict[str, Any]] = []
    pool = candidates if candidates else set(target_sigs.keys())
    for cand in pool:
        if not is_hash_like(cand):
            continue
        if cand not in target_sigs:
            continue
        item = score_candidate(path, cand, src_sigs, target_sigs, css_map)
        scored.append(item)

    if not scored:
        return None
    scored.sort(key=lambda x: (x["score"], x["semantic_score"], x["css_score"]), reverse=True)
    best = scored[0]
    segs = set(path_segments(path))
    strict_region = bool(segs & set(REGION_REQUIRED))
    # Require either solid css match or solid semantic agreement.
    # Strict regions need semantic_score > 0 to avoid actionBar/etc. leaks.
    if best["score"] < threshold:
        best["rejected"] = True
        best["next"] = scored[1:4]
        return best
    if strict_region and best["semantic_score"] <= 0:
        best["rejected"] = True
        best["reason"] = "strict region requires semantic agreement"
        best["next"] = scored[1:4]
        return best
    if best["semantic_score"] <= 0 and best["css_score"] < 0.75:
        best["rejected"] = True
        best["next"] = scored[1:4]
        return best
    best["alternatives"] = scored[1:4]
    return best


def build_target_index(
    target_sigs: dict[str, set[frozenset[tuple[str, str]]]],
) -> dict[frozenset[tuple[str, str]], set[str]]:
    index: dict[frozenset[tuple[str, str]], set[str]] = defaultdict(set)
    for cls, sigs in target_sigs.items():
        for sig in sigs:
            index[sig].add(cls)
    return index


def iter_leaves(node: Any, path: tuple[str, ...] = ()) -> list[tuple[tuple[str, ...], str]]:
    leaves: list[tuple[tuple[str, ...], str]] = []
    if isinstance(node, dict):
        for k, v in node.items():
            leaves.extend(iter_leaves(v, path + (k,)))
    elif isinstance(node, str):
        leaves.append((path, node))
    return leaves


def set_leaf(root: dict, path: tuple[str, ...], value: str) -> None:
    cur: Any = root
    for key in path[:-1]:
        nxt = cur.get(key)
        if not isinstance(nxt, dict):
            nxt = {}
            cur[key] = nxt
        cur = nxt
    cur[path[-1]] = value


def migrate_classmap(
    base_map: dict,
    base_sigs: dict[str, set[frozenset[tuple[str, str]]]],
    target_sigs: dict[str, set[frozenset[tuple[str, str]]]],
    css_map: dict[str, str],
    threshold: float,
) -> tuple[dict, dict]:
    target_index = build_target_index(target_sigs)
    out: dict = json.loads(json.dumps(base_map))
    report: dict[str, Any] = {
        "matched": [],
        "unmatched": [],
        "identity": [],
        "stats": {},
    }

    leaves = iter_leaves(base_map)
    matched = 0
    identity = 0
    for path, old_hash in leaves:
        dotted = ".".join(path)

        if old_hash in target_sigs and is_hash_like(old_hash):
            set_leaf(out, path, old_hash)
            entry = {
                "path": dotted,
                "class": old_hash,
                "in_css_map": old_hash in css_map,
                "semantic": css_map.get(old_hash),
                "method": "identity",
            }
            report["identity"].append(entry)
            identity += 1
            matched += 1
            continue

        src = base_sigs.get(old_hash)
        if not src:
            # No base CSS signature for the old class. Fall back to a
            # semantic-only match via css-map, with a higher bar (0.75)
            # because there is zero CSS similarity evidence behind it.
            best_sem = None
            best_s = 0.0
            for h, sem in css_map.items():
                if h not in target_sigs or not is_hash_like(h):
                    continue
                s = semantic_overlap(path, sem)
                if s > best_s:
                    best_s = s
                    best_sem = (h, sem, s)
            if best_sem and best_s >= 0.75:
                new_cls, sem, s = best_sem
                set_leaf(out, path, new_cls)
                report["matched"].append(
                    {
                        "path": dotted,
                        "old": old_hash,
                        "new": new_cls,
                        "score": round(0.2 + 0.5 * s, 4),
                        "css_score": 0.0,
                        "semantic_score": round(s, 4),
                        "in_css_map": True,
                        "semantic": sem,
                        "method": "semantic-only",
                        "css_evidence": False,
                    }
                )
                matched += 1
                continue

            report["unmatched"].append(
                {
                    "path": dotted,
                    "old": old_hash,
                    "reason": "old class not found in base CSS",
                    "stale": True,
                    "kept": old_hash,
                }
            )
            set_leaf(out, path, old_hash)
            continue

        best = best_match(path, src, target_sigs, target_index, css_map, threshold)
        if not best or best.get("rejected"):
            report["unmatched"].append(
                {
                    "path": dotted,
                    "old": old_hash,
                    "reason": "no confident target",
                    "best": best,
                    "stale": True,
                    "kept": old_hash,
                }
            )
            set_leaf(out, path, old_hash)
            continue

        set_leaf(out, path, best["class"])
        report["matched"].append(
            {
                "path": dotted,
                "old": old_hash,
                "new": best["class"],
                "score": best["score"],
                "css_score": best["css_score"],
                "semantic_score": best["semantic_score"],
                "in_css_map": best["in_css_map"],
                "semantic": best["semantic"],
                "method": "css+semantic",
                "alternatives": best.get("alternatives", []),
            }
        )
        matched += 1

    report["stats"] = {
        "leaves": len(leaves),
        "matched": matched,
        "identity": identity,
        "migrated": matched - identity,
        "unmatched": len(leaves) - matched,
        "stale_kept": len(leaves) - matched,
        "match_rate": round(matched / len(leaves), 4) if leaves else 0.0,
        "threshold": threshold,
        "css_map_entries": len(css_map),
        "matched_in_css_map": sum(1 for m in report["matched"] if m.get("in_css_map")),
    }
    return out, report


def version_to_key(version: str) -> str:
    parts = version.strip().split(".")
    if len(parts) < 3:
        raise SystemExit(f"need major.minor.patch, got {version!r}")
    major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])
    return f"{major}{minor:02d}{patch:04d}"


def confidence_label(m: dict[str, Any]) -> str:
    if m.get("method") == "identity":
        # Class survived unchanged in the target CSS: strongest evidence.
        return "high"
    sem = m.get("semantic_score") or 0
    css = m.get("css_score") or 0
    in_map = m.get("in_css_map")
    if css == 0:
        # No CSS similarity evidence at all (semantic-only guess).
        return "low"
    if in_map and sem >= 0.5 and css >= 0.35:
        return "high"
    if in_map and sem >= 0.5:
        return "medium-semantic"
    if css >= 0.75 and is_hash_like(m.get("new") or m.get("class") or ""):
        return "medium-css"
    if css >= 0.55 and sem >= 0.34:
        return "low"
    if css >= 0.55:
        return "low"
    return "reject"


def cmd_inventory(args: argparse.Namespace) -> int:
    css = read_css_sources(args.spa, args.css_dir, args.css)
    counts = inventory_classes(css)
    items = [(c, n) for c, n in counts.items() if is_hash_like(c)]
    print(f"hash-like classes: {len(items)} (of {len(counts)} selector tokens)")
    for c, n in items[: args.top]:
        print(f"{n:5d}  {c}")
    if args.out:
        Path(args.out).write_text(json.dumps(dict(items), indent=2) + "\n")
        print(f"wrote {args.out}")
    return 0


def cmd_migrate(args: argparse.Namespace) -> int:
    base_map = json.loads(Path(args.base_classmap).read_text())
    base_css = read_css_sources(args.base_spa, args.base_css_dir, args.base_css)
    target_css = read_css_sources(args.target_spa, args.target_css_dir, args.target_css)
    css_map = load_css_map(args.css_map)

    print("Parsing base CSS signatures…")
    base_sigs = class_signatures(base_css)
    print(f"  base classes with signatures: {len(base_sigs)}")
    print("Parsing target CSS signatures…")
    target_sigs = class_signatures(target_css)
    print(f"  target classes with signatures: {len(target_sigs)}")
    print(f"  css-map entries: {len(css_map)}")

    migrated, report = migrate_classmap(
        base_map, base_sigs, target_sigs, css_map, args.threshold
    )
    for m in report["matched"]:
        m["confidence"] = confidence_label(m)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(migrated, indent=2) + "\n")
    print(f"wrote classmap {out}")

    if args.report:
        report_path = Path(args.report)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2) + "\n")
        print(f"wrote report {report_path}")

    stats = report["stats"]
    print(
        "stats: leaves={leaves} matched={matched} identity={identity} "
        "migrated={migrated} unmatched={unmatched} rate={match_rate} "
        "in_css_map={matched_in_css_map}".format(**stats)
    )
    if stats["stale_kept"]:
        print(
            f"warning: {stats['stale_kept']} leaves kept their old (stale) hash; "
            "see report.unmatched entries marked stale=true"
        )
    # confidence breakdown
    conf: dict[str, int] = defaultdict(int)
    for m in report["matched"]:
        conf[m.get("confidence", "?")] += 1
    print("confidence:", dict(conf))
    return 0 if stats["unmatched"] == 0 or args.allow_partial else 1


def cmd_verify(args: argparse.Namespace) -> int:
    css_map = load_css_map(args.css_map)
    target_css = read_css_sources(args.target_spa, args.target_css_dir, args.target_css)
    target_sigs = class_signatures(target_css)
    inv = inventory_classes(target_css)

    report = None
    if args.report:
        report = json.loads(Path(args.report).read_text())

    classmap = json.loads(Path(args.classmap).read_text())
    leaves = iter_leaves(classmap)

    rows = []
    for path, cls in leaves:
        dotted = ".".join(path)
        row = {
            "path": dotted,
            "class": cls,
            "in_target_css": cls in target_sigs or cls in inv,
            "css_rule_count": len(target_sigs.get(cls, [])),
            "selector_hits": inv.get(cls, 0),
            "in_css_map": cls in css_map,
            "semantic": css_map.get(cls),
            "semantic_score": round(semantic_overlap(path, css_map[cls]), 4) if cls in css_map else 0.0,
        }
        # attach migrate confidence if available
        if report:
            for m in report.get("matched", []) + report.get("identity", []):
                if m.get("path") == dotted:
                    row["migrate_score"] = m.get("score")
                    row["migrate_confidence"] = m.get("confidence") or confidence_label(m)
                    row["method"] = m.get("method")
                    break
            else:
                # unmatched leaves keep old hash often
                row["migrate_confidence"] = "unmatched-or-stale"
        # final verdict
        if (
            row["in_css_map"]
            and row["semantic_score"] >= 0.5
            and row["in_target_css"]
            and row.get("migrate_confidence") in {"high", "medium-semantic"}
        ):
            row["verdict"] = "likely_good"
        elif row["in_target_css"] and row.get("migrate_confidence") in {"high", "medium-semantic", "medium-css"}:
            row["verdict"] = "plausible"
        elif not row["in_target_css"]:
            row["verdict"] = "missing_in_css"
        else:
            row["verdict"] = "needs_manual_check"
        rows.append(row)

    summary = defaultdict(int)
    for r in rows:
        summary[r["verdict"]] += 1

    out = {
        "summary": dict(summary),
        "rows": rows,
    }
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(json.dumps(out, indent=2) + "\n")
        print(f"wrote {args.out}")

    print("verify summary:", dict(summary))
    print()
    print(f"{'VERDICT':<20} {'CONF':<16} {'PATH':<45} CLASS -> semantic")
    for r in sorted(rows, key=lambda x: (x["verdict"], x["path"])):
        print(
            f"{r['verdict']:<20} {str(r.get('migrate_confidence', '-')):<16} "
            f"{r['path']:<45} {r['class']} -> {r.get('semantic') or '-'}"
            f"  (sem={r['semantic_score']}, css_hits={r['selector_hits']})"
        )
    return 0


def cmd_devtools(args: argparse.Namespace) -> int:
    report = json.loads(Path(args.report).read_text())
    matched = report.get("matched", []) + report.get("identity", [])
    if not matched:
        print("no matched entries in report")
        return 1

    print("// Paste into Spotify DevTools console (Ctrl+Shift+I / Cmd+Opt+I)")
    print("// Requires spicetify enable-devtools or employee/devtools flags.")
    print("(function verifyClassmapMatches() {")
    print("  const checks = [")
    for m in matched:
        cls = m.get("new") or m.get("class")
        path = m.get("path")
        conf = m.get("confidence") or confidence_label(m)
        print(f"    {{ path: {path!r}, cls: {cls!r}, confidence: {conf!r} }},")
    print("  ];")
    print("""  const rows = checks.map(({path, cls, confidence}) => {
    const nodes = document.getElementsByClassName(cls);
    let sample = null;
    if (nodes[0]) {
      const el = nodes[0];
      sample = {
        tag: el.tagName,
        id: el.id || null,
        aria: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || null,
        text: (el.textContent || '').trim().slice(0, 60),
        parent: el.parentElement && el.parentElement.className,
      };
    }
    return { path, cls, confidence, count: nodes.length, sample };
  });
  console.table(rows.map(r => ({
    path: r.path,
    cls: r.cls,
    confidence: r.confidence,
    count: r.count,
    tag: r.sample && r.sample.tag,
    text: r.sample && r.sample.text,
  })));
  console.log('Full detail', rows);
  return rows;
})();""")
    print()
    print("// Tip: count===0 means the class is not in the current DOM (may be route-specific).")
    print("// Tip: open Home / Now Playing / Settings / a modal before running.")
    return 0


def cmd_key(args: argparse.Namespace) -> int:
    print(version_to_key(args.version))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_inv = sub.add_parser("inventory", help="List class tokens from CSS/spa")
    p_inv.add_argument("--spa")
    p_inv.add_argument("--css-dir")
    p_inv.add_argument("--css", action="append")
    p_inv.add_argument("--top", type=int, default=40)
    p_inv.add_argument("--out")
    p_inv.set_defaults(func=cmd_inventory)

    p_mig = sub.add_parser("migrate", help="Migrate a classmap using CSS + css-map signals")
    p_mig.add_argument("--base-classmap", required=True)
    p_mig.add_argument("--base-spa")
    p_mig.add_argument("--base-css-dir")
    p_mig.add_argument("--base-css", action="append")
    p_mig.add_argument("--target-spa")
    p_mig.add_argument("--target-css-dir")
    p_mig.add_argument("--target-css", action="append")
    p_mig.add_argument("--css-map", default="css-map.json", help="Path to cli css-map.json (optional empty to disable)")
    p_mig.add_argument("--out", required=True)
    p_mig.add_argument("--report")
    p_mig.add_argument("--threshold", type=float, default=0.50)
    p_mig.add_argument("--allow-partial", action="store_true")
    p_mig.set_defaults(func=cmd_migrate)

    p_ver = sub.add_parser("verify", help="Verify classmap leaves against css-map + target CSS")
    p_ver.add_argument("--classmap", required=True)
    p_ver.add_argument("--report", help="Optional migrate report for confidence labels")
    p_ver.add_argument("--css-map", default="css-map.json")
    p_ver.add_argument("--target-spa")
    p_ver.add_argument("--target-css-dir")
    p_ver.add_argument("--target-css", action="append")
    p_ver.add_argument("--out")
    p_ver.set_defaults(func=cmd_verify)

    p_dt = sub.add_parser("devtools", help="Emit DevTools console snippet for matched paths")
    p_dt.add_argument("--report", required=True)
    p_dt.set_defaults(func=cmd_devtools)

    p_key = sub.add_parser("key", help="Print classmap key for a Spotify version")
    p_key.add_argument("version")
    p_key.set_defaults(func=cmd_key)

    args = parser.parse_args(argv)
    if getattr(args, "css_map", None) == "":
        args.css_map = None
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
