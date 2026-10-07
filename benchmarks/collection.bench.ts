// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {bench, describe} from 'vitest';
import {lonLatToCell, polygonToCells, sphericalCap, union, intersect, difference, contains, count} from 'a5';
import type {LonLat} from 'a5/core/coordinate-systems';
import {BENCH_OPTS, createRandom} from './utils';
import fixtures from '../tests/fixtures/regions/polygon.json';

type CountryFixture = {name: string; polygon: [number, number][][]};

const countries = (fixtures as any).country as CountryFixture[];
const country = (name: string) => countries.find(c => c.name === name)!.polygon as LonLat[][];

// Coverings at resolution 12: two neighboring countries and a cap overlapping both
const france = polygonToCells(country('France'), 12);
const uk = polygonToCells(country('United Kingdom'), 12);
const capParis = sphericalCap(lonLatToCell([2.3522, 48.8566] as LonLat, 12), 400_000);

// Point-in-polygon probes: cells, at the coverage's resolution, of random points in France's bounding box
const random = createRandom(7);
const probes: bigint[] = [];
for (let i = 0; i < 1000; i++) {
  probes.push(lonLatToCell([-5 + 13 * random(), 42 + 9 * random()] as LonLat, 12));
}

describe('set operations', () => {
  bench(
    `union France + UK res 12 (${france.length + uk.length} compacted cells)`,
    () => {
      union(france, uk);
    },
    BENCH_OPTS
  );

  bench(
    'intersect France with Paris cap res 12',
    () => {
      intersect(france, capParis);
    },
    BENCH_OPTS
  );

  bench(
    'difference France minus Paris cap res 12',
    () => {
      difference(france, capParis);
    },
    BENCH_OPTS
  );

  bench(
    'count France res 12',
    () => {
      count(france);
    },
    BENCH_OPTS
  );

  bench(
    'contains France res 12, 1000 points',
    () => {
      for (let i = 0; i < probes.length; i++) contains(france, probes[i]);
    },
    BENCH_OPTS
  );
});
