// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

/**
 * Which vertex of each face triangle the equal-area projection radiates from.
 *
 * Both choices are equal-area; they differ in where the projection's cusps fall
 * and in how it distorts shape. A5 uses DSEA, radiating from the dodecahedron
 * face center. ISEA radiates from the corner instead — the face center of the
 * dual icosahedron, hence the name.
 */
export type ProjectionMode = 'dsea' | 'isea';

export const DEFAULT_PROJECTION_MODE: ProjectionMode = 'dsea';
