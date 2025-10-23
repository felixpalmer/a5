import React, { useState, useEffect } from 'react';
import {createRoot} from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Map, useControl} from 'react-map-gl/maplibre';
import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import {PolygonLayer} from '@deck.gl/layers';
import { cellToBoundary, uncompact, compact } from 'a5';
import {parquetMetadataAsync, parquetRead} from 'hyparquet';

const INITIAL_VIEW_STATE = { longitude: -0.1278, latitude: 51.5074, zoom: 10 };
const RESOLUTION = 16;

// Define interface for the DeckGLOverlay props
interface DeckGLOverlayProps {
  layers: any[];
  interleaved?: boolean;
}

const App: React.FC = () => {
  const [compactedCells, setCompactedCells] = useState<Set<bigint>>(new Set());
  const [uncompactedCells, setUncompactedCells] = useState<Set<bigint>>(new Set());
  const [showCompacted, setShowCompacted] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  // Load parquet file
  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/data/london.parquet');
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

        // Extract cell IDs from the rows and store as Sets
        const compactedSet = new Set(allRows.map(row => row[0]));
        const uncompactedSet = new Set(uncompact(Array.from(compactedSet), RESOLUTION));

        setCompactedCells(compactedSet);
        setUncompactedCells(uncompactedSet);
        setLoading(false);
      } catch (error) {
        console.error('Error loading parquet file:', error);
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Convert Sets to arrays for deck.gl
  const cellsToDisplay = showCompacted
    ? Array.from(compactedCells)
    : Array.from(uncompactedCells);

  const polygonLayer = new PolygonLayer({
    id: 'polygons',
    data: cellsToDisplay,
    getPolygon: d => cellToBoundary(d),
    getFillColor: showCompacted ? [255, 170, 0, 100] : [0, 170, 85, 100],
    getLineColor: [255, 255, 255],
    lineWidthUnits: 'pixels',
    getLineWidth: 0.5,
    filled: true,
    stroked: true,
    pickable: false,
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
        <DeckGLOverlay layers={[polygonLayer]} interleaved />
      </Map>

      {/* Toggle control */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '15px 20px',
          borderRadius: '8px',
          fontFamily: 'monospace',
          fontSize: '14px',
          zIndex: 1000
        }}
      >
        {loading ? (
          <div>Loading...</div>
        ) : (
          <>
            <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
              London 10km Radius - Resolution {RESOLUTION}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showCompacted}
                onChange={(e) => setShowCompacted(e.target.checked)}
                style={{ marginRight: '10px', cursor: 'pointer' }}
              />
              Show Compacted ({showCompacted ? compactedCells.size : uncompactedCells.size} cells)
            </label>
            <div style={{ marginTop: '10px', fontSize: '12px', color: '#aaa' }}>
              {showCompacted ? (
                <span style={{ color: '#ffaa00' }}>Compacted: {compactedCells.size} cells</span>
              ) : (
                <span style={{ color: '#00aa55' }}>Uncompacted: {uncompactedCells.size} cells</span>
              )}
            </div>
            <div style={{ marginTop: '5px', fontSize: '12px', color: '#aaa' }}>
              Compression ratio: {(uncompactedCells.size / compactedCells.size).toFixed(2)}x
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
