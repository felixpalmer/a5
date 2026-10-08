// Spec-level helpers for compaction / covering fixtures. These re-derive the
// encoding from the definitions rather than calling the library's internals,
// so fixtures cross-check the implementation.

const {deserialize, serialize, cellToChildren, origins, WORLD_CELL} = require('../../a5-test.cjs');

/**
 * The compaction marker for resolution r: quintant 60 (bits 63-58), the resolution
 * (bits 55-48) and the marker 1000000 (bits 6-0); all other bits 0.
 */
function compactionMarker(resolution) {
  return (60n << 58n) | (BigInt(resolution) << 48n) | 0b1000000n;
}

/** Compaction marker: quintant 60, marker 1000000, resolution 0-30; the bits with no meaning are ignored. */
const compactionMarkerResolution = cell => Number((cell >> 48n) & 0xffn);
const isCompactionMarker = cell =>
  cell >> 58n === 60n && (cell & 0x7fn) === 0x40n && compactionMarkerResolution(cell) <= 30;

/** A cell's first leaf slot: quintant, then S left-aligned (res-30 S fills 58 bits). */
function firstSlot(cell) {
  if (cell === WORLD_CELL) return 0n;
  const {origin, segment, S, resolution} = deserialize(cell);
  if (resolution === 0) return BigInt(5 * origin.id) << 58n;
  const quintant = BigInt(5 * origin.id + ((segment - origin.firstQuintant + 5) % 5));
  if (resolution === 1) return quintant << 58n;
  return (quintant << 58n) | (BigInt(S) << BigInt(60 - 2 * resolution));
}

/** Sort cells in curve order (the canonical order of a covering). */
const sortByCurve = cells =>
  [...cells].sort((a, b) => {
    const slotA = firstSlot(a);
    const slotB = firstSlot(b);
    return slotA < slotB ? -1 : slotA > slotB ? 1 : 0;
  });

/** The canonical covering for already-compacted cells at resolution r: curve order, then the compaction marker. */
const covering = (cells, resolution) => [...sortByCurve(cells), compactionMarker(resolution)];

/** Brute force: the flat set of res-r cells a set of cells stands for. */
function flatAt(cells, resolution) {
  const out = new Set();
  for (const cell of cells) {
    if (isCompactionMarker(cell)) continue;
    for (const child of cellToChildren(cell, resolution)) out.add(child);
  }
  return out;
}

const sameSet = (a, b) => a.size === b.size && [...a].every(x => b.has(x));

/** A res-30 cell in a given quintant (0-41), exercising each res-30 encoding. */
function res30Cell(quintant, S) {
  const origin = origins[Math.floor(quintant / 5)];
  const segment = ((quintant % 5) + origin.firstQuintant) % 5;
  return serialize({origin, segment, S, resolution: 30});
}

/** Whether calling `fn` throws. */
function throws(fn) {
  try {
    fn();
  } catch {
    return true;
  }
  return false;
}

module.exports = {
  compactionMarker,
  isCompactionMarker,
  compactionMarkerResolution,
  firstSlot,
  sortByCurve,
  covering,
  flatAt,
  sameSet,
  res30Cell,
  throws
};
