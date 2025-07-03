import { Vector3 } from 'three';
import { toPolar } from 'a5/core/coordinate-transforms';
import { Face, Polar } from 'a5/core/types';

// Generate fixed set of points for optimization
const USE_CACHED_POINTS = false;
export const NUM_OPTIMIZATION_POINTS = 10000;
export const NUM_EDGE_POINTS = Math.floor(2 * Math.sqrt(NUM_OPTIMIZATION_POINTS)); // Per each edge

export const optimizationPoints: Polar[] = [];

// Helper to generate a point from barycentric coordinates
export function addPoint(bary: number[], v1: Vector3, v2: Vector3, v3: Vector3) {
  const point = interpolatePoint(v1, v2, v3, bary);
  optimizationPoints.push(toPolar([point.x, point.y] as Face));
}

// Generate or load optimization points
export async function initializePoints(quintant: Vector3[]) {
  const [v1, v2, v3] = quintant;
  
  if (USE_CACHED_POINTS) {
    try {
      const response = await fetch('/data/quintant.json');
      const points = await response.json();
      optimizationPoints.push(...points);
      console.log(`Loaded ${points.length} points from cache`);
    } catch (error) {
      console.error('Failed to load cached points, generating new ones:', error);
      generatePoints(v1, v2, v3);
      // savePoints();
    }
  } else {
    generatePoints(v1, v2, v3);
  }
}

// Helper to save points for caching
export function savePoints() {
  console.log(JSON.stringify(optimizationPoints));
}

function generatePoints(v1: Vector3, v2: Vector3, v3: Vector3) {
  // Generate points along edges
  const epsilon = 1e-5; // Inset line, to avoid numerical issues with the Jacobian
  for (let i = 0; i < NUM_EDGE_POINTS; i++) {
    let t = i / NUM_EDGE_POINTS; // Range 0 -> 1
    const scale = 1 - 3 * epsilon;
    const u = t * scale + epsilon;
    const v = (1 - t) * scale + epsilon;
    const w = epsilon;
    addPoint([u, v, w], v1, v2, v3);     // Edge v1->v2
    addPoint([w, u, v], v1, v2, v3);     // Edge v2->v3
    addPoint([v, w, u], v1, v2, v3);     // Edge v3->v1
  }

  // Generate points in quintant
  for (let i = optimizationPoints.length; i < NUM_OPTIMIZATION_POINTS; i++) {
    addPoint(randomBarycentricCoord(), v1, v2, v3);
  }
  console.log(`Generated ${optimizationPoints.length} points`);
}

// Generate random barycentric coordinates
function randomBarycentricCoord() {
  const r1 = Math.random();
  const r2 = Math.random();
  const sqrt1 = Math.sqrt(r1);
  const u = 1 - sqrt1;
  const v = r2 * sqrt1;
  const w = 1 - u - v;
  return [u, v, w];
}

// Interpolate point using barycentric coordinates
function interpolatePoint(v1: Vector3, v2: Vector3, v3: Vector3, [u, v, w]: number[]) {
  return new Vector3(
    u * v1.x + v * v2.x + w * v3.x,
    u * v1.y + v * v2.y + w * v3.y,
    u * v1.z + v * v2.z + w * v3.z
  );
}
