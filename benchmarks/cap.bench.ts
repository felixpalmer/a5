// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {bench, describe} from 'vitest';
import {lonLatToCell} from 'a5';
import {sphericalCap} from 'a5/traversal/cap';
import type {LonLat} from 'a5/core/coordinate-systems';
import {BENCH_OPTS} from './utils';

const london9 = lonLatToCell([-0.1276, 51.5072] as LonLat, 9);
const london12 = lonLatToCell([-0.1276, 51.5072] as LonLat, 12);

describe('sphericalCap', () => {
  bench(
    'sphericalCap res 9 radius 10km',
    () => {
      sphericalCap(london9, 10_000);
    },
    BENCH_OPTS
  );

  bench(
    'sphericalCap res 9 radius 100km',
    () => {
      sphericalCap(london9, 100_000);
    },
    BENCH_OPTS
  );

  bench(
    'sphericalCap res 12 radius 5km',
    () => {
      sphericalCap(london12, 5_000);
    },
    BENCH_OPTS
  );
});
