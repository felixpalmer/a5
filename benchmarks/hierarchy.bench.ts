// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {bench, describe} from 'vitest';
import {cellArea, cellToChildren, cellToParent, getNumCells, getNumChildren, getRes0Cells, getResolution} from 'a5';
import {BATCH, BENCH_OPTS, SINK, sampleCells} from './utils';

const N = 256;
const cells15 = sampleCells(15, BATCH);
const cells10 = sampleCells(10, N);

// The resolutions read from an array, so the optimizer can't fold the calls into constants
const res0: number[] = new Array(BATCH).fill(0);
const res15: number[] = new Array(BATCH).fill(15);

describe('hierarchy', () => {
  bench(
    'getResolution res 15 ×100',
    () => {
      for (let i = 0; i < BATCH; i++) SINK[i] = getResolution(cells15[i]);
    },
    BENCH_OPTS
  );

  bench(
    'cellToParent res 15 -> 14 ×100',
    () => {
      for (let i = 0; i < BATCH; i++) SINK[i] = cellToParent(cells15[i]);
    },
    BENCH_OPTS
  );

  bench(
    'cellToParent res 15 -> 5 ×100',
    () => {
      for (let i = 0; i < BATCH; i++) SINK[i] = cellToParent(cells15[i], 5);
    },
    BENCH_OPTS
  );

  bench(
    'cellToChildren res 15 -> 16 ×100',
    () => {
      for (let i = 0; i < BATCH; i++) SINK[i] = cellToChildren(cells15[i]);
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
    'getRes0Cells ×100',
    () => {
      for (let i = 0; i < BATCH; i++) SINK[i] = getRes0Cells();
    },
    BENCH_OPTS
  );
});

describe('cell-info', () => {
  bench(
    'getNumCells res 15 ×100',
    () => {
      for (let i = 0; i < BATCH; i++) SINK[i] = getNumCells(res15[i]);
    },
    BENCH_OPTS
  );

  bench(
    'getNumChildren res 0 -> 15 ×100',
    () => {
      for (let i = 0; i < BATCH; i++) SINK[i] = getNumChildren(res0[i], res15[i]);
    },
    BENCH_OPTS
  );

  bench(
    'cellArea res 15 ×100',
    () => {
      for (let i = 0; i < BATCH; i++) SINK[i] = cellArea(res15[i]);
    },
    BENCH_OPTS
  );
});
