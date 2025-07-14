import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {createRoot} from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Map as Maplibre, useControl} from 'react-map-gl/maplibre';
import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import {ScatterplotLayer, PolygonLayer, TextLayer} from '@deck.gl/layers';
import {HeatmapLayer} from '@deck.gl/aggregation-layers';
import { Color, Position } from '@deck.gl/core';
import { colorContinuous } from '@deck.gl/carto';
import { cellToBoundary, lonLatToCell } from 'a5';
import {H3HexagonLayer} from '@deck.gl/geo-layers';
import {cellToBoundary as h3CellToBoundary, latLngToCell} from 'h3-js';

const ATHENS_DATA = '/data/malta.json';
const OSLO_DATA = '/data/oslo.json';

const COLOR_RANGE = [ [211, 242, 163], [151, 225, 150], [108, 192, 139], [76, 155, 130], [33, 122, 121], [16, 89, 101], [7, 64, 80] ] as Color[];

const A5_RESOLUTION = 13;
const H3_RESOLUTION = 8;

const INITIAL_VIEW_STATE = {
  athens: { longitude: 14.385, latitude: 35.87, pitch: 30, bearing: 240, zoom: 10.5},
  oslo: { longitude: 10.85, latitude: 60, pitch: 30, bearing: 40, zoom: 9.8 }
};

type A5CellWithCount = { id: bigint, count: number };
type H3CellWithCount = { id: string, count: number };
type AggregatedData = {
  a5: {
    cells: A5CellWithCount[];
    maxCount: number;
  };
  h3: {
    cells: H3CellWithCount[];
    maxCount: number;
  };
};

type ViewType = 'points' | 'a5' | 'h3' | 'heatmap';

const MapView: React.FC<{
  dataUrl: string;
  initialViewState: typeof INITIAL_VIEW_STATE.athens;
  layerType: 'points' | 'cells' | 'heatmap';
  globalMaxCount: number;
  tilingSystem: 'a5' | 'h3';
  aggregatedData: AggregatedData;
  center: [number, number];
  labelPosition: [number, number];
}> = ({ dataUrl, initialViewState, layerType, globalMaxCount, tilingSystem, aggregatedData, center, labelPosition }) => {
  const [rawData, setRawData] = useState<[number, number][] | null>(null);

  // Load raw data
  useEffect(() => {
    fetch(dataUrl).then(r => r.json()).then(setRawData);
  }, [dataUrl]);

  if (!rawData) return null;

  // Common layer props
  const commonProps = {
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 255],
    visible: layerType === 'cells'
  };

  // Create scatterplot layer for points
  const scatterplotLayer = new ScatterplotLayer<Position>({
    id: 'airbnb-points',
    data: rawData,
    getPosition: d => d,
    getFillColor: COLOR_RANGE[0],
    getRadius: 1,
    radiusUnits: 'pixels',
    visible: layerType === 'points'
  });

  // Create heatmap layer
  const heatmapLayer = new HeatmapLayer({
    id: 'airbnb-heatmap',
    data: rawData,
    getPosition: d => d,
    getWeight: 1,
    radiusPixels: 25,
    intensity: 1,
    threshold: 0.05,
    colorRange: COLOR_RANGE,
    visible: layerType === 'heatmap'
  });

  // Create center point layer with 10km radius
  const centerPointLayer = new ScatterplotLayer({
    id: 'center-point',
    data: [center],
    getPosition: d => d,
    getLineColor: [255, 255, 255, 200],
    getRadius: 10000,
    radiusUnits: 'meters',
    stroked: true,
    filled: false,
    lineWidthMinPixels: 2,
    pickable: false,
  });

  // Create label layer for the 10km circle
  const labelLayer = new TextLayer({
    id: 'circle-label',
    data: [labelPosition],
    getPosition: d => d,
    getText: d => '10km',
    getColor: [255, 255, 255, 200],
    getSize: 16,
    fontFamily: 'Arial, sans-serif',
    fontSettings: { sdf: true, buffer: 8 },
    pickable: false,
  });

  const cellProps = {
    getFillColor: colorContinuous({ attr: d => Math.sqrt(d.count), domain: [0, Math.sqrt(globalMaxCount)], colors: 'Emrld' }),
    getLineColor: [255, 255, 255, 200],
    stroked: true,
    wireframe: true,
    getElevation: d => 25000 * d.count / globalMaxCount,
    extruded: true
  } as any;

  // Create cell layer based on tiling system
  const cellLayer = tilingSystem === 'a5' 
    ? new PolygonLayer<A5CellWithCount>({
        id: 'airbnb-cells',
        data: aggregatedData.a5.cells,
        getPolygon: d => cellToBoundary(d.id),
        ...cellProps,
        ...commonProps
      })
    : new H3HexagonLayer<H3CellWithCount>({
        id: 'airbnb-cells',
        data: aggregatedData.h3.cells,
        getHexagon: d => d.id,
        ...cellProps,
        ...commonProps
      });

  return (
    <div style={{ width: '50%', height: '100%', position: 'relative' }}>
      <Maplibre
        id="map"
        initialViewState={initialViewState}
        boxZoom={false}
        scrollZoom={false}
        minPitch={initialViewState.pitch}
        maxPitch={initialViewState.pitch}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
      >
        <DeckGLOverlay 
          layers={[cellLayer, scatterplotLayer, heatmapLayer, centerPointLayer, labelLayer]}
          interleaved={false}
          getTooltip={({object}) => {
            if (!object) return null;
            return {
              html: `<div>Listings: ${object.count}</div>`,
              style: {
                backgroundColor: 'white',
                padding: '8px',
                borderRadius: '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }
            };
          }}
        />
      </Maplibre>
    </div>
  );
};

const App: React.FC = () => {
  const [viewType, setViewType] = useState<ViewType>('a5');
  const [aggregatedData, setAggregatedData] = useState<{
    malta: AggregatedData;
    oslo: AggregatedData;
  } | null>(null);
  const [globalMaxCounts, setGlobalMaxCounts] = useState<{
    a5: number;
    h3: number;
  }>({ a5: 0, h3: 0 });

  // Load and aggregate data
  useEffect(() => {
    const loadAndAggregateData = async () => {
      const [maltaData, osloData] = await Promise.all([
        fetch(ATHENS_DATA).then(r => r.json()),
        fetch(OSLO_DATA).then(r => r.json())
      ]);

      const aggregateData = (data: [number, number][]) => {
        // Aggregate for A5
        const a5Cells = data.map(point => {
          const id = lonLatToCell(point, A5_RESOLUTION);
          return { id, count: 1 };
        });

        const a5Bins = new Map<bigint, A5CellWithCount>();
        let a5MaxCount = 0;
        
        for (const feature of a5Cells) {
          const {id} = feature;
          if (!a5Bins.has(id)) {
            a5Bins.set(id, feature);
          } else {
            a5Bins.get(id)!.count += 1;
          }
          a5MaxCount = Math.max(a5MaxCount, a5Bins.get(id)!.count);
        }

        // Aggregate for H3
        const h3Cells = data.map(point => {
          const id = latLngToCell(point[1], point[0], H3_RESOLUTION);
          return { id, count: 1 };
        });

        const h3Bins = new Map<string, H3CellWithCount>();
        let h3MaxCount = 0;
        
        for (const feature of h3Cells) {
          const {id} = feature;
          if (!h3Bins.has(id)) {
            h3Bins.set(id, feature);
          } else {
            h3Bins.get(id)!.count += 1;
          }
          h3MaxCount = Math.max(h3MaxCount, h3Bins.get(id)!.count);
        }

        return {
          a5: {
            cells: [...a5Bins.values()],
            maxCount: a5MaxCount
          },
          h3: {
            cells: [...h3Bins.values()],
            maxCount: h3MaxCount
          }
        };
      };

      const maltaAggregated = aggregateData(maltaData);
      const osloAggregated = aggregateData(osloData);

      setAggregatedData({
        malta: maltaAggregated,
        oslo: osloAggregated
      });

      // Calculate global max counts for each tiling system
      setGlobalMaxCounts({
        a5: Math.max(
          maltaAggregated.a5.maxCount,
          osloAggregated.a5.maxCount
        ),
        h3: Math.max(
          maltaAggregated.h3.maxCount,
          osloAggregated.h3.maxCount
        )
      });
    };

    loadAndAggregateData();
  }, []);

  const Controls: React.FC<{
    viewType: ViewType;
    setViewType: (type: ViewType) => void;
  }> = ({ viewType, setViewType }) => {
    return (
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 1,
        background: 'white',
        padding: '10px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
      }}>
        <div>
          <label style={{ marginRight: '8px' }}>View:</label>
          <select 
            value={viewType} 
            onChange={(e) => setViewType(e.target.value as ViewType)}
            style={{ padding: '4px' }}
          >
            <option value="points">Points</option>
            <option value="a5">A5 (Pentagons)</option>
            <option value="h3">H3 (Hexagons)</option>
            <option value="heatmap">Heatmap</option>
          </select>
        </div>
      </div>
    );
  };

  if (!aggregatedData) return null;

  return (
    <div
      style={{
        position: 'absolute',
        height: '100%',
        width: '100%',
        top: 0,
        left: 0,
        background: 'linear-gradient(0, #000, #223)',
        display: 'flex'
      }}
    >
      <MapView
        dataUrl={ATHENS_DATA}
        initialViewState={INITIAL_VIEW_STATE.athens}
        layerType={viewType === 'points' ? 'points' : viewType === 'heatmap' ? 'heatmap' : 'cells'}
        globalMaxCount={globalMaxCounts[viewType === 'a5' ? 'a5' : 'h3']}
        tilingSystem={viewType === 'a5' ? 'a5' : 'h3'}
        aggregatedData={aggregatedData.malta}
        center={[14.4923, 35.9139]}
        labelPosition={[14.49, 35.989]}
      />
      <MapView
        dataUrl={OSLO_DATA}
        initialViewState={INITIAL_VIEW_STATE.oslo}
        layerType={viewType === 'points' ? 'points' : viewType === 'heatmap' ? 'heatmap' : 'cells'}
        globalMaxCount={globalMaxCounts[viewType === 'a5' ? 'a5' : 'h3']}
        tilingSystem={viewType === 'a5' ? 'a5' : 'h3'}
        aggregatedData={aggregatedData.oslo}
        center={[10.7522, 59.9139]}
        labelPosition={[10.61, 59.88]}
      />
      <Controls 
        viewType={viewType}
        setViewType={setViewType}
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