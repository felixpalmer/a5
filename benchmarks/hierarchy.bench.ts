// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {bench, describe} from 'vitest';
import {cellArea, cellToChildren, cellToParent, getNumCells, getNumChildren, getRes0Cells, getResolution} from 'a5';
import {BENCH_OPTS, sampleCells} from './utils';

const N = 256;
const cells15 = sampleCells(15, N);
const cells10 = sampleCells(10, N);

describe('hierarchy', () => {
  let i = 0;
  bench(
    'getResolution res 15',
    () => {
      getResolution(cells15[i++ & (N - 1)]);
    },
    BENCH_OPTS
  );

  let j = 0;
  bench(
    'cellToParent res 15 -> 14',
    () => {
      cellToParent(cells15[j++ & (N - 1)]);
    },
    BENCH_OPTS
  );

  let k = 0;
  bench(
    'cellToParent res 15 -> 5',
    () => {
      cellToParent(cells15[k++ & (N - 1)], 5);
    },
    BENCH_OPTS
  );

  let l = 0;
  bench(
    'cellToChildren res 15 -> 16',
    () => {
      cellToChildren(cells15[l++ & (N - 1)]);
    },
    BENCH_OPTS
  );

  let m = 0;
  bench(
    'cellToChildren res 10 -> 13',
    () => {
      cellToChildren(cells10[m++ & (N - 1)], 13);
    },
    BENCH_OPTS
  );

  bench(
    'getRes0Cells',
    () => {
      getRes0Cells();
    },
    BENCH_OPTS
  );
});

describe('cell-info', () => {
  bench(
    'getNumCells res 15',
    () => {
      getNumCells(15);
    },
    BENCH_OPTS
  );

  bench(
    'getNumChildren res 0 -> 15',
    () => {
      getNumChildren(0, 15);
    },
    BENCH_OPTS
  );

  bench(
    'cellArea res 15',
    () => {
      cellArea(15);
    },
    BENCH_OPTS
  );
});
