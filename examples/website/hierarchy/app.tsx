import React, { useState, useCallback, useMemo } from 'react';
import {createRoot} from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Map} from 'react-map-gl/maplibre';
import {ScatterplotLayer, PolygonLayer} from '@deck.gl/layers';
import {lonLatToCell, cellToBoundary, cellToChildren, cellToParent} from 'a5';
import DeckGL from '@deck.gl/react';
import {MapView} from '@deck.gl/core';
import A5CellInfoBox from '../components/a5-cell-info-box';

const MAX_RESOLUTION = 30;

const INITIAL_VIEW_STATE = { longitude: -0.1276, latitude: 51.50735, zoom: 10, minZoom: 2, maxZoom: 27 };

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const A5GREEN = [0, 170, 85] as [number, number, number];
const A5GREEN_DARK = [0, 128, 64] as [number, number, number];

const App: React.FC<{showCellId?: boolean, height?: string}> = ({showCellId = true, height = '100%'}) => {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [cellLocation, setCellLocation] = useState([INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude]);
  const [showChildren, setShowChildren] = useState(false);
  const [showParent, setShowParent] = useState(false);

  const onViewStateChange = useCallback(({viewState}) => {
    const [longitude, latitude] = cellLocation;
    setViewState({...INITIAL_VIEW_STATE, zoom: viewState.zoom, longitude, latitude});
  }, [cellLocation]);

  const handleMapClick = useCallback((event) => {
    const [longitude, latitude] = event.coordinate;
    setViewState(viewState => ({ ...viewState, longitude, latitude }));
    setCellLocation([longitude, latitude]);
  }, []);

  // Calculate resolution based on zoom level
  let resolution = Math.min(Math.floor(2 * viewState.zoom - 5), Math.floor(viewState.zoom));
  resolution = Math.max(0, Math.min(MAX_RESOLUTION, resolution));

  // Memoize the entire cells calculation
  const data = useMemo(() => {
    const cellId = lonLatToCell(cellLocation, resolution);
    const children = showChildren ? cellToChildren(cellId) : [];
    const parent = showParent ? cellToParent(cellId) : null;
    return {cellId, children: [cellId, ...children, ...(parent ? [parent] : [])]};
  }, [resolution, cellLocation, showChildren, showParent]);

  // Convert cell boundaries to great circle arcs
  const polygons = useMemo(() => {
    return data.children.map((cell: bigint) => {
      const boundary = cellToBoundary(cell, {segments: 'auto'});
      return {polygon: [boundary], cellId: cell};
    });
  }, [data.children]);

  const polygonLayer = new PolygonLayer({
    id: 'cell-boundaries-line',
    data: polygons,
    getPolygon: d => d.polygon,
    stroked: true,
    filled: false,
    getLineColor: (_, info) => info.index < 1 ? A5GREEN : [160, 160, 160, 255],
    getLineWidth: (_, info) => info.index < 1 ? 2 : 1,
    lineWidthUnits: 'pixels'
  });

  const scatterplotLayer = new ScatterplotLayer({
    id: 'source-point',
    data: [cellLocation],
    getPosition: d => d,
    getFillColor: A5GREEN_DARK,
    getRadius: 5,
    radiusUnits: 'pixels',
    pickable: true,
    stroked: true,
    getLineColor: [255, 255, 255, 255],
    getLineWidth: 2,
    lineWidthUnits: 'pixels'
  });

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <DeckGL
        views={new MapView({repeat: true})}
        layers={[scatterplotLayer, polygonLayer]}
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        controller={{dragRotate: false}}
        onClick={handleMapClick}
      >
        <Map
          mapStyle={MAP_STYLE}
          maxZoom={24}
        />
      </DeckGL>
      {showCellId && (
        <A5CellInfoBox
          location={cellLocation}
          resolution={resolution}
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            maxWidth: 'calc(100% - 40px)',
            overflow: 'auto'
          }}
        >
          <div style={{ marginTop: '10px' }}>
            <label style={{ marginRight: '15px' }}>
              <input
                type="checkbox"
                checked={showChildren}
                onChange={(e) => setShowChildren(e.target.checked)}
              />
              Show children
            </label>
            <label>
              <input
                type="checkbox"
                checked={showParent}
                onChange={(e) => setShowParent(e.target.checked)}
              />
              Show parent
            </label>
          </div>
        </A5CellInfoBox>
      )}
    </div>
  );
};

export default App;

export async function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<App />);
} 