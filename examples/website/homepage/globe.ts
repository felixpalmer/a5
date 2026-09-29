import {cellToBoundary} from 'a5';

function toUnitVector(lon: number, lat: number, out: Float32Array, offset: number) {
  const lambda = (lon * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  out[offset] = Math.cos(phi) * Math.sin(lambda);
  out[offset + 1] = Math.sin(phi);
  out[offset + 2] = Math.cos(phi) * Math.cos(lambda);
}

/**
 * Each cell's 5 vertices on the unit sphere, and its center repeated for each
 * vertex, as the shared geometry's position and center attributes. The
 * slowest part of building the scene, so it runs in a worker (globe-worker.ts)
 */
export function computeGlobe(cells: BigUint64Array) {
  const n = cells.length;
  const position = new Float32Array(n * 15);
  const center = new Float32Array(n * 15);
  const centerVector = new Float32Array(3);
  for (let i = 0; i < n; i++) {
    const boundary = cellToBoundary(cells[i], {closedRing: false, segments: 1});
    // At this resolution the normalized mean of the vertices is as good as the
    // cell's center, and saves a cellToLonLat per cell
    centerVector.fill(0);
    for (let k = 0; k < 5; k++) {
      const v = (i * 5 + k) * 3;
      const [lon, lat] = boundary[k % boundary.length];
      toUnitVector(lon, lat, position, v);
      for (let c = 0; c < 3; c++) centerVector[c] += position[v + c];
    }
    const length = Math.hypot(centerVector[0], centerVector[1], centerVector[2]);
    for (let c = 0; c < 3; c++) centerVector[c] /= length;
    for (let k = 0; k < 5; k++) center.set(centerVector, (i * 5 + k) * 3);
  }
  return {position, center};
}
