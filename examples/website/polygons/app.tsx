import React, {useState, useMemo, useCallback, useRef, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Map, useControl, ViewStateChangeEvent} from 'react-map-gl/maplibre';
import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import {ScatterplotLayer, ArcLayer} from '@deck.gl/layers';
import {A5Layer} from '@deck.gl/geo-layers';
import {lineStringToCells} from 'a5/traversal/line';
import {polygonToCells} from 'a5/regions/polygon';
import {uncompact} from 'a5/core/compact';
import {getResolution} from 'a5/core/serialization';
import type {LonLat} from 'a5/core/coordinate-systems';

const INITIAL_VIEW_STATE = {
  longitude: 10,
  latitude: 50,
  zoom: 4,
  pitch: 0,
  bearing: 0
};

type CountryEntry = {
  name: string;
  /** MultiPolygon parts, each as GeoJSON-style rings [outer, ...holes] (unclosed) */
  polygons: [number, number][][][];
};

/** Derive A5 resolution from map zoom level */
function zoomToResolution(zoom: number): number {
  return Math.max(0, Math.min(28, Math.round(zoom * 1.1)));
}

/** Compute the centroid and appropriate zoom for a multipolygon's outer rings */
function countryView(polygons: [number, number][][][]): {
  longitude: number;
  latitude: number;
  zoom: number;
} {
  let minLon = Infinity,
    maxLon = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity;
  for (const rings of polygons) {
    for (const [lon, lat] of rings[0]) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }
  const span = Math.max(maxLon - minLon, maxLat - minLat);
  const zoom = Math.max(1, Math.min(12, Math.log2(360 / span) - 0.5));
  return {
    longitude: (minLon + maxLon) / 2,
    latitude: (minLat + maxLat) / 2,
    zoom
  };
}

interface DeckGLOverlayProps {
  layers: any[];
  interleaved?: boolean;
  onClick?: (info: any, event: any) => void;
}

type WaypointData = {
  position: [number, number];
  index: number;
};

type LineData = {
  from: [number, number];
  to: [number, number];
};

const App: React.FC = () => {
  const [waypoints, setWaypoints] = useState<LonLat[]>([]);
  const [zoom, setZoom] = useState(INITIAL_VIEW_STATE.zoom);
  const [center, setCenter] = useState<LonLat>([INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude] as LonLat);
  const zoomRef = useRef<number>(INITIAL_VIEW_STATE.zoom);
  const [resOffset, setResOffset] = useState(0);
  const [fixedResolution, setFixedResolution] = useState<number | null>(null);
  const [showCompacted, setShowCompacted] = useState(false);
  const [outlineOnly, setOutlineOnly] = useState(false);
  const [showControlPoints, setShowControlPoints] = useState(true);
  const [showOutline, setShowOutline] = useState(true);
  const [countries, setCountries] = useState<CountryEntry[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [countryPolygons, setCountryPolygons] = useState<[number, number][][][] | null>(null);
  const mapRef = useRef<any>(null);

  // Load countries
  useEffect(() => {
    // Pre-stripped: each feature is the full MultiPolygon (all parts and
    // holes) with only the `admin` property retained.
    fetch('/data/ne_50m_countries_geom.geojson')
      .then(r => r.json())
      .then((data: any) => {
        // Remove closing vertex if ring is closed
        const stripClosing = (coords: [number, number][]): [number, number][] =>
          coords[coords.length - 1][0] === coords[0][0] && coords[coords.length - 1][1] === coords[0][1]
            ? coords.slice(0, -1)
            : coords;
        const entries: CountryEntry[] = [];
        for (const f of data.features) {
          const polygons = (f.geometry.coordinates as [number, number][][][]).map(part => part.map(stripClosing));
          entries.push({name: f.properties.admin, polygons});
        }
        entries.sort((a, b) => a.name.localeCompare(b.name));
        setCountries(entries);
      })
      .catch(() => console.warn('Could not load ne_50m_countries_geom.geojson'));
  }, []);

  // Latitude-corrected zoom for resolution
  const effectiveZoom = useMemo(() => {
    const latRad = (center[1] * Math.PI) / 180;
    return zoom - Math.log2(Math.max(Math.cos(latRad), 0.01));
  }, [zoom, center]);

  const baseResolution = useMemo(() => zoomToResolution(Math.round(effectiveZoom)), [effectiveZoom]);
  const resolution = fixedResolution ?? Math.min(28, baseResolution + resOffset);

  const handleViewStateChange = useCallback((e: ViewStateChangeEvent) => {
    zoomRef.current = e.viewState.zoom;
    setZoom(e.viewState.zoom);
    const {longitude, latitude} = e.viewState;
    setCenter([longitude, latitude] as LonLat);
  }, []);

  const handleClick = useCallback((info: any) => {
    if (!info.coordinate) return;
    const point: LonLat = [info.coordinate[0], info.coordinate[1]] as LonLat;
    setWaypoints(prev => [...prev, point]);
    setSelectedCountry('');
    setCountryPolygons(null);
    setFixedResolution(null);
  }, []);

  const handleClear = useCallback(() => {
    setWaypoints([]);
    setFixedResolution(null);
    setSelectedCountry('');
    setCountryPolygons(null);
  }, []);
  const handleUndo = useCallback(() => {
    setWaypoints(prev => prev.slice(0, -1));
    setSelectedCountry('');
    setCountryPolygons(null);
  }, []);

  const handleExport = useCallback(() => {
    if (waypoints.length < 3) return;
    const ring = waypoints.map(wp => [Math.round(wp[0] * 1e6) / 1e6, Math.round(wp[1] * 1e6) / 1e6]);
    const obj = {name: 'unnamed', ring, resolution};
    const text = JSON.stringify(obj);
    navigator.clipboard.writeText(text).then(
      () => {
        alert('Copied to clipboard');
      },
      () => {
        prompt('Copy this:', text);
      }
    );
  }, [waypoints, resolution]);

  const handleCountryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const name = e.target.value;
      setSelectedCountry(name);
      if (!name) return;
      const country = countries.find(c => c.name === name);
      if (!country) return;
      const view = countryView(country.polygons);
      if (mapRef.current) {
        mapRef.current.jumpTo({
          center: [view.longitude, view.latitude],
          zoom: view.zoom
        });
      }
      setWaypoints([]);
      setCountryPolygons(country.polygons);
      setFixedResolution(null);
    },
    [countries]
  );

  // Polygons being displayed: the selected country's parts (with holes), or
  // the single hand-drawn ring.
  const activePolygons = useMemo((): LonLat[][][] | null => {
    if (countryPolygons) return countryPolygons as LonLat[][][];
    if (waypoints.length >= 3) return [[waypoints]];
    return null;
  }, [countryPolygons, waypoints]);

  const isPolygon = activePolygons !== null;

  // Trace cells: line for 2 points, filled polygon(s) otherwise
  // For polygons, store compacted output and derive display cells from toggle.
  const compactedCells = useMemo((): BigUint64Array | null => {
    if (!activePolygons || outlineOnly) return null;
    const parts = activePolygons.map(rings => polygonToCells(rings, resolution));
    if (parts.length === 1) return parts[0];
    let total = 0;
    for (const p of parts) total += p.length;
    const merged = new BigUint64Array(total);
    let offset = 0;
    for (const p of parts) {
      merged.set(p, offset);
      offset += p.length;
    }
    return merged;
  }, [activePolygons, resolution, outlineOnly]);

  const tracedCells = useMemo((): bigint[] => {
    if (!isPolygon) {
      if (waypoints.length !== 2) return [];
      return Array.from(lineStringToCells(waypoints, resolution));
    }
    if (outlineOnly) {
      const seen = new Set<bigint>();
      const cells: bigint[] = [];
      for (const rings of activePolygons!) {
        for (const ring of rings) {
          const closedRing = [...ring, ring[0]];
          for (const id of lineStringToCells(closedRing, resolution)) {
            if (!seen.has(id)) {
              seen.add(id);
              cells.push(id);
            }
          }
        }
      }
      return cells;
    }
    if (!compactedCells) return [];
    return Array.from(showCompacted ? compactedCells : uncompact(compactedCells, resolution));
  }, [waypoints, resolution, isPolygon, activePolygons, outlineOnly, showCompacted, compactedCells]);

  const uncompactedCount = useMemo(() => {
    if (!compactedCells) return 0;
    return Array.from(compactedCells).reduce((sum, cell) => {
      const res = getResolution(cell);
      const diff = resolution - res;
      return sum + Math.pow(4, diff);
    }, 0);
  }, [compactedCells, resolution]);

  // Waypoint markers
  const waypointData = useMemo((): WaypointData[] => {
    return waypoints.map((wp, i) => ({
      position: [wp[0], wp[1]] as [number, number],
      index: i
    }));
  }, [waypoints]);

  // Line segments: all country rings, or the hand-drawn waypoints (closed for polygons)
  const lineData = useMemo((): LineData[] => {
    const lines: LineData[] = [];
    if (countryPolygons) {
      for (const rings of countryPolygons) {
        for (const ring of rings) {
          for (let i = 0; i < ring.length; i++) {
            const a = ring[i];
            const b = ring[(i + 1) % ring.length];
            lines.push({from: [a[0], a[1]], to: [b[0], b[1]]});
          }
        }
      }
      return lines;
    }
    for (let i = 0; i < waypoints.length - 1; i++) {
      lines.push({
        from: [waypoints[i][0], waypoints[i][1]],
        to: [waypoints[i + 1][0], waypoints[i + 1][1]]
      });
    }
    if (waypoints.length >= 3) {
      const last = waypoints[waypoints.length - 1];
      lines.push({
        from: [last[0], last[1]],
        to: [waypoints[0][0], waypoints[0][1]]
      });
    }
    return lines;
  }, [waypoints, countryPolygons]);

  const layers = useMemo(
    () => [
      new A5Layer<bigint>({
        id: 'traced-cells',
        data: tracedCells,
        getPentagon: d => d,
        getFillColor: [0, 200, 100, 120],
        getLineColor: [255, 255, 255, 180],
        getLineWidth: 1,
        lineWidthUnits: 'pixels',
        filled: true,
        stroked: true,
        pickable: false,
        beforeId: 'watername_ocean',
        parameters: {cullMode: 'back', depthCompare: 'always'}
      }),
      new ArcLayer<LineData>({
        id: 'line-segments',
        data: showOutline ? lineData : [],
        getSourcePosition: d => d.from,
        getTargetPosition: d => d.to,
        getSourceColor: [255, 255, 255, 200],
        getTargetColor: [255, 255, 255, 200],
        getHeight: 0,
        getWidth: 2,
        widthMinPixels: 5,
        widthUnits: 'pixels',
        greatCircle: true
      }),
      new ScatterplotLayer<WaypointData>({
        id: 'waypoints',
        data: showControlPoints ? waypointData : [],
        getPosition: d => d.position,
        getFillColor: d => (d.index === 0 ? [0, 200, 255, 255] : [255, 140, 0, 255]),
        getRadius: 6,
        radiusUnits: 'pixels',
        filled: true,
        stroked: true,
        getLineColor: [255, 255, 255, 255],
        getLineWidth: 2,
        lineWidthUnits: 'pixels',
        parameters: {depthCompare: 'always'}
      })
    ],
    [tracedCells, lineData, waypointData, showControlPoints, showOutline]
  );

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
        ref={mapRef}
        id="map"
        initialViewState={INITIAL_VIEW_STATE}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        dragRotate={false}
        maxPitch={0}
        onMove={handleViewStateChange}
      >
        <DeckGLOverlay layers={layers} interleaved onClick={handleClick} />
      </Map>

      {/* Controls */}
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
          userSelect: 'none',
          fontSize: 12,
          lineHeight: 1.8
        }}
      >
        <div style={{marginBottom: 4}}>
          Resolution: <strong>{resolution}</strong>
          {fixedResolution !== null && <span style={{color: '#888'}}> (fixed)</span>}
        </div>
        <div style={{marginBottom: 8}}>
          <label>Detail: {['Coarse', 'Normal', 'Fine', 'Finest'][resOffset]}</label>
          <input
            type="range"
            min={0}
            max={3}
            value={resOffset}
            onChange={e => setResOffset(Number(e.target.value))}
            style={{width: 120, display: 'block'}}
          />
        </div>
        <div style={{marginBottom: 4}}>
          Waypoints: <strong>{waypoints.length}</strong>
        </div>
        <div style={{marginBottom: 4}}>
          Cells: <strong>{tracedCells.length}</strong>
          {isPolygon && !outlineOnly && compactedCells && (
            <span style={{color: '#888'}}>
              {showCompacted ? ` (${uncompactedCount} uncompacted)` : ` (${compactedCells.length} compacted)`}
            </span>
          )}
        </div>
        {isPolygon && (
          <div style={{marginBottom: 4}}>
            <label>
              <input
                type="checkbox"
                checked={outlineOnly}
                onChange={e => setOutlineOnly(e.target.checked)}
                style={{marginRight: 4}}
              />
              Outline only
            </label>
          </div>
        )}
        {isPolygon && !outlineOnly && (
          <div style={{marginBottom: 4}}>
            <label>
              <input
                type="checkbox"
                checked={showCompacted}
                onChange={e => setShowCompacted(e.target.checked)}
                style={{marginRight: 4}}
              />
              Show compacted
            </label>
          </div>
        )}
        <div style={{marginBottom: 4}}>
          <label>
            <input
              type="checkbox"
              checked={showControlPoints}
              onChange={e => setShowControlPoints(e.target.checked)}
              style={{marginRight: 4}}
            />
            Show control points
          </label>
        </div>
        <div style={{marginBottom: 4}}>
          <label>
            <input
              type="checkbox"
              checked={showOutline}
              onChange={e => setShowOutline(e.target.checked)}
              style={{marginRight: 4}}
            />
            Show polygon outline
          </label>
        </div>
        <div style={{display: 'flex', gap: 6, flexWrap: 'wrap'}}>
          <button
            onClick={handleUndo}
            disabled={waypoints.length === 0}
            style={{
              padding: '4px 10px',
              cursor: waypoints.length > 0 ? 'pointer' : 'default',
              fontSize: 12
            }}
          >
            Undo
          </button>
          <button
            onClick={handleClear}
            disabled={waypoints.length === 0}
            style={{
              padding: '4px 10px',
              cursor: waypoints.length > 0 ? 'pointer' : 'default',
              fontSize: 12
            }}
          >
            Clear
          </button>
          <button
            onClick={handleExport}
            disabled={waypoints.length < 3}
            style={{
              padding: '4px 10px',
              cursor: waypoints.length >= 3 ? 'pointer' : 'default',
              fontSize: 12
            }}
          >
            Export
          </button>
        </div>
        {countries.length > 0 && (
          <div style={{marginTop: 8, borderTop: '1px solid #ddd', paddingTop: 8}}>
            <label style={{fontWeight: 'bold'}}>Countries:</label>
            <select
              value={selectedCountry}
              onChange={handleCountryChange}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 4,
                fontSize: 12,
                padding: '3px 4px'
              }}
            >
              <option value="">-- select --</option>
              {countries.map(c => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.polygons.length} {c.polygons.length === 1 ? 'part' : 'parts'})
                </option>
              ))}
            </select>
          </div>
        )}
        <div style={{marginTop: 8, color: '#888', fontSize: 11}}>Click map to add waypoints</div>
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
