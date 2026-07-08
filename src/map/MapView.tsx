import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { useEffect, useRef } from 'react';
import type { ColorTheme } from './mapColors';
import {
  BASEMAP_SOURCE_ID,
  buildMapStyle,
  MAX_ZOOM,
  MIN_ZOOM,
} from './mapStyle';

let pmtilesProtocol: Protocol | undefined;

function ensurePmtilesProtocol(): Protocol {
  if (!pmtilesProtocol) {
    pmtilesProtocol = new Protocol();
    maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile);
  }
  return pmtilesProtocol;
}

// Why: maplibre-gl's ErrorEvent type doesn't declare sourceId, but source-load
// failures bubble up with it attached (Source -> Style -> Map). Matching on it
// is how we distinguish tile/source load failures from unrelated map errors.
function isBasemapLoadError(event: maplibregl.ErrorEvent): boolean {
  return (
    (event as maplibregl.ErrorEvent & { sourceId?: string }).sourceId ===
    BASEMAP_SOURCE_ID
  );
}

type MapViewProps = {
  colorTheme: ColorTheme;
  basemapPath: string;
  onMapReady?: (map: maplibregl.Map) => void;
  onError?: (message: string) => void;
};

export function MapView({
  colorTheme,
  basemapPath,
  onMapReady,
  onError,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onMapReadyRef = useRef(onMapReady);
  onMapReadyRef.current = onMapReady;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const colorThemeRef = useRef(colorTheme);
  colorThemeRef.current = colorTheme;
  const appliedColorThemeRef = useRef(colorTheme);
  const basemapPathRef = useRef(basemapPath);
  basemapPathRef.current = basemapPath;

  useEffect(() => {
    if (!containerRef.current) return;
    const protocol = ensurePmtilesProtocol();
    appliedColorThemeRef.current = colorThemeRef.current;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(
        colorThemeRef.current,
        window.location.origin,
        basemapPathRef.current,
      ),
      center: [20, 25],
      zoom: MIN_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    const handleError = (event: maplibregl.ErrorEvent) => {
      if (isBasemapLoadError(event)) {
        // Why: pmtiles caches a rejected header/tile promise per URL
        // indefinitely, so without evicting it a retry would keep failing
        // instantly without ever re-fetching from the network.
        protocol.tiles.clear();
        onErrorRef.current?.('地図の読み込みに失敗しました');
      }
    };
    map.on('error', handleError);
    onMapReadyRef.current?.(map);
    return () => {
      map.off('error', handleError);
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || appliedColorThemeRef.current === colorTheme) return;
    appliedColorThemeRef.current = colorTheme;
    mapRef.current.setStyle(
      buildMapStyle(colorTheme, window.location.origin, basemapPath),
    );
  }, [colorTheme, basemapPath]);

  return (
    <div ref={containerRef} className="h-full w-full" data-testid="map-view" />
  );
}
