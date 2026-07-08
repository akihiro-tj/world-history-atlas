#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

CACHE_DIR=.cache/naturalearth
BUILD_DIR=.cache/build
OUT=public/tiles/basemap.pmtiles
BASE_URL="https://naturalearth.s3.amazonaws.com/10m_physical"
LAYERS=(ne_10m_land ne_10m_rivers_lake_centerlines ne_10m_lakes)
MAX_BYTES=$((25 * 1024 * 1024))

mkdir -p "$CACHE_DIR" "$BUILD_DIR" public/tiles

for layer in "${LAYERS[@]}"; do
  zip="$CACHE_DIR/$layer.zip"
  [ -f "$zip" ] || curl -fL "$BASE_URL/$layer.zip" -o "$zip"
done

if [ ! -s scripts/tile-sources.sha256 ]; then
  echo "ERROR: scripts/tile-sources.sha256 がない。ソースを意図的に更新する場合は .cache/naturalearth/ の zip から再生成してコミットする（README 参照）" >&2
  exit 1
fi
(cd "$CACHE_DIR" && shasum -a 256 -c "$OLDPWD/scripts/tile-sources.sha256")

for layer in "${LAYERS[@]}"; do
  unzip -o "$CACHE_DIR/$layer.zip" -d "$BUILD_DIR/$layer" >/dev/null
  ogr2ogr -f GeoJSONSeq "$BUILD_DIR/$layer.geojsonl" "$BUILD_DIR/$layer/$layer.shp"
done

tippecanoe -o "$OUT" --force -Z0 -z7 -X \
  --coalesce-densest-as-needed \
  -L land:"$BUILD_DIR/ne_10m_land.geojsonl" \
  -L rivers:"$BUILD_DIR/ne_10m_rivers_lake_centerlines.geojsonl" \
  -L lakes:"$BUILD_DIR/ne_10m_lakes.geojsonl"

size=$(wc -c < "$OUT" | tr -d ' ')
if [ "$size" -ge "$MAX_BYTES" ]; then
  echo "ERROR: $OUT is $size bytes (limit: $MAX_BYTES)" >&2
  exit 1
fi
echo "OK: $OUT ($size bytes)"
