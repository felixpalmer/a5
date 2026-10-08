// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// The library as the benchmarks see it: the public API plus the internals they
// measure. `yarn bench` bundles this file into one module (as the published
// library is bundled) and points every `a5` import at it, so calls between
// library functions are direct, rather than going through Vitest's per-module
// import getters, which keep V8 from inlining hot helpers.

export * from '../modules/index';
export * from '../modules/lattice';
export {cellToSpherical} from '../modules/core/cell';
export {deserialize} from '../modules/core/serialization';
export {AuthalicProjection} from '../modules/projections/authalic';
export {DodecahedronProjection} from '../modules/projections/dodecahedron';
export {GnomonicProjection} from '../modules/projections/gnomonic';
