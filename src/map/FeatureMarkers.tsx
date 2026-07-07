import maplibregl from 'maplibre-gl';
import { useEffect } from 'react';
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
  useEffect(() => {
    if (!map) return;
    const markers = features.map((feature) =>
      new maplibregl.Marker({
        element: buildMarkerElement(
          feature,
          feature.id === selectedFeatureId,
          onSelectFeature,
        ),
        anchor: feature.kind === 'city' ? 'left' : 'center',
      })
        .setLngLat(feature.coordinates)
        .addTo(map),
    );
    return () => {
      for (const marker of markers) marker.remove();
    };
  }, [map, features, selectedFeatureId, onSelectFeature]);

  return null;
}

function buildMarkerElement(
  feature: ThemeFeature,
  isSelected: boolean,
  onSelect: (id: string) => void,
): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = feature.name;
  button.setAttribute('aria-label', feature.name);
  button.dataset.testid = `marker-${feature.id}`;
  button.dataset.markerKind = feature.kind;
  if (isSelected) button.dataset.markerSelected = 'true';
  button.className = feature.kind === 'city' ? 'marker-city' : 'marker-terrain';
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onSelect(feature.id);
  });
  return button;
}
