#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=public/tiles/basemap.pmtiles
MAX_BYTES=$((25 * 1024 * 1024))
[ -f "$OUT" ] || { echo "ERROR: $OUT がない。'pnpm tiles:build' で生成してコミットする" >&2; exit 1; }
size=$(wc -c < "$OUT" | tr -d ' ')
[ "$size" -lt "$MAX_BYTES" ] || { echo "ERROR: $OUT is $size bytes (limit: $MAX_BYTES)" >&2; exit 1; }
echo "OK: $OUT ($size bytes)"
