// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {bench, describe} from 'vitest';
import {sToAnchor, anchorToS, IJToS} from 'a5/lattice';
import type {Anchor} from 'a5/lattice';
import type {IJ} from 'a5/core/coordinate-systems';
import {BENCH_OPTS, createRandom} from './utils';

const N = 256;

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

describe('sToAnchor', () => {
  for (const resolution of [5, 15, 28]) {
    const values = sampleS(resolution, N);
    let i = 0;
    bench(
      `sToAnchor res ${resolution}`,
      () => {
        sToAnchor(values[i++ & (N - 1)], resolution, 'uv');
      },
      BENCH_OPTS
    );
  }

  // Orientation with both flip and reversal transforms
  const values = sampleS(15, N);
  let i = 0;
  bench(
    `sToAnchor res 15 orientation wu`,
    () => {
      sToAnchor(values[i++ & (N - 1)], 15, 'wu');
    },
    BENCH_OPTS
  );
});

describe('anchorToS', () => {
  for (const resolution of [5, 15, 28]) {
    const values = sampleS(resolution, N);
    const anchors: Anchor[] = new Array(N);
    for (let i = 0; i < N; i++) {
      anchors[i] = sToAnchor(values[i], resolution, 'uv');
    }
    let i = 0;
    bench(
      `anchorToS res ${resolution}`,
      () => {
        anchorToS(anchors[i++ & (N - 1)], resolution, 'uv');
      },
      BENCH_OPTS
    );
  }
});

describe('IJToS', () => {
  const values = sampleS(15, N);
  const ijs: IJ[] = new Array(N);
  for (let i = 0; i < N; i++) {
    ijs[i] = sToAnchor(values[i], 15, 'uv').offset;
  }
  let i = 0;
  bench(
    'IJToS res 15',
    () => {
      IJToS(ijs[i++ & (N - 1)], 15, 'uv');
    },
    BENCH_OPTS
  );
});
