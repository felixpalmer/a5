// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { vec3, quat, glMatrix } from "gl-matrix";
glMatrix.setMatrixArrayType(Float64Array as any);

import type { Cartesian, Spherical } from "../core/coordinate-systems";
import { toCartesian } from "../core/coordinate-transforms";

/**
 * Number of perturbed sample points the spiral can produce. Tuned via
 * debug-scripts/tune-spiral.ts so that on a corpus of ~3500 spherical
 * points × 8 resolutions, the spiral hits a strictly-containing cell
 * within these many iterations for all but a handful of points right at
 * the polar singularity at very high resolutions.
 */
export const SPIRAL_SAMPLE_COUNT = 24;

/**
 * Azimuthal step between consecutive samples in the rotated tangent plane.
 * 1.4 rad (~80°) sits on a flat plateau of the parameter sweep.
 */
const ANGLE_STEP_RAD = 1.4;

// Precomputed unit-direction spiral at the canonical pole's tangent plane
// (z=0). Each entry is the tangent direction of one sample. The pattern
// is independent of resolution; per spiral the directions are rotated to
// the input point's tangent plane via a single quaternion.
const POLE: vec3 = vec3.fromValues(0, 0, 1);
const SPIRAL_DIRECTIONS: vec3[] = (() => {
  const out: vec3[] = [];
  for (let i = 0; i < SPIRAL_SAMPLE_COUNT; i++) {
    const a = (i + 1) * ANGLE_STEP_RAD;
    out.push(vec3.fromValues(Math.cos(a), Math.sin(a), 0));
  }
  return out;
})();

/**
 * Lazy spiral sampler around a center point on the unit sphere — used by
 * `sphericalToCell` to discover nearby cells when the projection-based
 * estimate lands in the wrong one.
 *
 * Construction precomputes the pole→center quaternion. `sample(i)`
 * rotates the i-th cached direction into the tangent plane at `center`,
 * scales by the appropriate radius, and returns a Cartesian point near
 * the unit sphere — the consumer of the spiral (the dodecahedron
 * projection) wants Cartesian anyway, so we skip the spherical
 * round-trip entirely. The point is slightly off the unit sphere by
 * O(R²); downstream callers either tolerate this or normalise.
 *
 * All state is per-instance (no module-level mutable scratch), so each
 * thread/task can hold its own without locking.
 */
export class Spiral {
  private c0: Cartesian;
  private q: quat;
  private scaleRad: number;
  private scratch: vec3;

  /**
   * Initialise a spiral around `center` on the unit sphere. The
   * tangent-plane radius of the outermost sample is `scaleRad`;
   * intermediate samples scale linearly between 0 and that.
   * `quat.rotationTo` handles the antipode case internally.
   */
  constructor(center: Spherical, scaleRad: number) {
    this.c0 = toCartesian(center);
    this.q = quat.create();
    quat.rotationTo(this.q, POLE, this.c0 as unknown as vec3);
    this.scaleRad = scaleRad;
    this.scratch = vec3.create();
  }

  /**
   * Return the i-th spiral sample (0 ≤ i < SPIRAL_SAMPLE_COUNT) as a
   * Cartesian point. Sample i sits at tangent-plane offset of magnitude
   * `(i+1)/(SPIRAL_SAMPLE_COUNT+1) · scaleRad` from `center`, rotated
   * by azimuth `(i+1) · 1.4 rad` in `center`'s tangent frame.
   */
  sample(i: number): Cartesian {
    vec3.transformQuat(this.scratch, SPIRAL_DIRECTIONS[i], this.q);
    const R = ((i + 1) / (SPIRAL_SAMPLE_COUNT + 1)) * this.scaleRad;
    return [
      this.c0[0] + R * this.scratch[0],
      this.c0[1] + R * this.scratch[1],
      this.c0[2] + R * this.scratch[2],
    ] as Cartesian;
  }
}
