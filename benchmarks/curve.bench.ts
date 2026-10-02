// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Benchmarks for the space-filling curve: s -> cell decode, cell -> s encode,
// and fractional-point location (IJToS).
//
// CI runs these same files against both the PR and its merge-base, so they
// must run on either side of the L-system migration: the adapters below pick
// the new API (sToCell / tripleToS) when present and fall back to the old
// engine (sToAnchor / anchorToS) on pre-L-system builds. Inputs are derived
// via triple coordinates, which both engines expose and agree on, so both
// sides measure the equivalent operation on identical cells.

import {bench, describe} from 'vitest';
import * as lattice from 'a5/lattice';
import type {Orientation, Triple} from 'a5/lattice';
import type {IJ} from 'a5/core/coordinate-systems';
import {BENCH_OPTS, createRandom} from './utils';

const N = 256;

/* eslint-disable @typescript-eslint/no-explicit-any */
const api = lattice as any;
const hasNewApi = Boolean(api.sToCell);

/** s -> cell decode (new: sToCell, old: sToAnchor). */
const decode: (s: bigint, resolution: number, orientation: Orientation) => unknown = hasNewApi
  ? api.sToCell
  : api.sToAnchor;

/** The (orientation-independent) triple of the cell at s. */
function tripleOf(s: bigint, resolution: number, orientation: Orientation): Triple {
  return hasNewApi
    ? api.sToCell(s, resolution, orientation).triple
    : api.anchorToTriple(api.sToAnchor(s, resolution, orientation));
}

/** cell -> s encode input + function (new: triple, old: anchor). */
function encodeInput(s: bigint, resolution: number, orientation: Orientation): unknown {
  return hasNewApi ? tripleOf(s, resolution, orientation) : api.sToAnchor(s, resolution, orientation);
}
const encode: (input: unknown, resolution: number, orientation: Orientation) => unknown = hasNewApi
  ? api.tripleToS
  : api.anchorToS;

/** Deterministic S values in [0, 4^resolution). */
function sampleS(resolution: number, n: number, seed = 42): bigint[] {
  const random = createRandom(seed);
  const max = 1n << BigInt(2 * resolution);
  const values: bigint[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const hi = BigInt(Math.floor(random() * 0x100000000));
    const lo = BigInt(Math.floor(random() * 0x100000000));
    values[i] = ((hi << 32n) | lo) % max;
  }
  return values;
}

/** The cell's centroid in IJ coordinates (parity 0: (x+y+1/3, -x+1/3), parity 1: (x+y-1/3, -x+2/3)). */
function centroidIJ(t: Triple): IJ {
  const parity = t.x + t.y + t.z;
  return (parity === 0 ? [t.x + t.y + 1 / 3, -t.x + 1 / 3] : [t.x + t.y - 1 / 3, -t.x + 2 / 3]) as IJ;
}

describe('sToCell', () => {
  for (const resolution of [5, 15, 28]) {
    const values = sampleS(resolution, N);
    let i = 0;
    bench(
      `sToCell res ${resolution}`,
      () => {
        decode(values[i++ & (N - 1)], resolution, 'uv');
      },
      BENCH_OPTS
    );
  }

  // Orientation with both flip and reversal transforms
  const values = sampleS(15, N);
  let i = 0;
  bench(
    `sToCell res 15 orientation wu`,
    () => {
      decode(values[i++ & (N - 1)], 15, 'wu');
    },
    BENCH_OPTS
  );
});

describe('tripleToS', () => {
  for (const resolution of [5, 15, 28]) {
    const values = sampleS(resolution, N);
    const inputs: unknown[] = new Array(N);
    for (let i = 0; i < N; i++) {
      inputs[i] = encodeInput(values[i], resolution, 'uv');
    }
    let i = 0;
    bench(
      `tripleToS res ${resolution}`,
      () => {
        encode(inputs[i++ & (N - 1)], resolution, 'uv');
      },
      BENCH_OPTS
    );
  }
});

describe('IJToS', () => {
  const values = sampleS(15, N);
  const ijs: IJ[] = new Array(N);
  for (let i = 0; i < N; i++) {
    ijs[i] = centroidIJ(tripleOf(values[i], 15, 'uv'));
  }
  let i = 0;
  bench(
    'IJToS res 15',
    () => {
      lattice.IJToS(ijs[i++ & (N - 1)], 15, 'uv');
    },
    BENCH_OPTS
  );
});
