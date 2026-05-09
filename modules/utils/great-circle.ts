// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {vec3} from 'gl-matrix';
import type {Cartesian} from '../core/coordinate-systems';
import {AUTHALIC_RADIUS_EARTH} from '../core/constants';
import {precomputeSlerp, slerp} from './vector';

/**
 * Great-circle distance in meters between two unit vectors on the authalic sphere.
 */
export function greatCircleDistance(a: Cartesian, b: Cartesian): number {
  const dot = Math.max(-1, Math.min(1, vec3.dot(a, b)));
  return Math.acos(dot) * AUTHALIC_RADIUS_EARTH;
}

/**
 * Sample interior points along the great-circle arc from `a` to `b` at roughly
 * `sampleInterval` meters spacing. Endpoints are NOT included — the caller
 * already has them. Returned vectors live on the authalic unit sphere.
 */
export function sampleGreatCircleArc(a: Cartesian, b: Cartesian, sampleInterval: number): Cartesian[] {
  const dist = greatCircleDistance(a, b);
  const numSegments = Math.max(1, Math.ceil(dist / sampleInterval));
  const samples: Cartesian[] = [];
  if (numSegments <= 1) return samples;
  const slerpCtx = precomputeSlerp(a, b);
  for (let j = 1; j < numSegments; j++) {
    const v = vec3.create() as Cartesian;
    slerp(v, a, b, j / numSegments, slerpCtx);
    samples.push(v);
  }
  return samples;
}
