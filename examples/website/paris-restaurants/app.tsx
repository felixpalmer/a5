import React from 'react';
import {createRoot} from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Map as Maplibre, useControl} from 'react-map-gl/maplibre';
import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import {PolygonLayer} from '@deck.gl/layers';
import { cellToBoundary } from 'a5';
import { Color } from '@deck.gl/core';
import { HyparquetLoader } from '../shared/hyparquet-loader';

const RESTAURANTS_DATA = '/data/restaurants_paris_aggregated.parquet';
const INITIAL_VIEW_STATE = { longitude: 2.35, latitude: 48.85, zoom: 10, pitch: 0, maxZoom: 12, minZoom: 9 };
const MAX_COUNT = 14;

type A5CellWithCount = {a5: bigint; count: number;};

const App: React.FC = () => {
  // Create layer with custom Parquet loader
  const cellLayer = new PolygonLayer<A5CellWithCount>({
    data: RESTAURANTS_DATA,
    id: 'cell-polygon',
    loaders: [HyparquetLoader],
    getPolygon: (d: A5CellWithCount) => cellToBoundary(d.a5),
    getFillColor: (d: A5CellWithCount) => {
      const value = Math.min(d.count / MAX_COUNT, 1);

      // Color based on restaurant count (French tricolor: white -> blue -> red)
      if (value < 0.5) {
        const t = value * 2;  // 0 to 1
        return [255 - 255 * t, 255 - 220 * t, 255 - 113 * t, 200] as Color;
      } else {
        const t = (value - 0.5) * 2;  // 0 to 1
        return [0 + 255 * t, 35 - 35 * t, 142 - 142 * t, 200] as Color;
      }
    },
    filled: true,
    stroked: false,
    pickable: true
  });

  return (
    <div
      style={{
        position: 'absolute',
        height: '100%',
        width: '100%',
        top: 0,
        left: 0
      }}
    >
      <Maplibre
        id="map"
        initialViewState={INITIAL_VIEW_STATE}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json"
      >
        <DeckGLOverlay
          layers={[cellLayer]}
          interleaved={true}
          getTooltip={({object}) => object && `${object.count} restaurants`}
        />
      </Maplibre>
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
