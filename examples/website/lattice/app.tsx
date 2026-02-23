import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {createRoot} from 'react-dom/client';
import DeckGL from '@deck.gl/react';
import {PolygonLayer, PathLayer, ScatterplotLayer, TextLayer} from '@deck.gl/layers';
import {DataFilterExtension} from '@deck.gl/extensions';
import { colorContinuous } from '@deck.gl/carto';
import { vec2 } from 'gl-matrix';

import type { Anchor, Orientation } from 'a5/lattice';
import type { Triple } from 'a5/lattice';
import { sToAnchor, anchorToTriple } from 'a5/lattice';
import { Pentagon, PentagonShape } from 'a5/geometry/pentagon';
import { getPentagonVertices } from 'a5/core/tiling';
import { getCellNeighbors } from 'a5/traversal/quintant-neighbors';
import { BASIS } from 'a5/core/pentagon';

export type Cell = {
  origin: vec2;
  anchor: Anchor;
  vertices: vec2[];
  center: vec2;
  index: number;
  tripleCoords: Triple;
}

function crossCheck(cells: Cell[], cells2: Cell[]) {
  for (let i = 0; i < cells2.length; i++) {
    const child = cells2[i];
    const parent = cells[Math.floor(i / 4)];
    const pentagon = new PentagonShape(parent.vertices as Pentagon);
    let contained = false;
    for (const vertex of child.vertices) {
      if (pentagon.containsPoint(vertex) > 0) {
        contained = true;
        break;
      }
    }
    if (!contained) {
      // @ts-ignore
      parent.crossCheckFailed = true;
    }
  }
}

const App: React.FC = () => {
  const [resolution, setResolution] = useState(3);
  const [layerVisibility, setLayerVisibility] = useState({
    triangles: true,
    path: true,
    points: true,
    labels: false,
    anchors: false,
    children: false,
    centerLines: false
  });
  const [orientation, setOrientation] = useState<Orientation>('uv');
  const [colorByParent, setColorByParent] = useState(true);
  const [maxFilterValue, setMaxFilterValue] = useState(100);
  const [hoveredCellIndex, setHoveredCellIndex] = useState<number | null>(null);
  const [showTripleCoords, setShowTripleCoords] = useState(false);
  const [gridDiskK, setGridDiskK] = useState(0);

  // Memoize the cell generation function
  const generateCells = useCallback((resolution: number) => {
    const sequence = Array.from({length: Math.pow(4, resolution)}, (_, i) => i);
    const scale = Math.pow(2, -resolution);
    
    let anchors = sequence.map(s => sToAnchor(s, resolution, orientation));

    return anchors.map((anchor, i) => {
      const origin = vec2.transformMat2(vec2.create(), anchor.offset, BASIS);
      const vertices = getPentagonVertices(resolution, 0, anchor).getVertices().map(v => [...v]);
      // Calculate center as average of vertices
      const center = vertices.reduce((sum, v) => vec2.add(sum, sum, vec2.fromValues(v[0], v[1])), [0, 0] as vec2);
      vec2.scale(center, center, 1/vertices.length);
      return {
        origin: vec2.scale(vec2.create(), origin, scale),
        anchor,
        vertices,
        center,
        index: i,
        tripleCoords: anchorToTriple(anchor)
      };
    });
  }, [orientation]);

  const generatePaths = useCallback((cells: Cell[]) => {
    return cells.slice(0, -1).map((cell, i) => ({
      path: [cell.center, cells[i + 1].center],
      index: cell.index
    }));
  }, []);

  // Initialize state with memoized values
  const [cells, setCells] = useState<Cell[]>([]);
  const [children, setChildren] = useState([]);
  const [paths, setPaths] = useState(() => generatePaths(cells));

  // Compute gridDisk highlighted cells when hovering with k > 0
  const highlightedCells = useMemo(() => {
    if (gridDiskK === 0 || hoveredCellIndex === null) return new Set<number>();
    // BFS in s-value space using getCellNeighbors
    const s = BigInt(hoveredCellIndex);
    const visited = new Set<bigint>([s]);
    let frontier = new Set<bigint>([s]);
    for (let ring = 1; ring <= gridDiskK; ring++) {
      const nextFrontier = new Set<bigint>();
      for (const id of frontier) {
        for (const neighbor of getCellNeighbors(id, resolution, orientation, {edgeOnly: true})) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            nextFrontier.add(neighbor);
          }
        }
      }
      frontier = nextFrontier;
    }
    return new Set(Array.from(visited).map(Number));
  }, [hoveredCellIndex, gridDiskK, resolution, orientation]);

  // Update geometry when resolution changes
  useEffect(() => {
    const newCells = generateCells(resolution);
    const newChildren = generateCells(resolution + 1);
    if (newCells.length > 0 && newChildren.length === 4 * newCells.length) {
      crossCheck(newCells, newChildren);
    }
    setCells(newCells);
    setChildren(newChildren);
    setPaths(generatePaths(newCells));
  }, [resolution, generateCells, generatePaths]);

  // Resolution change handler
  const handleResolutionChange = useCallback((newResolution: number) => {
    setResolution(newResolution);
  }, []);

  const softBuffer = useMemo(() => paths.length / 100, [paths.length]);

  // Calculate actual filter range based on percentage
  const filterRange = useMemo(() => {
    const maxIndex = paths.length;
    const maxValue = Math.floor(maxIndex * (maxFilterValue / 100));
    return [0, maxValue] as [number, number];
  }, [paths.length, maxFilterValue]);

  const INITIAL_VIEW_STATE = { latitude: 0, longitude: 0.4, zoom: 9 };

  // UI Components
  const Controls: React.FC<{
    resolution: number,
    onResolutionChange: (res: number) => void,
    layerVisibility: {triangles: boolean, path: boolean, points: boolean, labels: boolean, anchors: boolean, children: boolean, centerLines: boolean},
    setLayerVisibility: (vis: {triangles: boolean, path: boolean, points: boolean, labels: boolean, anchors: boolean, children: boolean, centerLines: boolean}) => void,
    orientation: Orientation,
    setOrientation: (o: Orientation) => void,
    colorByParent: boolean,
    setColorByParent: (colorByParent: boolean) => void,
    showTripleCoords: boolean,
    setShowTripleCoords: (show: boolean) => void,
    gridDiskK: number,
    setGridDiskK: (k: number) => void
  }> = ({
    resolution,
    onResolutionChange,
    layerVisibility,
    setLayerVisibility,
    orientation,
    setOrientation,
    colorByParent,
    setColorByParent,
    showTripleCoords,
    setShowTripleCoords,
    gridDiskK,
    setGridDiskK
  }) => {
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
            Orientation: {' '}
            <select 
              value={orientation}
              onChange={e => setOrientation(e.target.value as Orientation)}
              style={{marginLeft: '5px'}}
            >
              <option value="uv">uv</option>
              <option value="vu">vu</option>
              <option value="uw">uw</option>
              <option value="wu">wu</option>
              <option value="vw">vw</option>
              <option value="wv">wv</option>
            </select>
          </label>
        </div>
        
        <div style={{marginBottom: '10px'}}>
          <label>
            <input
              type="checkbox"
              checked={colorByParent}
              onChange={e => setColorByParent(e.target.checked)}
            /> Color by Parent
          </label>
        </div>

        <div style={{marginBottom: '10px'}}>
          <label>
            <input
              type="checkbox"
              checked={showTripleCoords}
              onChange={e => setShowTripleCoords(e.target.checked)}
            /> Triple Coordinates
          </label>
        </div>

        <div style={{marginBottom: '10px'}}>
          <label>
            gridDisk: {gridDiskK}
            <input
              type="range"
              min="0"
              max="4"
              value={gridDiskK}
              onChange={e => setGridDiskK(Number(e.target.value))}
              style={{marginLeft: '10px'}}
            />
          </label>
        </div>

        <div style={{marginBottom: '10px', borderTop: '1px solid #ccc', paddingTop: '10px'}}>
          <label>
            Resolution: {resolution}
            <input 
              type="range" 
              min="1" 
              max="8" 
              value={resolution} 
              onChange={e => onResolutionChange(Number(e.target.value))}
              style={{marginLeft: '10px'}}
            />
          </label>
        </div>

        <div style={{
          display: 'flex', 
          flexDirection: 'column', 
          gap: '5px',
          borderTop: '1px solid #ccc',
          paddingTop: '10px'
        }}>
          <label>
            <input
              type="checkbox"
              checked={layerVisibility.triangles}
              onChange={e => setLayerVisibility({...layerVisibility, triangles: e.target.checked})}
            /> Show Cells
          </label>
          <label>
            <input
              type="checkbox"
              checked={layerVisibility.path}
              onChange={e => setLayerVisibility({...layerVisibility, path: e.target.checked})}
            /> Show Path
          </label>
          <label>
            <input
              type="checkbox"
              checked={layerVisibility.points}
              onChange={e => setLayerVisibility({...layerVisibility, points: e.target.checked})}
            /> Show Points
          </label>
          <label>
            <input
              type="checkbox"
              checked={layerVisibility.labels}
              onChange={e => setLayerVisibility({...layerVisibility, labels: e.target.checked})}
            /> Show Labels
          </label>
          <label>
            <input
              type="checkbox"
              checked={layerVisibility.anchors}
              onChange={e => setLayerVisibility({...layerVisibility, anchors: e.target.checked})}
            /> Show Anchors
          </label>
          <label>
            <input
              type="checkbox"
              checked={layerVisibility.children}
              onChange={e => setLayerVisibility({...layerVisibility, children: e.target.checked})}
            /> Show Children
          </label>
          <label>
            <input
              type="checkbox"
              checked={layerVisibility.centerLines}
              onChange={e => setLayerVisibility({...layerVisibility, centerLines: e.target.checked})}
            /> Show Center Lines
          </label>
        </div>
      </div>
    );
  };

  // New component for the filter slider
  const FilterSlider: React.FC<{
    value: number,
    onChange: (value: number) => void
  }> = ({ value, onChange }) => {
    return (
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'white',
        padding: '10px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        zIndex: 1,
        width: '300px',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '5px' }}>
          Show {value}% of Path
        </div>
        <input 
          type="range" 
          min="1" 
          max="100" 
          value={value} 
          onChange={e => onChange(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>
    );
  };

  const createLayers = (
    filterRange: [number, number],
    pathsLength: number,
    cells: Cell[],
    paths: any[],
    softBuffer: number,
    showTripleCoords: boolean,
    highlightedCells: Set<number>
  ) => {
    // Common filter props shared between layers
    const filterProps = {
      extensions: [new DataFilterExtension({filterSize: 1})],
      getFilterValue: (d: any) => d.index,
      filterSoftRange: filterRange,
      filterRange: filterRange.map((x, i) => i === 0 ? x - softBuffer : x + softBuffer)
    };

    const lineProps = { lineWidthMinPixels: 1, stroked: true };

    const getSegmentColor = colorContinuous({
      attr: (p: any) => p.index,
      colors: 'Geyser',
      domain: Array.from({length: 10}).map((_, i) => i * pathsLength / 10),
    });
    const getParentColor = (d: Cell) => {
      if ((d as any).crossCheckFailed) {
        return [255, 0, 0, 255];
      }

      // gridDisk highlighting
      if (highlightedCells.size > 0) {
        if (highlightedCells.has(d.index)) {
          return [255, 200, 0, 220]; // Yellow highlight
        }
        return colorByParent ? getBaseColor(d, 80) : [100, 100, 100, 0];
      }

      if (!colorByParent) {
        return [100, 100, 100, 0];
      }

      return getBaseColor(d, 200);
    }
    function getBaseColor(d: Cell, alpha: number) {
      const parent = Math.floor(d.index / 4) + 5;
      const r = Math.sin(2748127411 * parent) * 127 + 128;
      const g = Math.sin(748119248 * parent) * 127 + 128;
      const b = Math.sin(33712841 * parent) * 127 + 128;
      return [r, g, b, alpha];
    }
    return [
      new PolygonLayer<Cell>({
        id: 'triangles',
        data: cells,
        getPolygon: d => d.vertices,
        getFillColor: getParentColor,
        updateTriggers: { getFillColor: [colorByParent, highlightedCells] },
        getLineColor: [255, 255, 255, 255],
        filled: true,
        visible: layerVisibility.triangles,
        ...lineProps,
        ...filterProps,
        pickable: true,
        onHover: info => {
          if (info.object) {
            setHoveredCellIndex(info.object.index);
          } else {
            setHoveredCellIndex(null);
          }
        }
      }),

      new PathLayer({
        id: 'path',
        data: paths,
        getPath: d => d.path,
        getColor: getSegmentColor,
        getWidth: 4,
        widthUnits: 'pixels',
        capRounded: true,
        visible: layerVisibility.path,
        ...filterProps
      }),

      new TextLayer<Cell>({
        id: 'labels',
        data: cells,
        getPosition: d => d.center,
        getText: d => {
          if (showTripleCoords) {
            const {x, y, z} = d.tripleCoords;
            return `${x},${y},${z}`;
          }
          const [i, j] = d.anchor.offset;
          return `[${i},${j}]`;
        },
        getSize: 12,
        getColor: [255, 255, 255, 255],
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
        visible: layerVisibility.labels,
        updateTriggers: { getText: [showTripleCoords] },
        ...filterProps
      }),

      new ScatterplotLayer<Cell>({
        id: 'points',
        data: cells,
        getPosition: d => d.center,
        getFillColor: getSegmentColor,
        getRadius: 8,
        radiusUnits: 'pixels',
        getLineColor: [255, 255, 255],
        visible: layerVisibility.points,
        ...lineProps,
        ...filterProps
      }),

      new ScatterplotLayer<Cell>({
        id: 'anchors',
        data: cells,
        getPosition: d => d.origin,
        getFillColor: [0, 0, 0],
        getLineColor: [255, 255, 255],
        getRadius: d => [1, 6, 9, 14, 18, 21, 26, 29].includes(d.index % 32) ? 10 : 5,
        radiusUnits: 'pixels',
        stroked: true,
        lineWidthMinPixels: 1,
        visible: layerVisibility.anchors,
        ...filterProps
      }),

      new PolygonLayer<Cell>({
        id: 'children',
        data: children,
        getPolygon: d => d.vertices,
        getLineColor: [255, 255, 255, 100],
        filled: false,
        stroked: true,
        lineWidthMinPixels: 2,
        visible: layerVisibility.children,
        extensions: [new DataFilterExtension({filterSize: 1})],
        getFilterValue: (d: any) => Math.floor(d.index / 4),
        filterRange: hoveredCellIndex !== null ? 
          [hoveredCellIndex - 0.5, hoveredCellIndex + 0.5] : 
          [0, 0]
      }),

      // New layer for center-to-anchor lines
      new PathLayer({
        id: 'center-lines',
        data: cells,
        getPath: d => [[...d.origin], d.center],
        getColor: [0, 244, 50, 100],
        getWidth: 1,
        widthUnits: 'pixels',
        visible: layerVisibility.centerLines,
      })
    ];
  };

  return (
    <>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={createLayers(
          filterRange,
          paths.length,
          cells,
          paths,
          softBuffer,
          showTripleCoords,
          highlightedCells
        )}
      />
      <Controls
        resolution={resolution}
        onResolutionChange={handleResolutionChange}
        layerVisibility={layerVisibility}
        setLayerVisibility={setLayerVisibility}
        orientation={orientation}
        setOrientation={setOrientation}
        colorByParent={colorByParent}
        setColorByParent={setColorByParent}
        showTripleCoords={showTripleCoords}
        setShowTripleCoords={setShowTripleCoords}
        gridDiskK={gridDiskK}
        setGridDiskK={setGridDiskK}
      />
      <FilterSlider 
        value={maxFilterValue}
        onChange={setMaxFilterValue}
      />
    </>
  );
};

export default App;

export async function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  console.log('renderToDOM');
  root.render(<App />);
}