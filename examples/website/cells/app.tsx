import React, { useState, useCallback, useRef } from 'react';
import {createRoot} from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Map, useControl, ViewStateChangeEvent} from 'react-map-gl/maplibre';
import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import {PolygonLayer} from '@deck.gl/layers';
import { lonLatToCell, cellToBoundary } from 'a5';
import { _getPentagon } from 'a5';

const INITIAL_VIEW_STATE = { longitude: 10, latitude: 50, zoom: 4 };

// Define interface for the DeckGLOverlay props
interface DeckGLOverlayProps {
  layers: any[];
  interleaved?: boolean;
  views?: any[];
  onClick?: (info: any, event: any) => void;
}

const App: React.FC = () => {
  const [cellsSet, setCellsSet] = useState<Set<bigint>>(new Set());
  // Keep track of current zoom level
  const zoomRef = useRef<number>(INITIAL_VIEW_STATE.zoom);
  
  // Handle viewport changes
  const handleViewStateChange = useCallback((e: ViewStateChangeEvent) => {
    zoomRef.current = e.viewState.zoom;
  }, []);
  
  // Handle map clicks
  const handleClick = useCallback((info, event) => {
    if (!info.coordinate) return;
    const resolution = Math.max(1, Math.min(28, Math.floor(zoomRef.current + 1)));
    const cell = lonLatToCell(info.coordinate, resolution);
    setCellsSet(prevSet => {
      const newSet = new Set(prevSet);
      newSet.has(cell) ? newSet.delete(cell) : newSet.add(cell);
      return newSet;
    });
  }, []);

  // Convert Set to Array for the layer
  const cellsArray = Array.from(cellsSet);

  const polygonLayer = new PolygonLayer({
    id: 'polygons',
    data: cellsArray,
    getPolygon: d => cellToBoundary(d),
    getFillColor: d => [0, 170, 85, 150],
    getLineColor: [255, 255, 255],
    lineWidthUnits: 'pixels',
    getLineWidth: 3,
    filled: true,
    stroked: true,
    pickable: true,
    beforeId: 'watername_ocean'
  });

  return (
    <div
      style={{
        position: 'absolute',
        height: '100%',
        width: '100%',
        top: 0,
        left: 0,
        background: 'linear-gradient(0, #000, #223)'
      }}
    >
      <Map
        id="map"
        initialViewState={INITIAL_VIEW_STATE}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        renderWorldCopies={true}
        onMove={handleViewStateChange}
      >
        <DeckGLOverlay 
          layers={[polygonLayer]} 
          interleaved 
          onClick={handleClick}
        />
      </Map>
    </div>
  );
};

export default App;

export async function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<App />);
}

function DeckGLOverlay(props: DeckGLOverlayProps) {
  const overlay = useControl(() => new DeckOverlay(props));
  overlay.setProps(props);
  return null;
} 