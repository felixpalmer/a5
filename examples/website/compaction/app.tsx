import React, { useState, useEffect } from 'react';
import {createRoot} from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Map, useControl} from 'react-map-gl/maplibre';
import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import {PolygonLayer} from '@deck.gl/layers';
import { cellToBoundary, uncompact } from 'a5';
import { parquetRead } from 'hyparquet';

// Generated using examples/cli/compact with:
// node index.js --lon -0.1278 --lat 51.5074 --radius 10 --resolution 16 --output london-10km-compacted
const COMPACTED_DATA = '/data/london-10km-compacted.parquet';
const INITIAL_VIEW_STATE = { longitude: -0.1278, latitude: 51.5074, zoom: 11 };
const RESOLUTION = 16;

// Define interface for the DeckGLOverlay props
interface DeckGLOverlayProps {
  layers: any[];
  interleaved?: boolean;
}

const App: React.FC = () => {
  const [compactedCells, setCompactedCells] = useState<bigint[]>([]);
  const [uncompactedCells, setUncompactedCells] = useState<bigint[]>([]);
  const [showCompacted, setShowCompacted] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  // Load parquet file and uncompact once
  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch(COMPACTED_DATA);
        const arrayBuffer = await response.arrayBuffer();

        // Parse parquet file
        const rows: any[] = await new Promise(onComplete => {
          parquetRead({file: arrayBuffer, onComplete});
        });

        // Extract cell IDs (first column)
        const compacted = rows.map((row: any) => row[0]);

        // Set compacted cells and render them first
        setCompactedCells(compacted);
        setLoading(false);

        // Uncompact in the background after rendering to avoid delaying initial render
        setTimeout(() => {
          const uncompacted = uncompact(compacted, RESOLUTION);
          setUncompactedCells(uncompacted);
        }, 1000);
      } catch (error) {
        console.error('Error loading parquet file:', error);
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const compactedLayer = new PolygonLayer({
    id: 'compacted-polygons',
    data: compactedCells,
    getPolygon: d => cellToBoundary(d),
    getFillColor: [255, 170, 0, 100],
    getLineColor: [255, 255, 255],
    lineWidthUnits: 'pixels',
    getLineWidth: 0.5,
    filled: true,
    stroked: true,
    pickable: false,
    visible: showCompacted,
    beforeId: 'watername_ocean'
  });

  const uncompactedLayer = new PolygonLayer({
    id: 'uncompacted-polygons',
    data: uncompactedCells,
    getPolygon: d => cellToBoundary(d),
    getFillColor: [0, 170, 85, 100],
    getLineColor: [255, 255, 255],
    lineWidthUnits: 'pixels',
    getLineWidth: 0.5,
    filled: true,
    stroked: true,
    pickable: false,
    visible: !showCompacted,
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
      >
        <DeckGLOverlay layers={[compactedLayer, uncompactedLayer]} interleaved />
      </Map>

      {/* Toggle control */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          background: 'white',
          padding: '10px',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          zIndex: 1,
          userSelect: 'none'
        }}
      >
        {loading ? (
          <div>Loading...</div>
        ) : (
          <>
            <div style={{ marginBottom: '10px' }}>
              <label>
                <input
                  type="checkbox"
                  checked={showCompacted}
                  onChange={(e) => setShowCompacted(e.target.checked)}
                />
                {' '}Show Compacted
              </label>
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {showCompacted ? (
                <div>Compacted: {compactedCells.length} cells</div>
              ) : (
                <div>Uncompacted: {uncompactedCells.length} cells</div>
              )}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              Ratio: {(uncompactedCells.length / compactedCells.length).toFixed(2)}x
            </div>
          </>
        )}
      </div>
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
