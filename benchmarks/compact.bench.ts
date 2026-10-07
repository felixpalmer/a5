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

// A realistic mixed-resolution cell set: country fill expanded to a flat list.
// The resolution argument is for the pre-compaction-marker uncompact(cells, resolution),
// which the baseline run may use; uncompact now reads it from the compaction marker.
const uncompactAt = uncompact as (cells: BigUint64Array, resolution: number) => BigUint64Array;
const flat = uncompactAt(polygonToCells(uk.polygon as LonLat[][], 10), 10);
const compacted12 = polygonToCells(uk.polygon as LonLat[][], 12);

describe('compact', () => {
  bench(
    `compact UK res 10 (${flat.length} cells)`,
    () => {
      compact(flat);
    },
    BENCH_OPTS
  );

  bench(
    `uncompact UK res 12 (${flat.length * 16} cells)`,
    () => {
      uncompactAt(compacted12, 12);
    },
    BENCH_OPTS
  );
});
