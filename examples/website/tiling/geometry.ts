// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import * as vec3 from 'a5/math/vec3';

import {origins} from 'a5/core/origin';
import {distanceToEdge, PI_OVER_5} from 'a5/core/constants';

// Pure geometry shared by the Tiling and Conway examples, kept free of React
// and deck.gl.

export type V3 = [number, number, number];

export const INK: [number, number, number] = [25, 25, 25];

// Shared transition for morphing between the planar and projected layouts
// (smoothstep easing).
export const MORPH_TRANSITION = {
  duration: 1200,
  easing: (t: number) => t * t * (3 - 2 * t)
};

// Scale for the planar dodecahedron so its corner vertices sit at distance 1
// from the origin — the sphere radius. The DSEA projection maps face corners
// to the same radial directions, so the dodecahedron vertices stay fixed
// through the planar↔sphere morph. (Unit insphere ⇒ circumradius
// √(1 + L²) with L the face circumradius in the tangent plane.)
export const DODEC_CIRCUMRADIUS = Math.hypot(1, distanceToEdge / Math.cos(PI_OVER_5));

// Lift a face-local 2D point onto a dodecahedron face: rotate in-plane by the
// origin's angle, place on the tangent plane z = 1 (the dodecahedron has unit
// insphere radius, so face coordinates ARE the face plane), then rotate the
// plane into position with the origin's quaternion. This is the planar part of
// the A5 projection pipeline (see a5/projections/dodecahedron.ts).
export function liftToFace(origin: (typeof origins)[number]) {
  const cosA = Math.cos(origin.angle);
  const sinA = Math.sin(origin.angle);
  const v3 = vec3.create();
  return (v: [number, number]): V3 => {
    vec3.set(v3, v[0] * cosA - v[1] * sinA, v[0] * sinA + v[1] * cosA, 1);
    vec3.transformQuat(v3, v3, origin.quat);
    vec3.scale(v3, v3, 1 / DODEC_CIRCUMRADIUS);
    return [v3[0], v3[1], v3[2]];
  };
}

export function normalize3(v: V3): V3 {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
}

export function mean3(pts: V3[]): V3 {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < pts.length; i++) {
    x += pts[i][0];
    y += pts[i][1];
    z += pts[i][2];
  }
  return [x / pts.length, y / pts.length, z / pts.length];
}

// Vertices shared between neighbouring cells are produced by different
// transforms — and unprojected from different dodecahedron faces — so they
// agree only to floating-point precision. The tolerance is far above that
// error (the A5 quaternions are single precision, so a vertex lifted through
// two different faces can disagree by ~1e-7) and far below the cell size.
export const VERTEX_QUANTUM = 1e-6;

// Identify points that agree to floating-point precision. Rounding to a grid
// alone splits the rare pair that straddles a grid cell boundary, so this
// looks in the neighbouring grid cells too and hands back one id per point
// within `tolerance`.
export function makeWelder(tolerance = VERTEX_QUANTUM) {
  const cell = tolerance * 2;
  const grid = new Map<string, {p: V3; id: string}[]>();
  let next = 0;
  return (p: V3): string => {
    const c = p.map(x => Math.floor(x / cell));
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          for (const q of grid.get(`${c[0] + dx},${c[1] + dy},${c[2] + dz}`) ?? []) {
            if (Math.hypot(p[0] - q.p[0], p[1] - q.p[1], p[2] - q.p[2]) <= tolerance) return q.id;
          }
        }
    const id = `v${next++}`;
    const key = c.join();
    (grid.get(key) ?? grid.set(key, []).get(key)!).push({p, id});
    return id;
  };
}

// A vertex lies on the boundary of the drawn region unless its ring of
// surrounding cell centroids encloses it: for an interior vertex no gap
// between consecutive centroids can reach π.
export function enclosed(sortedAngles: number[]): boolean {
  let maxGap = sortedAngles[0] + 2 * Math.PI - sortedAngles[sortedAngles.length - 1];
  for (let i = 1; i < sortedAngles.length; i++) {
    maxGap = Math.max(maxGap, sortedAngles[i] - sortedAngles[i - 1]);
  }
  return maxGap < Math.PI;
}

// Subdivide a ring of unit vectors along the sphere surface (normalized lerp
// between consecutive points) so edges follow the sphere instead of cutting
// chords. Subdividing on the sphere — rather than in face space before
// projection — matters: intermediate face points beyond a face *corner* have
// no single consistent mapping in the DSEA inverse and would occasionally
// jump, producing sliver artifacts.
export function slerpSubdivide(ring: V3[], segments: number): V3[] {
  if (segments <= 1) return ring;
  const out: V3[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    for (let j = 0; j < segments; j++) {
      const t = j / segments;
      out.push(normalize3([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]));
    }
  }
  return out;
}

// Linear subdivision of a ring of 3D points, with the same per-edge
// parameterization as slerpSubdivide so planar and spherical rings pair up
// vertex-for-vertex.
export function subdivideRing(ring: V3[], segments: number): V3[] {
  if (segments <= 1) return ring;
  const out: V3[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    for (let j = 0; j < segments; j++) {
      const t = j / segments;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  return out;
}

const dot3 = (a: ArrayLike<number>, b: ArrayLike<number>) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// ---------------------------------------------------------------------------
// Two-pass cell meshes
//
// Every 3D datum carries BOTH the planar and sphere-projected positions,
// generated together with identical vertex counts and ordering, so deck.gl
// attribute transitions can morph between the two layouts. Polygons are
// pre-normalized flat closed rings and the layers use `_normalize: false`:
// deck's normalization forces a winding measured in the xy-plane, which can
// differ between the two layouts and would twist cells through themselves
// during the morph.
//
// Cells are drawn without any line rendering: the full-size cell in ink, then
// a fill shrunk toward its centre on top, whose exposed rim is the border.
// BOTH passes are fans from that centre, which makes each fill triangle
// exactly coplanar with the underlay triangle behind it. That matters because
// the cells are not planar — a pentagon bulges over the sphere — and any other
// triangulation of the underlay would fold along a different diagonal and cut
// through the fill.
// ---------------------------------------------------------------------------

// One cell in both layouts: the ring of its corners and the point its fans
// radiate from.
export type Patch = {
  ringPlanar: V3[];
  ringSphere: V3[];
  centerPlanar: V3;
  centerSphere: V3;
};

export type BorderTri3D = {
  planar: number[];
  sphere: number[];
};

export type FillTri3D = {
  planar: number[];
  sphere: number[];
  shadePlanar: number; // lit by the cell's own normal
  shadeSphere: number; // lit by the sphere's radial normal at its centre
  quintant: number;
  sides: number;
};

export type Cells = {borders: BorderTri3D[]; fills: FillTri3D[]};

// How much the fill is shrunk toward the cell centre; the exposed rim of the
// full-size ink underlay becomes the cell border.
const CELL_INSET = 0.95;

const LIGHT_DIR = (() => {
  const l = vec3.fromValues(0.4, 0.3, 0.85);
  return vec3.normalize(l, l);
})();

function shadeForNormal(n: ArrayLike<number>): number {
  return 0.6 + 0.4 * Math.max(0, dot3(n, LIGHT_DIR));
}

// Blend an RGBA tint over white by its alpha, then shade.
export function tint([r, g, b, a]: [number, number, number, number], s: number): [number, number, number, number] {
  const mix = a / 255;
  return [(255 * (1 - mix) + r * mix) * s, (255 * (1 - mix) + g * mix) * s, (255 * (1 - mix) + b * mix) * s, 255];
}

// Flatten a ring of 3D points into deck's pre-normalized polygon form (flat
// array, closed by repeating the first vertex).
function flatClosedRing(ring: V3[]): number[] {
  const flat: number[] = [];
  for (const p of ring) flat.push(p[0], p[1], p[2]);
  flat.push(ring[0][0], ring[0][1], ring[0][2]);
  return flat;
}

// Newell normal of a ring, oriented away from the origin. Newell copes with
// rings that are not planar, and both layouts are star-shaped about the
// origin, so comparing against the ring's centroid fixes the sign regardless
// of winding.
function outwardNormal(ring: V3[]): V3 {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const n = normalize3([nx, ny, nz]);
  return dot3(n, mean3(ring)) < 0 ? [-n[0], -n[1], -n[2]] : n;
}

function insetRing(ring: V3[], center: V3): V3[] {
  return ring.map(p => [
    center[0] + (p[0] - center[0]) * CELL_INSET,
    center[1] + (p[1] - center[1]) * CELL_INSET,
    center[2] + (p[2] - center[2]) * CELL_INSET
  ]);
}

// Append the two passes for one cell.
export function pushPasses(
  patch: Patch,
  segments: number,
  borders: BorderTri3D[],
  fills: FillTri3D[],
  attrs: {quintant: number; sides: number}
): void {
  const n = patch.ringPlanar.length;
  for (let i = 0; i < n; i++) {
    borders.push({
      planar: flatClosedRing([patch.centerPlanar, patch.ringPlanar[i], patch.ringPlanar[(i + 1) % n]]),
      sphere: flatClosedRing([patch.centerSphere, patch.ringSphere[i], patch.ringSphere[(i + 1) % n]])
    });
  }
  // Insetting toward the centre pulls the sphere ring inside the sphere;
  // normalizing puts it back on the surface, where slerpSubdivide expects unit
  // vectors. The underlay's full-size chords sag deeper than the subdivided
  // fill, so the ink backs the fill but never pokes through it.
  const innerPlanar = subdivideRing(insetRing(patch.ringPlanar, patch.centerPlanar), segments);
  const innerSphere = slerpSubdivide(insetRing(patch.ringSphere, patch.centerSphere).map(normalize3), segments);
  // One normal per CELL, shared by all its fan triangles — per-triangle normals
  // would make the fan triangulation visible in the shading.
  const shadePlanar = shadeForNormal(outwardNormal(patch.ringPlanar));
  const shadeSphere = shadeForNormal(patch.centerSphere);
  const m = innerPlanar.length;
  for (let i = 0; i < m; i++) {
    fills.push({
      planar: flatClosedRing([patch.centerPlanar, innerPlanar[i], innerPlanar[(i + 1) % m]]),
      sphere: flatClosedRing([patch.centerSphere, innerSphere[i], innerSphere[(i + 1) % m]]),
      shadePlanar,
      shadeSphere,
      ...attrs
    });
  }
}
