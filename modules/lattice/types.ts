// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type { IJ } from '../core/coordinate-systems';

/**
 * Orientation of the Hilbert curve. The curve fills a space defined by the triangle with vertices
 * u, v & w. The orientation describes which corner the curve starts and ends at, e.g. wv is a
 * curve that starts at w and ends at v.
 */
export type Orientation = 'uv' | 'vu' | 'uw' | 'wu' | 'vw' | 'wv';

export type Quaternary = 0 | 1 | 2 | 3;
export const YES = -1 as const;
export const NO = 1 as const;
export type Flip = typeof YES | typeof NO;

/** Position in the Hilbert curve with quaternary value, offset, and flip states. */
export type Anchor = {
  q: Quaternary;
  offset: IJ;
  flips: [flipX: Flip, flipY: Flip];
};
