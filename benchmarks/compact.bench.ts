// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {bench, describe} from 'vitest';
import {compact, polygonToCells, uncompact} from 'a5';
import type {LonLat} from 'a5/core/coordinate-systems';
import {BENCH_OPTS} from './utils';
import fixtures from '../tests/fixtures/regions/polygon.json';

type CountryFixture = {name: string; polygon: [number, number][][]};

const countries = (fixtures as any).country as CountryFixture[];
const uk = countries.find(c => c.name === 'United Kingdom')!;

// A realistic mixed-resolution cell set: country fill expanded to a flat list
const compacted = polygonToCells(uk.polygon as LonLat[][], 10);
const flat = uncompact(compacted, 10);

describe('compact', () => {
  bench(
    `compact UK res 10 (${flat.length} cells)`,
    () => {
      compact(flat);
    },
    BENCH_OPTS
  );

  bench(
    `uncompact UK res 10 -> 12 (${flat.length * 16} cells)`,
    () => {
      uncompact(flat, 12);
    },
    BENCH_OPTS
  );
});
