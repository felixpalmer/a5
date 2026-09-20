// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

/**
 * Which vertex of each face triangle the equal-area projection radiates from.
 *
 * A face triangle has three vertices, so there are exactly three choices, and
 * they are the three cyclic rotations of the same ordering — never swaps, since
 * the closed-form equal-area projection depends on the winding. All three are
 * equal-area; they differ in where the cusps fall and in how shape is distorted.
 *
 * - `dsea` radiates from the dodecahedron face center. A5's projection.
 * - `isea` radiates from the corner, the face center of the dual icosahedron.
 * - `rtsea` radiates from the edge midpoint, which is a face centre of the
 *   rhombic triacontahedron. Included so the design space is closed rather than
 *   because anything uses it.
 *
 * Each is named for the solid whose face fan it radiates from, following the
 * precedent set by ISEA and RTSEA. All three decompose into the same 120 Mobius
 * triangles of the icosahedral symmetry group, differing only in which vertex of
 * each triangle leads.
 *
 * `gnomonic` is not one of them and is not equal-area. It is the plain central
 * projection from the sphere onto the face plane, with no triangle decomposition
 * at all. It is included as the baseline the Snyder family is measured against:
 * it maps great circles to straight lines, so it has no cusps and no sag, and it
 * shows exactly what the equal-area property costs.
 */
export type ProjectionMode = 'dsea' | 'isea' | 'rtsea' | 'gnomonic';

export const DEFAULT_PROJECTION_MODE: ProjectionMode = 'dsea';
