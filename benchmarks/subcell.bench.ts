// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {bench, describe} from 'vitest';
import {cellToSubcell, cellToSupercell} from 'a5';
import {BENCH_OPTS, sampleCells} from './utils';

const N = 64;
const cells8 = sampleCells(8, N);
const cells15 = sampleCells(15, N);

describe('subcell', () => {
  let i = 0;
  bench(
    'cellToSupercell res 15 -> 8',
    () => {
      cellToSupercell(cells15[i++ & (N - 1)], 8);
    },
    BENCH_OPTS
  );

  let j = 0;
  bench(
    'cellToSubcell res 8 -> 11',
    () => {
      cellToSubcell(cells8[j++ & (N - 1)], 11);
    },
    BENCH_OPTS
  );

  let k = 0;
  bench(
    'cellToSubcell res 8 -> 16',
    () => {
      cellToSubcell(cells8[k++ & (N - 1)], 16);
    },
    BENCH_OPTS
  );
});
