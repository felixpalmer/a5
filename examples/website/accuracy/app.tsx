import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {createRoot} from 'react-dom/client';
import DeckGL from '@deck.gl/react';
import {MapViewState} from '@deck.gl/core';
import {BitmapLayer, PathLayer, PolygonLayer, ScatterplotLayer} from '@deck.gl/layers';
import {
  BezierVertex, ContourData, HoverCells,
  sampleBezierPath, roundTripA5, roundTripH3, roundTripS2, getCellsAtLocation
} from './utils';

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: -73.92242366,
  latitude: 40.82170088,
  zoom: 21,
  minZoom: 20,
  maxZoom: 30,
  pitch: 0,
  bearing: -43
};

const IMAGE_BOUNDS: [number, number, number, number] = [
  -73.9235733535, 40.8209720877, -73.9214787230, 40.8223914219
];

type SystemKey = 'original' | 'a5' | 'h3' | 's2';

const SYSTEMS: {key: SystemKey; label: string; color: [number, number, number]; resolution: string}[] = [
  {key: 'original', label: 'Vector', color: [255, 255, 200], resolution: '-'},
  {key: 'a5', label: 'A5', color: [0, 200, 100], resolution: '30'},
  {key: 'h3', label: 'H3', color: [255, 60, 60], resolution: '15'},
  {key: 's2', label: 'S2', color: [60, 130, 255], resolution: '30'}
];

const DOT_RADIUS: Record<SystemKey, number> = {
  original: 0.001,
  a5: 0.0015,
  h3: 0.1,
  s2: 0.002
};

const HOVER_COLORS: Record<string, {fill: [number, number, number, number]; line: [number, number, number]}> = {
  a5: {fill: [0, 200, 100, 60], line: [0, 200, 100]},
  h3: {fill: [255, 60, 60, 60], line: [255, 60, 60]},
  s2: {fill: [60, 130, 255, 60], line: [60, 130, 255]}
};

const App: React.FC = () => {
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE);
  const [selected, setSelected] = useState<SystemKey>('original');
  const [showCell, setShowCell] = useState(false);
  const [hoverCells, setHoverCells] = useState<HoverCells>(null);
  const [bezierPaths, setBezierPaths] = useState<BezierVertex[][] | null>(null);

  useEffect(() => {
    fetch('/data/bezier.json')
      .then(r => r.json())
      .then((data: {paths: {vertices: BezierVertex[]}[]}) => {
        setBezierPaths(data.paths.map(p => p.vertices));
      });
  }, []);

  const contourData = useMemo<ContourData[] | null>(() => {
    if (!bezierPaths) return null;
    return bezierPaths.map(verts => {
      const sampled = sampleBezierPath(verts, true);
      return {
        original: sampled,
        a5: roundTripA5(sampled),
        h3: roundTripH3(sampled),
        s2: roundTripS2(sampled)
      };
    });
  }, [bezierPaths]);

  const onViewStateChange = useCallback(({viewState}: {viewState: MapViewState}) => {
    setViewState(viewState);
  }, []);

  const onHover = useCallback((info: any) => {
    if (showCell && info.coordinate) {
      const [lon, lat] = info.coordinate;
      setHoverCells(getCellsAtLocation(lon, lat));
    } else {
      setHoverCells(null);
    }
  }, [showCell]);

  const sys = SYSTEMS.find(s => s.key === selected)!;

  const layers = [];

  layers.push(
    new BitmapLayer({
      id: 'football-field',
      image: '/data/football-field.jpg',
      bounds: IMAGE_BOUNDS
    })
  );

  if (contourData) {
    for (let ci = 0; ci < contourData.length; ci++) {
      const cd = contourData[ci];
      layers.push(
        new PathLayer({
          id: `contour-${ci}`,
          data: [{path: cd[selected]}],
          getPath: (d: any) => d.path,
          getColor: sys.color,
          widthUnits: 'pixels',
          getWidth: 4,
          jointRounded: true,
          capRounded: true
        })
      );
      layers.push(
        new ScatterplotLayer({
          id: `dots-${ci}`,
          data: cd[selected],
          getPosition: (d: [number, number]) => d,
          getRadius: DOT_RADIUS[selected],
          radiusUnits: 'meters',
          radiusMinPixels: 1,
          getFillColor: sys.color,
          filled: true
        })
      );
    }
  }

  if (showCell && hoverCells && selected !== 'original') {
    const colors = HOVER_COLORS[selected];
    const boundary = hoverCells[selected as 'a5' | 'h3' | 's2'];
    layers.push(
      new PolygonLayer({
        id: 'hover-cell',
        data: [{polygon: boundary}],
        getPolygon: (d: any) => d.polygon,
        getFillColor: colors.fill,
        getLineColor: colors.line,
        getLineWidth: 2,
        lineWidthUnits: 'pixels',
        filled: true,
        stroked: true
      })
    );
  }

  return (
    <div style={{position: 'absolute', height: '100%', width: '100%', top: 0, left: 0, background: '#111'}}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        onHover={onHover}
        controller={true}
        layers={layers}
      />

      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        background: 'white',
        padding: 10,
        borderRadius: 4,
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        zIndex: 1
      }}>
        <div style={{marginBottom: 10}}>
          <label>
            Grid system:{' '}
            <select
              value={selected}
              onChange={e => setSelected(e.target.value as SystemKey)}
              style={{marginLeft: 5}}
            >
              {SYSTEMS.map(s => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              checked={showCell}
              onChange={e => setShowCell(e.target.checked)}
            /> Show nearest cell
          </label>
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
