// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// Plain array types for the small linear-algebra helpers in this folder.
// A5 stores every coordinate as Float64Array (double precision) — the tuple
// members exist only so callers may pass array literals. Unlike gl-matrix's
// `vec2 = [number, number] | Float32Array`, there is no Float32Array variant,
// so precision cannot silently drop to single precision (Kahan §10).
export type Vec2 = [number, number] | Float64Array;
export type Vec3 = [number, number, number] | Float64Array;
export type Mat2 = [number, number, number, number] | Float64Array;
export type Mat2d = [number, number, number, number, number, number] | Float64Array;
export type Quat = [number, number, number, number] | Float64Array;
