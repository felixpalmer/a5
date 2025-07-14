import React, { useState, useEffect } from 'react';
import {createRoot} from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Map as Maplibre, useControl} from 'react-map-gl/maplibre';
import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import {ColumnLayer, PolygonLayer, ScatterplotLayer} from '@deck.gl/layers';
import { cellToBoundary, cellToLonLat, lonLatToCell } from 'a5';
import { LonLat } from 'a5';
import { Color, Position } from '@deck.gl/core';
const PLACES = '/data/ne_10m_populated_places_simple.geojson';
const INITIAL_VIEW_STATE = { longitude: -5, latitude: 50, zoom: 5 };
const RESOLUTION = 8;

type A5CellWithPopulation = { id: bigint, point: Position, population: number };
type SourcePoint = { point: Position, population: number };
type TransformedData = {
  cells: A5CellWithPopulation[];
  sourcePoints: SourcePoint[];
};

// Transform GeoJSON point data into aggregated A5 cells with population
function dataTransform(d: GeoJSON.FeatureCollection): TransformedData {
  // Convert GeoJSON to cells
  let inside = 0;
  let outside = 0;
  const sourcePoints: SourcePoint[] = [];
  const data: (A5CellWithPopulation | null)[] = d.features.map(feature => {
    const point = (feature.geometry as GeoJSON.Point).coordinates;
    const population = feature.properties ? feature.properties.pop_max : 10000;
    
    // Store source point
    sourcePoints.push({ point, population });
    
    const id = lonLatToCell(point as LonLat, RESOLUTION);
    const originSegmentProduct = Number(id >> 58n);
    const lowRes = originSegmentProduct > 32 + 8 + 2 + 0.5;
    if (lowRes) {
      outside += population;
    } else {
      inside += population;
    }
    return {
      id,
      point,
      population
    };
  });
  console.log('population in HD', 100 - 0.001 * Math.round(100000 * outside / (inside + outside)), '%');
  const filteredData = data.filter(Boolean) as A5CellWithPopulation[];
  const bins = new Map<bigint, A5CellWithPopulation>();
  for (const feature of filteredData) {
    const {id} = feature;
    if (!bins.has(id)) {
      bins.set(id, feature);
    } else {
      bins.get(id)!.population += feature.population;
    }
  }

  let aggregated = [...bins.values()];
  return { cells: aggregated, sourcePoints };
}

const App: React.FC = () => {
  const [layerType, setLayerType] = useState<'polygon' | 'column'>('column');
  const [data, setData] = useState<TransformedData | null>(null);

  useEffect(() => {
    fetch(PLACES)
      .then(r => r.json())
      .then(dataTransform)
      .then(setData);
  }, []);

  // Common layer props
  const commonLayerProps = {
    data: data?.cells,
    getFillColor: (d: A5CellWithPopulation) => {
      const scale = d.population / 100000;
      return [255 * scale, 5 * scale, 255 - 25 * scale, 255] as Color;
    },
    extruded: true,
    getElevation: (d: A5CellWithPopulation) => (10000 + d.population / 10),
    beforeId: 'watername_ocean',
    parameters: { cullMode: 'back' } as const
  };

  // Create layers
  const cellLayer = new PolygonLayer<A5CellWithPopulation>({
    ...commonLayerProps,
    id: 'cell-polygon',
    getPolygon: d => cellToBoundary(d.id),
    filled: false,
    wireframe: true,
    getLineColor: [255, 255, 255, 255],
    visible: layerType === 'polygon'
  });

  const columnLayer = new ColumnLayer<A5CellWithPopulation>({
    ...commonLayerProps,
    id: 'cell-column',
    getPosition: d => cellToLonLat(d.id),
    radius: 2000,
    radiusUnits: 'meters',
    visible: layerType === 'column'
  });

  const pointLayers = [true, false].map(original => new ScatterplotLayer<SourcePoint>({
    id: `cell-point-${original ? 'visible' : 'hidden'}`,
    data: original ? data?.sourcePoints : data?.cells,
    getPosition: original ? d => d.point : d => cellToLonLat(d.id),
    radiusUnits: 'meters',
    radiusMaxPixels: original ? 10 : 20,
    lineWidthMaxPixels: 2,
    filled: true,
    stroked: true,
    lineWidthUnits: 'meters',
    getRadius: original ? 2000 : 4000,
    getLineWidth: 500,
    getFillColor: original ? [255, 255, 255, 255] : d => {
      const scale = d.population / 100000;
      return [255 * scale, 5 * scale, 255 - 25 * scale, 255] as Color;
    },
    getLineColor: [255, 255, 255, 255],
    parameters: { depthCompare: 'always', cullMode: 'back' } as const,
    getPolygonOffset: d => [1, 0],
    visible: layerType === 'polygon'
  }));

  const Controls: React.FC<{
    layerType: 'polygon' | 'column';
    setLayerType: (type: 'polygon' | 'column') => void;
  }> = ({ layerType, setLayerType }) => {
    const toggleLayer = () => {
      setLayerType(layerType === 'polygon' ? 'column' : 'polygon');
    };

    return (
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 1
      }}>
        <button
          onClick={toggleLayer}
          style={{
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          Show {layerType === 'polygon' ? 'Column' : 'Cell'} View
        </button>
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
      <Maplibre
        id="map"
        initialViewState={INITIAL_VIEW_STATE}
        projection="globe"
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        dragRotate={false}
        maxPitch={0}
      >
        <DeckGLOverlay 
          layers={[cellLayer, columnLayer, ...pointLayers]}
          interleaved={true}
        />
      </Maplibre>
      <Controls 
        layerType={layerType}
        setLayerType={setLayerType}
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