// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {bench, describe} from 'vitest';
import {hexToU64, u64ToHex} from 'a5';
import {BENCH_OPTS, sampleCells} from './utils';

const N = 256;
const cells = sampleCells(20, N);
const hexes: string[] = new Array(N);
for (let i = 0; i < N; i++) {
  hexes[i] = u64ToHex(cells[i]);
}

describe('hex', () => {
  let i = 0;
  bench(
    'u64ToHex',
    () => {
      u64ToHex(cells[i++ & (N - 1)]);
    },
    BENCH_OPTS
  );

  let j = 0;
  bench(
    'hexToU64',
    () => {
      hexToU64(hexes[j++ & (N - 1)]);
    },
    BENCH_OPTS
  );
});
