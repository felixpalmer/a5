// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {A5Cell} from './utils';
import {Origin} from './utils';
import {origins} from './origin';

export const FIRST_HILBERT_RESOLUTION = 2;
export const MAX_RESOLUTION = 30;
// IDs below res 30 start with a 6-bit origin (res 0) or quintant, above S
export const QUINTANT_SHIFT = 58n;
export const S_MASK = (1n << QUINTANT_SHIFT) - 1n;

// Abstract cell that contains the whole world, has resolution -1 and 12 children,
// which are the res0 cells.
export const WORLD_CELL = 0n;

// Resolution 30 IDs have no room for a 6-bit quintant: its field is 5, 3 or 1
// bits wide, marked by the tag (lowest bits) ...1, ...100 or ...10000:
//   ...1     → 5-bit quintant (0-31),  58-bit S
//   ...100   → 3-bit quintant (32-39), 58-bit S
//   ...10000 → 1-bit quintant (40-41), 58-bit S
// Quintants 42-59 have no res-30 IDs.
/** The number of quintants (in ID order) with resolution 30 IDs. */
export const RES30_QUINTANTS = 42;

/** The leaf slot of a res-30 ID: its quintant, then its 58-bit S (see Leaf slots below). */
function res30ToSlot(index: bigint): bigint {
  if (index & 1n) return ((index >> 59n) << QUINTANT_SHIFT) | ((index >> 1n) & S_MASK);
  if (index & 0b100n) return (((index >> 61n) + 32n) << QUINTANT_SHIFT) | ((index >> 3n) & S_MASK);
  return (((index >> 63n) + 40n) << QUINTANT_SHIFT) | ((index >> 5n) & S_MASK);
}

/** The res-30 ID of a leaf slot in quintants 0-41. */
function slotToRes30(slot: bigint): bigint {
  const q = slot >> QUINTANT_SHIFT;
  const s = slot & S_MASK;
  if (q < 32n) return (q << 59n) | (s << 1n) | 1n;
  if (q < 40n) return ((q - 32n) << 61n) | (s << 3n) | 0b100n;
  return ((q - 40n) << 63n) | (s << 5n) | 0b10000n;
}

// Leaf slots. The A5 curve, at resolution 30, passes through every leaf
// (res-30) cell of the globe once: picture it as a line of slots, one per leaf
// cell, numbered in curve order from 0 to 60 * 4^29 - 1. A leaf slot is the
// 6-bit quintant (0-59) then the leaf's S, left-aligned below it.
//
// A cell at resolution r occupies 4^(30-r) consecutive slots, an aligned block
// starting at its first slot, and the cells of a resolution step along the
// slots in strides of that size, as the Hilbert curve does. Unlike cell IDs,
// whose layout differs at resolutions 0, 1 and 30, slots put every cell on one
// integer line in curve order, including all 60 quintants at resolution 30.
// A leaf slot is not a cell ID.

export const QUINTANT_SLOTS = 1n << QUINTANT_SHIFT;
export const ORIGIN_SLOTS = 5n * QUINTANT_SLOTS;
export const WORLD_SLOTS = 60n * QUINTANT_SLOTS;

/**
 * By resolution 0..30: the resolution tag (lowest set bit) of a cell below
 * res 30, and the number of slots a cell occupies.
 */
export const RESOLUTION_TAGS: bigint[] = [];
export const SLOT_COUNTS: bigint[] = [];
for (let r = 0; r <= MAX_RESOLUTION; r++) {
  RESOLUTION_TAGS.push(r === 0 ? 1n << 57n : r === 1 ? 1n << 56n : 1n << BigInt(Math.max(59 - 2 * r, 0)));
  SLOT_COUNTS.push(r === 0 ? ORIGIN_SLOTS : r === 1 ? QUINTANT_SLOTS : 1n << BigInt(60 - 2 * r));
}

/** Res-30 IDs end in ...1, ...100 or ...10000: their tag has one of these bits */
export const RES30_TAG_BITS = 0b10101n;

/** The tags of resolutions 2-29: the odd bits 55 down to 1 */
const HILBERT_TAG_BITS = RESOLUTION_TAGS.slice(FIRST_HILBERT_RESOLUTION, MAX_RESOLUTION).reduce(
  (bits, tag) => bits | tag,
  0n
);

/**
 * The first slot a cell occupies. Throws if the value is not an A5 cell ID:
 * its tag (lowest set bit) must be a resolution tag, and its origin (res 0) or
 * quintant (res 1-29) must exist. Every res-30 pattern decodes to an existing
 * quintant (0-41).
 */
export function cellFirstSlot(cell: bigint): bigint {
  // The resolution tag: the lowest set bit (0 for the world cell)
  const tag = cell & -cell;
  if (tag < RESOLUTION_TAGS[1]) {
    if ((tag & RES30_TAG_BITS) !== 0n) return res30ToSlot(cell);
    // Resolutions 2-29, in quintants 0-59: the first slot is the ID without its tag
    if ((tag & HILBERT_TAG_BITS) !== 0n && cell < WORLD_SLOTS) return cell - tag;
    if (tag === 0n) return 0n;
  } else {
    // Resolution 0 (tag bit 57) starts its origin's 5 quintants, 1 (bit 56) its quintant
    const top = cell >> QUINTANT_SHIFT;
    if (tag === RESOLUTION_TAGS[0] && top < 12n) return (5n * top) << QUINTANT_SHIFT;
    if (tag === RESOLUTION_TAGS[1] && top < 60n) return top << QUINTANT_SHIFT;
  }
  throw invalidCell(cell);
}

/**
 * The first slot of a cell, without checking that the value is an A5 cell ID:
 * for searches, which check the cell they land on. A value that is not a cell
 * gives a meaningless slot.
 */
export function cellFirstSlotUnchecked(cell: bigint): bigint {
  const tag = cell & -cell;
  if (tag === 0n) return 0n;
  if (tag >= RESOLUTION_TAGS[1]) {
    const top = cell >> QUINTANT_SHIFT;
    return (tag === RESOLUTION_TAGS[0] ? 5n * top : top) << QUINTANT_SHIFT;
  }
  if ((tag & RES30_TAG_BITS) !== 0n) return res30ToSlot(cell);
  return cell - tag;
}

/**
 * The resolution of a cell, as `getResolution` gives it, but throwing if the
 * value is not an A5 cell ID (see `cellFirstSlot` for what that requires).
 */
export function checkedResolution(cell: bigint): number {
  const tag = cell & -cell;
  if (tag === 0n) return -1;
  const bit = Math.log2(Number(tag)); // exact, as a power of two converts exactly
  if (bit < 56) {
    if (bit % 2 === 1 && cell < WORLD_SLOTS) return (59 - bit) >> 1;
    if (bit <= 4 && bit % 2 === 0) return MAX_RESOLUTION;
  } else {
    const top = cell >> QUINTANT_SHIFT;
    if (bit === 57 && top < 12n) return 0;
    if (bit === 56 && top < 60n) return 1;
  }
  throw invalidCell(cell);
}

function invalidCell(cell: bigint): Error {
  return new Error(`Invalid cell: 0x${cell.toString(16)}`);
}

/** The number of slots a cell occupies. */
export function cellSlotCount(cell: bigint): bigint {
  // The resolution tag: the lowest set bit (0 for the world cell)
  const tag = cell & -cell;
  if (tag === 0n) return WORLD_SLOTS;
  if (tag === RESOLUTION_TAGS[0]) return ORIGIN_SLOTS;
  if (tag === RESOLUTION_TAGS[1]) return QUINTANT_SLOTS;
  if ((tag & RES30_TAG_BITS) !== 0n) return 1n;
  // Resolutions 2-29: the slots are symmetric about the ID
  return tag << 1n;
}

/** The res-r cell whose block of slots starts at `slot`. */
export function slotToCell(slot: bigint, resolution: number): bigint {
  if (resolution < 0) return WORLD_CELL;
  if (resolution > 0 && resolution < MAX_RESOLUTION) return slot + RESOLUTION_TAGS[resolution];
  if (resolution === 0) return (((slot >> QUINTANT_SHIFT) / 5n) << QUINTANT_SHIFT) | RESOLUTION_TAGS[0];
  return slotToRes30(slot);
}

export function getResolution(index: bigint): number {
  // The resolution tag: the lowest set bit (0 for the world cell). Its position
  // gives the resolution: bit 57 is res 0, 56 res 1, 59 - 2r res r (2-29), and
  // res 30 uses the patterns ...1, ...100 and ...10000 (bits 0, 2 and 4).
  const tag = index & -index;
  if (tag === 0n) return -1;
  const bit = Math.log2(Number(tag)); // exact, as a power of two converts exactly
  if (bit === 57) return 0;
  if (bit === 56) return 1;
  if (bit <= 4 && bit % 2 === 0) return MAX_RESOLUTION;
  return (59 - bit) >> 1;
}

export function deserialize(index: bigint): A5Cell {
  const resolution = getResolution(index);

  // Technically not a resolution, but can be useful to think of as an
  // abstract cell that contains the whole world
  if (resolution === -1) {
    return {origin: origins[0], segment: 0, S: 0n, resolution};
  }

  // The cell's first slot holds its quintant, then its S above the slots of one cell
  const slot = cellFirstSlot(index);
  const quintant = Number(slot >> QUINTANT_SHIFT);
  const origin = origins[Math.floor(quintant / 5)];
  if (resolution === 0) return {origin, segment: 0, S: 0n, resolution};

  const segment = (quintant + origin.firstQuintant) % 5;
  const S = resolution < FIRST_HILBERT_RESOLUTION ? 0n : (slot & S_MASK) / SLOT_COUNTS[resolution];
  return {origin, segment, S, resolution};
}

export function serialize(cell: A5Cell): bigint {
  const {origin, segment, S, resolution} = cell;
  if (resolution > MAX_RESOLUTION) {
    throw new Error(`Resolution (${resolution}) is too large`);
  }

  if (resolution === -1) return WORLD_CELL;
  if (resolution === 0) return slotToCell(BigInt(5 * origin.id) * QUINTANT_SLOTS, 0);

  // The cell's first slot: its quintant, then S cells of this resolution into it
  const offset = resolution >= FIRST_HILBERT_RESOLUTION ? BigInt(S) * SLOT_COUNTS[resolution] : 0n;
  if (offset >= QUINTANT_SLOTS) {
    throw new Error(`S (${S}) is too large for resolution level ${resolution}`);
  }

  const quintant = 5 * origin.id + ((segment - origin.firstQuintant + 5) % 5);
  // Quintants past RES30_QUINTANTS have no res-30 IDs: fall back to res 29
  if (resolution === MAX_RESOLUTION && quintant >= RES30_QUINTANTS) {
    return serialize({origin, segment, S: S >> 2n, resolution: MAX_RESOLUTION - 1});
  }
  return slotToCell((BigInt(quintant) << QUINTANT_SHIFT) + offset, resolution);
}

// The segments of an origin in ID (quintant) order, by its firstQuintant
const QUINTANT_SEGMENTS: number[][] = [0, 1, 2, 3, 4].map(first => [0, 1, 2, 3, 4].map(n => (n + first) % 5));

/**
 * The children of a cell at `childResolution` (default: the next resolution),
 * in ascending ID order.
 */
export function cellToChildren(index: bigint, childResolution?: number): bigint[] {
  const {origin, segment, S, resolution: currentResolution} = deserialize(index);
  const newResolution = childResolution ?? currentResolution + 1;

  if (newResolution < currentResolution) {
    throw new Error(
      `Target resolution (${newResolution}) must be equal to or greater than current resolution (${currentResolution})`
    );
  }

  if (newResolution > MAX_RESOLUTION) {
    throw new Error(`Target resolution (${newResolution}) exceeds maximum resolution (${MAX_RESOLUTION})`);
  }

  // If target resolution equals current resolution, return the original cell
  if (newResolution === currentResolution) {
    return [index];
  }

  let newOrigins: Origin[] = [origin];
  if (currentResolution === -1) {
    newOrigins = origins;
  }
  const allSegments = (currentResolution === -1 && newResolution > 0) || currentResolution === 0;

  const resolutionDiff = newResolution - Math.max(currentResolution, FIRST_HILBERT_RESOLUTION - 1);
  const childrenCount = Math.pow(4, resolutionDiff);
  const children: bigint[] = [];
  const shiftedS = S << BigInt(2 * resolutionDiff);
  for (const newOrigin of newOrigins) {
    // An origin's quintants in ID order: the n-th is segment (n + firstQuintant) % 5
    const newSegments = allSegments ? QUINTANT_SEGMENTS[newOrigin.firstQuintant] : [segment];
    for (const newSegment of newSegments) {
      for (let i = 0; i < childrenCount; i++) {
        const newS = shiftedS + BigInt(i);
        children.push(serialize({origin: newOrigin, segment: newSegment, S: newS, resolution: newResolution}));
      }
    }
  }

  return children;
}

/** Whether a cell is at resolution 30: its tag is one of ...1, ...100 or ...10000. */
function isMaxResolution(index: bigint): boolean {
  return (index & -index & RES30_TAG_BITS) !== 0n;
}

/**
 * Re-pack a res-30 cell into the standard res-29 bit layout (6-bit quintant
 * in [63..58], 56-bit S in [57..2], tag at bit 1). The 58-bit res-30 S is
 * truncated by 2 bits, exactly as `cellToParent(_, 29)` would.
 */
function normalizeRes30(index: bigint): bigint {
  // The res-29 parent starts at the same slot, rounded down to its 4 children
  return (res30ToSlot(index) & ~3n) | 0b10n;
}

/**
 * Walk a cell up the hierarchy to a coarser resolution.
 *
 * Implemented as pure bit ops over the encoded index — no deserialize /
 * serialize round-trip. The three encoding regimes (non-Hilbert res 0/1,
 * Hilbert res 2..29, variable-width res 30) all reduce to the same shape
 * after a small amount of normalization.
 */
export function cellToParent(index: bigint, parentResolution?: number): bigint {
  if (parentResolution === undefined) parentResolution = getResolution(index) - 1;

  // Special case: parent of resolution 0 cells is the world cell
  if (parentResolution === -1) return WORLD_CELL;
  if (parentResolution < -1 || parentResolution > MAX_RESOLUTION) {
    throw new Error(`Target resolution (${parentResolution}) is out of range`);
  }
  if (index === WORLD_CELL) {
    throw new Error(`Target resolution (${parentResolution}) must be equal to or less than current resolution (-1)`);
  }

  // Normalize res-30 children to the standard res-29 layout. After this,
  // the fast paths below treat the cell as a Hilbert-range cell.
  let c = index;
  if (isMaxResolution(index)) {
    if (parentResolution === MAX_RESOLUTION) return index; // identity (already res 30)
    c = normalizeRes30(index);
    if (parentResolution === MAX_RESOLUTION - 1) return c;
  }

  if (parentResolution >= FIRST_HILBERT_RESOLUTION) {
    // Hilbert-range parent: clear bits below the parent tag, set the tag.
    // Identity (parent res === child res) falls out for free: the tag lands
    // in the same position and bits below the keep cut are already zero.
    const keepShift = BigInt(60 - 2 * parentResolution);
    return ((c >> keepShift) << keepShift) | (1n << BigInt(59 - 2 * parentResolution));
  }

  if (parentResolution === 1) {
    // Top 6 bits already encode 5*originId + segmentN; only the tag moves.
    // Identity (cell already at res 1) is preserved.
    return ((c >> 58n) << 58n) | (1n << 56n);
  }

  // parentResolution === 0: top 6 bits change from quintant (0-59) to originId (0-11).
  // Identity (cell already at res 0) needs an explicit guard since dividing
  // an originId by 5 would corrupt it. A res-0 cell has bit 57 set with all
  // lower bits zero — equivalently, all bottom 57 bits are zero.
  if ((c & ((1n << 57n) - 1n)) === 0n) return c;
  return (((c >> 58n) / 5n) << 58n) | (1n << 57n);
}

/**
 * Returns resolution 0 cells of the A5 system, which serve as a starting point
 * for all higher-resolution subdivisions in the hierarchy.
 *
 * @returns Array of 12 cell indices
 */
// The 12 resolution-0 cells (dodecahedron faces) are a constant — compute once.
let RES0_CELLS: bigint[] | undefined;
export function getRes0Cells(): bigint[] {
  if (RES0_CELLS === undefined) RES0_CELLS = cellToChildren(WORLD_CELL, 0);
  return [...RES0_CELLS];
}

/**
 * Bit-level descendant test: is `child` the same cell as `parent`, or one of
 * its descendants at any deeper resolution? Compares the high (quintant +
 * parent's Hilbert) bits in a single shift, no deserialize needed.
 *
 * Restricted to the Hilbert range: `parentResolution` must be in
 * [FIRST_HILBERT_RESOLUTION .. MAX_RESOLUTION - 1], and `child` must not be
 * a resolution-30 cell (whose encoding uses a variable quintant shift).
 * Callers handling those cases should fall back to `cellToParent` equality.
 */
export function isChildOf(child: bigint, parent: bigint, parentResolution: number): boolean {
  // Parent's identifying bits occupy positions 63..(60-2P): 6 quintant bits
  // + 2(P-1) Hilbert bits. Bit (59-2P) is the tag, below that is zero.
  // Shifting both right by (60-2P) keeps exactly those identifying bits and
  // discards the tag, so a descendant matches iff the high bits match.
  const shift = BigInt(60 - 2 * parentResolution);
  return child >> shift === parent >> shift;
}
