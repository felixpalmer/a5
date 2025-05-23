// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { vec2, mat2, glMatrix } from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import {distanceToEdge, PI_OVER_10, PI_OVER_5} from './constants';    
import {PentagonShape} from './utils';
import type { Face, LonLat, Degrees } from "./coordinate-systems";

// Pentagon vertex angles
const A = 72 as Degrees;
const B = 127.94543761193603 as Degrees;
const C = 108 as Degrees;
const D = 82.29202980963508 as Degrees;
const E = 149.7625318412527 as Degrees;

let a: Face = [0, 0] as Face;
let b: Face = [0, 1] as Face;
// c & d calculated by circle intersections. Perhaps can obtain geometrically.
let c: Face = [0.7885966681787006, 1.6149108024237764] as Face;
let d: Face = [1.6171013659387945, 1.054928690397459] as Face;
let e: Face = [Math.cos(PI_OVER_10), Math.sin(PI_OVER_10)] as Face;

// Distance to edge midpoint
const edgeMidpointD = 2 * vec2.length(c) * Math.cos(PI_OVER_5);

// Lattice growth direction is AC, want to rotate it so that it is parallel to x-axis
const BASIS_ROTATION = PI_OVER_5 - Math.atan2(c[1], c[0]); // -27.97 degrees

// Scale to match unit sphere
const scale = 2 * distanceToEdge / edgeMidpointD;
[a,b,c,d,e].forEach(v => {
  vec2.scale(v, v, scale);
  vec2.rotate(v, v, [0, 0], BASIS_ROTATION);
});

/**
 * Definition of pentagon used for tiling the plane.
 * While this pentagon is not equilateral, it forms a tiling with 5 fold
 * rotational symmetry and thus can be used to tile a regular pentagon.
 */
const PENTAGON = new PentagonShape([a, b, c, d, e]);

const bisectorAngle = Math.atan2(c[1], c[0]) - PI_OVER_5;

// Define triangle also, as UVW
const u: Face = [0, 0] as Face;
const L = distanceToEdge / Math.cos(PI_OVER_5);

const V = bisectorAngle + PI_OVER_5;
const v: Face = [L * Math.cos(V), L * Math.sin(V)] as Face;

const W = bisectorAngle - PI_OVER_5;
const w: Face = [L * Math.cos(W), L * Math.sin(W)] as Face;
const TRIANGLE = new PentagonShape([u, v, w, w, w]); // TODO hacky, don't pretend this is pentagon

/**
 * Basis vectors used to layout primitive unit
 */
const BASIS: mat2 = mat2.fromValues(v[0], v[1], w[0], w[1]);
const BASIS_INVERSE: mat2 = mat2.invert(mat2.create(), BASIS);

export {A, B, C, D, E, a, b, c, d, e, PENTAGON, u, v, w, V, TRIANGLE, BASIS, BASIS_INVERSE};
