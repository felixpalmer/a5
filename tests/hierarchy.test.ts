import { describe, it, expect } from 'vitest';
import { PentagonShape } from 'a5/geometry/pentagon';
import type { Pentagon } from 'a5/geometry/pentagon';
import { sToAnchor } from 'a5/lattice';
import type { Orientation } from 'a5/lattice';
import { getPentagonVertices } from 'a5/core/tiling';
import { vec2 } from 'gl-matrix';

function generateCells(resolution: number, orientation: Orientation): Pentagon[] {
  const sequence = Array.from({length: Math.pow(4, resolution)}, (_, i) => i);
  const anchors = sequence.map(s => sToAnchor(s, resolution, orientation));
  return anchors.map(anchor => 
    getPentagonVertices(resolution, 0, anchor).getVertices()
  );
}

function verifyHierarchy(resolution: number, orientation: Orientation): void {
  const level1Cells = generateCells(resolution, orientation);
  const level2Cells = generateCells(resolution + 1, orientation);

  let failedPentagon: PentagonShape | null = null;
  let failedChild: vec2[] | null = null;
  for (let i = 0; i < level2Cells.length; i++) {
    const child = level2Cells[i];
    const parent = level1Cells[Math.floor(i / 4)];
    const pentagon = new PentagonShape(parent);
    let contained = false;
    for (const vertex of child) {
      if (pentagon.containsPoint(vertex) > 0) {
        contained = true;
        break;
      }
    }
    if (!contained) {
      failedPentagon = pentagon;
      failedChild = child;
    }
  }
  if (failedPentagon && failedChild) {
    console.log('Pentagon:', failedPentagon.getVertices());
    console.log('did not contain any of:', failedChild);
  }
  expect(failedPentagon).toBeNull();
  expect(failedChild).toBeNull();
}

describe('Cell Hierarchy', () => {
  const orientations: Orientation[] = ['uv', 'vu', 'uw', 'wu', 'vw', 'wv'];
  orientations.forEach(orientation => {
    [1, 2, 3, 4, 5, 6].forEach(resolution => {
      it(`Hierarchy ${orientation} correct for resolution ${resolution}`, () => {
        verifyHierarchy(resolution, orientation);
      });
    });
  });
}); 