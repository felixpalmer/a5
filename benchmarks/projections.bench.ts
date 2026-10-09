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
import {BATCH, BENCH_OPTS, SINK, createRandom, sampleCells} from './utils';

// Spherical points paired with the origin of the face they fall on
const cells = sampleCells(10, BATCH);
const sphericals: Spherical[] = new Array(BATCH);
const originIds: OriginId[] = new Array(BATCH);
for (let i = 0; i < BATCH; i++) {
  sphericals[i] = cellToSpherical(cells[i]);
  originIds[i] = deserialize(cells[i]).origin.id;
}

const dodecahedron = new DodecahedronProjection();
const faces: Face[] = new Array(BATCH);
for (let i = 0; i < BATCH; i++) {
  faces[i] = dodecahedron.forward(sphericals[i], originIds[i]);
}

describe('dodecahedron projection', () => {
  bench(
    'forward ×100',
    () => {
      for (let i = 0; i < BATCH; i++) SINK[i] = dodecahedron.forward(sphericals[i], originIds[i]);
    },
    BENCH_OPTS
  );

  bench(
    'inverse ×100',
    () => {
      for (let i = 0; i < BATCH; i++) SINK[i] = dodecahedron.inverse(faces[i], originIds[i]);
    },
    BENCH_OPTS
  );
});

const authalic = new AuthalicProjection();
const gnomonic = new GnomonicProjection();
const random = createRandom(7);
const phis: Radians[] = new Array(BATCH);
for (let i = 0; i < BATCH; i++) {
  phis[i] = (Math.PI * (random() - 0.5)) as Radians;
}

describe('authalic projection', () => {
  bench(
    'forward ×100',
    () => {
      for (let i = 0; i < BATCH; i++) SINK[i] = authalic.forward(phis[i]);
    },
    BENCH_OPTS
  );

  bench(
    'inverse ×100',
    () => {
      for (let i = 0; i < BATCH; i++) SINK[i] = authalic.inverse(phis[i]);
    },
    BENCH_OPTS
  );
});

describe('gnomonic projection', () => {
  const polars = new Array(BATCH);
  for (let i = 0; i < BATCH; i++) {
    polars[i] = gnomonic.forward(sphericals[i]);
  }

  bench(
    'forward ×100',
    () => {
      for (let i = 0; i < BATCH; i++) SINK[i] = gnomonic.forward(sphericals[i]);
    },
    BENCH_OPTS
  );

  bench(
    'inverse ×100',
    () => {
      for (let i = 0; i < BATCH; i++) SINK[i] = gnomonic.inverse(polars[i]);
    },
    BENCH_OPTS
  );
});
