import type {MapStyleDataEvent} from 'react-map-gl/maplibre';

/**
 * Hide a basemap's labels, for maps where they would compete with the data.
 * Pass as `onStyleData`, which fires before the first render, so they never show.
 */
export function hideLabels({target: map}: MapStyleDataEvent) {
  for (const layer of map.getStyle().layers) {
    if (layer.type === 'symbol') {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
  }
}
