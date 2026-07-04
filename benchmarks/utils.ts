// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {lonLatToCell} from 'a5';
import type {Degrees, LonLat} from 'a5/core/coordinate-systems';

/**
 * Shared time budget per benchmark, chosen so the full suite completes in
 * around a minute. Benchmarks never assert outputs — only throughput matters.
 * BENCH_TIME (ms) overrides the budget, e.g. for more samples in CI.
 */
export const BENCH_OPTS = {time: Number(process.env.BENCH_TIME) || 200, warmupTime: 50};

/** Deterministic PRNG (mulberry32) so every run benchmarks identical inputs. */
export function createRandom(seed = 42): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Points distributed uniformly over the sphere (area-uniform in latitude). */
export function samplePoints(n: number, seed = 42): LonLat[] {
  const random = createRandom(seed);
  const points: LonLat[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const lon = (360 * random() - 180) as Degrees;
    const lat = ((Math.asin(2 * random() - 1) * 180) / Math.PI) as Degrees;
    points[i] = [lon, lat] as LonLat;
  }
  return points;
}

/** Cell IDs of uniformly distributed points at the given resolution. */
export function sampleCells(resolution: number, n: number, seed = 42): bigint[] {
  const points = samplePoints(n, seed);
  const cells: bigint[] = new Array(n);
  for (let i = 0; i < n; i++) {
    cells[i] = lonLatToCell(points[i], resolution);
  }
  return cells;
}
