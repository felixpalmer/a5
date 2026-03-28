import React, {useState, useMemo, useCallback} from 'react';
import {createRoot} from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Map as MapGL, useControl} from 'react-map-gl/maplibre';
import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import {PolygonLayer} from '@deck.gl/layers';
import {lonLatToCell, cellToBoundary, cellToLonLat} from 'a5/core/cell';
import {getResolution} from 'a5/core/serialization';
import {getGlobalCellNeighbors} from 'a5/traversal/global-neighbors';
import {gridDisk, gridDiskVertex} from 'a5/traversal/grid-disk';
import {sphericalCap} from 'a5/traversal/cap';
import {uncompact} from 'a5/core/compact';
import type {LonLat} from 'a5/core/coordinate-systems';

const INITIAL_VIEW_STATE = {
  longitude: 0,
  latitude: 30,
  zoom: 2,
  pitch: 0,
  bearing: 0,
};

const SELECTED_COLOR: [number, number, number, number] = [255, 255, 0, 200];

/**
 * Compute ring distances for visualization: BFS from center, assigning
 * each cell its hop distance.
 */
function kRingWithDistance(cellId: bigint, k: number, edgeOnly: boolean): Map<bigint, number> {
  const res = getResolution(cellId);
  const compact = edgeOnly ? gridDisk(cellId, k) : gridDiskVertex(cellId, k);
  const cells = new Set(uncompact(compact, res));
  cells.delete(cellId);

  const ringMap = new Map<bigint, number>();
  let frontier = new Set<bigint>([cellId]);
  const visited = new Set<bigint>([cellId]);

  for (let ring = 1; ring <= k; ring++) {
    const nextFrontier = new Set<bigint>();
    for (const id of frontier) {
      for (const neighbor of getGlobalCellNeighbors(id, {edgeOnly})) {
        if (!visited.has(neighbor) && cells.has(neighbor)) {
          visited.add(neighbor);
          ringMap.set(neighbor, ring);
          nextFrontier.add(neighbor);
        }
      }
    }
    frontier = nextFrontier;
  }
  return ringMap;
}

const EARTH_RADIUS_KM = 6371;
const DEG_TO_RAD = Math.PI / 180;
function haversineDistance(a: LonLat, b: LonLat): number {
  const dLat = (b[1] - a[1]) * DEG_TO_RAD;
  const dLon = (b[0] - a[0]) * DEG_TO_RAD;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat +
    Math.cos(a[1] * DEG_TO_RAD) * Math.cos(b[1] * DEG_TO_RAD) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function capWithDistance(cellId: bigint, radiusM: number): Map<bigint, number> {
  const res = getResolution(cellId);
  const cells = uncompact(sphericalCap(cellId, radiusM), res);
  const center = cellToLonLat(cellId);

  const distMap = new Map<bigint, number>();
  let maxDist = 0;
  for (const id of cells) {
    if (id === cellId) continue;
    const d = haversineDistance(center, cellToLonLat(id));
    if (d > maxDist) maxDist = d;
    distMap.set(id, d);
  }

  const maxRing = 10;
  const ringMap = new Map<bigint, number>();
  for (const [id, d] of distMap) {
    ringMap.set(id, Math.max(1, Math.ceil((d / maxDist) * maxRing)));
  }
  return ringMap;
}

// Color ramp from bright green (ring 1) to dark blue (ring k)
function ringColor(ring: number, maxRing: number): [number, number, number, number] {
  const t = maxRing <= 1 ? 0 : (ring - 1) / (maxRing - 1);
  const r = Math.round(0 * (1 - t) + 30 * t);
  const g = Math.round(255 * (1 - t) + 80 * t);
  const b = Math.round(128 * (1 - t) + 220 * t);
  return [r, g, b, 200];
}

// Color ramp for compact visualization: coarse (orange) → target resolution (green)
function resolutionColor(res: number, minRes: number, maxRes: number): [number, number, number, number] {
  const t = maxRes <= minRes ? 0 : (res - minRes) / (maxRes - minRes);
  const r = Math.round(255 * (1 - t) + 0 * t);
  const g = Math.round(140 * (1 - t) + 230 * t);
  const b = Math.round(0 * (1 - t) + 100 * t);
  return [r, g, b, 200];
}

type OverlayCell = {
  id: bigint;
  boundary: LonLat[];
  ring: number;
};

type CompactCell = {
  id: bigint;
  boundary: LonLat[];
  resolution: number;
};

function cellBoundary(id: bigint): LonLat[] {
  return cellToBoundary(id, {closedRing: true, segments: 1}) as LonLat[];
}

/** Derive A5 resolution from map zoom level */
function zoomToResolution(zoom: number): number {
  return Math.max(0, Math.min(28, Math.round(zoom * 1.1)));
}

/** Base radius in meters for a given zoom level (half Earth circumference / scale) */
function zoomToBaseRadius(zoom: number): number {
  return 20_000_000 / Math.pow(2, zoom);
}

/** Format a radius in meters to a human-readable string with appropriate units */
function formatRadius(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    return km >= 100 ? `${Math.round(km)} km` : km >= 10 ? `${km.toFixed(1)} km` : `${km.toFixed(2)} km`;
  }
  if (meters >= 1) {
    return meters >= 100 ? `${Math.round(meters)} m` : meters >= 10 ? `${meters.toFixed(1)} m` : `${meters.toFixed(2)} m`;
  }
  const mm = meters * 1000;
  return mm >= 100 ? `${Math.round(mm)} mm` : mm >= 10 ? `${mm.toFixed(1)} mm` : `${mm.toFixed(2)} mm`;
}

const App: React.FC = () => {
  const [zoom, setZoom] = useState(INITIAL_VIEW_STATE.zoom);
  const [center, setCenter] = useState<LonLat>([INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude] as LonLat);
  const [mode, setMode] = useState<'gridDisk' | 'cap'>('gridDisk');
  const [k, setK] = useState(1);
  const [radiusFraction, setRadiusFraction] = useState(50);
  const [includeVertex, setIncludeVertex] = useState(false);
  const [doUncompact, setDoUncompact] = useState(false);

  const edgeOnly = !includeVertex;

  // Compensate Mercator zoom for latitude: Mercator inflates by 1/cos(lat),
  // so subtract log2(cos(lat)) to get ground-truth zoom.
  const effectiveZoom = useMemo(() => {
    const latRad = center[1] * Math.PI / 180;
    return zoom - Math.log2(Math.max(Math.cos(latRad), 0.01));
  }, [zoom, center]);

  // Derive resolution and radius from latitude-corrected zoom
  const resolution = useMemo(() => zoomToResolution(Math.round(effectiveZoom)), [effectiveZoom]);
  const selectedId = useMemo(() => lonLatToCell(center, resolution), [center, resolution]);

  const baseRadius = useMemo(() => zoomToBaseRadius(effectiveZoom), [effectiveZoom]);
  const radiusM = baseRadius * radiusFraction / 100;

  const onMove = useCallback((e: any) => {
    setZoom(e.viewState.zoom);
    const {longitude, latitude} = e.viewState;
    setCenter([longitude, latitude] as LonLat);
  }, []);

  // Ring data for uncompacted mode
  const ringData = useMemo(() => {
    if (!doUncompact) return new Map<bigint, number>();
    if (mode === 'cap') return capWithDistance(selectedId, radiusM);
    return kRingWithDistance(selectedId, k, edgeOnly);
  }, [selectedId, mode, k, radiusM, edgeOnly, doUncompact]);

  // Compact data (default mode)
  const compactData = useMemo((): CompactCell[] => {
    if (doUncompact) return [];
    const cells = mode === 'cap'
      ? sphericalCap(selectedId, radiusM)
      : edgeOnly ? gridDisk(selectedId, k) : gridDiskVertex(selectedId, k);
    return Array.from(cells).map(id => ({
      id,
      boundary: cellBoundary(id),
      resolution: getResolution(id),
    }));
  }, [selectedId, mode, k, radiusM, edgeOnly, doUncompact]);

  const maxRing = useMemo(() => {
    let max = 1;
    for (const ring of ringData.values()) if (ring > max) max = ring;
    return max;
  }, [ringData]);

  const overlayData = useMemo((): OverlayCell[] => {
    const result: OverlayCell[] = [];
    result.push({id: selectedId, boundary: cellBoundary(selectedId), ring: 0});
    for (const [id, ring] of ringData) {
      result.push({id, boundary: cellBoundary(id), ring});
    }
    return result;
  }, [selectedId, ringData]);

  const [minCompactRes, maxCompactRes] = useMemo(() => {
    if (compactData.length === 0) return [0, 0];
    let min = Infinity, max = -Infinity;
    for (const c of compactData) {
      if (c.resolution < min) min = c.resolution;
      if (c.resolution > max) max = c.resolution;
    }
    return [min, max];
  }, [compactData]);

  const layers = useMemo(() => [
    new PolygonLayer<OverlayCell>({
      id: 'gridDisk-overlay',
      data: overlayData,
      getPolygon: d => d.boundary,
      getFillColor: d => d.ring === 0 ? SELECTED_COLOR : ringColor(d.ring, maxRing),
      getLineColor: [255, 255, 255, 120],
      getLineWidth: 1,
      lineWidthUnits: 'pixels',
      filled: true,
      stroked: true,
      pickable: false,
      beforeId: 'watername_ocean',
      parameters: {cullMode: 'back', depthCompare: 'always'},
    }),
    new PolygonLayer<CompactCell>({
      id: 'compact-overlay',
      data: compactData,
      getPolygon: d => d.boundary,
      getFillColor: d => d.id === selectedId
        ? SELECTED_COLOR
        : resolutionColor(d.resolution, minCompactRes, maxCompactRes),
      getLineColor: [255, 255, 255, 150],
      getLineWidth: 1,
      lineWidthUnits: 'pixels',
      filled: true,
      stroked: true,
      pickable: false,
      beforeId: 'watername_ocean',
      parameters: {cullMode: 'back', depthCompare: 'always'},
    }),
  ], [overlayData, maxRing, compactData, selectedId, minCompactRes, maxCompactRes]);

  return (
    <div
      style={{
        position: 'absolute',
        height: '100%',
        width: '100%',
        top: 0,
        left: 0,
        background: 'linear-gradient(0, #000, #223)',
      }}
    >
      <MapGL
        projection="globe"
        id="map"
        initialViewState={INITIAL_VIEW_STATE}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        dragRotate={false}
        maxPitch={0}
        onMove={onMove}
      >
        <DeckGLOverlay layers={layers} interleaved />
      </MapGL>

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
          lineHeight: 1.8,
        }}
      >
        <div style={{marginBottom: 8}}>
          Resolution: <strong>{resolution}</strong>
        </div>
        <div style={{marginBottom: 8, display: 'flex', gap: 8}}>
          <label style={{cursor: 'pointer'}}>
            <input type="radio" name="mode" checked={mode === 'gridDisk'}
              onChange={() => setMode('gridDisk')} /> gridDisk
          </label>
          <label style={{cursor: 'pointer'}}>
            <input type="radio" name="mode" checked={mode === 'cap'}
              onChange={() => setMode('cap')} /> sphericalCap
          </label>
        </div>
        {mode === 'gridDisk' && (
          <div style={{marginBottom: 8}}>
            <label>k: {k}</label>
            <input
              type="range"
              min={1}
              max={10}
              value={k}
              onChange={e => setK(Number(e.target.value))}
              style={{width: 120, display: 'block'}}
            />
          </div>
        )}
        {mode === 'cap' && (
          <div style={{marginBottom: 8}}>
            <label>Radius: {formatRadius(radiusM)}</label>
            <input
              type="range"
              min={1}
              max={100}
              value={radiusFraction}
              onChange={e => setRadiusFraction(Number(e.target.value))}
              style={{width: 120, display: 'block'}}
            />
          </div>
        )}
        <div style={{marginBottom: 8}}>
          <label style={{display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'}}>
            <input
              type="checkbox"
              checked={doUncompact}
              onChange={e => setDoUncompact(e.target.checked)}
            />
            Uncompact
          </label>
        </div>
        {mode === 'gridDisk' && (
          <div style={{marginBottom: 8}}>
            <label style={{display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'}}>
              <input
                type="checkbox"
                checked={includeVertex}
                onChange={e => setIncludeVertex(e.target.checked)}
              />
              Include vertex neighbors
            </label>
          </div>
        )}
        <div style={{marginBottom: 8}}>
          {!doUncompact ? (
            <>Compact cells: <strong>{compactData.length}</strong>
              {minCompactRes < maxCompactRes && (
                <span style={{color: '#888'}}> (res {minCompactRes}-{maxCompactRes})</span>
              )}
            </>
          ) : (
            <>Cells: <strong>{ringData.size}</strong></>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;

export async function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<App />);
}

function DeckGLOverlay(props: any) {
  const overlay = useControl(() => new DeckOverlay(props));
  overlay.setProps(props);
  return null;
}
