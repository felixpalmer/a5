import React, { Suspense, useMemo, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { DoubleSide, BufferGeometry, BufferAttribute, Vector3, SphereGeometry, LineBasicMaterial } from 'three';
import { generateWireframe } from 'a5-internal/wireframe';
import { fromLonLat, toCartesian, toFace, toPolar, toSpherical } from 'a5/core/coordinate-transforms';
import { projectDodecahedron, projectDodecahedron2 } from 'a5/core/dodecahedron';
import { quat } from 'gl-matrix';
import { Cartesian, Face, Polar, Radians } from 'a5/core/types';
import { WARP_FACTORS } from 'a5/core/constants';
import { minimize_L_BFGS, rs_minimize, Real, minimize_GradientDescent } from './optimization';
import { optimizationPoints, initializePoints } from './optimization-points';
import { cellToBoundary, cellToChildren } from 'a5/index';
import {pentagonArea} from 'a5/core/utils';
import { projectPoint } from 'a5/core/project';
import { origins } from 'a5/core/origin';

// Create a cache for geometries
const geometryCache = new Map<number, BufferGeometry>();

const SCALE = 1 / 0.7946544775515483; // Scale to make inscribed sphere
const dodecahedron = generateWireframe(1).map(cell => cell.map(lonLat => {
  const cartesian = toCartesian(fromLonLat(lonLat));
  const vector = new Vector3(...cartesian);
  vector.multiplyScalar(SCALE);
  return vector;
}));

const quintant = [dodecahedron[0][0], dodecahedron[0][1], dodecahedron[0][3]];

type WarpFactors = Partial<typeof WARP_FACTORS>;

function applyWarpFactors(warpFactors: WarpFactors) {
  Object.assign(WARP_FACTORS, warpFactors);
}

const originalWarpFactors = { ...WARP_FACTORS };

const level3Cells = cellToChildren(0n, 3);

function getCellArea(cell: bigint): number {
  const boundary = cellToBoundary(cell, {closedRing: false, segments: 1});
  const xyz = boundary.map(lonLat => toCartesian(fromLonLat(lonLat)));
  const unitArea = pentagonArea(xyz);
  return unitArea;
}

const AUTHALIC_RADIUS = 6371.0072; // km
const AUTHALIC_AREA = 4 * Math.PI * AUTHALIC_RADIUS * AUTHALIC_RADIUS;

function calculateAreaRatio(warpFactors: WarpFactors): number {
  // Set the new value
  applyWarpFactors(warpFactors);
  
  let minArea = Infinity;
  let maxArea = -Infinity;
  let totalArea = 0;

  for (const cell of level3Cells) {
    const area = getCellArea(cell);
    minArea = Math.min(minArea, area);
    maxArea = Math.max(maxArea, area);
    totalArea += area;
  }
  console.log(minArea, maxArea);

  // Restore original values
  applyWarpFactors(originalWarpFactors);

  const averageArea = totalArea / level3Cells.length;
  return (maxArea - averageArea) / averageArea;
}
//console.log('Area error', calculateAreaRatio({}));

// Calculate min/max ratio of Jacobian values for random points
function calculateJacobianRatio(warpFactors: WarpFactors): number {
  if (optimizationPoints.length === 0) {
    throw new Error('No optimization points');
  }
  // Set the new value
  applyWarpFactors(warpFactors);
  
  let minJ = Infinity;
  let maxJ = -Infinity;

  for (const polar of optimizationPoints) {
    // Calculate Jacobian
    const j = calculateJacobian(polar);
    
    minJ = Math.min(minJ, j);
    maxJ = Math.max(maxJ, j);
  }

  // Restore original values
  applyWarpFactors(originalWarpFactors);

  return (maxJ - minJ) / minJ;
}

function faceToCartesian(face: Face): Cartesian {
  const identityQuat = quat.create();
  const polar = toPolar(face);
  const projectedLonLat = projectPoint(face, origins[0], 2);
  const projected = fromLonLat(projectedLonLat);
  const projectedCartesian = toCartesian(projected);
  return projectedCartesian;
}

// Create random points inside first pentagon and their projections
function createPointGeometries() {
  const points: Vector3[] = [];
  const projectedPoints: Vector3[] = [];
  const colors: number[] = [];
  const identityQuat = quat.create();

  // Helper to interpolate colors
  const minScale = 0.7465978738739937;
  const maxScale = 0.7608320967201088;
  function interpolateColor(stretch: number): [number, number, number] {
    const t = (stretch - minScale) / (maxScale - minScale);
    return [1 - t, 0 , t];
  }

  let minStretch = Infinity;
  let maxStretch = -Infinity;

  // Generate points in each triangle of the pentagon
  for (let i = 0; i < optimizationPoints.length; i++) {
    const face = toFace(optimizationPoints[i]);
    const point = new Vector3(...face, 1.0);
    points.push(point);

    // Project point onto sphere
    const polar = toPolar([point.x, point.y] as Face);
    const projectedCartesian = faceToCartesian([point.x, point.y] as Face);
    projectedPoints.push(new Vector3(...projectedCartesian));

    // Calculate Jacobian and add color
    const stretch = calculateJacobian(polar);
    if (stretch > 0.1) {
    minStretch = Math.min(minStretch, stretch);
    }
    maxStretch = Math.max(maxStretch, stretch);
    const [r, g, b] = interpolateColor(stretch);
    colors.push(r, g, b);
  }

  console.log('strech', minStretch, maxStretch);

  // Create geometries for both sets of points
  const positions = new Float32Array(points.length * 3);
  const projectedPositions = new Float32Array(projectedPoints.length * 3);
  const colorAttribute = new Float32Array(colors);

  points.forEach((point, i) => {
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y;
    positions[i * 3 + 2] = point.z;
  });

  projectedPoints.forEach((point, i) => {
    projectedPositions[i * 3] = point.x;
    projectedPositions[i * 3 + 1] = point.y;
    projectedPositions[i * 3 + 2] = point.z;
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));

  const projectedGeometry = new BufferGeometry();
  projectedGeometry.setAttribute('position', new BufferAttribute(projectedPositions, 3));
  projectedGeometry.setAttribute('color', new BufferAttribute(colorAttribute, 3));

  return { geometry, projectedGeometry };
}

// Create a merged geometry from all pentagons
function createMergedGeometry() {
  // Arrays to hold all vertices, UVs, and indices
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  
  // Process each cell
  dodecahedron.forEach((cell, cellIndex) => {
    // Convert vertices to Cartesian coordinates
    const vertices = cell;
    
    // Calculate normal for this pentagon
    const v1 = vertices[1].clone().sub(vertices[0]);
    const v2 = vertices[2].clone().sub(vertices[0]);
    const normal = new Vector3().crossVectors(v1, v2).normalize();
    
    // Add vertices to positions array
    vertices.forEach(vertex => {
      positions.push(vertex.x, vertex.y, vertex.z);
      normals.push(normal.x, normal.y, normal.z);
    });
    
    const vertexOffset = cellIndex * 5;
    
    // Create triangles (0,1,2), (0,2,3), (0,3,4)
    indices.push(
      vertexOffset, vertexOffset + 1, vertexOffset + 2,
      vertexOffset, vertexOffset + 2, vertexOffset + 3,
      vertexOffset, vertexOffset + 3, vertexOffset + 4
    );
  });
  
  // Create the merged geometry
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setIndex(new BufferAttribute(new Uint32Array(indices), 1));
  
  return geometry;
}

// Calculate area of a quadrilateral from four points using cross product method
function calculateQuadArea(p1: number[], p2: number[], p3: number[], p4: number[]): number {
  // Calculate area using two triangles
  function triangleArea(a: number[], b: number[], c: number[]): number {
    const v1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cross = [
      v1[1] * v2[2] - v1[2] * v2[1],
      v1[2] * v2[0] - v1[0] * v2[2],
      v1[0] * v2[1] - v1[1] * v2[0]
    ];
    return Math.sqrt(cross[0] * cross[0] + cross[1] * cross[1] + cross[2] * cross[2]) / 2;
  }
  return triangleArea(p1, p2, p3) + triangleArea(p1, p3, p4);
}

function calculateJacobian(polar: Polar): number {
  const h = 1e-9;
  const identityQuat = quat.create();
  const cartesian = [...toFace(polar), 1] as Cartesian;

  // Generate four points in Cartesian space forming a small quadrilateral
  const dx = h;
  const dy = h;
  const sourcePoints = [
    cartesian,
    [cartesian[0] + dx, cartesian[1] + dy, cartesian[2]] as Cartesian,
    [cartesian[0] - dy, cartesian[1] + dx, cartesian[2]] as Cartesian,
    [cartesian[0] - dx - dy, cartesian[1] + dx - dy, cartesian[2]] as Cartesian
  ];

  // Project points to sphere
  const projectedCartesian = sourcePoints.map(p => {
    const projectedCartesian = faceToCartesian([p[0], p[1]] as Face);
    return projectedCartesian;
  });

  // Calculate areas
  const sourceArea = calculateQuadArea(...sourcePoints);
  const projectedArea = calculateQuadArea(...projectedCartesian);

  // Return ratio of areas (projected/source)
  const ratio = projectedArea / sourceArea;
  return ratio;
}

// Optimization function using optim.js
async function optimizeBetaScale() {
  // Create dimension for betaScale parameter
  const dims = [
    new Real(0.508, 0.513),  // BETA_SCALE bounds
    new Real(0.943, 0.949),  // RHO_SHIFT bounds
    new Real(-0.02, 0.02),  // RHO_SCALE bounds
    new Real(0.04, 0.06),  // RHO_SCALE bounds
  ];

  // Objective function for optimizer
  function objective(x: number[]) {
    const warpFactors = { BETA_SCALE: x[0], RHO_SHIFT: x[1], RHO_SCALE: x[2], RHO_SCALE2: x[3] };
    // WARP_FACTORS.OVERRIDES = x;
    const ratio = calculateAreaRatio(warpFactors);
    return ratio;
  }

  // Add gradient calculation
  function gradient(x: number[]) {
    const h = 1e-6; // Small step size for finite differences
    const grad = new Array(x.length).fill(0);
    const f0 = objective(x);

    // Calculate partial derivatives using forward differences
    for (let i = 0; i < x.length; i++) {
      const xh = [...x];
      xh[i] += h;
      const fh = objective(xh);
      grad[i] = (fh - f0) / h;
    }

    return grad;
  }

  // Progress tracking
  let iteration = 0;
  const wrappedObjective = (x: number[]) => {
    iteration++;
    const value = objective(x);
    if (iteration % 10 === 0) {
      console.log(`Step ${iteration}: ${x}, Loss = ${formatLoss(value)}`);
    }
    return value;
  };

  // Run optimization with L-BFGS
  // const result = rs_minimize(wrappedObjective, dims, 100, 1, 0.01);

  const result = minimize_GradientDescent(
  // const result = minimize_L_BFGS( // <- spits out NaN values
    wrappedObjective,
    gradient,
    [WARP_FACTORS.BETA_SCALE, WARP_FACTORS.RHO_SHIFT, WARP_FACTORS.RHO_SCALE, WARP_FACTORS.RHO_SCALE2]
  );

  // Return optimized parameters
  return {
    warpFactors: result.best_x || result.argument,
    loss: result.best_y || result.fncvalue
  };
}

function formatLoss(loss: number) {
  return `${Math.round(loss * 100000) / 1000}%`;
}

function Scene() {
  // Track loading state
  const [pointsLoaded, setPointsLoaded] = useState(false);

  useEffect(() => {
    initializePoints(quintant).then(() => {
      setPointsLoaded(true);
      return;
      const loss = calculateAreaRatio({});
      console.log(`Initial loss: ${formatLoss(loss)}`);

      // Run optimization when component mounts
      optimizeBetaScale().then(optimalWarpFactors => {
        console.log(`Optimal: ${optimalWarpFactors.warpFactors}, Loss: ${formatLoss(optimalWarpFactors.loss)}`);
      });
    });
  }, []);

  // Create geometries once points are loaded
  const dodecahedronGeometry = useMemo(() => {
    if (geometryCache.has(1)) return geometryCache.get(1)!;
    const geometry = createMergedGeometry();
    geometryCache.set(1, geometry);
    return geometry;
  }, []);
  const sphereGeometry = useMemo(() => new SphereGeometry(1, 32, 32), []);
  const { geometry: pointsGeometry, projectedGeometry: projectedPointsGeometry } = useMemo(() => {
    if (!pointsLoaded) return { geometry: new BufferGeometry(), projectedGeometry: new BufferGeometry() };
    return createPointGeometries();
  }, [pointsLoaded]);
  const pointSize = 0.5 / Math.sqrt(optimizationPoints.length);

  if (!pointsLoaded) return null; 
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 10, 10]} intensity={1.5} />
      <directionalLight position={[-10, -10, -10]} intensity={0.8} />

      <group>
        <mesh geometry={dodecahedronGeometry} position={[-1.5, 0, 0]}>
          <meshPhysicalMaterial color="#a50" />
        </mesh>

        <points geometry={pointsGeometry} position={[-1.5, 0, 0]}>
          <pointsMaterial color="#fff" size={pointSize} />
        </points>

        <mesh geometry={sphereGeometry} position={[1.5, 0, 0]}>
          <meshPhysicalMaterial color="#0a5" />
        </mesh>

        <points geometry={projectedPointsGeometry} position={[1.5, 0, 0]}>
          <pointsMaterial vertexColors={true} size={pointSize} />
        </points>
      </group>

      <OrbitControls 
        makeDefault
        enableDamping 
        enableZoom={true}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
        minDistance={3}
        maxDistance={10}
        enablePan={false}
      />
    </>
  );
}

const App: React.FC = () => {
  return (
    <div style={{
      position: 'absolute',
      height: '100%',
      width: '100%',
      top: 0,
      left: 0,
      background: 'linear-gradient(0, #000, #223)'
    }}>
      <Canvas camera={{ position: [0, 0, 3] }}>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default App;

export async function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<App />);
} 