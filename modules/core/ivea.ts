// IVEA (Icosahedral Vertex Equal Area) projection implementation
// Adaptation of icoVertexGreatCircle.ec from DGGAL project
// BSD 3-Clause License
// 
// Copyright (c) 2014-2025, Ecere Corporation
// 
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
// 
// 1. Redistributions of source code must retain the above copyright notice, this
//    list of conditions and the following disclaimer.
// 
// 2. Redistributions in binary form must reproduce the above copyright notice,
//    this list of conditions and the following disclaimer in the documentation
//    and/or other materials provided with the distribution.
// 
// 3. Neither the name of the copyright holder nor the names of its
//    contributors may be used to endorse or promote products derived from
//    this software without specific prior written permission.
// 
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
// FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
// DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
// SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
// CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
// OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
// BSD 3-Clause License
// Copyright (c) 2024, A5 Project Contributors
// All rights reserved.
import { vec3, glMatrix } from "gl-matrix";
glMatrix.setMatrixArrayType(Float64Array as any);
import type { Radians, Cartesian, Face, Barycentric, FaceTriangle, SphericalTriangle } from "./coordinate-systems";
import { faceToBarycentric, barycentricToFace } from "./coordinate-transforms";

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
  vec3.lerp(midA, B, C, 0.5);
  vec3.lerp(midB, C, A, 0.5);
  vec3.lerp(midC, A, B, 0.5);
  vec3.normalize(midA, midA);
  vec3.normalize(midB, midB);
  vec3.normalize(midC, midC);
  
  // Compute scalar triple product of midpoints.
  const crossBC = vec3.create();
  vec3.cross(crossBC, midB, midC);
  const tripleProduct = vec3.dot(midA, crossBC);

  // Calculate area using asin of dot product, clamped to valid range
  const clamped = Math.max(-1.0, Math.min(1.0, tripleProduct));
  
  // sin(x) = x for x < 1e-8
  if (Math.abs(clamped) < 1e-8) {
    return 2 * clamped as Radians;
  } else {
    return Math.asin(clamped) * 2 as Radians;
  }
}

const midpointAB = vec3.create() as Cartesian;
/**
 * Returns a difference measure between two vectors, a - b
 * D = sqrt(1 - dot(a,b))
 * D = 1: a and b are perpendicular
 * D = 0: a and b are the same
 * D = NaN: a and b are opposite (shouldn't happen in IVEA as we're using normalized vectors in the same hemisphere)
 * 
 * D is a measure of the angle between the two vectors.
 * 
 * @param A - The first vector
 * @param B - The second vector
 * @returns The difference between the two vectors
 */
function vectorDifference(A: Cartesian, B: Cartesian): number {
  // Original implementation is unstable for small angles as dot(A, B) approaches 1
  //return Math.sqrt(1 - vec3.dot(A, B));

  // dot(A, B) = cos(x) as A and B are normalized
  // Using double angle formula for cos(2x) = 1 - 2sin(x)^2, can rewrite as:
  // 1 - cos(x) = 2 * sin(x/2)^2)
  //            = 2 * sin(x/2)^2
  // ⇒ sqrt(1 - cos(x)) = 2 * sin(x/2) 
  //                    = sin(x/2) [drop factor of 2 as we will only ever compare vector difference ratios]
  // Angle x/2 can be obtained as the angle between A and the normalized midpoint of A and B
  // ⇒ sin(x/2) = |cross(A, midpointAB)|
  vec3.lerp(midpointAB, A, B, 0.5);
  vec3.normalize(midpointAB, midpointAB);
  vec3.cross(midpointAB, A, midpointAB);
  const D = vec3.length(midpointAB);

  // Math.sin(x) = x for x < 1e-8
  if (D < 1e-8) {
    // When A and B are close or equal sin(x/2) ≈ x/2, just take the half-distance between A and B
    const AB = vec3.subtract(vec3.create(), A, B);
    const halfDistance = 0.5 * vec3.length(AB);
    return halfDistance;
  }
  return D;
}

const crossCD = vec3.create();
const scaledA = vec3.create();
const scaledB = vec3.create();
function quadrupleProduct(A: Cartesian, B: Cartesian, C: Cartesian, D: Cartesian): Cartesian {
  vec3.cross(crossCD, C, D);
  const tripleProductACD = vec3.dot(A, crossCD);
  const tripleProductBCD = vec3.dot(B, crossCD);
  vec3.scale(scaledA, A, tripleProductBCD);
  vec3.scale(scaledB, B, tripleProductACD);
  return vec3.sub(vec3.create(), scaledB, scaledA) as Cartesian;
}

function slerp(A: Cartesian, B: Cartesian, t: number): Cartesian {
  const gamma = vec3.angle(A, B);
  const weightA = Math.sin((1 - t) * gamma) / Math.sin(gamma);
  const weightB = Math.sin(t * gamma) / Math.sin(gamma);
  const scaledA = vec3.scale(vec3.create(), A, weightA);
  const scaledB = vec3.scale(vec3.create(), B, weightB);
  return vec3.add(vec3.create(), scaledA, scaledB) as Cartesian;
}

// Port of forwardVector from the reference implementation
function forwardVector(
  v: Cartesian,
  sphericalTriangle: SphericalTriangle,
  faceTriangle: FaceTriangle,
  disableLinear: boolean = false
): Face {
  const [A, B, C] = sphericalTriangle;

  // This actually reduces accuracy, perhaps there is a bug?
  // const delta = vec3.subtract(vec3.create(), v, A);
  // const SAFE = 0.00036;
  // const LINEAR = vec3.length(delta) < SAFE;
  // if (LINEAR && !disableLinear) {
  //   console.log('LINEAR');
  //   const small = vec3.length(delta)
  //   const scale = SAFE / small;
  //   const adjustedV = vec3.scaleAndAdd(vec3.create(), A, delta, scale) as Cartesian;
  //   console.log('adjustedV', adjustedV);
  //   vec3.normalize(adjustedV, adjustedV);

  //   const projectedV = [0, 0] as [number, number];
  //   forwardVector(adjustedV, sphericalTriangle, faceTriangle, projectedV, true);

  //   const projectedA = [0, 0] as [number, number];
  //   forwardVector(A, sphericalTriangle, faceTriangle, projectedA, true);
  //   console.log('projectedA', projectedA);
  //   console.log('projectedV', projectedV);

  //   const f = small / SAFE; // 0 at A, 1 at adjectedV
  //   return vec2.lerp(vec2.create(), projectedA, projectedV, f) as [number, number];
  // }

  const p = quadrupleProduct(A, v, B, C);
  vec3.normalize(p, p);

  const h = vectorDifference(A, v) / vectorDifference(A, p);
  const Area_ABC = sphericalTriArea(A, B, C);
  const scaledArea = h / Area_ABC;
  const b = [
    1 - h,
    scaledArea * sphericalTriArea(A, p, C as Cartesian),
    scaledArea * sphericalTriArea(A, B, p as Cartesian)
  ] as Barycentric;
  return barycentricToFace(b, faceTriangle);
}

function inverseVector(
  facePoint: Face,
  faceTriangle: FaceTriangle,
  sphericalTriangle: SphericalTriangle,
  disableLinear: boolean = false
): Cartesian {
  const [A, B, C] = sphericalTriangle;
  const b = faceToBarycentric(facePoint, faceTriangle);

  const threshold = 1 - 1e-14;
  if (b[0] > threshold) return A;
  if (b[1] > threshold) return B;
  if (b[2] > threshold) return C;
  
  // Linear approx when b[0] is close to 1
  const SAFE = 0.999;
  const LINEAR = b[0] > SAFE;
  if (LINEAR && !disableLinear) {
    let [_, b1, b2] = b;
    const small = Math.abs(b1) + Math.abs(b2);
    const scale = (1 - SAFE) / small;
    const _b1 = b1 * scale;
    const _b2 = b2 * scale;
    const _b0 = SAFE;
    const _b = [_b0, _b1, _b2] as Barycentric;
    const adjustedPi = barycentricToFace(_b, faceTriangle);

    const V = inverseVector(adjustedPi, faceTriangle, sphericalTriangle, true);
    vec3.normalize(V, V);
    const f = (b[0] - SAFE) / (1 - SAFE);
    const out = vec3.lerp(vec3.create(), V, A, f) as Cartesian;
    vec3.normalize(out, out);
    return out;
  }

  const c1 = vec3.create();
  vec3.cross(c1, B, C);
  const Area_ABC = sphericalTriArea(A, B, C);
  const h = 1 - b[0];
  const R = b[2] / h;
  const alpha = R * Area_ABC;
  const S = Math.sin(alpha);
  const halfC = Math.sin(alpha / 2);
  const CC = 2 * halfC * halfC; // Half angle formula

  const c01 = vec3.dot(A, B);
  const c12 = vec3.dot(B, C);
  const c20 = vec3.dot(C, A);
  const s12 = vec3.length(c1);

  const V = vec3.dot(A, c1); // Triple product of A, B, C. Constant??
  const f = S * V + CC * (c01 * c12 - c20);
  const g = CC * s12 * (1 + c01);
  const q = (2 / Math.acos(c12)) * Math.atan2(g, f);
  const P = slerp(B, C, q);
  const dotAp = vec3.dot(A, P);
  const t = Math.acos(1 + h * h * (dotAp - 1)) / Math.acos(dotAp);
  const out = slerp(A, P, t);
  return out;
}

export { forwardVector, inverseVector }; 