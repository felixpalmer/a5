import { describe, it, expect, test } from 'vitest'
import { getResolution, serialize, deserialize, FIRST_HILBERT_RESOLUTION, getRes0Cells } from 'a5/core/serialization';

const MAX_RESOLUTION = 30;
const REMOVAL_MASK = 0x3ffffffffffffffn;
import { A5Cell } from 'a5/core/utils';
import { origins } from 'a5/core/origin';
import TEST_IDS from './test-ids.json';
import { cellToParent, cellToChildren } from 'a5/core/serialization';
import { u64ToHex } from 'a5/core/hex';

const RESOLUTION_MASKS = [
  // Non-Hilbert resolutions
  '0000001000000000000000000000000000000000000000000000000000000000', // Dodecahedron faces
  '0000000100000000000000000000000000000000000000000000000000000000', // Quintants
  // Hilbert resolutions
  '0000000010000000000000000000000000000000000000000000000000000000',
  '0000000000100000000000000000000000000000000000000000000000000000',
  '0000000000001000000000000000000000000000000000000000000000000000',
  '0000000000000010000000000000000000000000000000000000000000000000',
  '0000000000000000100000000000000000000000000000000000000000000000',
  '0000000000000000001000000000000000000000000000000000000000000000',
  '0000000000000000000010000000000000000000000000000000000000000000',
  '0000000000000000000000100000000000000000000000000000000000000000',
  '0000000000000000000000001000000000000000000000000000000000000000',
  '0000000000000000000000000010000000000000000000000000000000000000',
  '0000000000000000000000000000100000000000000000000000000000000000',
  '0000000000000000000000000000001000000000000000000000000000000000',
  '0000000000000000000000000000000010000000000000000000000000000000',
  '0000000000000000000000000000000000100000000000000000000000000000',
  '0000000000000000000000000000000000001000000000000000000000000000',
  '0000000000000000000000000000000000000010000000000000000000000000',
  '0000000000000000000000000000000000000000100000000000000000000000',
  '0000000000000000000000000000000000000000001000000000000000000000',
  '0000000000000000000000000000000000000000000010000000000000000000',
  '0000000000000000000000000000000000000000000000100000000000000000',
  '0000000000000000000000000000000000000000000000001000000000000000',
  '0000000000000000000000000000000000000000000000000010000000000000',
  '0000000000000000000000000000000000000000000000000000100000000000',
  '0000000000000000000000000000000000000000000000000000001000000000',
  '0000000000000000000000000000000000000000000000000000000010000000',
  '0000000000000000000000000000000000000000000000000000000000100000',
  '0000000000000000000000000000000000000000000000000000000000001000',
  '0000000000000000000000000000000000000000000000000000000000000010',
  // Point level
  //'0000000000000000000000000000000000000000000000000000000000000001', // TODO
];

const origin0 = JSON.parse(JSON.stringify(origins[0])); // Use first origin for most tests

describe('serialize', () => {

  test('Correct number of masks', () => {
    expect(RESOLUTION_MASKS.length).toBe(MAX_RESOLUTION); // TODO add point level
  });

  test('Removal mask is correct', () => {
    const originSegmentBits = ''.padStart(6, '0');
    const remainingBits = ''.padStart(58, '1');
    const expected = BigInt(`0b${originSegmentBits}${remainingBits}`);
    expect(REMOVAL_MASK).toBe(expected);
  });

  test('encodes resolution correctly for different values', () => {
    const testCases = RESOLUTION_MASKS.map((_, i) => (
      // Origin 0 has first quintant 4, so start use segment 4 to obtain start of Hilbert curve
      {origin: origin0, segment: 4, S: 0n, resolution: i}
    ));

    testCases.forEach((input, i) => {
      const serialized = serialize(input);
      expect(serialized.toString(2).padStart(64, '0')).toBe(RESOLUTION_MASKS[i]);
    });
  });

  test('correctly extracts resolution', () => {
    RESOLUTION_MASKS.forEach((binary, i) => {
      const bitCount = binary.length;
      expect(bitCount).toBe(64);
      const N = BigInt(`0b${binary}`);
      const resolution = getResolution(N);
      expect(resolution).toBe(i);
    });
  });

  test('encodes origin, segment and S correctly', () => {
    // Origin 0 has first quintant 4, so start use segment 4 to obtain start of Hilbert curve
    const cell: A5Cell = { origin: origin0, segment: 4, S: 0n, resolution: MAX_RESOLUTION - 1 };
    const serialized = serialize(cell);
    expect(serialized).toBe(0b10n)
  });

  test('throws error when S is too large for resolution', () => {
    const cell: A5Cell = {
      origin: origin0,
      segment: 0,
      S: 16n, // Too large for resolution 1 (max is 15)
      resolution: 3
    };
    
    expect(() => serialize(cell)).toThrow('S (16) is too large for resolution level 3');
  });

  test('throws error when resolution exceeds maximum', () => {
    const cell: A5Cell = {
      origin: origin0,
      segment: 0,
      S: 0n,
      resolution: 31 // MAX_RESOLUTION is 30
    }

    expect(() => serialize(cell)).toThrow('Resolution (31) is too large');
  });

  describe('round trip', () => {
    test.skip('resolution masks', () => {
      RESOLUTION_MASKS.forEach(binary => {
        const serialized = BigInt(`0b${binary}`);
        const deserialized = deserialize(serialized);
        const reserialized = serialize(deserialized);
        expect(reserialized).toBe(serialized);
      });
    });

    for (let n = 1; n < 12; n++) {
      const originSegmentId = (5 * n).toString(2).padStart(6, '0');
      test(`resolution masks with origin ${n} (${originSegmentId})`, () => {
        RESOLUTION_MASKS.slice(FIRST_HILBERT_RESOLUTION).forEach(binary => {
          const serialized = BigInt(`0b${originSegmentId}${binary.slice(6)}`);
          const deserialized = deserialize(serialized);
          const reserialized = serialize(deserialized);
          expect(reserialized).toBe(serialized);
        });
      });
    }

    test('test ids', () => {
      TEST_IDS.forEach(id => {
        const serialized = BigInt(`0x${id}`);
        const deserialized = deserialize(serialized);
        const reserialized = serialize(deserialized);
        expect(reserialized).toBe(serialized);
      });
    });
  });
});

describe('hierarchy', () => {
  test('round trip between cellToParent and cellToChildren', () => {
    TEST_IDS.forEach(id => {
      const cell = BigInt(`0x${id}`);
      const child = cellToChildren(cell)[0];
      const parent = cellToParent(child);
      expect(parent).toBe(cell);

      const children = cellToChildren(cell);
      const parents = children.map(c => cellToParent(c));
      expect(parents.every(p => p === cell)).toBe(true);
    });
  });

  test('cellToChildren with same resolution returns original cell', () => {
    TEST_IDS.forEach(id => {
      const cell = BigInt(`0x${id}`);
      const currentResolution = getResolution(cell);

      // Test with explicit childResolution equal to current resolution
      const children = cellToChildren(cell, currentResolution);

      // Should return array with just the original cell
      expect(children.length).toBe(1);
      expect(children[0]).toBe(cell);
    });
  });

  test('cellToParent with same resolution returns original cell', () => {
    TEST_IDS.forEach(id => {
      const cell = BigInt(`0x${id}`);
      const currentResolution = getResolution(cell);

      // Test with explicit parentResolution equal to current resolution
      const parent = cellToParent(cell, currentResolution);

      // Should return the original cell
      expect(parent).toBe(cell);
    });
  });
  
  test('non-Hilbert to non-Hilbert hierarchy', () => {
    // Test resolution 0 to 1 (both non-Hilbert)
    const cell = serialize({origin: origin0, segment: 0, S: 0n, resolution: 0});
    const children = cellToChildren(cell);
    expect(children.length).toBe(5);
    children.forEach(child => {
      const parent = cellToParent(child);
      expect(parent).toBe(cell);
    });
  });

  test('non-Hilbert to Hilbert hierarchy', () => {
    // Test resolution 1 to 2 (non-Hilbert to Hilbert)
    const cell = serialize({origin: origin0, segment: 0, S: 0n, resolution: 1});
    const children = cellToChildren(cell);
    expect(children.length).toBe(4);
    children.forEach(child => {
      const parent = cellToParent(child);
      expect(parent).toBe(cell);
    });
  });

  test('Hilbert to non-Hilbert hierarchy', () => {
    // Test resolution 2 to 1 (Hilbert to non-Hilbert)
    const cell = serialize({origin: origin0, segment: 0, S: 0n, resolution: 2});
    const parent = cellToParent(cell, 1);
    const children = cellToChildren(parent);
    expect(children.length).toBe(4);
    expect(children).toContain(cell);
  });

  test('low resolution hierarchy chain', () => {
    // Test a chain of resolutions from 0 to 4
    const resolutions = [0, 1, 2, 3, 4];
    const cells = resolutions.map(res => 
      serialize({origin: origin0, segment: 0, S: 0n, resolution: res})
    );

    // Test parent relationships
    for (let i = 1; i < cells.length; i++) {
      const parent = cellToParent(cells[i]);
      expect(parent).toBe(cells[i-1]);
    }

    // Test children relationships
    for (let i = 0; i < cells.length - 1; i++) {
      const children = cellToChildren(cells[i]);
      expect(children).toContain(cells[i+1]);
    }
  });

  test('base cell division counts', () => {
    // Start with the base cell (resolution 0)
    const baseCell = serialize({origin: origin0, segment: 0, S: 0n, resolution: -1});
    let currentCells = [baseCell];
    const expectedCounts = [12, 60, 240, 960]; // 12, 12*5, 12*5*4, 12*5*4*4

    // Test each resolution level up to 4
    for (let resolution = 0; resolution < 4; resolution++) {
      // Get all children of current cells
      const allChildren = currentCells.flatMap(cell => cellToChildren(cell));
      
      // Verify the total number of cells matches expected
      expect(allChildren.length).toBe(expectedCounts[resolution]);
      
      // Update current cells for next iteration
      currentCells = allChildren;
    }
  });
});

describe('getRes0Cells', () => {
  test('returns 12 resolution 0 cells', () => {
    const res0Cells = getRes0Cells();
    expect(res0Cells.length).toBe(12);
    
    // Each cell should have resolution 0
    res0Cells.forEach(cell => {
      expect(getResolution(cell)).toBe(0);
    });
    
    // Expected hex values for the 12 resolution 0 cells
    const expectedHexValues = ['2', '6', 'a', 'e', '12', '16', '1a', '1e', '22', '26', '2a', '2e']
      .map((hex, i) => hex.padEnd(i < 4 ? 15 : 16, '0'));
    
    // Verify each cell matches the expected hex value
    res0Cells.forEach((cell, index) => {
      expect(u64ToHex(cell)).toBe(expectedHexValues[index]);
    });
  });
});

// A bit broken, can generate invalid ids
function randomId() {
  const originSegment = Math.floor(Math.random() * 60).toString(2).padStart(6, '0');
  const resolution = Math.floor(Math.random() * (MAX_RESOLUTION - 1));
  const S = Math.floor(Math.random() * (1 << (2 * resolution)));
  const Sbits = S.toString(2).padStart(2 * resolution, '0');
  const id = `${originSegment}${Sbits}10`.padEnd(64, '0');
  return BigInt(`0b${id}`).toString(16).padStart(16, '0');
}
// for (let i = 0; i < 100; i++) {
//   const id = randomId();
//   console.log(`"${id}",`);
// }