// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Benchmarks for the space-filling curve: s -> cell decode and cell -> s encode.

import {bench, describe} from 'vitest';
import {sToCell, tripleToS} from 'a5/lattice';
import type {Orientation, Triple} from 'a5/lattice';
import {BATCH, BENCH_OPTS, SINK, createRandom} from './utils';

/** Deterministic S values in [0, 4^resolution). */
function sampleS(resolution: number, n: number, seed = 42): bigint[] {
  const random = createRandom(seed);
  const max = 1n << BigInt(2 * resolution);
  const values: bigint[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const hi = BigInt(Math.floor(random() * 0x100000000));
    const lo = BigInt(Math.floor(random() * 0x100000000));
    values[i] = ((hi << 32n) | lo) % max;
  }
  return values;
}

/** The triples of the cells at `values`. */
function triplesOf(values: bigint[], resolution: number, orientation: Orientation): Triple[] {
  const triples: Triple[] = new Array(values.length);
  for (let i = 0; i < values.length; i++) {
    triples[i] = sToCell(values[i], resolution, orientation).triple;
  }
  return triples;
}

describe('sToCell', () => {
  for (const resolution of [5, 15, 28]) {
    const values = sampleS(resolution, BATCH);
    bench(
      `sToCell res ${resolution} ×100`,
      () => {
        for (let i = 0; i < BATCH; i++) SINK[i] = sToCell(values[i], resolution, 'uv');
      },
      BENCH_OPTS
    );
  }

  // Orientation with both flip and reversal transforms
  const values = sampleS(15, BATCH);
  bench(
    `sToCell res 15 orientation wu ×100`,
    () => {
      for (let i = 0; i < BATCH; i++) SINK[i] = sToCell(values[i], 15, 'wu');
    },
    BENCH_OPTS
  );
});

describe('tripleToS', () => {
  for (const resolution of [5, 15, 28]) {
    const triples = triplesOf(sampleS(resolution, BATCH), resolution, 'uv');
    bench(
      `tripleToS res ${resolution} ×100`,
      () => {
        for (let i = 0; i < BATCH; i++) SINK[i] = tripleToS(triples[i], resolution, 'uv');
      },
      BENCH_OPTS
    );
  }
});
