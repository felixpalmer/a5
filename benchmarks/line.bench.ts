// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {bench, describe} from 'vitest';
import {lineStringToCells} from 'a5';
import type {LonLat} from 'a5/core/coordinate-systems';
import {BENCH_OPTS} from './utils';

const londonParis = [
  [-0.1276, 51.5072],
  [2.3522, 48.8566]
] as LonLat[];

const roundTheWorld = [
  [-122.4194, 37.7749], // San Francisco
  [-74.006, 40.7128], // New York
  [-0.1276, 51.5072], // London
  [139.6917, 35.6895], // Tokyo
  [151.2093, -33.8688] // Sydney
] as LonLat[];

describe('lineStringToCells', () => {
  bench(
    'lineStringToCells London-Paris res 9',
    () => {
      lineStringToCells(londonParis, 9);
    },
    BENCH_OPTS
  );

  bench(
    'lineStringToCells round-the-world res 6',
    () => {
      lineStringToCells(roundTheWorld, 6);
    },
    BENCH_OPTS
  );
});
