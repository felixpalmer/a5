// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {getQuintantVertices} from 'a5/core/tiling';
import {origins} from 'a5/core/origin';
import {PENTAGON, BASIS_INVERSE} from 'a5/core/pentagon';

import {type V3, liftToFace, mean3, normalize3} from '../tiling/geometry';

// Class II icosahedral geodesic polyhedra {3,5+}m,m and the A5 pentagonal
// tiling read as an operation on them.
//
// The geodesic (m,m) is the pentakis dodecahedron with every edge of its 60
// triangles divided into m. Each pentakis triangle is an A5 quintant, and its
// subdivision is exactly the lattice A5 places its pentagons on (the quintant
// triangle's edges ARE the A5 lattice basis), so for m = 2^r the two share
// everything but their edges.
//
// The A5 tiling at resolution r + 1 is then the geodesic (2^r, 2^r) put through:
//
//   1. Merge. Delete every geodesic edge parallel to the dodecahedron edge of
//      its quintant (the dodecahedron edges included). The triangles pair up
//      into rhombi and what is left is a quadrangulation R — the rhombic
//      triacontahedron jD with each rhombus ruled into an m × m grid.
//   2. Gyro. R is the join of some polyhedron Q (every quadrangulation of the
//      sphere is bipartite: one colour class is Q's vertices, the other its
//      face centres), and the A5 tiling is gQ. Gyro turns every edge of Q
//      into two degree-3 vertices, i.e. every rhombus of R into one new vertex
//      per triangle, and every edge of R into a pentagon.
//
// For m = 2^r that is Q = o^r D and A5 = g o^r D (r = 0, A5 resolution 1,
// gives gD, the pentagonal hexecontahedron). Nothing in either step needs m to be a power of
// two, so the same operation extends the tiling to every (m,m).
//
// A new vertex joins its triangle's apex (the corner opposite the deleted
// edge), one end of the deleted edge — the next one counter-clockwise when the
// apex is in the colour class of the dodecahedron vertices, clockwise
// otherwise, which is gyro's single chirality — and the new vertex of the
// triangle it was merged with. (For even m the face centres share the
// vertices' colour; for odd m — m = 1 is A5 resolution 1 — they don't, and
// the rule read from the face centres would give the other mirror image.) It
// sits at a fixed barycentric position in its triangle. A5's four pentagon flavors are this one rule seen from the lattice:
// the two triangles of a rhombus are 180° turns of each other (flavor bit 0),
// and the colour of the apex alternates from one row of rhombi to the next,
// swapping which diagonal of the rhombus is Q's edge (flavor bit 1, a mirror
// image in the plane but the same chirality on the sphere).

// Barycentric weights of the new vertex on (apex, joined end, other end), read
// off A5's own pentagon: its vertex e lies in the unit lattice triangle whose
// apex is the lattice origin, joined to the (0, 1) corner. Its lattice
// coordinates are therefore the weights of the two other corners.
const [W_OTHER, W_JOINED] = (() => {
  const e = PENTAGON.getVertices()[4];
  const b = BASIS_INVERSE;
  return [b[0] * e[0] + b[2] * e[1], b[1] * e[0] + b[3] * e[1]];
})();
const W_APEX = 1 - W_OTHER - W_JOINED;

// The Catalan pentakis dodecahedron — the polar dual of the truncated
// icosahedron — so the planar layout is a convex solid whose apexes sit
// slightly inside the sphere through the dodecahedron vertices. The truncated
// icosahedron's faces lie at distance (2 + 1/√5)/3 (pentagons, cut a third of
// the way along the unit icosahedron's edges) and c (hexagons, c the
// icosahedron's inradius/circumradius ratio); polar duality inverts those
// distances, and scaling the dodecahedron vertices to radius 1 — as in the
// Tiling example — leaves the apexes at c / ((2 + 1/√5)/3) ≈ 0.974.
const ICOSA_IN_OVER_CIRCUM = Math.sqrt((5 + 2 * Math.sqrt(5)) / 15);
export const APEX_RADIUS = ICOSA_IN_OVER_CIRCUM / ((2 + 1 / Math.sqrt(5)) / 3);

export type PentakisFace = {quintant: number; corners: V3[]};

// The 60 faces of the pentakis dodecahedron, on the same dodecahedron as the
// Tiling example: each A5 quintant triangle lifted onto its face, with the face
// centre raised to the apex. `apexRadius` null leaves it flat on the face,
// which is A5's own layout.
export function pentakisFaces(apexRadius: number | null = APEX_RADIUS): PentakisFace[] {
  const faces: PentakisFace[] = [];
  for (const origin of origins) {
    const lift = liftToFace(origin);
    for (let quintant = 0; quintant < 5; quintant++) {
      const [u, v, w] = getQuintantVertices(quintant)
        .getVertices()
        .map(p => [p[0], p[1]] as [number, number]);
      let apex = lift(u);
      if (apexRadius !== null) {
        const c = normalize3(apex);
        apex = [c[0] * apexRadius, c[1] * apexRadius, c[2] * apexRadius];
      }
      faces.push({quintant, corners: [apex, lift(v), lift(w)]});
    }
  }
  return faces;
}

// One triangle of the geodesic. corners[0] is the apex; corners[1] and
// corners[2] span the edge parallel to the quintant's dodecahedron edge, which
// the pentagonal operation deletes. `down` marks the triangles pointing away
// from the face centre.
export type GeoTri = {quintant: number; down: boolean; corners: V3[]; keys: string[]};

function lerp3(a: V3, b: V3, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// Divide every edge of a pentakis triangle into m, giving m² triangles, in the
// A5 lattice of the quintant: point (i, j) is apex + i/m (v - apex) + j/m
// (w - apex). Points are identified by their direction from the origin — the
// sphere is where the two copies of a vertex on a shared pentakis edge must
// coincide — through `weld`, shared by all the faces.
export function subdivideTriangle(face: PentakisFace, m: number, weld: (p: V3) => string): GeoTri[] {
  const [a, b, c] = face.corners;
  const at = (i: number, j: number): V3 => {
    const p = lerp3(a, b, i / m);
    const q = lerp3(a, c, j / m);
    return [p[0] + q[0] - a[0], p[1] + q[1] - a[1], p[2] + q[2] - a[2]];
  };
  const tri = (down: boolean, corners: V3[]): GeoTri => ({
    quintant: face.quintant,
    down,
    corners,
    keys: corners.map(p => weld(normalize3(p)))
  });
  const out: GeoTri[] = [];
  for (let i = 0; i < m; i++) {
    for (let j = 0; i + j < m; j++) {
      out.push(tri(false, [at(i, j), at(i + 1, j), at(i, j + 1)]));
      if (i + j < m - 1) out.push(tri(true, [at(i + 1, j + 1), at(i + 1, j), at(i, j + 1)]));
    }
  }
  return out;
}

export type PentagonCell = {
  ringPlanar: V3[];
  ringSphere: V3[];
  tri: number; // the geodesic triangle the pentagon belongs to
  flavor: number; // A5 flavor: bit 0 the rhombus half, bit 1 the apex colour
  quintant: number;
};

export type Pentagonal = {cells: PentagonCell[]};

// The rhombic grid R = jQ of the merge step — every triangle keeps its two
// edges at the apex — and its 2-colouring. Colour 0 holds the dodecahedron
// vertices and is Q's vertex class; colour 1 is Q's face centres.
type RhombicGrid = {
  position: Map<string, V3>;
  neighbours: Map<string, Set<string>>;
  colour: Map<string, number>;
};

function rhombicGrid(tris: GeoTri[]): RhombicGrid {
  const position = new Map<string, V3>();
  const rNeighbours = new Map<string, Set<string>>();
  const link = (x: string, y: string) => {
    let s = rNeighbours.get(x);
    if (!s) rNeighbours.set(x, (s = new Set()));
    s.add(y);
  };
  for (const t of tris) {
    t.keys.forEach((k, i) => position.set(k, t.corners[i]));
    for (const k of [1, 2]) {
      const [x, y] = [t.keys[0], t.keys[k]];
      if (rNeighbours.get(x)?.has(y)) continue;
      link(x, y);
      link(y, x);
    }
  }

  // 2-colour R, starting from a dodecahedron vertex: the only vertices of R
  // with three neighbours (face centres have five, grid points four).
  let seed = '';
  for (const [x, nbrs] of rNeighbours) {
    if (nbrs.size === 3) {
      seed = x;
      break;
    }
  }
  const colour = new Map<string, number>([[seed, 0]]);
  const queue = [seed];
  while (queue.length) {
    const x = queue.pop()!;
    for (const y of rNeighbours.get(x) ?? []) {
      const c = colour.get(y);
      if (c === undefined) {
        colour.set(y, 1 - colour.get(x)!);
        queue.push(y);
      }
    }
  }
  return {position, neighbours: rNeighbours, colour};
}

// The pentagonal operation on a subdivided pentakis dodecahedron (see top).
// The colouring starts from a dodecahedron vertex, whose colour class fixes
// which of the two mirror images comes out (A5's, see the chirality rule).
export function pentagonalize(tris: GeoTri[]): Pentagonal {
  // 1. Merge: pair every triangle with the one across its deleted edge.
  const byDiagonal = new Map<string, number[]>();
  tris.forEach((t, i) => {
    const key = t.keys[1] < t.keys[2] ? `${t.keys[1]}|${t.keys[2]}` : `${t.keys[2]}|${t.keys[1]}`;
    let pair = byDiagonal.get(key);
    if (!pair) byDiagonal.set(key, (pair = []));
    pair.push(i);
  });
  const partner = new Int32Array(tris.length).fill(-1);
  for (const pair of byDiagonal.values()) {
    if (pair.length !== 2) continue;
    partner[pair[0]] = pair[1];
    partner[pair[1]] = pair[0];
  }

  const {position, colour} = rhombicGrid(tris);

  // 2. Gyro: one new vertex per triangle, joined to its apex, to one end of
  // its deleted edge, and to its partner's new vertex.
  const lattice = [...position.keys()];
  const nodeOf = new Map(lattice.map((k, i) => [k, i]));
  const nL = lattice.length;
  const pos: V3[] = lattice.map(k => position.get(k)!);
  const adj: number[][] = lattice.map(() => []);
  const joined: number[] = [];
  tris.forEach((t, i) => {
    const [a, b, c] = t.corners;
    // Orientation of (a, b, c) seen from outside.
    const ab: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const g = mean3(t.corners);
    const ccw =
      g[0] * (ab[1] * ac[2] - ab[2] * ac[1]) +
        g[1] * (ab[2] * ac[0] - ab[0] * ac[2]) +
        g[2] * (ab[0] * ac[1] - ab[1] * ac[0]) >
      0;
    const k = ccw === (colour.get(t.keys[0]) === 0) ? 1 : 2;
    const conn = t.corners[k];
    const other = t.corners[3 - k];
    pos.push([
      W_APEX * a[0] + W_JOINED * conn[0] + W_OTHER * other[0],
      W_APEX * a[1] + W_JOINED * conn[1] + W_OTHER * other[1],
      W_APEX * a[2] + W_JOINED * conn[2] + W_OTHER * other[2]
    ]);
    joined.push(nodeOf.get(t.keys[k])!);
    adj.push([]);
  });
  const edge = (x: number, y: number) => {
    adj[x].push(y);
    adj[y].push(x);
  };
  tris.forEach((t, i) => {
    const p = nL + i;
    edge(p, nodeOf.get(t.keys[0])!);
    edge(p, joined[i]);
    if (partner[i] > i) edge(p, nL + partner[i]);
  });

  // Faces, by walking the embedding: order every vertex's neighbours around
  // it on the sphere, then follow each directed edge to the next one around.
  const dir = pos.map(normalize3);
  const order = adj.map((nbrs, x) => {
    const n = dir[x];
    const ref: V3 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const d = ref[0] * n[0] + ref[1] * n[1] + ref[2] * n[2];
    const e1 = normalize3([ref[0] - d * n[0], ref[1] - d * n[1], ref[2] - d * n[2]]);
    const e2: V3 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]];
    const angle = (y: number) => {
      const v = [dir[y][0] - n[0], dir[y][1] - n[1], dir[y][2] - n[2]];
      return Math.atan2(v[0] * e2[0] + v[1] * e2[1] + v[2] * e2[2], v[0] * e1[0] + v[1] * e1[1] + v[2] * e1[2]);
    };
    return [...nbrs].sort((y, z) => angle(y) - angle(z));
  });
  const seen = new Set<string>();
  const cells: PentagonCell[] = [];
  for (let x = 0; x < pos.length; x++) {
    for (const y of adj[x]) {
      if (seen.has(`${x},${y}`)) continue;
      const ring: number[] = [];
      let [u, v] = [x, y];
      while (!seen.has(`${u},${v}`) && ring.length <= 12) {
        seen.add(`${u},${v}`);
        ring.push(u);
        const around = order[v];
        const w = around[(around.indexOf(u) + around.length - 1) % around.length];
        [u, v] = [v, w];
      }
      if (ring.length !== 5) continue;
      // The pentagon's own triangle: the new vertex whose partner shares the
      // pentagon and whose apex is one of its corners.
      const onRing = new Set(ring);
      const tri =
        ring
          .filter(q => q >= nL)
          .map(q => q - nL)
          .find(i => onRing.has(nL + partner[i]) && onRing.has(nodeOf.get(tris[i].keys[0])!)) ?? -1;
      const t = tris[tri];
      cells.push({
        ringPlanar: ring.map(q => pos[q]),
        ringSphere: ring.map(q => dir[q]),
        tri,
        flavor: t ? 2 * colour.get(t.keys[0])! + (t.down ? 1 : 0) : 0,
        quintant: t ? t.quintant : 0
      });
    }
  }
  return {cells};
}

// The polyhedron Q = oₙD the merge step finds (see top), read off the
// rhombic grid R = jQ: every colour 1 vertex of R is a face centre of Q, and
// its neighbours in R, in order around it, are that face's corners. n = 1
// gives D itself, n = 2 the deltoidal hexecontahedron oD.
export type QuadFace = {ring: V3[]; centre: V3};

export function orthoFaces(tris: GeoTri[]): QuadFace[] {
  const {position, neighbours, colour} = rhombicGrid(tris);
  const faces: QuadFace[] = [];
  for (const [x, c] of colour) {
    if (c !== 1) continue;
    const centre = position.get(x)!;
    const n = normalize3(centre);
    const ref: V3 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const d = ref[0] * n[0] + ref[1] * n[1] + ref[2] * n[2];
    const e1 = normalize3([ref[0] - d * n[0], ref[1] - d * n[1], ref[2] - d * n[2]]);
    const e2: V3 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]];
    const angle = (p: V3) => {
      const v = [p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]];
      return Math.atan2(v[0] * e2[0] + v[1] * e2[1] + v[2] * e2[2], v[0] * e1[0] + v[1] * e1[1] + v[2] * e1[2]);
    };
    const ring = [...neighbours.get(x)!].map(y => position.get(y)!).sort((p, q) => angle(p) - angle(q));
    faces.push({ring, centre});
  }
  return faces;
}
