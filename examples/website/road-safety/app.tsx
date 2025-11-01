import React from 'react';
import {createRoot} from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Map as Maplibre, useControl} from 'react-map-gl/maplibre';
import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import {PolygonLayer} from '@deck.gl/layers';
import { cellToBoundary } from 'a5';
import { Color } from '@deck.gl/core';
import { parquetRead } from 'hyparquet';

const HEATMAP_DATA = '/data/heatmap-data.parquet';
const INITIAL_VIEW_STATE = { longitude: 0, latitude: 53, zoom: 5, pitch: 20, maxZoom: 8, minZoom: 4 };
const MAX_COUNT = 109;

const A5GREEN = [0, 170, 85] as Color;
const WHITE = [255, 255, 255] as Color;

// Custom loader for Parquet files using hyparquet
const HyparquetLoader = {
  name: 'Hyparquet',
  id: 'hyparquet',
  module: 'hyparquet',
  version: '1.0.0',
  extensions: ['parquet'],
  mimeTypes: ['application/octet-stream'],
  category: 'table',
  parse: async (arrayBuffer: ArrayBuffer) => {
    console.log('HyparquetLoader: Starting to parse', arrayBuffer.byteLength, 'bytes');
    return new Promise((resolve, reject) => {
      try {
        parquetRead({
          file: arrayBuffer,
          onComplete: (rows) => {
            console.log('HyparquetLoader: Loaded', rows.length, 'rows');
            console.log('HyparquetLoader: First row:', rows[0]);
            resolve(rows);
          }
        });
      } catch (error) {
        console.error('HyparquetLoader: Error parsing parquet:', error);
        reject(error);
      }
    });
  }
};

const App: React.FC = () => {
  // Create layer with custom Parquet loader
  const cellLayer = new PolygonLayer({
    data: HEATMAP_DATA,
    id: 'cell-polygon',
    loaders: [HyparquetLoader],
    getPolygon: (d: any) => {
      const boundary = cellToBoundary(d[0]);
      return boundary;
    },
    getFillColor: (d: any) => {
      // Interpolate between A5 green and white based on sqrt of count
      const scale = Math.sqrt(d[1] / MAX_COUNT);
      return [
        A5GREEN[0] * (1 - scale) + WHITE[0] * scale,
        A5GREEN[1] * (1 - scale) + WHITE[1] * scale,
        A5GREEN[2] * (1 - scale) + WHITE[2] * scale,
        255
      ] as Color;
    },
    extruded: true,
    getElevation: (d: any) => d[1],
    elevationScale: 1000,
    filled: true,
    beforeId: 'watername_ocean',
    parameters: { cullMode: 'back' } as const
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
      <Maplibre
        id="map"
        initialViewState={INITIAL_VIEW_STATE}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
      >
        <DeckGLOverlay
          layers={[cellLayer]}
          interleaved={true}
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
