import { describe, it, expect, test } from 'vitest'
import { getResolution, serialize, deserialize, FIRST_HILBERT_RESOLUTION, getRes0Cells, isFirstChild, getStride } from 'a5/core/serialization';

const MAX_RESOLUTION = 30;
import { A5Cell } from 'a5/core/utils';
import { origins } from 'a5/core/origin';
import { cellToParent, cellToChildren } from 'a5/core/serialization';
import { u64ToHex } from 'a5/core/hex';
import FIXTURES from './fixtures/serialization.json';

const RESOLUTION_MASKS = FIXTURES.resolutionMasks;
const TEST_IDS = FIXTURES.testIds;

const origin0 = JSON.parse(JSON.stringify(origins[0])); // Use first origin for most tests

describe('serialize', () => {

  test('Correct number of masks', () => {
    expect(RESOLUTION_MASKS.length).toBe(MAX_RESOLUTION + 1);
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
        // Exclude res 30 as it has a different bit layout (5-bit quintant)
        RESOLUTION_MASKS.slice(FIRST_HILBERT_RESOLUTION, MAX_RESOLUTION).forEach(binary => {
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
      const resolution = getResolution(cell);
      // Skip res 30 (no children) and res 29 with out-of-bounds quintants
      // (res 30 children fall back to res 29)
      if (resolution >= MAX_RESOLUTION) return;
      const child = cellToChildren(cell)[0];
      if (getResolution(child) !== resolution + 1) return;

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

describe('resolution 30', () => {
  test('getResolution detects res 30 from LSB', () => {
    // Any odd bigint (LSB=1) that isn't 0 is resolution 30
    expect(getResolution(1n)).toBe(30);
    expect(getResolution(3n)).toBe(30);
    expect(getResolution(0xFFFFFFFFFFFFFFFFn)).toBe(30);
  });

  test('serialize/deserialize round trip for valid quintants (0-41)', () => {
    // Quintants 0-31 use ...1, 32-39 use ...100, 40-41 use ...10000
    for (let q = 0; q < 42; q++) {
      const originId = Math.floor(q / 5);
      const origin = origins[originId];
      const segmentN = q % 5;
      const segment = (segmentN + origin.firstQuintant) % 5;

      const cell: A5Cell = { origin, segment, S: 0n, resolution: 30 };
      const serialized = serialize(cell);
      expect(getResolution(serialized)).toBe(30);

      // Verify correct marker pattern
      if (q <= 31) {
        expect(serialized & 1n).toBe(1n); // ...1 encoding
      } else if (q <= 39) {
        expect(serialized & 0b111n).toBe(0b100n); // ...100 encoding
      } else {
        expect(serialized & 0b11111n).toBe(0b10000n); // ...10000 encoding
      }

      const deserialized = deserialize(serialized);
      expect(deserialized.origin.id).toBe(originId);
      expect(deserialized.segment).toBe(segment);
      expect(deserialized.S).toBe(0n);
      expect(deserialized.resolution).toBe(30);

      // Round trip
      const reserialized = serialize(deserialized);
      expect(reserialized).toBe(serialized);
    }
  });

  test('serialize/deserialize round trip with non-zero S', () => {
    const origin = origins[0];
    const segment = (0 + origin.firstQuintant) % 5; // segmentN=0

    const testSValues = [0n, 1n, 42n, (1n << 58n) - 1n]; // min, small, medium, max
    for (const S of testSValues) {
      const cell: A5Cell = { origin, segment, S, resolution: 30 };
      const serialized = serialize(cell);
      const deserialized = deserialize(serialized);
      expect(deserialized.S).toBe(S);
      expect(deserialized.resolution).toBe(30);
      expect(serialize(deserialized)).toBe(serialized);
    }
  });

  test('bit layout: ...1 encoding (quintant 0-31)', () => {
    const origin = origins[0];
    const segment = (0 + origin.firstQuintant) % 5; // quintant=0

    // Quintant 0, S=0 → just the marker bit
    const cell0 = serialize({ origin, segment, S: 0n, resolution: 30 });
    expect(cell0).toBe(1n);

    // Quintant 0, S=1 → marker + S shifted left by 1
    const cell1 = serialize({ origin, segment, S: 1n, resolution: 30 });
    expect(cell1).toBe(0b11n); // S=1 at bit 1, marker at bit 0
  });

  test('bit layout: ...10000 encoding (quintant 40-41)', () => {
    // Origin 8, segmentN=0 → quintant 40
    const origin = origins[8];
    const segment = (0 + origin.firstQuintant) % 5;

    // Quintant 40, S=0 → (40-40)=0 in top 1 bit, marker 10000
    const cell0 = serialize({ origin, segment, S: 0n, resolution: 30 });
    expect(cell0).toBe(0b10000n); // just the marker

    // Quintant 40, S=1 → S shifted left by 5 + marker
    const cell1 = serialize({ origin, segment, S: 1n, resolution: 30 });
    expect(cell1).toBe(0b110000n); // S=1 at bit 5, marker 10000 at bits 4-0
  });

  test('bit layout: ...100 encoding (quintant 32-39)', () => {
    // Origin 6, segmentN=0 → quintant 30... need quintant >= 32
    // Origin 6 has quintants 30-34, so segmentN=2 gives quintant 32
    const origin = origins[6];
    const segmentN = 2;
    const segment = (segmentN + origin.firstQuintant) % 5;

    // Quintant 32, S=0 → (32-32)=0 in top 3 bits, marker 100
    const cell0 = serialize({ origin, segment, S: 0n, resolution: 30 });
    expect(cell0).toBe(0b100n); // just the marker

    // Quintant 32, S=1 → S shifted left by 3 + marker
    const cell1 = serialize({ origin, segment, S: 1n, resolution: 30 });
    expect(cell1).toBe(0b1100n); // S=1 at bit 3, marker 100 at bits 2-0
  });

  test('serialize/deserialize round trip with non-zero S (extended encoding)', () => {
    // Use quintant 35 (origin 7, segmentN=0) for ...100 encoding
    const origin = origins[7];
    const segment = (0 + origin.firstQuintant) % 5;

    const testSValues = [0n, 1n, 42n, (1n << 58n) - 1n];
    for (const S of testSValues) {
      const cell: A5Cell = { origin, segment, S, resolution: 30 };
      const serialized = serialize(cell);
      expect(serialized & 0b111n).toBe(0b100n); // ...100 marker
      const deserialized = deserialize(serialized);
      expect(deserialized.S).toBe(S);
      expect(deserialized.resolution).toBe(30);
      expect(serialize(deserialized)).toBe(serialized);
    }
  });

  test('falls back to res 29 for quintant > 41', () => {
    // Origin 9 has quintants 45-49, all > 41
    const origin = origins[9];
    const segment = (0 + origin.firstQuintant) % 5;
    const cell = serialize({ origin, segment, S: 0n, resolution: 30 });
    expect(getResolution(cell)).toBe(29);

    // With non-zero S, the parent S should be S >> 2
    const cell2 = serialize({ origin, segment, S: 7n, resolution: 30 });
    expect(getResolution(cell2)).toBe(29);
    expect(deserialize(cell2).S).toBe(1n); // 7 >> 2 = 1
  });

  test('falls back to res 29 for out-of-bounds quintant (e.g. 55)', () => {
    // Origin 11 has quintants 55-59, all > 41
    const origin = origins[11];
    const segmentN = 0;
    const segment = (segmentN + origin.firstQuintant) % 5;
    const cell = serialize({ origin, segment, S: 100n, resolution: 30 });
    expect(getResolution(cell)).toBe(29);
    expect(deserialize(cell).S).toBe(25n); // 100 >> 2 = 25
    expect(deserialize(cell).origin.id).toBe(11);
  });

  test('throws for S too large', () => {
    const origin = origins[0];
    const segment = (0 + origin.firstQuintant) % 5;
    expect(() => serialize({ origin, segment, S: 1n << 58n, resolution: 30 }))
      .toThrow('too large for resolution level 30');
  });

  test('cellToParent from res 30 to res 29', () => {
    const origin = origins[0];
    const segment = (0 + origin.firstQuintant) % 5;

    // Create 4 children at res 30 (S=0..3), they should share the same res 29 parent (S=0)
    for (let i = 0; i < 4; i++) {
      const child = serialize({ origin, segment, S: BigInt(i), resolution: 30 });
      const parent = cellToParent(child);
      expect(getResolution(parent)).toBe(29);

      const parentCell = deserialize(parent);
      expect(parentCell.S).toBe(0n);
    }
  });

  test('cellToChildren from res 29 to res 30', () => {
    const origin = origins[0];
    const segment = (0 + origin.firstQuintant) % 5;
    const parent = serialize({ origin, segment, S: 0n, resolution: 29 });
    const children = cellToChildren(parent, 30);

    expect(children.length).toBe(4);
    children.forEach((child, i) => {
      expect(getResolution(child)).toBe(30);
      const childCell = deserialize(child);
      expect(childCell.S).toBe(BigInt(i));
    });
  });

  test('cellToChildren/cellToParent round trip', () => {
    const origin = origins[0];
    const segment = (0 + origin.firstQuintant) % 5;
    const parent = serialize({ origin, segment, S: 42n, resolution: 29 });
    const children = cellToChildren(parent, 30);

    expect(children.length).toBe(4);
    children.forEach(child => {
      expect(cellToParent(child)).toBe(parent);
    });
  });

  test('getStride returns 2 for res 30', () => {
    expect(getStride(30)).toBe(2n);
  });

  test('isFirstChild works for res 30 (...1 encoding)', () => {
    const origin = origins[0];
    const segment = (0 + origin.firstQuintant) % 5;

    expect(isFirstChild(serialize({ origin, segment, S: 0n, resolution: 30 }))).toBe(true);
    expect(isFirstChild(serialize({ origin, segment, S: 1n, resolution: 30 }))).toBe(false);
    expect(isFirstChild(serialize({ origin, segment, S: 4n, resolution: 30 }))).toBe(true);
  });

  test('serialize/deserialize round trip with non-zero S (...10000 encoding)', () => {
    // Use quintant 40 (origin 8, segmentN=0) for ...10000 encoding
    const origin = origins[8];
    const segment = (0 + origin.firstQuintant) % 5;

    const testSValues = [0n, 1n, 42n, (1n << 58n) - 1n];
    for (const S of testSValues) {
      const cell: A5Cell = { origin, segment, S, resolution: 30 };
      const serialized = serialize(cell);
      expect(serialized & 0b11111n).toBe(0b10000n); // ...10000 marker
      const deserialized = deserialize(serialized);
      expect(deserialized.S).toBe(S);
      expect(deserialized.resolution).toBe(30);
      expect(serialize(deserialized)).toBe(serialized);
    }
  });

  test('isFirstChild works for res 30 (...100 encoding)', () => {
    const origin = origins[7]; // quintant 35, uses ...100
    const segment = (0 + origin.firstQuintant) % 5;

    expect(isFirstChild(serialize({ origin, segment, S: 0n, resolution: 30 }))).toBe(true);
    expect(isFirstChild(serialize({ origin, segment, S: 1n, resolution: 30 }))).toBe(false);
    expect(isFirstChild(serialize({ origin, segment, S: 4n, resolution: 30 }))).toBe(true);
  });

  test('isFirstChild works for res 30 (...10000 encoding)', () => {
    const origin = origins[8]; // quintant 40, uses ...10000
    const segment = (0 + origin.firstQuintant) % 5;

    expect(isFirstChild(serialize({ origin, segment, S: 0n, resolution: 30 }))).toBe(true);
    expect(isFirstChild(serialize({ origin, segment, S: 1n, resolution: 30 }))).toBe(false);
    expect(isFirstChild(serialize({ origin, segment, S: 4n, resolution: 30 }))).toBe(true);
  });

  test('cellToChildren/cellToParent round trip (...10000 encoding)', () => {
    // Origin 8 (quintant 40) uses the ...10000 encoding
    const origin = origins[8];
    const segment = (0 + origin.firstQuintant) % 5;
    const parent = serialize({ origin, segment, S: 10n, resolution: 29 });
    const children = cellToChildren(parent, 30);

    expect(children.length).toBe(4);
    children.forEach(child => {
      expect(getResolution(child)).toBe(30);
      expect(child & 0b11111n).toBe(0b10000n); // ...10000 marker
      expect(cellToParent(child)).toBe(parent);
    });
  });

  test('cellToChildren/cellToParent round trip (...100 encoding)', () => {
    // Origin 7 (quintant 35) uses the ...100 encoding
    const origin = origins[7];
    const segment = (0 + origin.firstQuintant) % 5;
    const parent = serialize({ origin, segment, S: 10n, resolution: 29 });
    const children = cellToChildren(parent, 30);

    expect(children.length).toBe(4);
    children.forEach(child => {
      expect(getResolution(child)).toBe(30);
      expect(child & 0b111n).toBe(0b100n); // ...100 marker
      expect(cellToParent(child)).toBe(parent);
    });
  });

  test('cellToChildren of res 30 throws (max resolution)', () => {
    const origin = origins[0];
    const segment = (0 + origin.firstQuintant) % 5;
    const cell = serialize({ origin, segment, S: 0n, resolution: 30 });
    expect(() => cellToChildren(cell)).toThrow('exceeds maximum resolution');
  });
});

describe('resolution 30 locations', () => {
  const res30Locations = FIXTURES.res30Locations;

  test('round trip for res 30 location cells', () => {
    res30Locations.forEach((loc: any) => {
      const cell = BigInt(`0x${loc.hex}`);
      const deserialized = deserialize(cell);
      const reserialized = serialize(deserialized);
      expect(reserialized).toBe(cell);
    });
  });

  test('out-of-bounds quintants fall back to res 29', () => {
    const outOfBounds = res30Locations.filter((l: any) => l.resolution === 29);
    expect(outOfBounds.length).toBeGreaterThan(0);
    outOfBounds.forEach((loc: any) => {
      const cell = BigInt(`0x${loc.hex}`);
      expect(getResolution(cell)).toBe(29);
    });
  });

  test('in-bounds quintants encode at res 30', () => {
    const inBounds = res30Locations.filter((l: any) => l.resolution === 30);
    expect(inBounds.length).toBeGreaterThan(0);
    inBounds.forEach((loc: any) => {
      const cell = BigInt(`0x${loc.hex}`);
      expect(getResolution(cell)).toBe(30);
    });
  });
});