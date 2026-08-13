// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Shared array types for the double-precision linear-algebra helpers in this
// folder (vec2/vec3/mat2/mat2d/quat). Every array is a Float64Array — the tuple
// members exist only so callers may pass array literals; there is no
// Float32Array variant, so intermediate math always stays at double precision.
export type Vec2 = [number, number] | Float64Array;
export type Vec3 = [number, number, number] | Float64Array;
export type Mat2 = [number, number, number, number] | Float64Array;
export type Mat2d = [number, number, number, number, number, number] | Float64Array;
export type Quat = [number, number, number, number] | Float64Array;
