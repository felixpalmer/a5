// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

/**
 * Compact and uncompact functions for A5 DGGS cell indices.
 *
 * These functions allow you to efficiently represent sets of cells by
 * replacing complete sets of sibling cells with their parent cell (compact)
 * or expanding parent cells to their children (uncompact).
 */

export { compact, uncompact } from './compact.optimized';
