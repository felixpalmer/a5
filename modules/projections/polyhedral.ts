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
import {vec3, glMatrix} from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import type {Cartesian, Face, Barycentric, FaceTriangle, SphericalTriangle} from '../core/coordinate-systems';
import {faceToBarycentric, barycentricToFace} from '../core/coordinate-transforms';
import {sphericalTriangleArea} from '../geometry/spherical-polygon';
import {vectorDifference, quadrupleProduct, slerp} from '../utils/vector';

// Per-instance scratch buffers — forward/inverse are on the lonLatToCell hot
// path, so we avoid vec3.create() per call. Per-instance (not module-scoped)
// keeps the projection re-entrant across DodecahedronProjection instances.
const _Z = vec3.create() as Cartesian;
const _p = vec3.create() as Cartesian;
const _c1 = vec3.create() as Cartesian;
const _P = vec3.create() as Cartesian;

export class PolyhedralProjection {
  /**
   * Forward projection: converts a spherical point to face coordinates
   * @param v - The spherical point to project
   * @param sphericalTriangle - The spherical triangle vertices
   * @param faceTriangle - The face triangle vertices
   * @returns The face coordinates
   */
  forward(v: Cartesian, sphericalTriangle: SphericalTriangle, faceTriangle: FaceTriangle): Face {
    const [A, B, C] = sphericalTriangle;

    // When v is close to A, the quadruple product is unstable.
    // As we just need the intersection of two great circles we can use difference
    // between A and v, as it lies in the same plane of the great circle containing A & v
    vec3.subtract(_Z, v, A);
    vec3.normalize(_Z, _Z);
    const p = quadrupleProduct(_p, A, _Z, B, C);
    vec3.normalize(p, p);

    const h = vectorDifference(A, v) / vectorDifference(A, p);
    const Area_ABC = sphericalTriangleArea(A, B, C);
    const scaledArea = h / Area_ABC;
    const b = [
      1 - h,
      scaledArea * sphericalTriangleArea(A, p, C),
      scaledArea * sphericalTriangleArea(A, B, p)
    ] as Barycentric;
    return barycentricToFace(b, faceTriangle);
  }

  /**
   * Inverse projection: converts face coordinates back to spherical coordinates
   * @param facePoint - The face coordinates
   * @param faceTriangle - The face triangle vertices
   * @param sphericalTriangle - The spherical triangle vertices
   * @returns The spherical coordinates
   */
  inverse(facePoint: Face, faceTriangle: FaceTriangle, sphericalTriangle: SphericalTriangle): Cartesian {
    const [A, B, C] = sphericalTriangle;
    const b = faceToBarycentric(facePoint, faceTriangle);

    const threshold = 1 - 1e-14;
    if (b[0] > threshold) return A;
    if (b[1] > threshold) return B;
    if (b[2] > threshold) return C;

    vec3.cross(_c1, B, C);
    const Area_ABC = sphericalTriangleArea(A, B, C);
    const h = 1 - b[0];
    const R = b[2] / h;
    const alpha = R * Area_ABC;
    const S = Math.sin(alpha);
    const halfC = Math.sin(alpha / 2);
    const CC = 2 * halfC * halfC; // Half angle formula

    const c01 = vec3.dot(A, B);
    const c12 = vec3.dot(B, C);
    const c20 = vec3.dot(C, A);
    const s12 = vec3.length(_c1);

    const V = vec3.dot(A, _c1); // Triple product of A, B, C. Constant??
    const f = S * V + CC * (c01 * c12 - c20);
    const g = CC * s12 * (1 + c01);
    const q = (2 / Math.acos(c12)) * Math.atan2(g, f);
    const P = slerp(_P, B, C, q);
    const K = vectorDifference(A, P);
    const t = this.safeAcos(h * K) / this.safeAcos(K);
    // `out` is returned to the caller, which immediately reads it via
    // toSpherical — so it must be a fresh allocation, not a scratch buffer.
    const out = slerp(vec3.create() as Cartesian, A, P, t);
    return out;
  }

  /**
   * Computes acos(1 - 2 * x * x) without loss of precision for small x
   * @param x
   * @returns acos(1 - x)
   */
  private safeAcos(x: number): number {
    if (x < 1e-3) {
      return 2 * x + (x * x * x) / 3;
    } else {
      return Math.acos(1 - 2 * x * x);
    }
  }
}
