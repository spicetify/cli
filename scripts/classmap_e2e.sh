#!/usr/bin/env bash
# Full classmap pipeline: migrate → static verify → CDP e2e DOM verify.
#
# Usage:
#   ./scripts/classmap_e2e.sh
#   ./scripts/classmap_e2e.sh --skip-migrate --deep
#   SPOTIFY_SPA=/path/to/xpui.spa ./scripts/classmap_e2e.sh
#
# Env:
#   SPOTIFY_SPA       Path to xpui.spa (default: macOS Spotify.app)
#   BASE_CLASSMAP     Base classmap JSON (default: ../classmaps/1020040/...)
#   BASE_CSS_DIR      Base CSS dir from xpui-archive
#   OUT_DIR           Output dir (default: classmaps/1020092)
#   CDP_PORT          Remote debugging port (default: 9222)
#   MIN_HIT_RATE      CDP pass threshold (default: 0.25)
#   SPICETIFY         Spicetify binary (default: ~/.spicetify/spicetify)
#
# Notes:
#   - When CDP is not reachable, the script temporarily appends
#     --remote-debugging-port=$CDP_PORT to spotify_launch_flags and restores
#     the original config-xpui.ini on exit.
#   - Applied xpui.spa files (spicetify hooks detected) are never used as a
#     migrate target; only stock spa copies are.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SKIP_MIGRATE=0
SKIP_STATIC=0
SKIP_CDP=0
SKIP_FLATTEN=0
DEEP=0
RESTART=0
ENSURE_CDP=1
MIN_HIT_RATE="${MIN_HIT_RATE:-0.25}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-migrate) SKIP_MIGRATE=1 ;;
    --skip-static) SKIP_STATIC=1 ;;
    --skip-cdp) SKIP_CDP=1 ;;
    --skip-flatten) SKIP_FLATTEN=1 ;;
    --deep) DEEP=1 ;;
    --restart) RESTART=1 ;;
    --no-ensure-cdp) ENSURE_CDP=0 ;;
    --min-hit-rate)
      shift
      MIN_HIT_RATE="${1:-}"
      if [[ -z "$MIN_HIT_RATE" ]]; then
        echo "--min-hit-rate requires a value" >&2
        exit 1
      fi
      ;;
    -h|--help)
      sed -n '2,25p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
  shift
done

SPOTIFY_SPA="${SPOTIFY_SPA:-}"
SPOTIFY_CSS_DIR="${SPOTIFY_CSS_DIR:-/Applications/Spotify.app/Contents/Resources/Apps/xpui}"
STOCK_SPA_CANDIDATES=(
  "${SPOTIFY_SPA:-}"
  "$HOME/.local/state/spicetify/Backup/xpui.spa"
  "$HOME/Library/Application Support/spicetify/Backup/xpui.spa"
  "/Applications/Spotify.app/Contents/Resources/Apps/xpui.spa"
  "/Applications/Spotify.app/Contents/Resources/Apps/xpui.spa.bak"
)
BASE_CLASSMAP="${BASE_CLASSMAP:-$ROOT/../classmaps/1020040/classmap-190747c4b8f.json}"
BASE_CSS_DIR="${BASE_CSS_DIR:-$ROOT/../xpui-archive/1.2.40.599}"
OUT_DIR="${OUT_DIR:-$ROOT/classmaps/1020092}"
CSS_MAP="${CSS_MAP:-$ROOT/css-map.json}"
CDP_PORT="${CDP_PORT:-9222}"
SPICETIFY="${SPICETIFY:-$HOME/.spicetify/spicetify}"
PYTHON="${PYTHON:-python3}"
NODE="${NODE:-node}"

CLASSMAP_OUT="$OUT_DIR/classmap.json"
REPORT_OUT="$OUT_DIR/report.json"
VERIFY_OUT="$OUT_DIR/verify.json"
CDP_OUT="$OUT_DIR/cdp-e2e-report.json"
OVERLAY_OUT="$OUT_DIR/css-map.json"

mkdir -p "$OUT_DIR"

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

# spa_is_applied returns 0 when the given xpui.spa has spicetify hooks
# injected (i.e. it is NOT a stock spa and must not be used as a migrate
# target; hashes in it have already been rewritten to semantic names).
spa_is_applied() {
  local spa="$1"
  unzip -p "$spa" "index.html" 2>/dev/null | grep -qi "spicetify"
}

find_stock_spa() {
  local p
  local have_unzip=1
  command -v unzip >/dev/null 2>&1 || have_unzip=0
  for p in "${STOCK_SPA_CANDIDATES[@]}"; do
    [[ -n "$p" && -f "$p" ]] || continue
    if [[ "$have_unzip" -eq 0 ]]; then
      # Without unzip we cannot detect an applied spa, so only trust
      # Spicetify Backup copies, which are stock by construction.
      case "$p" in
        */spicetify/Backup/*) ;;
        *)
          echo "Skipping unverifiable spa (unzip not installed): $p" >&2
          continue
          ;;
      esac
    elif spa_is_applied "$p"; then
      echo "Skipping applied (non-stock) spa: $p" >&2
      continue
    fi
    echo "$p"
    return 0
  done
  return 1
}

# Prefer stock (pre-rewrite) spa for migrate/static hashing.
# Applied Apps/xpui CSS has already been rewritten by css-map and is a bad
# migrate target (hashes become semantic names).
resolve_target_css_args() {
  local prefer_stock="${1:-0}"
  TARGET_ARGS=()
  local spa=""
  if spa="$(find_stock_spa)"; then
    TARGET_ARGS+=(--target-spa "$spa")
    echo "Using target spa: $spa"
    return 0
  fi
  if [[ "$prefer_stock" == "1" ]]; then
    echo "No stock xpui.spa found for migrate (need Spicetify Backup or unapplied spa)." >&2
    echo "Run: spicetify backup   # creates ~/.local/state/spicetify/Backup/xpui.spa" >&2
    return 1
  fi
  if [[ -d "$SPOTIFY_CSS_DIR" ]]; then
    TARGET_ARGS+=(--target-css-dir "$SPOTIFY_CSS_DIR")
    echo "Using applied css dir (hashes may already be rewritten): $SPOTIFY_CSS_DIR"
    return 0
  fi
  echo "Missing Spotify CSS sources" >&2
  return 1
}

# Original config preservation: when we have to touch config-xpui.ini to
# enable CDP, we back it up first and restore it on exit (any status), so
# the user's spotify_launch_flags are never permanently rewritten.
CFG_PATH=""
CFG_BACKUP=""
restore_config() {
  if [[ -n "$CFG_BACKUP" && -n "$CFG_PATH" && -f "$CFG_BACKUP" ]]; then
    cp "$CFG_BACKUP" "$CFG_PATH"
    rm -f "$CFG_BACKUP"
    echo "Restored original spotify_launch_flags in $CFG_PATH"
  fi
}
trap restore_config EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

ensure_cdp() {
  if curl -sf "http://127.0.0.1:${CDP_PORT}/json/version" >/dev/null; then
    echo "CDP already up on :${CDP_PORT}"
    return 0
  fi

  if [[ ! -x "$SPICETIFY" ]]; then
    echo "CDP down and spicetify not found at $SPICETIFY" >&2
    echo "Start Spotify with --remote-debugging-port=${CDP_PORT} first." >&2
    return 1
  fi

  local cfg="${XDG_CONFIG_HOME:-$HOME/.config}/spicetify/config-xpui.ini"
  if [[ -f "$cfg" ]]; then
    if ! grep -q "remote-debugging-port=${CDP_PORT}" "$cfg" 2>/dev/null; then
      log "Temporarily adding remote-debugging flag to $cfg (restored on exit)"
      CFG_PATH="$cfg"
      CFG_BACKUP="$(mktemp -t spicetify-config-xpui)"
      cp "$cfg" "$CFG_BACKUP"
      "$PYTHON" - "$cfg" "$CDP_PORT" <<'PY'
import sys
from pathlib import Path

cfg, port = Path(sys.argv[1]), sys.argv[2]
debug_flag = f"--remote-debugging-port={port}"

def merge(value: str) -> str:
    # Preserve existing flags; only append the debug port. No
    # --remote-allow-origins=*: the verifier connects without an Origin
    # header, so a wildcard that exposes the logged-in client to any
    # local web page is unnecessary.
    parts = [p for p in value.split("|") if p.strip()]
    if not any("remote-debugging-port" in p for p in parts):
        parts.append(debug_flag)
    return "|".join(parts)

lines = []
found = False
for line in cfg.read_text().splitlines():
    stripped = line.strip()
    if stripped.startswith("spotify_launch_flags"):
        _, _, value = stripped.partition("=")
        lines.append(f"spotify_launch_flags   = {merge(value.strip())}")
        found = True
    else:
        lines.append(line)
if not found:
    out = []
    inserted = False
    for line in lines:
        out.append(line)
        if line.strip() == "[Setting]" and not inserted:
            out.append(f"spotify_launch_flags   = {debug_flag}")
            inserted = True
    lines = out if inserted else lines + [f"spotify_launch_flags   = {debug_flag}"]
cfg.write_text("\n".join(lines) + "\n")
print("updated", cfg)
PY
    fi
  fi

  log "Restarting Spotify via spicetify for CDP"
  "$SPICETIFY" restart
  for i in $(seq 1 30); do
    if curl -sf "http://127.0.0.1:${CDP_PORT}/json/version" >/dev/null; then
      echo "CDP ready after ${i}s"
      return 0
    fi
    sleep 1
  done
  echo "CDP still not reachable on :${CDP_PORT}" >&2
  return 1
}

if [[ "$SKIP_MIGRATE" -eq 0 ]]; then
  log "1/4 migrate classmap"
  if [[ ! -f "$BASE_CLASSMAP" ]]; then
    echo "Missing base classmap: $BASE_CLASSMAP" >&2
    exit 1
  fi
  if [[ ! -d "$BASE_CSS_DIR" ]]; then
    echo "Missing base CSS dir: $BASE_CSS_DIR" >&2
    exit 1
  fi
  resolve_target_css_args 1
  "$PYTHON" scripts/classmap_capture.py migrate \
    --base-classmap "$BASE_CLASSMAP" \
    --base-css-dir "$BASE_CSS_DIR" \
    "${TARGET_ARGS[@]}" \
    --css-map "$CSS_MAP" \
    --out "$CLASSMAP_OUT" \
    --report "$REPORT_OUT" \
    --threshold 0.55 \
    --allow-partial
else
  log "1/4 migrate skipped"
fi

if [[ "$SKIP_STATIC" -eq 0 ]]; then
  log "2/4 static verify"
  resolve_target_css_args 1 || resolve_target_css_args 0
  "$PYTHON" scripts/classmap_capture.py verify \
    --classmap "$CLASSMAP_OUT" \
    --report "$REPORT_OUT" \
    --css-map "$CSS_MAP" \
    "${TARGET_ARGS[@]}" \
    --out "$VERIFY_OUT"
  "$PYTHON" scripts/classmap_capture.py devtools \
    --report "$REPORT_OUT" > "$OUT_DIR/devtools-snippet.js" || true
else
  log "2/4 static verify skipped"
fi

if [[ "$SKIP_CDP" -eq 0 ]]; then
  log "3/4 CDP e2e verify"
  if [[ "$ENSURE_CDP" -eq 1 ]]; then
    ensure_cdp
  fi
  NAV_FLAGS=(--navigate)
  if [[ "$DEEP" -eq 1 ]]; then
    NAV_FLAGS=(--deep)
  fi
  RESTART_FLAG=()
  if [[ "$RESTART" -eq 1 ]]; then
    RESTART_FLAG=(--restart)
  fi
  "$NODE" scripts/classmap_cdp_verify.mjs \
    --port "$CDP_PORT" \
    --mode both \
    --report "$REPORT_OUT" \
    --classmap "$CLASSMAP_OUT" \
    --css-map "$CSS_MAP" \
    --out "$CDP_OUT" \
    --min-hit-rate "$MIN_HIT_RATE" \
    "${NAV_FLAGS[@]}" \
    "${RESTART_FLAG[@]}"
else
  log "3/4 CDP e2e skipped"
fi

if [[ "$SKIP_FLATTEN" -eq 0 ]]; then
  log "4/4 flatten css-map overlay"
  META_ARGS=()
  [[ -f "$OUT_DIR/META.json" ]] && META_ARGS=(--meta "$OUT_DIR/META.json")
  "$PYTHON" scripts/classmap_capture.py flatten \
    --classmap "$CLASSMAP_OUT" \
    --base-classmap "$BASE_CLASSMAP" \
    --css-map "$CSS_MAP" \
    --report "$REPORT_OUT" \
    "${META_ARGS[@]+${META_ARGS[@]}}" \
    --out "$OVERLAY_OUT"
else
  log "4/4 flatten skipped"
fi

log "Done"
echo "Artifacts in $OUT_DIR:"
ls -la "$OUT_DIR" | sed -n '1,30p'
