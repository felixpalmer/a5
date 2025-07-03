import { vec3, glMatrix } from "gl-matrix";
glMatrix.setMatrixArrayType(Float64Array as any);
import type { Radians, Cartesian, Face } from "./coordinate-systems";

// IVEA (Icosahedral Vertex Equal Area) projection implementation
// Based on DGGAL project: icoVertexGreatCircle.ec (vector-based implementation)
//
// BSD 3-Clause License
// Copyright (c) 2024, A5 Project Contributors
// All rights reserved.

// IVEA configuration constants
const IVEA_VA = 0;  // Vertex A index (midpoint)
const IVEA_VB = 1;  // Vertex B index (triangle vertex)  
const IVEA_VC = 2;  // Vertex C index (center)

// Spherical triangle area for SDT triangles (6 degrees)
const SDT_TRIANGLE_AREA = (6 * Math.PI) / 180 as Radians;

export type Barycentric = [number, number, number] & { __brand: 'Barycentric' };
export type FaceTriangle = [Face, Face, Face];
export type SphericalTriangle = [Cartesian, Cartesian, Cartesian];

// Pre-allocated vectors for midpoints. midA is the midpoint opposite the vertex A
const midA = vec3.create();
const midB = vec3.create();
const midC = vec3.create();

/**
 * Calculates the area of a spherical triangle using vector operations
 * From https://arxiv.org/abs/1307.2567 as summarized in
 * https://brsr.github.io/2021/05/01/vector-spherical-geometry.html
 */
function sphericalTriArea(A: Cartesian, B: Cartesian, C: Cartesian): Radians {
  // Calculate midpoints
  vec3.add(midA, B, C);
  vec3.add(midB, C, A);
  vec3.add(midC, A, B);
  vec3.normalize(midA, midA);
  vec3.normalize(midB, midB);
  vec3.normalize(midC, midC);
  
  // Compute scalar triple product of midpoints. This is the (signed) volume
  // of the parallelepiped defined by the three midpoints.
  const crossBC = vec3.create();
  vec3.cross(crossBC, midB, midC);
  const tripleProduct = vec3.dot(midA, crossBC);

  // Calculate area using asin of dot product, clamped to valid range
  const clamped = Math.max(-1.0, Math.min(1.0, tripleProduct));
  return Math.asin(clamped) * 2 as Radians;
}

function cartesianToBary(p: [number, number], [p1, p2, p3]: FaceTriangle): Barycentric {
  const d31: [number, number] = [p1[0] - p3[0], p1[1] - p3[1]];
  const d23: [number, number] = [p3[0] - p2[0], p3[1] - p2[1]];
  const d3p: [number, number] = [p[0] - p3[0], p[1] - p3[1]];
  const oDet = 1 / (d23[0] * d31[1] - d23[1] * d31[0]);

  const b0 = (d23[0] * d3p[1] - d23[1] * d3p[0]) * oDet;
  const b1 = (d31[0] * d3p[1] - d31[1] * d3p[0]) * oDet;
  const b2 = 1 - b0 - b1;
  
  return [b0, b1, b2] as Barycentric;
}

function baryToCartesian(b: [number, number, number], p: [number, number], [p1, p2, p3]: FaceTriangle) {
  p[0] = b[0] * p1[0] + b[1] * p2[0] + b[2] * p3[0];
  p[1] = b[0] * p1[1] + b[1] * p2[1] + b[2] * p3[1];
}

// Port of forwardVector from the reference implementation
function forwardVector(
  v: Cartesian,
  sphericalTriangle: SphericalTriangle,
  faceTriangle: FaceTriangle,
  out: [number, number]
): void {
  const [A, B, C] = sphericalTriangle;
  const c1 = vec3.create();
  const c2 = vec3.create();
  const p = vec3.create();
  
  vec3.cross(c1, A, v);
  vec3.cross(c2, B, C);
  vec3.cross(p, c1, c2);
  vec3.normalize(p, p);
  
  const h = Math.sqrt((1 - vec3.dot(A, v)) / (1 - vec3.dot(A, p)));

  const Area_ABC = sphericalTriArea(A, B, C);
  // const scaledArea = h * sphericalTriArea(A, B, p as Cartesian) / SDT_TRIANGLE_AREA;
  const scaledArea = h * sphericalTriArea(A, B, p as Cartesian) / Area_ABC;
  const b: [number, number, number] = [1 - h, h - scaledArea, scaledArea];
  
  baryToCartesian(b, out, faceTriangle);
}

// Port of inverseVector from the reference implementation
function inverseVector(
  pi: [number, number],
  faceTriangle: FaceTriangle,
  sphericalTriangle: SphericalTriangle
): Cartesian {
  console.log('inverseVector called with pi:', pi);
  const [A, B, C] = sphericalTriangle;
  console.log('sphericalTriangle vertices:', { A, B, C });
  const b = cartesianToBary(pi, faceTriangle);
  console.log('b', b);
  
  // Early returns for vertices
  //if (b[0] > 1 - 1e-11) return A;
  //if (b[1] > 1 - 1e-11) return B;
  //if (b[2] > 1 - 1e-11) return C;
  
  const c1 = vec3.create();
  console.log('c1 created');
  vec3.cross(c1, B, C);
  console.log('c1 after cross:', c1);
  
  const Area_ABC = sphericalTriArea(A, B, C);
  console.log('Area_ABC', Area_ABC);
  const h = 1 - b[0];
  console.log('h:', h);
  const R = h ? b[2] / h : 0; // ?????
  const S = Math.sin(R * Area_ABC);
  console.log('S:', S);
  const c01 = vec3.dot(A, B);
  console.log('c01:', c01);
  const c12 = vec3.dot(B, C);
  console.log('c12:', c12);
  const c20 = vec3.dot(C, A);
  console.log('c20:', c20);
  const s12 = Math.sqrt(1 - c12 * c12);
  console.log('s12:', s12);
  const V = vec3.dot(A, c1);
  console.log('V:', V);
  const CC = 1 - Math.sqrt(1 - S * S);
  console.log('CC:', CC);
  const f = S * V + CC * (c01 * c12 - c20);
  console.log('f:', f);
  const g = CC * s12 * (1 + c01);
  console.log('g:', g);
  const f2 = f * f, g2 = g * g, gf = g * f;
  console.log('f2, g2, gf:', { f2, g2, gf });
  const oos12tf2pg2 = Math.abs(f2 + g2) > 1e-11 && Math.abs(s12) > 1e-11 ? 1.0 / (s12 * (f2 + g2)) : 0;
  console.log('oos12tf2pg2:', oos12tf2pg2);
  let ap = oos12tf2pg2 ? (s12 * (f2 - g2) - 2 * gf * c12) * oos12tf2pg2 : 1;
  console.log('ap before check:', ap);
  let bp = oos12tf2pg2 ? 2 * gf * oos12tf2pg2 : 0;
  console.log('bp before check:', bp);
  
  if (ap < 1e-5) {
    console.log('ap < 1e-5, setting ap=0, bp=1');
    ap = 0;
    bp = 1;
  }
  console.log('ap, bp after check:', { ap, bp });
  
  const p = vec3.create();
  console.log('p created');
  p[0] = ap * B[0] + bp * C[0];
  console.log('p[0]:', p[0]);
  p[1] = ap * B[1] + bp * C[1];
  console.log('p[1]:', p[1]);
  p[2] = ap * B[2] + bp * C[2];
  console.log('p[2]:', p[2]);
  console.log('p vector:', p);
  
  const av = vec3.dot(A, p);
  console.log('av:', av);
  const av2 = av * av;
  console.log('av2:', av2);
  const bv = 1 + h * h * (av - 1);
  console.log('bv:', bv);
  const bv2 = bv * bv;
  console.log('bv2:', bv2);
  const bvp = Math.sqrt((1 - bv2) / (1 - av2));
  console.log('bvp:', bvp);
  const avp = bv - av * bvp;
  console.log('avp:', avp);
  
  const result = vec3.create();
  console.log('result created');
  result[0] = avp * A[0] + bvp * p[0];
  console.log('result[0]:', result[0]);
  result[1] = avp * A[1] + bvp * p[1];
  console.log('result[1]:', result[1]);
  result[2] = avp * A[2] + bvp * p[2];
  console.log('result[2]:', result[2]);
  console.log('final result:', result);
  
  return result as Cartesian;
}

export { cartesianToBary, baryToCartesian, forwardVector, inverseVector }; 