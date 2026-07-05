import {describe, it, expect} from 'vitest';
import type {IJ} from 'a5/core/coordinate-systems';
import type {Orientation} from 'a5/lattice';
import {compatSToCell, compatTripleToS, compatIJToS} from 'a5/lattice';
// The original engine, imported directly from its modules (not the index) so
// this comparison stays meaningful when the canonical exports are rewired.
import {sToAnchor, IJToS} from 'a5/lattice/hilbert';
import {anchorToTriple} from 'a5/lattice/triple';

// TEMPORARY equivalence proof: the compat curve (modules/lattice/compat.ts,
// built on the L-system machinery) must be bit-for-bit identical to the
// original engine. This test exists while both implementations are in the
// tree; it is deleted together with the original engine, at which point the
// compat fixtures (tests/fixtures/lattice/compat.json) carry the pin forward.

const orientations: Orientation[] = ['uv', 'vu', 'uw', 'wu', 'vw', 'wv'];

describe('compat curve equals the original engine', () => {
  it('sToTriple matches and tripleToS round-trips, exhaustively at res 1-5', () => {
    for (let resolution = 1; resolution <= 5; resolution++) {
      const numCells = 4 ** resolution;
      for (const orientation of orientations) {
        for (let s = 0; s < numCells; s++) {
          const old = anchorToTriple(sToAnchor(BigInt(s), resolution, orientation));
          const {triple} = compatSToCell(BigInt(s), resolution, orientation);
          if (triple.x !== old.x || triple.y !== old.y || triple.z !== old.z) {
            expect.fail(
              `sToTriple mismatch at s=${s} res=${resolution} ori=${orientation}: ` +
                `compat (${triple.x},${triple.y},${triple.z}) vs original (${old.x},${old.y},${old.z})`
            );
          }
          const back = compatTripleToS(triple, resolution, orientation);
          if (back !== BigInt(s)) {
            expect.fail(`tripleToS round-trip failed at s=${s} res=${resolution} ori=${orientation}: got ${back}`);
          }
        }
      }
    }
  });

  it('sToTriple matches on sampled cells at res 8, 12, 15', () => {
    for (const resolution of [8, 12, 15]) {
      const numCells = 2 ** (2 * resolution);
      for (const orientation of orientations) {
        for (let k = 0; k < 50; k++) {
          const s = BigInt(Math.floor((k * numCells) / 50));
          const old = anchorToTriple(sToAnchor(s, resolution, orientation));
          const {triple} = compatSToCell(s, resolution, orientation);
          expect(triple, `s=${s} res=${resolution} ori=${orientation}`).toEqual(old);
          expect(compatTripleToS(triple, resolution, orientation)).toBe(s);
        }
      }
    }
  });

  it('IJToS matches on interior fractional points at res 3, 5, 8', () => {
    for (const resolution of [3, 5, 8]) {
      const n = 2 ** resolution;
      for (const orientation of orientations) {
        // grid of strictly-interior points of the quintant triangle,
        // offset to avoid cell boundaries
        for (let a = 0; a < 12; a++) {
          for (let b = 0; b < 12; b++) {
            const fi = (a + 0.371) / 13;
            const fj = (b + 0.613) / 13;
            if (fi + fj >= 0.95) continue;
            const ij = [fi * n, fj * n] as IJ;
            const oldS = IJToS(ij, resolution, orientation);
            const newS = compatIJToS(ij, resolution, orientation);
            if (oldS !== newS) {
              expect.fail(
                `IJToS mismatch at (${ij[0]},${ij[1]}) res=${resolution} ori=${orientation}: ` +
                  `compat ${newS} vs original ${oldS}`
              );
            }
          }
        }
      }
    }
  });
});
