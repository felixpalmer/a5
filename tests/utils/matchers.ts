import { expect } from 'vitest';

// Extend expect with custom matcher for arrays
declare module 'vitest' {
  interface Assertion<T> {
    toBeCloseToArray(expected: number[], tolerance?: number): T;
  }
}

export const DEFAULT_TOLERANCE = 13;

expect.extend({
  toBeCloseToArray(received: number[], expected: number[], tolerance = DEFAULT_TOLERANCE) {
    const pass = received.length === expected.length && 
      received.every((val, i) => Math.abs(val - expected[i]) < Math.pow(10, -tolerance));
    
    return {
      pass,
      message: () => 
        pass 
          ? `Expected arrays not to be close to each other within ${tolerance} decimal places`
          : `Expected arrays to be close to each other within ${tolerance} decimal places. Received: [${received.join(', ')}], Expected: [${expected.join(', ')}]`
    };
  }
}); 