import React, { useState, useEffect } from 'react';
import {createRoot} from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Map, useControl} from 'react-map-gl/maplibre';
import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import {PolygonLayer} from '@deck.gl/layers';
import { cellToBoundary, uncompact, compact } from 'a5';
import {parquetMetadataAsync, parquetRead} from 'hyparquet';

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
        // Generated using examples/cli/compact with:
        // node index.js --lon -0.1278 --lat 51.5074 --radius 10 --resolution 16 --output london-10km-compacted
        const response = await fetch('/data/london-10km-compacted.parquet');
        const arrayBuffer = await response.arrayBuffer();

        // Get metadata first - pass arrayBuffer directly
        const metadata = await parquetMetadataAsync(arrayBuffer);

        // Read parquet file - collect all rows
        const allRows: any[] = [];
        await parquetRead({
          metadata,
          file: arrayBuffer,
          onComplete: (rows: any[]) => {
            allRows.push(...rows);
          }
        });

        // Extract cell IDs and uncompact once
        const compacted = allRows.map(row => row[0]);
        const uncompacted = uncompact(compacted, RESOLUTION);

        setCompactedCells(compacted);
        setUncompactedCells(uncompacted);
        setLoading(false);
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
