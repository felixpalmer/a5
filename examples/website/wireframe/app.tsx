import React, { useState, useMemo, useCallback } from 'react';
import {createRoot} from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Map} from 'react-map-gl/maplibre';
import {PolygonLayer} from '@deck.gl/layers';
import {cellToBoundary, cellToChildren, cellToLonLat, getResolution, u64ToHex} from 'a5';
import DeckGL from '@deck.gl/react';
import {MapView} from '@deck.gl/core';

const INITIAL_VIEW_STATE = { 
  longitude: 0, 
  latitude: 20, 
  zoom: 1.5, 
  minZoom: 0, 
  maxZoom: 5 
};

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const A5_GREEN = [0, 170, 85] as [number, number, number];

type WireframeDemoOptions = {
  cellIds?: bigint[],
  showControls?: boolean
}
const App: React.FC<WireframeDemoOptions> = ({
  cellIds, 
  showControls = true
}: WireframeDemoOptions) => {
  const initialViewState = {...INITIAL_VIEW_STATE};
  if (cellIds) {
    let [lon, lat] = [0, 0];
    for (const cell of cellIds) {
      const [_lon, _lat] = cellToLonLat(cell);
      lon += _lon / cellIds.length;
      lat += _lat / cellIds.length;
    }

    const resolution = getResolution(cellIds[0]);
    const zoom = resolution + 1 - Math.log2(cellIds.length) / 2;
    initialViewState.longitude = lon;
    initialViewState.latitude = lat;
    initialViewState.zoom = Math.max(0, Math.min(24, zoom));
    initialViewState.minZoom = Math.max(0, zoom - 3);
    initialViewState.maxZoom = Math.min(24, zoom + 3);
    showControls = false;
  }
  const [viewState, setViewState] = useState(initialViewState);
  const [resolution, setResolution] = useState(2);

  const onViewStateChange = useCallback(({viewState}) => {
    setViewState(viewState);
  }, []);

  // Generate cells with sampling for higher resolutions
  if (cellIds === undefined) {
    cellIds = cellToChildren(0n, resolution);
  }
  const polygons = useMemo(() => {
    return cellIds.map((cellId: bigint) => {
      const boundary = cellToBoundary(cellId);
      return {
        polygon: [boundary],
        cellId: u64ToHex(cellId)
      };
    });
  }, [cellIds, resolution]);

  const polygonLayer = new PolygonLayer({
    id: 'a5-cells',
    data: polygons,
    getPolygon: d => d.polygon,
    getFillColor: [...A5_GREEN, 100],
    getLineColor: [...A5_GREEN, 255],
    getLineWidth: 2,
    stroked: true,
    filled: true,
    lineWidthUnits: 'pixels',
    pickable: true
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '500px' }}>
      <DeckGL
        views={new MapView({repeat: true})}
        layers={[polygonLayer]}
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        controller={true}
        getTooltip={({object}) => object && `Cell ID: ${object.cellId}`}
      >
        <Map 
          mapStyle={MAP_STYLE} 
        />
      </DeckGL>
      
      {showControls && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          backgroundColor: 'white',
          color: 'black',
          padding: '15px',
          borderRadius: '5px',
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          minWidth: '200px'
        }}>
          <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
            A5 Wireframe Example
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="resolution">Resolution: {resolution}</label>
            <input
              id="resolution"
              type="range"
              min="1"
              max="3"
              value={resolution}
              onChange={(e) => setResolution(parseInt(e.target.value))}
              style={{ width: '100%', marginTop: '5px' }}
            />
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            Cells shown: {polygons.length}
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            Hover over cells to see their IDs
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

export async function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<App />);
}
