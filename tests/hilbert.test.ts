import { describe, it, expect, test } from 'vitest'
import { vec2 } from 'gl-matrix';
import { quaternaryToKJ, quaternaryToFlips, YES, NO, Anchor, Quaternary, IJToKJ, KJToIJ, getRequiredDigits, IJToS, sToAnchor, IJ, KJ, Orientation } from 'a5/core/hilbert';

describe('hilbert anchor generation', () => {
    it('returns correct offsets for base cases', () => {
        // Test first corner (0)
        const offset0 = quaternaryToKJ(0, [NO, NO]);
        expect([...offset0]).toEqual([0, 0]);
        const flips0 = quaternaryToFlips(0);
        expect(flips0).toEqual([NO, NO]);

        // Test second corner (1)
        const offset1 = quaternaryToKJ(1, [NO, NO]);
        expect([...offset1]).toEqual([1, 0]);
        const flips1 = quaternaryToFlips(1);
        expect(flips1).toEqual([NO, YES]);

        // Test third corner (2)
        const offset2 = quaternaryToKJ(2, [NO, NO]);
        expect([...offset2]).toEqual([1, 1]);
        const flips2 = quaternaryToFlips(2);
        expect(flips2).toEqual([NO, NO]);

        // Test fourth corner (3)
        const offset3 = quaternaryToKJ(3, [NO, NO]);
        expect([...offset3]).toEqual([2, 1]);
        const flips3 = quaternaryToFlips(3);
        expect(flips3).toEqual([YES, NO]);
    });

    it('respects flips in offset calculation', () => {
        // Test with x-flip
        const offsetX = quaternaryToKJ(1, [YES, NO]);
        expect([...offsetX]).toEqual([-0, -1]);

        // Test with y-flip
        const offsetY = quaternaryToKJ(1, [NO, YES]);
        expect([...offsetY]).toEqual([0, 1]);

        // Test with both flips
        const offsetXY = quaternaryToKJ(1, [YES, YES]);
        expect([...offsetXY]).toEqual([-1, -0]);
    });

    it('output flips depend only on input n', () => {
        const EXPECTED_FLIPS = [
            [NO, NO],
            [NO, YES],
            [NO, NO],
            [YES, NO]
        ];
        for (let n = 0; n < 4; n++) {
            const flips = quaternaryToFlips(n as Quaternary);
            expect(flips).toEqual(EXPECTED_FLIPS[n]);
        }
    });

    it('generates correct sequence', () => {
        // Test first few indices
        const anchor0 = sToAnchor(0);
        expect([...anchor0.offset]).toEqual([0, 0]);
        expect(anchor0.flips).toEqual([NO, NO]);

        const anchor1 = sToAnchor(1);
        expect(anchor1.flips[1]).toBe(YES);

        const anchor4 = sToAnchor(4);
        expect(vec2.len(anchor4.offset)).toBeGreaterThan(1); // Should be scaled up

        // Test that sequence length grows exponentially
        const anchors = Array.from({length: 16}, (_, i) => sToAnchor(i));
        const uniqueOffsets = new Set(anchors.map(a => `${a.offset[0]},${a.offset[1]}`));
        expect(uniqueOffsets.size).toBe(12); 
        const uniqueAnchors = new Set(anchors.map(a => `${a.offset[0]},${a.offset[1]},${a.flips[0]},${a.flips[1]}`));
        expect(uniqueAnchors.size).toBe(15);
    });

    it('Neighboring anchors are adjacent', () => {
        // Test that combining anchors preserves orientation rules
        const anchor1 = sToAnchor(0);
        const anchor2 = sToAnchor(1);
        const anchor3 = sToAnchor(2);
        
        // Check that relative positions make sense
        const diff = vec2.subtract(vec2.create(), anchor2.offset, anchor1.offset);
        expect(vec2.len(diff)).toBe(1); // Should be adjacent
        const diff2 = vec2.subtract(vec2.create(), anchor3.offset, anchor2.offset);
        expect(vec2.len(diff2)).toBe(Math.sqrt(2)); // Should be adjacent
    });

    it('Generates correct anchors for all indices', () => {
        const EXPECTED_ANCHORS = [
            {s: 0, offset: [0, 0], flips: [NO, NO]},
            {s: 9, offset: [3, 1], flips: [YES, YES]},
            {s: 16, offset: [2, 2], flips: [NO, NO]},
            {s: 17, offset: [3, 2], flips: [NO, YES]},
            {s: 31, offset: [1, 3], flips: [YES, NO]},
            {s: 77, offset: [7, 5], flips: [NO, NO]},
            {s: 100, offset: [3, 7], flips: [YES, YES]},
            {s: 101, offset: [2, 7], flips: [YES, NO]},
            {s: 170, offset: [10, 1], flips: [NO, NO]},
            {s: 411, offset: [7, 13], flips: [YES, NO]},
            {s: 1762, offset: [7, 31], flips: [YES, NO]},
            {s: 481952, offset: [96, 356], flips: [YES, YES]},
            {s: 192885192n, offset: [13183, 1043], flips: [NO, NO]},
            {s: 4719283155n, offset: [37190, 46076], flips: [NO, YES]},
            {s: 7123456789n, offset: [29822, 40293], flips: [NO, YES]},
        ];

        for (const {s, offset, flips} of EXPECTED_ANCHORS) {
            const anchor = sToAnchor(s, 20, 'uv');
            expect([...anchor.offset]).toEqual(offset);
            expect(anchor.flips).toEqual(flips);
        }
    });
});

describe('coordinate conversion', () => {
  test('IJToKJ converts ij coordinates to kj coordinates', () => {
    // Test some basic conversions
    const testCases = [
      [vec2.fromValues(0, 0), vec2.fromValues(0, 0)],    // Origin
      [vec2.fromValues(1, 0), vec2.fromValues(1, 0)],    // Unit i
      [vec2.fromValues(0, 1), vec2.fromValues(1, 1)],    // Unit j -> k=i+j=1, j=1
      [vec2.fromValues(1, 1), vec2.fromValues(2, 1)],    // i + j -> k=2, j=1
      [vec2.fromValues(2, 3), vec2.fromValues(5, 3)]     // 2i + 3j -> k=5, j=3
    ] as [IJ, KJ][];

    testCases.forEach(([input, expected]) => {
      const result = IJToKJ(input);
      expect(vec2.equals(result, expected)).toBe(true);
    });
  });

  test('KJToIJ converts kj coordinates to ij coordinates', () => {
    // Test some basic conversions
    const testCases = [
      [vec2.fromValues(0, 0), vec2.fromValues(0, 0)],     // Origin
      [vec2.fromValues(1, 0), vec2.fromValues(1, 0)],     // Pure k -> i=1, j=0
      [vec2.fromValues(1, 1), vec2.fromValues(0, 1)],     // k=1, j=1 -> i=0, j=1
      [vec2.fromValues(2, 1), vec2.fromValues(1, 1)],     // k=2, j=1 -> i=1, j=1
      [vec2.fromValues(5, 3), vec2.fromValues(2, 3)]      // k=5, j=3 -> i=2, j=3
    ] as [KJ, IJ][];

    testCases.forEach(([input, expected]) => {
      const result = KJToIJ(input);
      expect(vec2.equals(result, expected)).toBe(true);
    });
  });

  test('IJToKJ and KJToIJ are inverses', () => {
    // Test that converting back and forth gives the original coordinates
    const testPoints = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 3],
      [-1, 2],
      [3, -2]
    ] as IJ[];

    testPoints.forEach(point => {
      const kj = IJToKJ(point);
      const ij = KJToIJ(kj);
      expect(vec2.equals(point, ij)).toBe(true);
    });
  });
});

describe('fromOffset', () => {
  test('correctly identifies quaternary digits from offsets', () => {
    // TODO
  });
});

describe('getRequiredDigits', () => {
  test('correctly determines number of digits needed', () => {
    const testCases: [vec2, number][] = [
      [vec2.fromValues(0, 0), 1], 
      [vec2.fromValues(1, 0), 1], 
      [vec2.fromValues(2, 1), 2], 
      [vec2.fromValues(4, 0), 3], 
      [vec2.fromValues(8, 8), 5], 
      [vec2.fromValues(16, 0), 5], 
      [vec2.fromValues(32, 32), 7] 
    ];

    testCases.forEach(([offset, expected]) => {
      expect(getRequiredDigits(offset)).toBe(expected);
    });
  });

  test('matches actual digits needed in sToAnchor output', () => {
    // Test that getRequiredDigits matches the number of digits 
    // actually used in sToAnchor's output
    const testValues = [0, 1, 2, 3, 4, 9, 16, 17, 31, 77, 100];
    
    testValues.forEach(s => {
      const anchor = sToAnchor(s);
      const requiredDigits = getRequiredDigits(anchor.offset);
      const actualDigits = s.toString(4).length;
      expect(requiredDigits).toBeGreaterThanOrEqual(actualDigits);
      expect(requiredDigits).toBeLessThanOrEqual(actualDigits + 1);
    });
  });
});

describe('IJToS', () => {
  test('computes s from anchor', () => {
    const testValues = [
      // First quadrant
      {s: 0, offset: [0, 0]},
      {s: 0, offset: [0.999, 0]},
      {s: 1, offset: [0.6, 0.6]},
      {s: 7, offset: [0.000001, 1.1]},

      {s: 2, offset: [1.2, 0.5]},
      {s: 2, offset: [1.9999, 0]},

      // Recursive cases, 2nd quadrant, flipY
      {s: 3, offset: [1.9999, 0.001]},
      {s: 4, offset: [1.1, 1.1]},
      {s: 5, offset: [1.999, 1.999]},
      {s: 6, offset: [0.99, 1.99]},

      // 3rd quadrant, no flips
      {s: 28, offset: [0.999, 2.000001]},
      {s: 29, offset: [0.9, 2.5]},
      {s: 30, offset: [0.5, 3.1]},
      {s: 31, offset: [1.3, 2.5]},

      // 4th quadrant, flipX
      {s: 8, offset: [2.00001, 1.001]},
      {s: 9, offset: [2.8, 0.5]},
      {s: 10, offset: [2.00001, 0.5]},
      {s: 11, offset: [3.5, 0.2]},

      // Next level, just sample a few as flips are the same as before
      {s: 15, offset: [2.5, 1.5]},
      {s: 21, offset: [3.999, 3.999]},

      // Finally, both flips
      {s: 24, offset: [1.999, 3.999]},
      {s: 25, offset: [1.2, 3.5]},
      {s: 26, offset: [1.9, 2.2]},
      {s: 27, offset: [0.1, 3.9]}
    ] as {s: number, offset: IJ}[];

    testValues.forEach(({s, offset}) => {
      expect(IJToS(offset, 3, 'uv')).toBe(BigInt(s));
    });
  });

  const testValues = [0, 1, 2, 3, 4, 9, 16, 17, 31, 77, 100, 101, 170, 411, 1762, 4410, 12387, 41872, 410922, 1247878, 88889182];
  const resolution = 20;
  const orientations: Orientation[] = ['uv', 'vu', 'uw', 'wu', 'vw', 'wv'];
  orientations.forEach(orientation => {
    testValues.forEach(s => {
      test(`IJToS is inverse of sToAnchor(${s}, ${resolution}, ${orientation})`, () => {
        const anchor = sToAnchor(s, resolution, orientation);

        // Nudge the offset away from the edge of the triangle
        const [flipX, flipY] = anchor.flips;
        if (flipX === NO && flipY === NO) {
          vec2.add(anchor.offset, anchor.offset, [0.1, 0.1]);
        } else if (flipX === YES && flipY === NO) {
          vec2.add(anchor.offset, anchor.offset, [0.1, -0.2]);
        } else if (flipX === NO && flipY === YES) {
          vec2.add(anchor.offset, anchor.offset, [-0.1, 0.2]);
        } else if (flipX === YES && flipY === YES) {
          vec2.add(anchor.offset, anchor.offset, [-0.1, -0.1]);
        }

          expect(IJToS(anchor.offset, resolution, orientation)).toBe(BigInt(s));
      });
    });
  });
}); 