// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {bench, describe} from 'vitest';
import {DodecahedronProjection} from 'a5/projections/dodecahedron';
import {AuthalicProjection} from 'a5/projections/authalic';
import {GnomonicProjection} from 'a5/projections/gnomonic';
import {cellToSpherical} from 'a5/core/cell';
import {deserialize} from 'a5/core/serialization';
import type {Face, Radians, Spherical} from 'a5/core/coordinate-systems';
import type {OriginId} from 'a5/core/utils';
import {BENCH_OPTS, createRandom, sampleCells} from './utils';

const N = 256;

// Spherical points paired with the origin of the face they fall on
const cells = sampleCells(10, N);
const sphericals: Spherical[] = new Array(N);
const originIds: OriginId[] = new Array(N);
for (let i = 0; i < N; i++) {
  sphericals[i] = cellToSpherical(cells[i]);
  originIds[i] = deserialize(cells[i]).origin.id;
}

const dodecahedron = new DodecahedronProjection();
const faces: Face[] = new Array(N);
for (let i = 0; i < N; i++) {
  faces[i] = dodecahedron.forward(sphericals[i], originIds[i]);
}

describe('dodecahedron projection', () => {
  let i = 0;
  bench(
    'forward',
    () => {
      const n = i++ & (N - 1);
      dodecahedron.forward(sphericals[n], originIds[n]);
    },
    BENCH_OPTS
  );

  let j = 0;
  bench(
    'inverse',
    () => {
      const n = j++ & (N - 1);
      dodecahedron.inverse(faces[n], originIds[n]);
    },
    BENCH_OPTS
  );
});

const authalic = new AuthalicProjection();
const gnomonic = new GnomonicProjection();
const random = createRandom(7);
const phis: Radians[] = new Array(N);
for (let i = 0; i < N; i++) {
  phis[i] = (Math.PI * (random() - 0.5)) as Radians;
}

describe('authalic projection', () => {
  let i = 0;
  bench(
    'forward',
    () => {
      authalic.forward(phis[i++ & (N - 1)]);
    },
    BENCH_OPTS
  );

  let j = 0;
  bench(
    'inverse',
    () => {
      authalic.inverse(phis[j++ & (N - 1)]);
    },
    BENCH_OPTS
  );
});

describe('gnomonic projection', () => {
  const polars = new Array(N);
  for (let i = 0; i < N; i++) {
    polars[i] = gnomonic.forward(sphericals[i]);
  }

  let i = 0;
  bench(
    'forward',
    () => {
      gnomonic.forward(sphericals[i++ & (N - 1)]);
    },
    BENCH_OPTS
  );

  let j = 0;
  bench(
    'inverse',
    () => {
      gnomonic.inverse(polars[j++ & (N - 1)]);
    },
    BENCH_OPTS
  );
});
