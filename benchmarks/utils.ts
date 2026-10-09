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

/**
 * Calls per sample for benchmarks of functions that take under ~1µs. Each
 * sample times one call of the benchmark function, and for a call that short
 * the timer's granularity (~10ns steps on CI) and the harness's own overhead
 * dominate: one tick reads as a 15-25% regression. These benchmarks make
 * BATCH calls per sample, over BATCH different inputs, so the time reported
 * (per batch, marked "×100" in the name) is the work being measured.
 */
export const BATCH = 100;

/**
 * Where batched benchmarks store their results. A result nothing reads could
 * be optimized away along with the call that made it; one stored here can't.
 */
export const SINK: unknown[] = new Array(BATCH);

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
