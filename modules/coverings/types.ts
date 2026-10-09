// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

/** A set of cells, compacted or not, possibly ending in a compaction marker. */
export type Cells = bigint[] | BigUint64Array;

/**
 * Sorted, disjoint, half-open runs of leaf slots [lo, hi), flattened as
 * [lo0, hi0, lo1, hi1, ...]: the form set operations work on.
 */
export type SlotRuns = bigint[];
