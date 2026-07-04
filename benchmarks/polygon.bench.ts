// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {bench, describe} from 'vitest';
import {polygonToCells} from 'a5';
import type {LonLat} from 'a5/core/coordinate-systems';
import {BENCH_OPTS} from './utils';
import fixtures from '../tests/fixtures/regions/polygon.json';

type CountryFixture = {name: string; polygon: [number, number][][]};

const countries = (fixtures as any).country as CountryFixture[];

function country(name: string): LonLat[][] {
  return countries.find(c => c.name === name)!.polygon as LonLat[][];
}

// Country outlines cover the interesting cases: many vertices (line tracing),
// large interiors (flood fill), multi-ring coastlines and high latitudes.
const CASES: [name: string, resolution: number][] = [
  ['United Kingdom', 7],
  ['France', 7],
  ['Brazil', 6],
  ['United States of America', 5],
  ['Fiji', 8] // antimeridian
];

describe('polygonToCells', () => {
  for (const [name, resolution] of CASES) {
    const polygon = country(name);
    bench(
      `polygonToCells ${name} res ${resolution}`,
      () => {
        polygonToCells(polygon, resolution);
      },
      BENCH_OPTS
    );
  }
});
