import React, { useState, useCallback, useMemo } from 'react';
import {createRoot} from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Map} from 'react-map-gl/maplibre';
import {ScatterplotLayer, PolygonLayer} from '@deck.gl/layers';
import {lonLatToCell, cellToBoundary, cellToChildren, cellToParent} from 'a5';
import DeckGL from '@deck.gl/react';
import {MapView} from '@deck.gl/core';

const MAX_RESOLUTION = 30;

const INITIAL_VIEW_STATE = { longitude: -0.1276, latitude: 51.50735, zoom: 10, minZoom: 2, maxZoom: 27 };

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const A5GREEN = [0, 170, 85] as [number, number, number];
const A5GREEN_DARK = [0, 128, 64] as [number, number, number];

const App: React.FC<{showCellId?: boolean}> = ({showCellId = true}) => {
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

  // Convert cellId to binary string and split into parts
  const binaryCellId = data.cellId.toString(2).padStart(64, '0');

  // First 6 bits encode origin and segment
  const originSegmentBits = 6;

  // Then follow bits to encode the position along the hilbert curve
  const hilbertBits = (2 * Math.max(0, resolution - 1)) + originSegmentBits;

  // Then two bits to encode the resolution
  const resolutionBits = 2 + hilbertBits;

  const originSegmentSection = binaryCellId.substring(0, originSegmentBits);
  const hilbertSection = binaryCellId.substring(originSegmentBits, hilbertBits);
  const resolutionSection = binaryCellId.substring(hilbertBits, resolutionBits);
  const zeroSection = binaryCellId.substring(resolutionBits);

  return (
    <>
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
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          backgroundColor: 'white',
          color: 'black',
          padding: '10px',
          borderRadius: '5px',
          fontFamily: 'monospace',
          fontSize: '14px',
          maxWidth: 'calc(100% - 40px)',
          overflow: 'auto',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}>
          <div>
            Cell ID (binary): 
            <span style={{ fontWeight: 'bold', color: '#0066FF' }}>{originSegmentSection}</span>
            <span style={{ fontWeight: 'bold', color: '#000000' }}>{hilbertSection}</span>
            <span style={{ fontWeight: 'bold', color: '#FF0066' }}>{resolutionSection}</span>
            <span style={{ fontWeight: 'bold', color: '#999999' }}>{zeroSection}</span>
          </div>
          <div>Cell ID (Hex): {`0x${data.cellId.toString(16).padStart(16, '0')}`}</div>
          <div>Resolution: {resolution}</div>
          <div>Location: [{cellLocation[0].toFixed(4)}, {cellLocation[1].toFixed(4)}]</div>
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
        </div>
      )}
    </>
  );
};

export default App;

export async function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<App />);
} 