import { describe, it, expect } from 'vitest'
import { hexToBigInt, bigIntToHex } from 'a5/core/hex'

describe('hex.ts', () => {
  describe('hexToBigInt', () => {
    it('converts hex strings to BigInt', () => {
      expect(hexToBigInt('1a2b3c')).toBe(BigInt(1715004));
      expect(hexToBigInt('0')).toBe(BigInt(0));
      expect(hexToBigInt('ff')).toBe(BigInt(255));
      expect(hexToBigInt('ffffffff')).toBe(BigInt(4294967295));
    });
  });

  describe('bigIntToHex', () => {
    it('converts BigInt to hex strings', () => {
      expect(bigIntToHex(BigInt(1715004))).toBe('1a2b3c');
      expect(bigIntToHex(BigInt(0))).toBe('0');
      expect(bigIntToHex(BigInt(255))).toBe('ff');
      expect(bigIntToHex(BigInt(4294967295))).toBe('ffffffff');
    });
  });

  describe('round trip conversion', () => {
    it('preserves values when converting back and forth', () => {
      const testValues = ['1a2b3c', '0', 'ff', 'ffffffff'];
      
      for (const hexStr of testValues) {
        const bigInt = hexToBigInt(hexStr);
        const result = bigIntToHex(bigInt);
        expect(result).toBe(hexStr);
      }
    });
  });
}); 