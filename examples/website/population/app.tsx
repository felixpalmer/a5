import React, {useState, useEffect, useRef, useCallback} from 'react';
import {createRoot} from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Map as Maplibre, useControl} from 'react-map-gl/maplibre';
import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import {PolygonLayer} from '@deck.gl/layers';
import {Color} from '@deck.gl/core';
import {cellToBoundary} from 'a5';

// Loaded at runtime from the CDN, which also serves the WASM binary and worker
const DUCKDB_BUNDLE = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.32.0/+esm';

type DuckDBConnection = {
  query: (sql: string) => Promise<any>;
  close: () => Promise<void>;
};

// Aggregated from Kontur Population (CC BY 4.0) with prepare.sql
const POPULATION_DATA = '/data/population.parquet';
const INITIAL_VIEW_STATE = {longitude: 10, latitude: 30, zoom: 1.7};

const DEFAULT_QUERY = `SELECT
  a5_cell_to_parent(cell, 6) AS cell,
  SUM(population) AS population
FROM population
GROUP BY 1`;

const PRESETS: {label: string; query: string}[] = [
  {label: 'Resolution 5', query: DEFAULT_QUERY.replace(', 6)', ', 5)')},
  {label: 'Resolution 6', query: DEFAULT_QUERY},
  {label: 'Resolution 7', query: DEFAULT_QUERY.replace(', 6)', ', 7)')},
  {
    label: 'Full detail',
    query: `SELECT cell, population\nFROM population`
  },
  {
    label: 'Megacities',
    query: `SELECT
  a5_cell_to_parent(cell, 7) AS cell,
  SUM(population) AS population
FROM population
GROUP BY 1
HAVING SUM(population) > 1000000`
  }
];

type CellRow = {cell: bigint; population: number};
type QueryResult = {rows: CellRow[]; maxPopulation: number; elapsedMs: number};

// Color ramp (dark blue -> magenta -> yellow), applied on a log scale
const RAMP: Color[] = [
  [11, 4, 5],
  [59, 15, 112],
  [140, 41, 129],
  [222, 73, 104],
  [254, 159, 109],
  [252, 253, 191]
];

function populationToColor(population: number, maxPopulation: number): Color {
  const t = Math.log10(1 + population) / Math.log10(1 + maxPopulation);
  const s = Math.min(Math.max(t, 0), 1) * (RAMP.length - 1);
  const i = Math.min(Math.floor(s), RAMP.length - 2);
  const f = s - i;
  const [r0, g0, b0] = RAMP[i];
  const [r1, g1, b1] = RAMP[i + 1];
  return [r0 + (r1 - r0) * f, g0 + (g1 - g0) * f, b0 + (b1 - b0) * f, 255] as Color;
}

// SUM() returns HUGEINT/DECIMAL, plain columns BIGINT or DOUBLE - coerce all to number
function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  return Number(String(value));
}

async function initDuckDB(): Promise<DuckDBConnection> {
  const duckdb = await import(/* webpackIgnore: true */ DUCKDB_BUNDLE);
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], {type: 'text/javascript'})
  );
  const worker = new Worker(workerUrl);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);

  // Expose the hosted parquet under a short name for queries
  const url = new URL(POPULATION_DATA, window.location.origin).href;
  await db.registerFileURL('population.parquet', url, duckdb.DuckDBDataProtocol.HTTP, false);

  const connection = await db.connect();
  await connection.query(`INSTALL a5 FROM community; LOAD a5;`);
  // Materialize as a table so interactive queries run against memory
  await connection.query(`CREATE TABLE population AS SELECT * FROM 'population.parquet'`);
  return connection;
}

const App: React.FC = () => {
  const connectionRef = useRef<DuckDBConnection | null>(null);
  const [status, setStatus] = useState<string>('Starting DuckDB…');
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<string>(DEFAULT_QUERY);
  const [running, setRunning] = useState<boolean>(false);
  const [result, setResult] = useState<QueryResult | null>(null);

  const runQuery = useCallback(async (sql: string) => {
    const connection = connectionRef.current;
    if (!connection) return;
    setRunning(true);
    setError(null);
    try {
      const start = performance.now();
      const table = await connection.query(sql);
      const elapsedMs = performance.now() - start;

      if (!table.schema.fields.some(f => f.name === 'cell')) {
        throw new Error(`Query must return a 'cell' column`);
      }
      const hasPopulation = table.schema.fields.some(f => f.name === 'population');

      const rows: CellRow[] = [];
      let maxPopulation = 1;
      for (const row of table) {
        const population = hasPopulation ? toNumber(row.population) : 1;
        if (population > maxPopulation) maxPopulation = population;
        rows.push({cell: BigInt(row.cell), population});
      }
      setResult({rows, maxPopulation, elapsedMs});
      setStatus(`${rows.length.toLocaleString()} cells · ${Math.round(elapsedMs)}ms`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    initDuckDB()
      .then(connection => {
        if (cancelled) {
          connection.close();
          return;
        }
        connectionRef.current = connection;
        setStatus('Running query…');
        runQuery(DEFAULT_QUERY);
      })
      .catch(e => setError((e as Error).message));
    return () => {
      cancelled = true;
      connectionRef.current?.close();
      connectionRef.current = null;
    };
  }, [runQuery]);

  const cellLayer = new PolygonLayer<CellRow>({
    id: 'population-cells',
    data: result?.rows ?? [],
    getPolygon: d => cellToBoundary(d.cell),
    getFillColor: d => populationToColor(d.population, result?.maxPopulation ?? 1),
    stroked: false,
    pickable: true,
    beforeId: 'watername_ocean',
    parameters: {cullMode: 'back', depthCompare: 'always'} as const,
    updateTriggers: {getFillColor: result?.maxPopulation}
  });

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      runQuery(query);
    }
  };

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
      <Maplibre
        id="map"
        initialViewState={INITIAL_VIEW_STATE}
        projection="globe"
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        dragRotate={false}
        maxPitch={0}
      >
        <DeckGLOverlay
          layers={[cellLayer]}
          interleaved={true}
          getTooltip={({object}) =>
            object && {
              html: `<div>Population: ${Math.round(object.population).toLocaleString()}</div>`,
              style: {
                backgroundColor: 'white',
                padding: '8px',
                borderRadius: '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }
            }
          }
        />
      </Maplibre>
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 1,
          width: '380px',
          maxWidth: 'calc(100% - 40px)',
          background: 'rgba(20, 20, 30, 0.9)',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          color: '#eee',
          fontFamily: 'sans-serif',
          fontSize: '13px'
        }}
      >
        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          rows={6}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: '#111',
            color: '#8f8',
            border: '1px solid #333',
            borderRadius: '4px',
            padding: '8px',
            fontFamily: 'monospace',
            fontSize: '12px',
            resize: 'vertical'
          }}
        />
        <div style={{display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px'}}>
          <button
            onClick={() => runQuery(query)}
            disabled={running || !connectionRef.current}
            style={{
              background: '#00aa55',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 14px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {running ? 'Running…' : 'Run ⌘⏎'}
          </button>
          {PRESETS.map(preset => (
            <button
              key={preset.label}
              onClick={() => {
                setQuery(preset.query);
                runQuery(preset.query);
              }}
              disabled={running || !connectionRef.current}
              style={{
                background: '#333',
                color: '#eee',
                border: '1px solid #555',
                borderRadius: '4px',
                padding: '6px 8px',
                cursor: 'pointer'
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div style={{marginTop: '8px', minHeight: '16px', color: error ? '#f66' : '#aaa'}}>{error ?? status}</div>
      </div>
    </div>
  );
};

export default App;

export async function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<App />);
}

function DeckGLOverlay(props) {
  const overlay = useControl(() => new DeckOverlay(props));
  overlay.setProps(props);
  return null;
}
