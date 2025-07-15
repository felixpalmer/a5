import React, { useState } from 'react';
import {createRoot} from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Map, useControl } from 'react-map-gl/maplibre';
import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import {PathLayer, PolygonLayer} from '@deck.gl/layers';
import {generateWireframe, LonLat, A5Pentagon} from 'a5-internal/wireframe';
import { colorBins } from '@deck.gl/carto';
import { vec2 } from 'gl-matrix';
import {DataFilterExtension} from '@deck.gl/extensions';
import RangeInput from './range-input';

const INITIAL_VIEW_STATE = { longitude: 0, latitude: 60, zoom: 1.5 };
const RESOLUTION = 4;
const CELLS_PER_SEGMENT = Math.pow(4, RESOLUTION);
const CELLS_PER_FACE = 5 * CELLS_PER_SEGMENT;

const DATA = generateWireframe(RESOLUTION + 1);

// End of high-density region in final resolution level
const HD_CUTOFF = DATA.length * (32 + 8 + 2 + 0.5) / 60;

const App: React.FC = () => {
  const [filterRange, setFilterRange] = useState<[number, number]>([0, DATA.length - 1]);
  const [layerVisibility, setLayerVisibility] = useState({
    path: true,
    polygons: false
  });

  // Common layer props
  const commonLayerProps = {
    data: DATA,
    parameters: { cullMode: 'back', depthCompare: 'always' } as any,
    extensions: [new DataFilterExtension({filterSize: 1})],
    getFilterValue: (d, info) => info.index,
    filterRange: filterRange,
  };

  const layer = new PathLayer({
    ...commonLayerProps,
    id: 'hilbert',
    dataTransform: ((data: LonLat[][]) => {
      const centers = data.map(c => {
        const average = c.slice(0, 5).reduce((sum, p) => vec2.add(sum, sum, p), vec2.create());
        vec2.scale(average, average, 1 / 5);
        return [average[0], average[1] * 1];
      }) as LonLat[];
      const segments = centers.slice(0, -1).map((center, i) => ({
        path: [
          center,
          centers[i + 1]
        ],
        properties: {index: i}
      }));
      return segments;
    }) as any,
    getPath: d => {
      // If the path crosses the antimeridian, wrap it
      if (Math.abs(d.path[0][0] - d.path[1][0]) > 180) {
        const sign = d.path[0][0] > d.path[1][0] ? 1 : -1;
        return [ d.path[0], [d.path[1][0] + sign * 360, d.path[1][1]] ];
      }
      return d.path;
    },
    igetColor: [235, 235, 255],
    getColor: colorBins({
      attr: d => Math.floor(d.properties.index / (CELLS_PER_FACE)),
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
    opacity: 0.2,
    getLineColor: [0, 0, 0],
    lineWidthMinPixels: 1,
    filled: false,
    stroked: true,
    pickable: false,
  });

  // Add Controls component
  const Controls: React.FC<{
    layerVisibility: {path: boolean, polygons: boolean},
    setLayerVisibility: (vis: {path: boolean, polygons: boolean}) => void
  }> = ({layerVisibility, setLayerVisibility}) => {
    return (
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'white',
        padding: '10px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        zIndex: 1
      }}>
        <div style={{marginBottom: '10px'}}>
          <label>
            <input
              type="checkbox"
              checked={layerVisibility.path}
              onChange={e => setLayerVisibility({...layerVisibility, path: e.target.checked})}
            /> Show Path
          </label>
        </div>
        <div style={{marginBottom: '10px'}}>
          <label>
            <input
              type="checkbox"
              checked={layerVisibility.polygons}
              onChange={e => setLayerVisibility({...layerVisibility, polygons: e.target.checked})}
            /> Show Polygons
          </label>
        </div>
      </div>
    );
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
      <Map
        projection="globe"
        id="map"
        initialViewState={INITIAL_VIEW_STATE}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json"
        dragRotate={false}
        maxPitch={0}
      >
        <DeckGLOverlay layers={[layer, cellLayer]} interleaved />
      </Map>
      <Controls 
        layerVisibility={layerVisibility}
        setLayerVisibility={setLayerVisibility}
      />
      <RangeInput
        min={0}
        max={DATA.length - 1}
        value={filterRange}
        animationSpeed={1}
        onChange={setFilterRange}
        formatLabel={value => value.toString()}
      />
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