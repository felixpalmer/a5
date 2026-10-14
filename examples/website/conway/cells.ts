// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import * as vec3 from 'a5/math/vec3';

import {
  type BorderTri3D,
  type Cells,
  type FillTri3D,
  type V3,
  enclosed,
  mean3,
  normalize3,
  pushPasses
} from '../tiling/geometry';
import type {GeoTri, Pentagonal, QuadFace} from './pentagonal';

// The cells of the three class II readings of a subdivided pentakis
// dodecahedron — the geodesic polyhedron, its dual Goldberg polyhedron and the
// Teohedron — as the two-pass meshes of pushPasses, in both layouts.

export const GOLDBERG_PENTAGON: [number, number, number, number] = [219, 68, 55, 110];
export const GOLDBERG_HEXAGON: [number, number, number, number] = [70, 170, 180, 110];

// The kites of oₙD, n ≥ 2.
export const ORTHO_QUAD: [number, number, number, number] = [235, 150, 60, 110];

// One tint per A5 flavor, so the four orientations — and the 2 × 2 metatile
// they repeat in — are readable at a glance.
export const FLAVOR_FILLS: [number, number, number, number][] = [
  [66, 133, 244, 110],
  [15, 157, 88, 110],
  [244, 180, 0, 110],
  [171, 71, 188, 110]
];

// The sphere layout is the radial projection of the planar one, point for
// point: vertices go to the sphere as a geodesic polyhedron's do, and the
// straight edges become great-circle arcs.
export function geodesicCells(tris: GeoTri[], segments: number): Cells {
  const borders: BorderTri3D[] = [];
  const fills: FillTri3D[] = [];
  for (const t of tris) {
    const ringSphere = t.corners.map(normalize3);
    pushPasses(
      {
        ringPlanar: t.corners,
        ringSphere,
        centerPlanar: mean3(t.corners),
        centerSphere: normalize3(mean3(ringSphere))
      },
      segments,
      borders,
      fills,
      {quintant: t.quintant, sides: 3}
    );
  }
  return {borders, fills};
}

// The dual: every vertex becomes a face whose corners are the centres of the
// triangles around it — 12 pentagons at the valence-5 vertices (the
// dodecahedron face centres), hexagons everywhere else.
export function goldbergCells(tris: GeoTri[], segments: number): Cells {
  const borders: BorderTri3D[] = [];
  const fills: FillTri3D[] = [];
  const groups = new Map<string, {planar: V3; tris: number[]}>();
  const centerPlanar: V3[] = [];
  const centerSphere: V3[] = [];
  tris.forEach((t, i) => {
    centerPlanar.push(mean3(t.corners));
    centerSphere.push(normalize3(mean3(t.corners.map(normalize3))));
    t.keys.forEach((key, k) => {
      let group = groups.get(key);
      if (!group) groups.set(key, (group = {planar: t.corners[k], tris: []}));
      group.tris.push(i);
    });
  });
  const e1 = vec3.create();
  const e2 = vec3.create();
  const d = vec3.create();
  for (const {planar, tris: around} of groups.values()) {
    const vertex = normalize3(planar);
    const ref: V3 = Math.abs(vertex[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    vec3.scaleAndAdd(e1, ref, vertex, -vec3.dot(ref, vertex));
    vec3.normalize(e1, e1);
    vec3.cross(e2, vertex, e1);
    const sorted = around
      .map(i => {
        vec3.subtract(d, centerSphere[i], vertex);
        return {i, angle: Math.atan2(vec3.dot(d, e2), vec3.dot(d, e1))};
      })
      .sort((a, b) => a.angle - b.angle);
    // The polyhedron is closed, so this never fails; it guards the fans.
    if (!enclosed(sorted.map(s => s.angle))) continue;
    pushPasses(
      {
        ringPlanar: sorted.map(s => centerPlanar[s.i]),
        ringSphere: sorted.map(s => centerSphere[s.i]),
        // The geodesic vertex is the face's own centre, and it lies on the
        // pentakis surface even when the face folds across a pentakis edge.
        centerPlanar: planar,
        centerSphere: vertex
      },
      segments,
      borders,
      fills,
      {quintant: -1, sides: sorted.length}
    );
  }
  return {borders, fills};
}

// The pentagons of pentagonalize, with each fill triangle's A5 flavor in the
// parallel `flavors` (FillTri3D has no slot for it).
export function pentagonCells(pentagonal: Pentagonal, segments: number): Cells & {flavors: number[]} {
  const borders: BorderTri3D[] = [];
  const fills: FillTri3D[] = [];
  const flavors: number[] = [];
  for (const cell of pentagonal.cells) {
    const before = fills.length;
    pushPasses(
      {
        ringPlanar: cell.ringPlanar,
        ringSphere: cell.ringSphere,
        centerPlanar: mean3(cell.ringPlanar),
        centerSphere: normalize3(mean3(cell.ringSphere))
      },
      segments,
      borders,
      fills,
      {quintant: cell.quintant, sides: 5}
    );
    for (let k = before; k < fills.length; k++) flavors.push(cell.flavor);
  }
  return {borders, fills, flavors};
}

// The faces of oₙD (see orthoFaces). The planar fan radiates from the mean of
// the corners rather than the grid's face-centre vertex, which sits on the
// pentakis surface: at n = 1 that is the raised apex over a flat dodecahedron
// face.
export function orthoCells(faces: QuadFace[], segments: number): Cells {
  const borders: BorderTri3D[] = [];
  const fills: FillTri3D[] = [];
  for (const f of faces) {
    pushPasses(
      {
        ringPlanar: f.ring,
        ringSphere: f.ring.map(normalize3),
        centerPlanar: mean3(f.ring),
        centerSphere: normalize3(f.centre)
      },
      segments,
      borders,
      fills,
      {quintant: -1, sides: f.ring.length}
    );
  }
  return {borders, fills};
}
