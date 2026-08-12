// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import * as vec3 from '../math/vec3';
import type {Cartesian} from '../core/coordinate-systems';

/**
 * Computes the scalar triple product A · (B × C).
 * Written out fully (same operation order as vec3.cross followed by vec3.dot,
 * so results are bit-identical) to avoid a scratch-vector store on hot paths.
 */
export function tripleProduct(A: Cartesian, B: Cartesian, C: Cartesian): number {
  return A[0] * (B[1] * C[2] - B[2] * C[1]) + A[1] * (B[2] * C[0] - B[0] * C[2]) + A[2] * (B[0] * C[1] - B[1] * C[0]);
}

/**
 * Angle between two UNIT vectors, computed as 2·atan2(‖a−b‖, ‖a+b‖).
 *
 * Unlike acos(a·b), which loses half the significant digits carried when the
 * vectors are nearly parallel (and all of them below ~1e-8 rad), this formula
 * keeps full working precision over the whole range [0, π]: the subtraction
 * a−b is exact for nearby vectors, and atan2 has no sensitive endpoints
 * (Kahan, "How Futile are Mindless Assessments of Roundoff…", §12).
 */
export function vectorAngle(A: Cartesian, B: Cartesian): number {
  const dx = A[0] - B[0],
    dy = A[1] - B[1],
    dz = A[2] - B[2];
  const sx = A[0] + B[0],
    sy = A[1] + B[1],
    sz = A[2] + B[2];
  return 2 * Math.atan2(Math.sqrt(dx * dx + dy * dy + dz * dz), Math.sqrt(sx * sx + sy * sy + sz * sz));
}

/**
 * Cached `gamma` and `sin(gamma)` for a fixed (A, B) pair, so loops that
 * slerp many times along the same arc don't re-run `vectorAngle` and `Math.sin`.
 * Build with `precomputeSlerp(A, B)` and pass to `slerp` as the optional `ctx`.
 */
export interface SlerpContext {
  gamma: number;
  sinGamma: number;
}

export function precomputeSlerp(A: Cartesian, B: Cartesian): SlerpContext {
  const gamma = vectorAngle(A, B);
  return {gamma, sinGamma: Math.sin(gamma)};
}

/**
 * Spherical linear interpolation between two vectors.
 * @param out - The target vector to write the result to
 * @param A - The first vector
 * @param B - The second vector
 * @param t - The interpolation parameter (0 to 1)
 * @param ctx - Optional precomputed `{gamma, sinGamma}`; supply when slerping
 *              many `t` values along the same arc to avoid recomputing them
 * @returns The interpolated vector (same as out)
 */
export function slerp(out: Cartesian, A: Cartesian, B: Cartesian, t: number, ctx?: SlerpContext): Cartesian {
  const gamma = ctx ? ctx.gamma : vectorAngle(A, B);
  if (gamma < 1e-12) {
    return vec3.lerp(out, A, B, t) as Cartesian;
  }
  const sinGamma = ctx ? ctx.sinGamma : Math.sin(gamma);
  const weightA = Math.sin((1 - t) * gamma) / sinGamma;
  const weightB = Math.sin(t * gamma) / sinGamma;
  out[0] = weightA * A[0] + weightB * B[0];
  out[1] = weightA * A[1] + weightB * B[1];
  out[2] = weightA * A[2] + weightB * B[2];
  return out;
}
