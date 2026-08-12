// Copyright (c) 2024, A5 Project Contributors
// All rights reserved.
import * as vec2 from '../math/vec2';
import * as vec3 from '../math/vec3';
import * as mat2d from '../math/mat2d';
import type {Mat2d} from '../math/types';
import type {Cartesian, Face, Barycentric, FaceTriangle, SphericalTriangle} from '../core/coordinate-systems';
import {faceToBarycentric, barycentricToFace} from '../core/coordinate-transforms';
import {sphericalTriangleArea} from '../geometry/spherical-polygon';

// Module-scoped scratch buffers — forward/inverse are on the lonLatToCell hot
// path, so we avoid vec3.create() per call.
const _BxC = vec3.create() as Cartesian;
const _P = vec3.create() as Cartesian; // Point along BC chord
const _csAlpha = vec2.create(); // [cos(alpha), sin(alpha)] — input to alphaTransform
const _weightBC = vec2.create(); // alphaTransform * _csAlpha

interface TriangleConstants {
  AdotB: number; // A · B — the canonical ("even") B-C orientation
  AdotC: number; // A · C — the mirror ("odd") orientation, with B and C swapped
  alphaTransform: Mat2d; // Affine transform for alpha direction vector to p
  areaABC: number; // spherical triangle area
  volumeABC: number; // A · (B × C) — signed triple product (volume of parallelpiped formed)
}

// Equal area projection originally described by:
// Snyder92 (AN EQUAL-AREA MAP PROJECTION FOR POLYHEDRAL GLOBES)
// Closed form equations due to Brenton R. S. Recht
//
// The projection maps a point V within a spherical triangle ABC onto a planar
// point F (within a planar triangle), in an equal-area-preserving manner.
//
// The first point of the triangle (A) is known as the radiating vertex and the
// choice of this vertex subtly modifies how the projection behaves. All three
// choices will yield an equal area projection, but the cusps will vary.
//
// The transformation is done via an intermediate point P, which is obtained by
// intersecting the two great circles formed by A&V and B&C (hence why A is special)
//
// The equal-area transformation is then done by computing the ratio of areas between
// triangles ABP & ABC
//
// The inverse follows the reverse procedure of obtaining P from the face triangle
// by inverting the equal-area transformation, before slerping between A&P to obtain V
export class EqualAreaProjection {
  // By assuming that the geometry of the spherical triangle used is constant (up to
  // rotations on a sphere), a number of constants can be precomputed and reused
  private constants: TriangleConstants;

  constructor(canonicalTriangle: SphericalTriangle) {
    this.constants = EqualAreaProjection.computeConstants(canonicalTriangle);
  }

  static computeConstants(sphericalTriangle: SphericalTriangle): TriangleConstants {
    const [A, B, C] = sphericalTriangle;
    const BxC = vec3.create() as Cartesian;
    vec3.cross(BxC, B, C);
    const AdotB = vec3.dot(A, B);
    const AdotC = vec3.dot(A, C);
    const BdotC = vec3.dot(B, C);

    const V = vec3.dot(A, BxC);
    const P = AdotC + BdotC;
    const Q = AdotB + 1;
    const R = AdotB * BdotC - AdotC;
    const F = P * P - Q * Q;
    const G = 2 * Q * R;
    const alphaTransform = mat2d.fromValues(V * V - F, -G, -2 * V * P, 2 * V * Q, V * V + F, G);

    return {volumeABC: V, areaABC: sphericalTriangleArea(A, B, C), AdotB, AdotC, alphaTransform};
  }

  /**
   * Forward projection: converts a spherical point to face coordinates
   * @param V - The spherical point to project
   * @param sphericalTriangle - The spherical triangle vertices
   * @param faceTriangle - The face triangle vertices
   * @returns The face coordinates
   */
  forward(V: Cartesian, sphericalTriangle: SphericalTriangle, faceTriangle: FaceTriangle): Face {
    const [A, B, C] = sphericalTriangle;
    const {areaABC, volumeABC} = this.constants;

    // Compute point P, where great circles through A&V and B&C intersect
    vec3.cross(_BxC, B, C);
    const volumeVBC = vec3.dot(V, _BxC);
    vec3.scale(_P, V, volumeABC);
    vec3.scaleAndAdd(_P, _P, A, -volumeVBC);
    const D = vec3.length(_P);
    const ooD = D > 0 ? 1 / D : 1;
    vec3.scale(_P, _P, ooD);

    // Obtain rho & alpha by ratio of areas
    const areaABp = Math.max(0, sphericalTriangleArea(A, B, _P));
    const alpha = areaABp / areaABC;
    const rho = (D / volumeABC) * Math.sqrt((1 + vec3.dot(A, _P)) / (1 + vec3.dot(A, V)));

    // Construct barycentric triangle and map to face
    const b = [1 - rho, rho * (1 - alpha), rho * alpha] as Barycentric;
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
    // Map from face to barycentric
    const [A, B, C] = sphericalTriangle;
    const b = faceToBarycentric(facePoint, faceTriangle);

    const threshold = 1 - 1e-14;
    if (b[0] > threshold) return A;
    if (b[1] > threshold) return B;
    if (b[2] > threshold) return C;

    // Normalize odd (mirror-image) triangles to the canonical even orientation
    // by swapping B↔C and the matching weight b1↔b2, so alphaTransform is correct
    const {AdotB, AdotC, alphaTransform, areaABC} = this.constants;
    const faceAdotB = vec3.dot(A, B);
    const odd = Math.abs(faceAdotB - AdotB) > Math.abs(faceAdotB - AdotC);
    const _B = odd ? C : B;
    const _C = odd ? B : C;
    const b2 = odd ? b[1] : b[2];

    // Obtain rho & alpha
    const rho = 1 - b[0];
    const alpha = (b2 / rho) * areaABC;

    // Inverse to obtain point P (see forward)
    _csAlpha[0] = Math.cos(alpha);
    _csAlpha[1] = Math.sin(alpha);
    vec2.transformMat2d(_weightBC, _csAlpha, alphaTransform);
    vec3.scale(_P, _B, _weightBC[0]);
    vec3.scaleAndAdd(_P, _P, _C, _weightBC[1]);
    vec3.normalize(_P, _P);

    // Compute weights for A & P
    const s = vec3.dot(A, _P);
    const t = 1 + rho * rho * (s - 1);
    const weightP = rho * Math.sqrt((1 + t) / (1 + s));
    const weightA = t - s * weightP;

    // `out` is returned to the caller, so it must be a fresh allocation
    const out = vec3.create() as Cartesian;
    vec3.scale(out, A, weightA);
    vec3.scaleAndAdd(out, out, _P, weightP);
    return out;
  }
}
