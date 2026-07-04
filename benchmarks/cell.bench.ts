// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {bench, describe} from 'vitest';
import {cellToBoundary, cellToLonLat, lonLatToCell} from 'a5';
import {BENCH_OPTS, samplePoints, sampleCells} from './utils';

const N = 256;
const points = samplePoints(N);

describe('lonLatToCell', () => {
  for (const resolution of [5, 15, 30]) {
    let i = 0;
    bench(
      `lonLatToCell res ${resolution}`,
      () => {
        lonLatToCell(points[i++ & (N - 1)], resolution);
      },
      BENCH_OPTS
    );
  }
});

describe('cellToLonLat', () => {
  for (const resolution of [5, 15, 30]) {
    const cells = sampleCells(resolution, N);
    let i = 0;
    bench(
      `cellToLonLat res ${resolution}`,
      () => {
        cellToLonLat(cells[i++ & (N - 1)]);
      },
      BENCH_OPTS
    );
  }
});

describe('cellToBoundary', () => {
  for (const resolution of [5, 15, 30]) {
    const cells = sampleCells(resolution, N);
    let i = 0;
    bench(
      `cellToBoundary res ${resolution}`,
      () => {
        cellToBoundary(cells[i++ & (N - 1)]);
      },
      BENCH_OPTS
    );
  }

  const cells = sampleCells(15, N);
  let i = 0;
  bench(
    `cellToBoundary res 15 segments 10`,
    () => {
      cellToBoundary(cells[i++ & (N - 1)], {segments: 10});
    },
    BENCH_OPTS
  );
});
