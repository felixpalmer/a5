import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import DeckGL from '@deck.gl/react';
import {PathLayer, PolygonLayer, ScatterplotLayer, TextLayer} from '@deck.gl/layers';
import {TRANSITION_EVENTS} from '@deck.gl/core';
import {mat2d, vec2} from 'gl-matrix';

import {PENTAGON} from 'a5/core/pentagon';

const vertices = PENTAGON.getVertices();
const center = PENTAGON.getCenter();

const rotateVertex = (vertex: vec2, angle: number) => {
  const M_rotate = mat2d.fromRotation(mat2d.create(), angle);
  const M_translate = mat2d.fromTranslation(mat2d.create(), vertex);
  const M_translateBack = mat2d.invert(mat2d.create(), M_translate);
  const M = mat2d.multiply(mat2d.create(), M_translate, M_rotate);
  mat2d.multiply(M, M, M_translateBack);
  return M;
};

// Create 5 triangles from the pentagon vertices
const triangles = vertices.map((vertex, i) => {
  const nextVertex = vertices[(i + 1) % vertices.length];
  return [center, vertex, nextVertex];
});
const trianglesExploded = JSON.parse(JSON.stringify(triangles));

const angle = Math.PI / 4;
const M = rotateVertex(vertices[1], angle);
trianglesExploded[1] = trianglesExploded[1].map(v => [...vec2.transformMat2d(vec2.create(), v, M)]);
trianglesExploded[2] = trianglesExploded[2].map(v => [...vec2.transformMat2d(vec2.create(), v, M)]);

const M2 = rotateVertex(vertices[4], -angle);
trianglesExploded[3] = trianglesExploded[3].map(v => [...vec2.transformMat2d(vec2.create(), v, M2)]);

const INITIAL_VIEW_STATE = {latitude: center[1], longitude: center[0], zoom: 9};
let firstRender = true;

const A5GREEN = [0, 170, 85] as [number, number, number];
const A5GREEN_LIGHT = [0, 194, 97] as [number, number, number];
const A5GREEN_DARK = [0, 128, 64] as [number, number, number];

const getAngle = (v1: number[], v2: number[]): number => {
  return Math.atan2(v2[1] - v1[1], v2[0] - v1[0]);
};

// Create arc path points
const createArcPath = (center: number[], v1: number[], v2: number[], radius: number = 0.3) => {
  const startAngle = getAngle(center, v1);
  let endAngle = getAngle(center, v2);

  // Take correct angle
  if (endAngle < startAngle) {
    endAngle += 2 * Math.PI;
  }

  // Generate points along the arc
  const numPoints = 32;
  const points: number[][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const angle = startAngle * t + endAngle * (1 - t);
    const delta = vec2.fromValues(radius * Math.cos(angle), radius * Math.sin(angle));
    points.push([...vec2.scaleAndAdd(vec2.create(), center as vec2, delta, radius)]);
  }
  return points;
};

// Create arc data for each vertex
const createArcData = (triangles: number[][][]) => {
  const out: number[][][] = [];
  for (let t = 0; t < triangles.length; t++) {
    const [_a, center, v1] = triangles[t];
    const [_b, _c, v2] = triangles[(t + 1) % triangles.length];
    out.push(createArcPath(v1, center, v2));
  }
  return out;
};

const App: React.FC = () => {
  const [isExploded, setIsExploded] = useState(true);
  const [hoverInfo, setHoverInfo] = useState<{index: number} | null>(null);

  const transitionConfig = {
    type: 'spring',
    stiffness: 0.02,
    damping: 0.2,
    transitionInterruption: TRANSITION_EVENTS.IGNORE
  };
  firstRender = false;

  const data = isExploded ? trianglesExploded : triangles;
  const arcData = createArcData(data);

  const layers = [
    // Triangle fill layer
    new PolygonLayer({
      id: 'pentagon-triangles',
      data,
      getPolygon: d => d,
      getFillColor: hoverInfo ? A5GREEN_LIGHT : A5GREEN,
      stroked: false,
      filled: true,
      pickable: true,
      onClick: () => setIsExploded(!isExploded),
      onHover: info => setHoverInfo(info.index === -1 ? null : info),
      transitions: {
        getFillColor: {duration: 100},
        getPolygon: transitionConfig
      }
    }),
    // Pentagon outline layer
    new PathLayer({
      id: 'pentagon-outline',
      data,
      getPath: d => [d[1], d[2]],
      getColor: [255, 255, 255],
      widthMinPixels: 4,
      transitions: {
        getPath: transitionConfig
      }
    }),
    // Vertex points layer
    new ScatterplotLayer({
      id: 'pentagon-vertices',
      data: data.flatMap(triangle => [triangle[1], triangle[2]]),
      getPosition: d => d,
      getFillColor: A5GREEN_DARK,
      getLineColor: [255, 255, 255],
      radiusMinPixels: 10,
      stroked: true,
      lineWidthMinPixels: 2,
      pickable: false,
      transitions: {
        getPosition: transitionConfig
      }
    }),
    // Circles traces layer
    new ScatterplotLayer({
      id: 'trace-circles',
      data: [data[1], data[4]].flatMap(triangle => [triangle[1]]),
      getPosition: d => d,
      getFillColor: [0, 0, 0, 0],
      getLineColor: [255, 255, 255, 50],
      opacity: isExploded ? 1 : 0,
      getRadius: (d, {index}) => (index === 0 ? 76533 : 47300),
      stroked: true,
      filled: false,
      lineWidthMinPixels: 1,
      pickable: false,
      transitions: {
        getPosition: transitionConfig,
        opacity: {duration: 200}
      }
    }),
    // Angle arcs layer
    new PathLayer({
      id: 'angle-arcs',
      data: arcData,
      getPath: d => d,
      getColor: (d, {index}) => (!isExploded || index === 1 || index === 4 ? [235, 235, 235, 200] : [235, 235, 235, 0]),
      widthMinPixels: 2,
      pickable: false,
      transitions: {
        getPath: transitionConfig,
        getColor: {duration: 200}
      }
    }),
    // Angle text layer
    new TextLayer({
      id: 'angle-labels',
      data: data.flatMap(triangle => [triangle[1]]),
      getPosition: d => d,
      getText: (d, {index}) => {
        if (index === 0) {
          return `72°`;
        } else if (index === 2) {
          return `108°`;
        }
        return '';
      },
      getPixelOffset: (d, {index}) => {
        return index === 0 ? [40, -20] : isExploded ? [12, 35] : [-15, 28];
      },
      characterSet: '0123456789°',
      getColor: [255, 255, 255],
      getSize: 14,
      pickable: false,
      transitions: {
        getPosition: transitionConfig,
        getPixelOffset: transitionConfig
      }
    })
  ];

  return (
    <>
      <DeckGL initialViewState={INITIAL_VIEW_STATE} controller={true} layers={layers} />
    </>
  );
};

export default App;

export function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<App />);
}
