import React, { useState, useCallback, useMemo } from 'react';
import {createRoot} from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Map} from 'react-map-gl/maplibre';
import {ScatterplotLayer, ArcLayer, LineLayer} from '@deck.gl/layers';
import {lonLatToCell, cellToBoundary, cellToChildren, cellToParent} from 'a5';
import DeckGL from '@deck.gl/react';
import {MapView} from '@deck.gl/core';

const MAX_RESOLUTION = 31;

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
  let resolution = Math.min(Math.floor(2 * viewState.zoom - 4), Math.floor(viewState.zoom + 3));
  resolution = Math.max(1, Math.min(MAX_RESOLUTION, resolution));

  // Memoize the entire cells calculation
  const data = useMemo(() => {
    const cellId = lonLatToCell(cellLocation, resolution);
    const children = showChildren ? cellToChildren(cellId) : [];
    const parent = showParent ? cellToParent(cellId) : null;
    return {cellId, children: [cellId, ...children, ...(parent ? [parent] : [])]};
  }, [resolution, cellLocation, showChildren, showParent]);

  // Convert cell boundaries to great circle arcs
  const arcs = useMemo(() => {
    return data.children.map(cell => {
      const boundary = cellToBoundary(cell);
      // Create pairs of points for each edge of the pentagon
      return boundary.map((point, i) => ({
        source: point,
        target: boundary[(i + 1) % boundary.length],
        cellId: cell
      }));
    }).flat();
  }, [data.children]);

  const getColor = (_, info) => {
    console.log(info);
    return info.index < 5 ? A5GREEN : [160, 160, 160, 255];
  }

  const polygonProps: any = {
    data: arcs,
    getSourcePosition: d => d.source,
    getTargetPosition: d => d.target,
    getSourceColor: getColor,
    getTargetColor: getColor,
    getColor: getColor,
    getWidth: (_, info) => info.index < 5 ? 2 : 1,
    getHeight: 0,
    greatCircle: true,
    widthUnits: 'pixels'
  }

  // At low zooms, draw great circle arcs
  const arcLayer = new ArcLayer({ id: 'cell-boundaries-arc', ...polygonProps });

  // At high zooms, draw lines (arc layer is slower and has precision issues)
  const lineLayer = new LineLayer({ id: 'cell-boundaries-line', ...polygonProps, });

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
  const hilbertBits = (2 * Math.max(0, resolution - 2)) + originSegmentBits;

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
        layers={[scatterplotLayer, arcLayer, lineLayer]}
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        controller={{dragRotate: false}}
        onClick={handleMapClick}
        layerFilter={({layer}) => {
          const ZOOM_THRESHOLD = 8;
          if (layer.id === 'cell-boundaries-arc') {
            return viewState.zoom < ZOOM_THRESHOLD;
          }
          if (layer.id === 'cell-boundaries-line') {
            return viewState.zoom >= ZOOM_THRESHOLD;
          }
          return true;
        }}
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