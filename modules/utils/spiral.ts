// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { vec3, quat, glMatrix } from "gl-matrix";
glMatrix.setMatrixArrayType(Float64Array as any);

import type { Cartesian, Spherical } from "../core/coordinate-systems";
import { toCartesian, toSpherical } from "../core/coordinate-transforms";

/**
 * Number of perturbed sample points returned by `generateSpiralSamples`.
 * Tuned via debug-scripts/tune-spiral.ts so that on a corpus of ~3500
 * spherical points × 8 resolutions, the spiral hits a strictly-containing
 * cell within these many iterations for all but a handful of points right
 * at the polar singularity at very high resolutions.
 */
export const SPIRAL_SAMPLE_COUNT = 24;

/**
 * Azimuthal step between consecutive samples in the rotated tangent plane.
 * 1.4 rad (~80°) is in a flat plateau of the parameter sweep.
 */
const ANGLE_STEP_RAD = 1.4;

// Precomputed unit-direction spiral at the canonical pole's tangent plane
// (z=0). Pattern is independent of resolution; per call we rotate it to
// the input point's tangent plane via a quaternion. `quat.rotationTo`
// handles the antipode case internally.
const POLE: vec3 = vec3.fromValues(0, 0, 1);
const SPIRAL_DIRECTIONS: vec3[] = (() => {
  const out: vec3[] = [];
  for (let i = 0; i < SPIRAL_SAMPLE_COUNT; i++) {
    const a = (i + 1) * ANGLE_STEP_RAD;
    out.push(vec3.fromValues(Math.cos(a), Math.sin(a), 0));
  }
  return out;
})();

const _q = quat.create();
const _tangent = vec3.create();

/**
 * Generate `SPIRAL_SAMPLE_COUNT` sample points around `center` on the unit
 * sphere, used to discover nearby cells when the projection-based estimate
 * lands in the wrong one.
 *
 * Sample i sits at tangent-plane offset of magnitude
 * `(i+1)/(SPIRAL_SAMPLE_COUNT+1) · scaleRad` from `center`, rotated by
 * azimuth `(i+1) · ANGLE_STEP_RAD` in `center`'s tangent frame. The point
 * `center + offset` is computed in 3D Cartesian — slightly off the unit
 * sphere by O(R²) — and `toSpherical` projects it back implicitly.
 */
export function generateSpiralSamples(center: Spherical, scaleRad: number): Spherical[] {
  const c0 = toCartesian(center);
  quat.rotationTo(_q, POLE, c0 as unknown as vec3);

  const out: Spherical[] = new Array(SPIRAL_SAMPLE_COUNT);
  for (let i = 0; i < SPIRAL_SAMPLE_COUNT; i++) {
    vec3.transformQuat(_tangent, SPIRAL_DIRECTIONS[i], _q);
    const R = ((i + 1) / (SPIRAL_SAMPLE_COUNT + 1)) * scaleRad;
    const perturbed: Cartesian = [
      c0[0] + R * _tangent[0],
      c0[1] + R * _tangent[1],
      c0[2] + R * _tangent[2],
    ] as Cartesian;
    out[i] = toSpherical(perturbed);
  }
  return out;
}
