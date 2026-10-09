import {describe, it, expect} from 'vitest';
import {FACE_ADJACENCY, seamTransform, seamTriple} from 'a5/core/face-adjacency';
import {TWO_PI_OVER_5} from 'a5/core/constants';
import type {Face} from 'a5/core/coordinate-systems';
import type {OriginId} from 'a5/core/utils';
import {getPentagonCenter} from 'a5/core/tiling';
import {tripleFlavor, tripleInBounds} from 'a5/lattice';
import {DodecahedronProjection} from 'a5/projections/dodecahedron';

const dodecahedron = new DodecahedronProjection();

const apply = (map: Float64Array, [x, y]: number[]) => [
  map[0] * x + map[2] * y + map[4],
  map[1] * x + map[3] * y + map[5]
];

describe('face seam', () => {
  it('seamTransform agrees with the projection across every base edge', () => {
    for (let o = 0; o < 12; o++) {
      for (let q = 0; q < 5; q++) {
        const [adjacentId, adjacentQuintant] = FACE_ADJACENCY[o][q];
        const map = seamTransform(o as OriginId, q);
        // Points of the neighbor's quintant near the shared edge, projected into this face
        for (const [r, angle] of [
          [0.5, 0],
          [0.55, -0.4],
          [0.55, 0.4]
        ]) {
          const gamma = adjacentQuintant * TWO_PI_OVER_5 + angle;
          const point = [r * Math.cos(gamma), r * Math.sin(gamma)];
          const landed = dodecahedron.forward(dodecahedron.inverse(point as Face, adjacentId), o as OriginId);
          const mapped = apply(map, landed);
          expect(mapped[0]).toBeCloseTo(point[0], 10);
          expect(mapped[1]).toBeCloseTo(point[1], 10);
        }
      }
    }
  });

  it('seamTriple is seamTransform on cells', () => {
    for (const hilbertRes of [1, 2, 5]) {
      const maxRow = (1 << hilbertRes) - 1;
      for (let q = 0; q < 5; q++) {
        const map = seamTransform(0, q);
        const adjacentQuintant = FACE_ADJACENCY[0][q][1];
        // The cells of the two rows along the base edge
        for (let y = Math.max(0, maxRow - 1); y <= maxRow; y++) {
          for (let x = -y - 1; x <= 0; x++) {
            for (const parity of [0, 1]) {
              const triple = {x, y, z: parity - x - y};
              if (!tripleInBounds(triple, maxRow)) continue;
              const flavor = tripleFlavor(triple, maxRow);
              const image = seamTriple(triple, maxRow);
              expect(tripleFlavor(image, maxRow)).toBe(flavor ^ 1);
              const center = apply(map, getPentagonCenter(hilbertRes, q, triple, flavor));
              const imageCenter = getPentagonCenter(hilbertRes, adjacentQuintant, image, flavor ^ 1);
              expect(center[0]).toBeCloseTo(imageCenter[0], 10);
              expect(center[1]).toBeCloseTo(imageCenter[1], 10);
            }
          }
        }
      }
    }
  });
});
