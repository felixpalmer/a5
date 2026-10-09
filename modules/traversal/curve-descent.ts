// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

// A region found by descending the cell hierarchy: a cell wholly inside is kept
// whole, one wholly outside is dropped, and the rest split, so the work follows
// the region's boundary rather than its area. The descent runs in curve order,
// stepping the curve one digit per level (see lattice curveChild), so the cells
// come out as sorted slot runs, with no cell IDs to encode and nothing to sort.

import type {Face} from '../core/coordinate-systems';
import {FIRST_HILBERT_RESOLUTION, SLOT_COUNTS} from '../core/serialization';
import {getPentagonCenter} from '../core/tiling';
import * as vec2 from '../math/vec2';
import type {OriginId} from '../core/utils';
import {appendSlotRun} from '../coverings/slot-runs';
import type {SlotRuns} from '../coverings/types';
import {curveChild, tripleToCurveNode} from '../lattice';
import type {CurveNode, Orientation} from '../lattice';
import {fillQuintantTables, QUINTANT_ORIENTATION, QUINTANT_PREFIX} from './triple-cells';

/** How a cell lies relative to the region: see `CurveDescentClassifier`. */
export const OUTSIDE = 0;
export const INSIDE = 1;
export const SPLIT = 2;

/**
 * Classifies a cell of the descent by its center, given in its face's frame:
 * INSIDE keeps the cell whole (all its cells at the target resolution are in
 * the region), OUTSIDE drops it (none are), and SPLIT descends into its
 * children. At the target resolution it must decide, INSIDE or OUTSIDE.
 *
 * `center` is reused between calls: read it, don't keep it.
 */
export type CurveDescentClassifier = (originId: OriginId, resolution: number, center: Face, slot: bigint) => number;

// The descent's inputs, shared by every level of `descend`, and its scratch:
// the triple and descent state of the cell being visited at each level (a
// level's are only overwritten once its cell's children are done)
interface Descent {
  classify: CurveDescentClassifier;
  /** Hilbert level of the target resolution */
  targetLevel: number;
  originId: OriginId;
  quintant: number;
  orientation: Orientation;
  /** Output, as sorted slot runs */
  runs: SlotRuns;
  triples: {x: number; y: number; z: number}[];
  nodes: CurveNode[];
  center: Face;
}

/**
 * Descend from `starts` — non-overlapping cells at one Hilbert level, as flat
 * triples (originId, quintant, x, y, z), in any order — to `resolution`,
 * appending the cells of the region `classify` describes to `runs`, as slot
 * runs in curve order.
 */
export function descendInCurveOrder(
  starts: number[],
  startLevel: number,
  resolution: number,
  classify: CurveDescentClassifier,
  runs: SlotRuns
): void {
  fillQuintantTables();
  const count = starts.length / 5;
  const slots: bigint[] = new Array(count);
  const states: {s: bigint; flavor: number; node: CurveNode}[] = new Array(count);
  const shift = BigInt(58 - 2 * startLevel);
  for (let i = 0; i < count; i++) {
    const c = 5 * i;
    const q = starts[c] * 5 + starts[c + 1];
    const triple = {x: starts[c + 2], y: starts[c + 3], z: starts[c + 4]};
    states[i] = tripleToCurveNode(triple, startLevel, QUINTANT_ORIENTATION[q]);
    slots[i] = QUINTANT_PREFIX[q] | (states[i].s << shift);
  }
  const order: number[] = new Array(count);
  for (let i = 0; i < count; i++) order[i] = i;
  order.sort((a, b) => (slots[a] < slots[b] ? -1 : slots[a] > slots[b] ? 1 : 0));

  const targetLevel = resolution - FIRST_HILBERT_RESOLUTION + 1;
  const d: Descent = {
    classify,
    targetLevel,
    originId: 0 as OriginId,
    quintant: 0,
    orientation: 'uv',
    runs,
    triples: [],
    nodes: [],
    center: vec2.create() as Face
  };
  for (let level = 0; level <= targetLevel; level++) {
    d.triples.push({x: 0, y: 0, z: 0});
    d.nodes.push({motif: 0, flip: 0, posA: 0, posB: 0});
  }
  for (let k = 0; k < count; k++) {
    const i = order[k];
    const c = 5 * i;
    const q = starts[c] * 5 + starts[c + 1];
    d.originId = starts[c] as OriginId;
    d.quintant = starts[c + 1];
    d.orientation = QUINTANT_ORIENTATION[q];
    const triple = d.triples[startLevel];
    triple.x = starts[c + 2];
    triple.y = starts[c + 3];
    triple.z = starts[c + 4];
    const node = d.nodes[startLevel];
    const startNode = states[i].node;
    node.motif = startNode.motif;
    node.flip = startNode.flip;
    node.posA = startNode.posA;
    node.posB = startNode.posB;
    descend(d, startLevel, states[i].flavor, slots[i]);
  }
}

/** Visit the cell at Hilbert `level` (its triple and descent state in the scratch) with the given flavor and first slot. */
function descend(d: Descent, level: number, flavor: number, slot: bigint): void {
  const resolution = level + FIRST_HILBERT_RESOLUTION - 1;
  getPentagonCenter(level, d.quintant, d.triples[level], flavor, d.center);
  const kind = d.classify(d.originId, resolution, d.center, slot);
  if (kind === INSIDE) {
    appendSlotRun(d.runs, slot, slot + SLOT_COUNTS[resolution]);
    return;
  }
  if (kind === OUTSIDE || level === d.targetLevel) return;
  // The children's slots follow one another in curve order
  const node = d.nodes[level];
  const childTriple = d.triples[level + 1];
  const childNode = d.nodes[level + 1];
  const childSlots = SLOT_COUNTS[resolution + 1];
  let childSlot = slot;
  for (let digit = 0; digit < 4; digit++) {
    const childFlavor = curveChild(node, digit, level + 1, d.orientation, childTriple, childNode);
    descend(d, level + 1, childFlavor, childSlot);
    childSlot += childSlots;
  }
}
