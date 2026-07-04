// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {bench, describe} from 'vitest';
import {gridDisk, gridDiskVertex, lonLatToCell} from 'a5';
import type {LonLat} from 'a5/core/coordinate-systems';
import {BENCH_OPTS} from './utils';

const london = lonLatToCell([-0.1276, 51.5072] as LonLat, 9);

describe('gridDisk', () => {
  for (const k of [1, 5, 20]) {
    bench(
      `gridDisk k=${k}`,
      () => {
        gridDisk(london, k);
      },
      BENCH_OPTS
    );
  }

  bench(
    'gridDiskVertex k=5',
    () => {
      gridDiskVertex(london, 5);
    },
    BENCH_OPTS
  );
});
