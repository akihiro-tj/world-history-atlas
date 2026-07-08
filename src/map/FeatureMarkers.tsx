import maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import type { ThemeFeature } from '../theme/schema';

type FeatureMarkersProps = {
  map: maplibregl.Map | null;
  features: readonly ThemeFeature[];
  selectedFeatureId: string | undefined;
  onSelectFeature: (id: string) => void;
};

export function FeatureMarkers({
  map,
  features,
  selectedFeatureId,
  onSelectFeature,
}: FeatureMarkersProps) {
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  useEffect(() => {
    if (!map) return;
    const markers = markersRef.current;
    for (const feature of features) {
      const marker = new maplibregl.Marker({
        element: buildMarkerElement(feature, onSelectFeature),
        anchor: feature.kind === 'city' ? 'left' : 'center',
      })
        .setLngLat(feature.coordinates)
        .addTo(map);
      markers.set(feature.id, marker);
    }
    return () => {
      for (const marker of markers.values()) marker.remove();
      markers.clear();
    };
  }, [map, features, onSelectFeature]);

  useEffect(() => {
    for (const feature of features) {
      const marker = markersRef.current.get(feature.id);
      if (!marker) continue;
      const element = marker.getElement();
      if (feature.id === selectedFeatureId) {
        element.dataset.markerSelected = 'true';
      } else {
        delete element.dataset.markerSelected;
      }
    }
  }, [features, selectedFeatureId]);

  return null;
}

function buildMarkerElement(
  feature: ThemeFeature,
  onSelect: (id: string) => void,
): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = feature.name;
  button.setAttribute('aria-label', feature.name);
  button.dataset.testid = `marker-${feature.id}`;
  button.dataset.markerKind = feature.kind;
  button.className = feature.kind === 'city' ? 'marker-city' : 'marker-terrain';
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onSelect(feature.id);
  });
  return button;
}
