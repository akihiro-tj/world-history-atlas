import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { useEffect, useRef } from 'react';
import type { ColorTheme } from './mapColors';
import { buildMapStyle, MAX_ZOOM, MIN_ZOOM } from './mapStyle';

let isProtocolRegistered = false;

function ensurePmtilesProtocol(): void {
  if (isProtocolRegistered) return;
  maplibregl.addProtocol('pmtiles', new Protocol().tile);
  isProtocolRegistered = true;
}

type MapViewProps = {
  colorTheme: ColorTheme;
  basemapPath: string;
  onMapReady?: (map: maplibregl.Map) => void;
};

export function MapView({ colorTheme, basemapPath, onMapReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onMapReadyRef = useRef(onMapReady);
  onMapReadyRef.current = onMapReady;
  const colorThemeRef = useRef(colorTheme);
  colorThemeRef.current = colorTheme;
  const appliedColorThemeRef = useRef(colorTheme);
  const basemapPathRef = useRef(basemapPath);
  basemapPathRef.current = basemapPath;

  useEffect(() => {
    if (!containerRef.current) return;
    ensurePmtilesProtocol();
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
    onMapReadyRef.current?.(map);
    return () => {
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
