import React, {useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Map, useControl} from 'react-map-gl/maplibre';
import {hideLabels} from '../shared/hide-labels';
import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import {PathLayer, PolygonLayer} from '@deck.gl/layers';
import {generateWireframe, LonLat, A5Pentagon} from 'a5-internal/wireframe';
import {colorBins} from '@deck.gl/carto';
import {DataFilterExtension} from '@deck.gl/extensions';
import RangeInput from './range-input';
import NetView from './net-view';

const INITIAL_VIEW_STATE = {longitude: 0, latitude: 40, zoom: 1.1};
const MAX_RESOLUTION = 5;

// Wireframes are generated on first use and kept, so revisiting a resolution is instant.
// The globe draws each segment as a straight chord, so the long edges of the
// coarse resolutions are split into more points to follow the surface
const WIREFRAMES: LonLat[][][] = [];
function getWireframe(resolution: number): LonLat[][] {
  WIREFRAMES[resolution] ??= generateWireframe(resolution, {segments: Math.max(1, 2 ** (4 - resolution))});
  return WIREFRAMES[resolution];
}

type Vec3 = [number, number, number];
const DEG = Math.PI / 180;
// Keep points a little off the poles, where longitude is undefined
const MAX_LATITUDE = 89.99;

function toVector([lon, lat]: LonLat): Vec3 {
  return [Math.cos(lat * DEG) * Math.cos(lon * DEG), Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG)];
}

function toLonLat([x, y, z]: Vec3): LonLat {
  const lat = Math.atan2(z, Math.hypot(x, y)) / DEG;
  return [Math.atan2(y, x) / DEG, Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat))] as LonLat;
}

// Cell center as the normalized mean of its boundary on the sphere (averaging
// lon/lat directly breaks for the cells around the poles)
function cellCenter(ring: LonLat[]): Vec3 {
  const sum: Vec3 = [0, 0, 0];
  for (const p of ring) {
    const v = toVector(p);
    sum[0] += v[0];
    sum[1] += v[1];
    sum[2] += v[2];
  }
  const length = Math.hypot(...sum);
  return [sum[0] / length, sum[1] / length, sum[2] / length];
}

// Great circle from a to b, with a point every ~2 degrees and longitudes kept
// continuous so the path never jumps across the antimeridian
function greatCircle(a: Vec3, b: Vec3): LonLat[] {
  const angle = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
  const steps = Math.max(1, Math.ceil(angle / (2 * DEG)));
  const path: LonLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const wa = angle === 0 ? 1 - t : Math.sin((1 - t) * angle) / Math.sin(angle);
    const wb = angle === 0 ? t : Math.sin(t * angle) / Math.sin(angle);
    const point = toLonLat([wa * a[0] + wb * b[0], wa * a[1] + wb * b[1], wa * a[2] + wb * b[2]]);
    if (path.length) {
      const previous = path[path.length - 1][0];
      point[0] += 360 * Math.round((previous - point[0]) / 360);
    }
    path.push(point);
  }
  // A pole has no longitude of its own: give an endpoint there its neighbor's,
  // so the path arrives along the meridian instead of curling around the pole
  const last = path.length - 1;
  if (Math.abs(path[0][1]) >= MAX_LATITUDE) path[0][0] = path[1][0];
  if (Math.abs(path[last][1]) >= MAX_LATITUDE) path[last][0] = path[last - 1][0];
  return path;
}

type LayerVisibility = {path: boolean; polygons: boolean};

// Defined outside App so its inputs keep their identity (and a slider drag)
// across the re-renders each change triggers
const Controls: React.FC<{
  layerVisibility: LayerVisibility;
  setLayerVisibility: (vis: LayerVisibility) => void;
  resolution: number;
  setResolution: (resolution: number) => void;
}> = ({layerVisibility, setLayerVisibility, resolution, setResolution}) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'white',
        padding: '10px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        zIndex: 1
      }}
    >
      <div style={{marginBottom: '10px'}}>
        <label>
          <input
            type="checkbox"
            checked={layerVisibility.path}
            onChange={e => setLayerVisibility({...layerVisibility, path: e.target.checked})}
          />{' '}
          Show Path
        </label>
      </div>
      <div style={{marginBottom: '10px'}}>
        <label>
          <input
            type="checkbox"
            checked={layerVisibility.polygons}
            onChange={e => setLayerVisibility({...layerVisibility, polygons: e.target.checked})}
          />{' '}
          Show Cells
        </label>
      </div>
      <div>
        <label>
          Resolution: {resolution}
          <br />
          <input
            type="range"
            min={0}
            max={MAX_RESOLUTION}
            step={1}
            value={resolution}
            onChange={e => setResolution(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [resolution, setResolution] = useState(1);
  const DATA = useMemo(() => getWireframe(resolution), [resolution]);
  const CELLS_PER_FACE = DATA.length / 12;
  // End of high-density region along the curve
  const HD_CUTOFF = (DATA.length * (32 + 8 + 2 + 0.5)) / 60;

  const [filterRange, setFilterRange] = useState<[number, number]>([0, DATA.length - 1]);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    path: true,
    polygons: false
  });

  // Keep the same stretch of the curve across resolutions: positions along it
  // scale with the number of cells
  const changeResolution = (newResolution: number) => {
    const scale = getWireframe(newResolution).length / DATA.length;
    const [lo, hi] = filterRange;
    setResolution(newResolution);
    setFilterRange([Math.floor(lo * scale), Math.ceil((hi + 1) * scale) - 1]);
  };

  // Common layer props
  const commonLayerProps = {
    data: DATA,
    parameters: {cullMode: 'back', depthCompare: 'always'} as any,
    extensions: [new DataFilterExtension({filterSize: 1})],
    getFilterValue: (d, info) => info.index,
    filterRange: filterRange
  };

  const layer = new PathLayer({
    ...commonLayerProps,
    id: 'hilbert',
    dataTransform: ((data: LonLat[][]) => {
      const centers = data.map(cellCenter);
      const segments = centers.slice(0, -1).map((center, i) => ({
        path: greatCircle(center, centers[i + 1]),
        properties: {index: i}
      }));
      return segments;
    }) as any,
    getPath: d => d.path,
    igetColor: [235, 235, 255],
    getColor: colorBins({
      attr: d => Math.floor(d.properties.index / CELLS_PER_FACE),
      colors: 'Pastel',
      domain: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    }),
    widthUnits: 'pixels',
    getWidth: d => {
      const highlight = d.properties.index < HD_CUTOFF;
      return 1 + (highlight ? 1 : 0);
    },
    capRounded: true,
    visible: layerVisibility.path
  });

  const cellLayer = new PolygonLayer({
    ...commonLayerProps,
    id: 'polygons',
    visible: layerVisibility.polygons,
    getPolygon: d => d,
    opacity: 0.6,
    getLineColor: [255, 255, 255],
    lineWidthMinPixels: 1,
    filled: false,
    stroked: true,
    pickable: false
  });

  return (
    <div
      style={{
        position: 'absolute',
        height: '100%',
        width: '100%',
        top: 0,
        left: 0,
        background: 'linear-gradient(0, #000, #223)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Globe in the top half, the same curve on the unfolded net below */}
      <div style={{position: 'relative', flex: '1 1 0', minHeight: 0}}>
        <Map
          projection="globe"
          id="map"
          initialViewState={INITIAL_VIEW_STATE}
          mapStyle="https://tiles.openfreemap.org/styles/dark"
          onStyleData={hideLabels}
          dragRotate={false}
          maxPitch={0}
        >
          <DeckGLOverlay layers={[layer, cellLayer]} interleaved />
        </Map>
        <Controls
          layerVisibility={layerVisibility}
          setLayerVisibility={setLayerVisibility}
          resolution={resolution}
          setResolution={changeResolution}
        />
      </div>
      <div style={{position: 'relative', flex: '1 1 0', minHeight: 0, borderTop: '1px solid rgba(255,255,255,0.12)'}}>
        <NetView
          resolution={resolution}
          filterRange={filterRange}
          showPath={layerVisibility.path}
          showCells={layerVisibility.polygons}
        />
      </div>
      {/* The range slider sits on the line between the two views, as it drives both */}
      <div style={{position: 'absolute', left: 0, right: 0, top: '50%', height: 0, zIndex: 1}}>
        <RangeInput min={0} max={DATA.length - 1} value={filterRange} animationSpeed={1} onChange={setFilterRange} />
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
