import {lonLatToCell, cellToLonLat, cellToBoundary} from 'a5';
import {latLngToCell, cellToLatLng, cellToBoundary as h3CellToBoundary} from 'h3-js';
import {S2} from 's2-geometry';

export type BezierVertex = {
  anchor: [number, number];
  ctrlIn: [number, number];
  ctrlOut: [number, number];
};

export type ContourData = {
  original: [number, number][];
  a5: [number, number][];
  h3: [number, number][];
  s2: [number, number][];
};

export type HoverCells = {
  a5: [number, number][];
  h3: [number, number][];
  s2: [number, number][];
} | null;

// Target spacing of ~1cm. At mid-latitudes, 1cm ≈ 1e-7 degrees.
const SAMPLE_SPACING_DEG = 1e-7;

function bezierPoint(
  p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number], t: number
): [number, number] {
  const u = 1 - t;
  return [
    u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
    u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1]
  ];
}

function estimateSegmentLength(
  p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number]
): number {
  // Estimate arc length by sampling 20 points along the curve
  let length = 0;
  let prev = p0;
  for (let i = 1; i <= 20; i++) {
    const pt = bezierPoint(p0, p1, p2, p3, i / 20);
    const dx = pt[0] - prev[0];
    const dy = pt[1] - prev[1];
    length += Math.sqrt(dx * dx + dy * dy);
    prev = pt;
  }
  return length;
}

export function sampleBezierPath(vertices: BezierVertex[], closed: boolean): [number, number][] {
  if (vertices.length < 2) return vertices.map(v => v.anchor);
  const points: [number, number][] = [];
  const segCount = closed ? vertices.length : vertices.length - 1;
  for (let seg = 0; seg < segCount; seg++) {
    const v0 = vertices[seg];
    const v1 = vertices[(seg + 1) % vertices.length];
    const p0 = v0.anchor, p1 = v0.ctrlOut, p2 = v1.ctrlIn, p3 = v1.anchor;
    const arcLen = estimateSegmentLength(p0, p1, p2, p3);
    const samples = Math.max(2, Math.ceil(arcLen / SAMPLE_SPACING_DEG));
    for (let s = 0; s <= samples; s++) {
      if (s === 0 && seg > 0) continue;
      points.push(bezierPoint(p0, p1, p2, p3, s / samples));
    }
  }
  return points;
}

function dedup(points: [number, number][]): [number, number][] {
  if (points.length === 0) return points;
  const result: [number, number][] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    if (points[i][0] !== prev[0] || points[i][1] !== prev[1]) {
      result.push(points[i]);
    }
  }
  return result;
}

export function roundTripA5(points: [number, number][]): [number, number][] {
  return dedup(points.map(([lon, lat]) => {
    const cell = lonLatToCell([lon, lat], 30);
    const r = cellToLonLat(cell);
    return [r[0], r[1]] as [number, number];
  }));
}

export function roundTripH3(points: [number, number][]): [number, number][] {
  return dedup(points.map(([lon, lat]) => {
    const cell = latLngToCell(lat, lon, 15);
    const [rlat, rlon] = cellToLatLng(cell);
    return [rlon, rlat] as [number, number];
  }));
}

export function roundTripS2(points: [number, number][]): [number, number][] {
  return dedup(points.map(([lon, lat]) => {
    const key = S2.latLngToKey(lat, lon, 30);
    const r = S2.keyToLatLng(key);
    return [r.lng, r.lat] as [number, number];
  }));
}

export function getCellsAtLocation(lon: number, lat: number): HoverCells {
  const a5Cell = lonLatToCell([lon, lat], 30);
  const a5Boundary = cellToBoundary(a5Cell);

  const h3Cell = latLngToCell(lat, lon, 15);
  const h3Boundary = h3CellToBoundary(h3Cell, true);

  const s2Cell = S2.S2Cell.FromLatLng({lat, lng: lon}, 30);
  const s2Corners = s2Cell.getCornerLatLngs();
  const s2Boundary = s2Corners.map((c: {lat: number; lng: number}) => [c.lng, c.lat]);

  return {a5: a5Boundary, h3: h3Boundary, s2: s2Boundary};
}
