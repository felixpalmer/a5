import React, { useState, useEffect, useRef } from 'react';
import {createRoot} from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Map, useControl, useMap} from 'react-map-gl/maplibre';
import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import {H3HexagonLayer} from '@deck.gl/geo-layers';
import {PolygonLayer} from '@deck.gl/layers';
import {cellArea, getRes0Cells, cellToChildren, cellToVertexes, vertexToLatLng, greatCircleDistance, cellToBoundary, cellToLatLng, isPentagon} from 'h3-js';
import {generateWireframe} from 'a5-internal/wireframe';
import {toCartesian, fromLonLat} from 'a5/core/coordinate-transforms';
import {colorContinuous} from '@deck.gl/carto';

import {pentagonArea} from 'a5/core/utils';

const H3_RESOLUTION = 1; // 1
const A5_RESOLUTION = 4; // 4

// 'Bold' color scheme
const COLORS = ['#7F3C8D', '#11A579', '#3969AC', '#F2B701', '#E73F74', '#80BA5A', '#E68310', '#008695', '#CF1C90', '#f97b72', '#4b4b8f', '#A5AA99'];

// Add Controls component
const Controls: React.FC<{
  areaLimits: [number, number];
  perimeterLimits: [number, number];
  tilingSystem: 'h3' | 'a5';
  onTilingSystemChange: (system: 'h3' | 'a5') => void;
}> = ({areaLimits, perimeterLimits, tilingSystem, onTilingSystemChange}) => {
  const [minArea, maxArea] = areaLimits;
  const [minPerimeter, maxPerimeter] = perimeterLimits;
  const areaRatio = maxArea / minArea;
  const perimeterRatio = maxPerimeter / minPerimeter;

  return (
    <div style={{
      position: 'absolute',
      top: '50px',
      left: '60px',
      background: 'white',
      padding: '12px',
      borderRadius: '4px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      zIndex: 1,
      fontSize: '12px',
      lineHeight: '1.5'
    }}>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ marginRight: '8px' }}>Tiling System:</label>
        <select 
          value={tilingSystem} 
          onChange={(e) => onTilingSystemChange(e.target.value as 'h3' | 'a5')}
          style={{ padding: '4px' }}
        >
          <option value="h3">H3 (Hexagons)</option>
          <option value="a5">A5 (Pentagons)</option>
        </select>
      </div>
      
      <h3 style={{margin: '0 0 8px', fontSize: '14px'}}>Area Statistics</h3>
      <div>Min Area: {minArea.toFixed(2)} km²</div>
      <div>Max Area: {maxArea.toFixed(2)} km²</div>
      <div>Area Ratio: {areaRatio.toFixed(4)}</div>
      
      <h3 style={{margin: '12px 0 8px', fontSize: '14px'}}>Area Statistics</h3>
      <div>Min Perimeter: {minPerimeter.toFixed(2)} km</div>
      <div>Max Perimeter: {maxPerimeter.toFixed(2)} km</div>
      <div>Perimeter Ratio: {perimeterRatio.toFixed(4)}</div>
    </div>
  );
};

// SVG visualization of cells
const CellVisualization: React.FC<{
  tilingSystem: 'h3' | 'a5';
  h3Output: any[];
  a5Output: any[];
  onCellHover: (cell: any, isHovering: boolean) => void;
}> = ({ tilingSystem, h3Output, a5Output, onCellHover }) => {
  // Find smallest and largest cells
  const getExtremeH3Cells = () => {
    // Filter out pentagon cells for a fair comparison
    const hexagonsOnly = h3Output.filter(cell => !isPentagon(cell.cell));
    const sortedByArea = hexagonsOnly.sort((a, b) => a.properties.area - b.properties.area);
    const smallest = sortedByArea[0];
    const largest = sortedByArea[sortedByArea.length - 1];
    return { smallest, largest };
  };

  const getExtremeA5Cells = () => {
    const sortedByArea = [...a5Output].sort((a, b) => a.properties.area - b.properties.area);
    const smallest = sortedByArea[0];
    const largest = sortedByArea[sortedByArea.length - 1];
    return { smallest, largest };
  };

  // Calculate angles between edges in degrees
  const calculateAngles = (projectedPoints) => {
    const angles = [];
    const n = projectedPoints.length;
    
    for (let i = 0; i < n; i++) {
      const prev = projectedPoints[(i - 1 + n) % n];
      const curr = projectedPoints[i];
      const next = projectedPoints[(i + 1) % n];
      
      // Calculate vectors
      const v1 = [prev[0] - curr[0], prev[1] - curr[1]];
      const v2 = [next[0] - curr[0], next[1] - curr[1]];
      
      // Calculate dot product
      const dotProduct = v1[0] * v2[0] + v1[1] * v2[1];
      
      // Calculate magnitudes
      const mag1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1]);
      const mag2 = Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1]);
      
      // Calculate angle in radians and convert to degrees
      const cosAngle = dotProduct / (mag1 * mag2);
      // Clamp cosAngle to [-1, 1] to avoid numerical issues
      const clampedCosAngle = Math.max(-1, Math.min(1, cosAngle));
      const angleRad = Math.acos(clampedCosAngle);
      const angleDeg = (angleRad * 180) / Math.PI;
      
      angles.push(angleDeg);
    }
    
    return angles;
  };

  // Generate projected points for a cell using gnomonic projection
  const projectH3Cell = (cell) => {
    const boundary = cellToBoundary(cell.cell);
    const center = cellToLatLng(cell.cell);
    
    // Convert center to radians
    const centerLat = center[0] * Math.PI / 180;
    const centerLon = center[1] * Math.PI / 180;
    
    // Gnomonic projection
    return boundary.map(point => {
      const lat = point[0] * Math.PI / 180;
      const lon = point[1] * Math.PI / 180;
      
      // Calculate the cosine of the angular distance from center
      const cosc = Math.sin(centerLat) * Math.sin(lat) + 
                   Math.cos(centerLat) * Math.cos(lat) * Math.cos(lon - centerLon);
      
      // Project to plane
      const x = Math.cos(lat) * Math.sin(lon - centerLon) / cosc;
      const y = (Math.cos(centerLat) * Math.sin(lat) - 
                Math.sin(centerLat) * Math.cos(lat) * Math.cos(lon - centerLon)) / cosc;
      
      return [x, y];
    });
  };

  const projectA5Cell = (cell) => {
    const {vertices} = cell;
    
    // Calculate center of cell using spherical coordinates
    const center = vertices.reduce(([sumX, sumY, sumZ], [lon, lat]) => {
      const latRad = lat * Math.PI / 180;
      const lonRad = lon * Math.PI / 180;
      const x = Math.cos(latRad) * Math.cos(lonRad);
      const y = Math.cos(latRad) * Math.sin(lonRad);
      const z = Math.sin(latRad);
      return [sumX + x, sumY + y, sumZ + z];
    }, [0, 0, 0]);
    
    // Normalize the center vector
    const magnitude = Math.sqrt(center[0] * center[0] + center[1] * center[1] + center[2] * center[2]);
    const normalizedCenter = center.map(c => c / magnitude);
    
    // Convert back to lat/lon
    const centerLat = Math.asin(normalizedCenter[2]) * 180 / Math.PI;
    const centerLon = Math.atan2(normalizedCenter[1], normalizedCenter[0]) * 180 / Math.PI;
    
    // Convert center to radians
    const centerLatRad = centerLat * Math.PI / 180;
    const centerLonRad = centerLon * Math.PI / 180;
    
    // Gnomonic projection
    return vertices.map(point => {
      const lat = point[1] * Math.PI / 180;
      const lon = point[0] * Math.PI / 180;
      
      // Calculate the cosine of the angular distance from center
      const cosc = Math.sin(centerLatRad) * Math.sin(lat) + 
                   Math.cos(centerLatRad) * Math.cos(lat) * Math.cos(lon - centerLonRad);
      
      // Project to plane
      const x = Math.cos(lat) * Math.sin(lon - centerLonRad) / cosc;
      const y = (Math.cos(centerLatRad) * Math.sin(lat) - 
                Math.sin(centerLatRad) * Math.cos(lat) * Math.cos(lon - centerLonRad)) / cosc;
      
      return [x, y];
    });
  };

  // Generate SVG path from projected points with proper scaling and rotation
  const generateSVGPath = (projectedPoints, scale) => {
    // Calculate the angle of the first vertex
    const firstPoint = projectedPoints[0];
    const angle = Math.atan2(firstPoint[1], firstPoint[0]);
    
    // Rotate all points so the first vertex is at the bottom (270 degrees)
    const targetAngle = -Math.PI / 2; // -90 degrees or 270 degrees
    const rotationAngle = targetAngle - angle;
    
    // Rotate and scale the points
    const transformedPoints = projectedPoints.map(point => {
      // Rotate point
      const x = point[0] * Math.cos(rotationAngle) - point[1] * Math.sin(rotationAngle);
      const y = point[0] * Math.sin(rotationAngle) + point[1] * Math.cos(rotationAngle);
      
      // Scale point
      return [x * scale, y * scale];
    });
    
    // Create SVG path centered in the 100x100 viewBox
    let path = `M`;
    transformedPoints.forEach((point, i) => {
      const x = 50 + point[0];
      const y = 50 - point[1]; // Flip y-axis for SVG
      path += `${i === 0 ? '' : ' L'}${x},${y}`;
    });
    path += 'Z';
    
    return { path, transformedPoints };
  };

  const { smallest: smallestH3, largest: largestH3 } = getExtremeH3Cells();
  const { smallest: smallestA5, largest: largestA5 } = getExtremeA5Cells();

  const currentSmallest = tilingSystem === 'h3' ? smallestH3 : smallestA5;
  const currentLargest = tilingSystem === 'h3' ? largestH3 : largestA5;
  
  // Project both cells
  const smallestProjected = tilingSystem === 'h3' 
    ? projectH3Cell(currentSmallest) 
    : projectA5Cell(currentSmallest);
    
  const largestProjected = tilingSystem === 'h3' 
    ? projectH3Cell(currentLargest) 
    : projectA5Cell(currentLargest);
  
  // Find the maximum radius of the largest cell to fit in the SVG
  const largestRadius = Math.max(...largestProjected.map(p => Math.sqrt(p[0]*p[0] + p[1]*p[1])));
  const scale = 45 / largestRadius; // Scale to fit in 90% of the SVG
  
  // Generate SVG paths and get transformed points
  const { path: smallestPath, transformedPoints: smallestTransformed } = 
    generateSVGPath(smallestProjected, scale);
  const { path: largestPath, transformedPoints: largestTransformed } = 
    generateSVGPath(largestProjected, scale);
  
  // Calculate angles
  const smallestAngles = calculateAngles(smallestTransformed);
  const largestAngles = calculateAngles(largestTransformed);

  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      right: '20px',
      background: 'white',
      padding: '12px',
      borderRadius: '4px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: '300px'
    }}>
      <h3 style={{margin: '0 0 8px', fontSize: '14px', textAlign: 'center'}}>Cell Comparison</h3>
      
      <div style={{display: 'flex', gap: '10px', alignItems: 'flex-start'}}>
        <div>
          <p style={{margin: '0 0 5px', fontSize: '12px', textAlign: 'left'}}>Smallest Cell</p>
          <svg 
            width="100" 
            height="100" 
            viewBox="0 0 100 100" 
            style={{border: '1px solid #ccc', cursor: 'pointer'}}
            onMouseEnter={() => onCellHover(currentSmallest, true)}
            onMouseLeave={() => onCellHover(currentSmallest, false)}
          >
            <path d={smallestPath} fill="#6baed6" stroke="#000" strokeWidth="1" />
          </svg>
          <p style={{margin: '5px 0 0', fontSize: '10px', textAlign: 'left'}}>
            {currentSmallest.properties.area.toFixed(2)} km²
          </p>
          <div style={{marginTop: '5px', fontSize: '10px'}}>
            <p style={{margin: '0 0 2px', fontWeight: 'bold'}}>Angles (degrees):</p>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: '2px 6px'}}>
              {smallestAngles.map((angle, i) => (
                <span key={i}>{angle.toFixed(2)}°</span>
              ))}
            </div>
          </div>
        </div>
        
        <div>
          <p style={{margin: '0 0 5px', fontSize: '12px', textAlign: 'left'}}>Largest Cell</p>
          <svg 
            width="100" 
            height="100" 
            viewBox="0 0 100 100" 
            style={{border: '1px solid #ccc', cursor: 'pointer'}}
            onMouseEnter={() => onCellHover(currentLargest, true)}
            onMouseLeave={() => onCellHover(currentLargest, false)}
          >
            <path d={largestPath} fill="#fd8d3c" stroke="#000" strokeWidth="1" />
          </svg>
          <p style={{margin: '5px 0 0', fontSize: '10px', textAlign: 'left'}}>
            {currentLargest.properties.area.toFixed(2)} km²
          </p>
          <div style={{marginTop: '5px', fontSize: '10px'}}>
            <p style={{margin: '0 0 2px', fontWeight: 'bold'}}>Angles (degrees):</p>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: '2px 6px'}}>
              {largestAngles.map((angle, i) => (
                <span key={i}>{angle.toFixed(2)}°</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const calculatePerimeter = (cell: string): number => {
  const vertexIndexes = cellToVertexes(cell);
  const vertices = vertexIndexes.map(vertex => vertexToLatLng(vertex));
  
  let perimeter = 0;
  for (let i = 0; i < vertices.length; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % vertices.length];
    perimeter += greatCircleDistance(v1, v2, 'km');
  }
  
  return perimeter;
}

const calculateA5Perimeter = (vertices: [number, number][]): number => {
  let perimeter = 0;
  for (let i = 0; i < vertices.length; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % vertices.length];
    // Convert to [lat, lng] format for greatCircleDistance
    perimeter += greatCircleDistance([v1[1], v1[0]], [v2[1], v2[0]], 'km');
  }
  return perimeter;
}

// Prepare H3 data
const h3Data = getRes0Cells().map(cell => cellToChildren(cell, H3_RESOLUTION)).flat();
let h3AreaLimits: [number, number] = [0, 0];
let h3PerimeterLimits: [number, number] = [0, 0];
const h3Output = h3Data.map(cell => {
  const area = cellArea(cell, 'km2');
  const perimeter = calculatePerimeter(cell);
  const scale = Math.sqrt(1 / area);
  const perimeterRatio = scale * perimeter;
  return { cell, properties: { area, perimeter, perimeterRatio } };
});

const h3Areas = h3Output.map(cell => cell.properties.area);
const h3Perimeters = h3Output.map(cell => cell.properties.perimeter);

h3AreaLimits = [Math.min(...h3Areas), Math.max(...h3Areas)];
h3PerimeterLimits = [Math.min(...h3Perimeters), Math.max(...h3Perimeters)];

// Prepare A5 data
const a5Data = generateWireframe(A5_RESOLUTION); //.slice(0, Math.pow(4, a5Res));
let a5AreaLimits: [number, number] = [Infinity, -Infinity];
let a5PerimeterLimits: [number, number] = [Infinity, -Infinity];

// Earth's surface area in km²
const EARTH_SURFACE_AREA = 510072000;

const a5Output = a5Data.map((vertices: [number, number][]) => {
  const xyz = vertices.map(lonLat => toCartesian(fromLonLat(lonLat)));
  
  // Calculate the area on unit sphere
  const unitArea = pentagonArea(xyz);
  
  // Convert to actual area on Earth's surface
  const area = unitArea * EARTH_SURFACE_AREA / (4 * Math.PI);
  
  const perimeter = calculateA5Perimeter(vertices);
  const scale = Math.sqrt(1 / area);
  const perimeterRatio = scale * perimeter;
  
  a5AreaLimits[0] = Math.min(a5AreaLimits[0], area);
  a5AreaLimits[1] = Math.max(a5AreaLimits[1], area);
  a5PerimeterLimits[0] = Math.min(a5PerimeterLimits[0], perimeter);
  a5PerimeterLimits[1] = Math.max(a5PerimeterLimits[1], perimeter);
  
  return {vertices, properties: { area, perimeter, perimeterRatio }};
});

const Legend: React.FC<{
  areaLimits: [number, number];
  h3AreaLimits: [number, number];
}> = ({ areaLimits, h3AreaLimits }) => {
  const [minArea, maxArea] = areaLimits;
  const [minH3Area, maxH3Area] = h3AreaLimits;
  
  // Calculate the position of the visible portion
  const visibleStart = ((minArea - minH3Area) / (maxH3Area - minH3Area)) * 100;
  const visibleEnd = ((maxArea - minH3Area) / (maxH3Area - minH3Area)) * 100;

  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '20px',
      top: '20px',
      background: 'white',
      padding: '8px',
      borderRadius: '4px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      zIndex: 1,
      fontFamily: 'sans-serif',
      fontSize: '12px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <div style={{
        width: '16px',
        flex: 1,
        position: 'relative',
        borderRadius: '4px',
        overflow: 'visible'
      }}>
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          background: `linear-gradient(to bottom, ${COLORS.join(',')})`,
        }} />
        <div style={{
          position: 'absolute',
          top: 0,
          height: `${visibleStart}%`,
          left: 0,
          right: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          transition: 'height 1s ease-in-out'
        }} />
        <div style={{
          position: 'absolute',
          bottom: 0,
          height: `${100 - visibleEnd}%`,
          left: 0,
          right: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          transition: 'height 1s ease-in-out'
        }} />
        <div style={{
          position: 'absolute',
          top: `${visibleStart}%`,
          height: `${visibleEnd - visibleStart}%`,
          left: '-4px',
          right: '-4px',
          border: '1px solid #000',
          pointerEvents: 'none',
          transition: 'top 1s ease-in-out, height 1s ease-in-out'
        }} />
      </div>
      <div style={{
        position: 'absolute',
        left: '32px',
        top: '0',
        bottom: '0',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '0',
        margin: '10px 0'
      }}>
        <div style={{
          position: 'absolute',
          top: `${visibleStart}%`,
          background: 'white',
          padding: '2px 4px',
          borderRadius: '2px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          whiteSpace: 'nowrap',
          transition: 'top 1s ease-in-out',
          transform: 'translateY(-50%)',
          marginLeft: '4px'
        }}>
          <div style={{
            position: 'absolute',
            left: '-6px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: 0,
            height: 0,
            borderTop: '4px solid transparent',
            borderBottom: '4px solid transparent',
            borderRight: '6px solid white'
          }} />
          {Math.round(minArea)} km²
        </div>
        <div style={{
          position: 'absolute',
          top: `${visibleEnd}%`,
          background: 'white',
          padding: '2px 4px',
          borderRadius: '2px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          whiteSpace: 'nowrap',
          transition: 'top 1s ease-in-out',
          transform: 'translateY(-50%)',
          marginLeft: '4px'
        }}>
          <div style={{
            position: 'absolute',
            left: '-6px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: 0,
            height: 0,
            borderTop: '4px solid transparent',
            borderBottom: '4px solid transparent',
            borderRight: '6px solid white'
          }} />
          {Math.round(maxArea)} km²
        </div>
      </div>
    </div>
  );
};

const App: React.FC<{ isMobile?: boolean }> = ({ isMobile = false }) => {
  // Initial view state
  const INITIAL_VIEW_STATE = {
    longitude: 0,
    latitude: 0,
    zoom: 2,
    pitch: 0,
    bearing: 0
  };

  const [tilingSystem, setTilingSystem] = useState<'a5' | 'h3'>('h3');
  const [areaLimits, setAreaLimits] = useState<[number, number]>(h3AreaLimits);
  const [perimeterLimits, setPerimeterLimits] = useState<[number, number]>(h3PerimeterLimits);
  const [hoveredCell, setHoveredCell] = useState<any>(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (tilingSystem === 'h3') {
      setAreaLimits(h3AreaLimits);
      setPerimeterLimits(h3PerimeterLimits);
    } else {
      setAreaLimits(a5AreaLimits);
      setPerimeterLimits(a5PerimeterLimits);
    }
  }, [tilingSystem]);

  // Handle cell hover
  const handleCellHover = (cell: any, isHovering: boolean) => {
    if (isHovering) {
      setHoveredCell(cell);
      
      // Get the center of the cell for the map to fly to
      let center;
      if (tilingSystem === 'h3') {
        center = cellToLatLng(cell.cell);
        // H3 returns [lat, lng], but we need [lng, lat] for the map
        center = [center[1], center[0]];
      } else {
        // For A5, calculate the center by averaging the vertices
        const vertices = cell.vertices;
        const sumLng = vertices.reduce((sum, point) => sum + point[0], 0);
        const sumLat = vertices.reduce((sum, point) => sum + point[1], 0);
        center = [sumLng / vertices.length, sumLat / vertices.length];
      }
      
      // Fly to the cell
      if (mapRef.current) {
        mapRef.current.flyTo({
          center,
          duration: 1000,
          essential: true
        });
      }
    } else {
      setHoveredCell(null);
    }
  };

  const N = 11;
  const domain = Array.from({length: N}, (_, i) => h3AreaLimits[0] + i * (h3AreaLimits[1] - h3AreaLimits[0]) / (N - 1));
  const getFillColor = (d: any, info: any) => colorContinuous({ 
    attr: d => d.properties!.area,
    domain,
    colors: 'Bold'
  })(d, info);
  const props: any = {
    filled: true,
    stroked: true,
    extruded: false,
    getFillColor,
    updateTriggers: { getFillColor: h3AreaLimits },
    opacity: 0.8,
    getLineColor: [255, 255, 255, 30],
    lineWidthMinPixels: 2,
    pickable: true,
    beforeId: 'watername_ocean',
    parameters: { cullMode: 'back', depthCompare: 'always' }
  }

  // Create base layeyr based on selected tiling system
  const baseLayer = tilingSystem === 'h3' 
    ? new H3HexagonLayer({
        id: 'h3-hexagons',
        data: h3Output,
        getHexagon: d => d.cell,
        ...props,
      })
    : new PolygonLayer({
        id: 'a5-pentagons',
        data: a5Output,
        getPolygon: d => d.vertices,
        ...props,
      });

  // Create highlight layer if a cell is hovered
  let highlightLayer = null;
  if (hoveredCell) {
    if (tilingSystem === 'h3') {
      highlightLayer = new H3HexagonLayer({
        id: 'highlight-h3-hexagon',
        data: [hoveredCell],
        filled: true,
        stroked: true,
        extruded: false,
        getHexagon: d => d.cell,
        getFillColor: [255, 255, 0, 150],
        getLineColor: [255, 255, 0, 255],
        lineWidthMinPixels: 4,
        pickable: false,
        beforeId: 'watername_ocean',
        parameters: { cullMode: 'back', depthCompare: 'always' }
      });
    } else {
      highlightLayer = new PolygonLayer({
        id: 'highlight-a5-pentagon',
        data: [hoveredCell],
        getPolygon: d => d.vertices,
        getFillColor: [255, 255, 0, 150],
        getLineColor: [255, 255, 0, 255],
        lineWidthMinPixels: 4,
        filled: true,
        stroked: true,
        pickable: false,
        beforeId: 'watername_ocean',
        parameters: { cullMode: 'back', depthCompare: 'always' }
      });
    }
  }

  // Combine layers
  const layers = highlightLayer ? [baseLayer, highlightLayer] : [baseLayer];

  const handleTilingSystemChange = (system: 'h3' | 'a5') => {
    setTilingSystem(system);
    setHoveredCell(null); // Clear any highlighted cell when switching systems
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
        ref={mapRef}
        projection="globe"
        id="map"
        initialViewState={INITIAL_VIEW_STATE}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        dragRotate={false}
        maxPitch={0}
      >
        <DeckGLOverlay 
          layers={layers}
          interleaved
        />
      </Map>
      <Controls 
        areaLimits={areaLimits}
        perimeterLimits={perimeterLimits}
        tilingSystem={tilingSystem}
        onTilingSystemChange={handleTilingSystemChange}
      />
      {!isMobile && (
        <CellVisualization 
          tilingSystem={tilingSystem}
          h3Output={h3Output}
          a5Output={a5Output}
          onCellHover={handleCellHover}
        />
      )}
      <Legend 
        areaLimits={areaLimits}
        h3AreaLimits={h3AreaLimits}
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
  const {current: map} = useMap();

  useEffect(() => {
    if (map) {
      map.flyTo({center: [-90, 20], curve: 0.1, speed: 0.002});
    }
  }, [map]);

  overlay.setProps(props);
  return null;
}