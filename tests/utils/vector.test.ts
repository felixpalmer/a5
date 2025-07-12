import { describe, it, expect } from 'vitest'
import { vectorDifference, quadrupleProduct, slerp } from 'a5/utils/vector'
import { vec3 } from 'gl-matrix'
import type { Cartesian } from 'a5/core/coordinate-systems'

describe('vectorDifference', () => {
  it('returns 0 for identical vectors', () => {
    const A = [1, 0, 0] as Cartesian
    const B = [1, 0, 0] as Cartesian
    const result = vectorDifference(A, B)
    expect(result).toBeCloseTo(0, 6)
  })

  it('returns sqrt(0.5) for perpendicular vectors', () => {
    const A = [1, 0, 0] as Cartesian
    const B = [0, 1, 0] as Cartesian
    const result = vectorDifference(A, B)
    expect(result).toBeCloseTo(Math.sqrt(0.5), 6)
  })

  it('handles small angles correctly', () => {
    const A = [1, 0, 0] as Cartesian
    const B = [0.999, 0.001, 0] as Cartesian
    vec3.normalize(B, B)
    const result = vectorDifference(A, B)
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(0.1)
  })
})

describe('quadrupleProduct', () => {
  it('computes quadruple product correctly', () => {
    const A = [1, 0, 0] as Cartesian
    const B = [0, 1, 0] as Cartesian
    const C = [0, 0, 1] as Cartesian
    const D = [1, 1, 1] as Cartesian
    vec3.normalize(D, D)
    
    const out = vec3.create() as Cartesian
    const result = quadrupleProduct(out, A, B, C, D)
    
    expect(result).toBe(out)
    expect(result.length).toBe(3)
  })

  it('handles orthogonal vectors', () => {
    const A = [1, 0, 0] as Cartesian
    const B = [0, 1, 0] as Cartesian
    const C = [0, 0, 1] as Cartesian
    const D = [1, 0, 0] as Cartesian
    
    const out = vec3.create() as Cartesian
    const result = quadrupleProduct(out, A, B, C, D)
    
    expect(result).toBe(out)
    expect(result.length).toBe(3)
    // The quadruple product of these vectors should be non-zero
    expect(result[0] !== 0 || result[1] !== 0 || result[2] !== 0).toBe(true)
  })
})

describe('slerp', () => {
  it('interpolates between two vectors', () => {
    const A = [1, 0, 0] as Cartesian
    const B = [0, 1, 0] as Cartesian
    const out = vec3.create() as Cartesian
    
    const result = slerp(out, A, B, 0.5)
    
    expect(result).toBe(out)
    expect(result).toBeCloseToArray([1/Math.sqrt(2), 1/Math.sqrt(2), 0], 6);
  })

  it('returns first vector at t=0', () => {
    const A = [1, 0, 0] as Cartesian
    const B = [0, 1, 0] as Cartesian
    const out = vec3.create() as Cartesian
    
    const result = slerp(out, A, B, 0)
    
    expect(result).toBe(out)
    expect(result).toBeCloseToArray([1, 0, 0], 6);
  })

  it('returns second vector at t=1', () => {
    const A = [1, 0, 0] as Cartesian
    const B = [0, 1, 0] as Cartesian
    const out = vec3.create() as Cartesian
    
    const result = slerp(out, A, B, 1)
    
    expect(result).toBe(out)
    expect(result).toBeCloseToArray([0, 1, 0], 6);
  })

  it('handles identical vectors', () => {
    const A = [1, 0, 0] as Cartesian
    const B = [1, 0, 0] as Cartesian
    const out = vec3.create() as Cartesian
    
    const result = slerp(out, A, B, 0.5)
    
    expect(result).toBe(out)
    // For identical vectors, slerp should return the same vector
    // Note: The current implementation may have issues with identical vectors
    // due to division by zero in the angle calculation
    expect(result).toBeCloseToArray([1, 0, 0], 6);
  })

  it('interpolates at different t values', () => {
    const A = [1, 0, 0] as Cartesian
    const B = [0, 1, 0] as Cartesian
    const out1 = vec3.create() as Cartesian
    const out2 = vec3.create() as Cartesian
    
    const result1 = slerp(out1, A, B, 0.25)
    const result2 = slerp(out2, A, B, 0.75)
    
    // At 0.25, should be closer to A (larger x component)
    expect(result1[0]).toBeGreaterThan(result1[1])
    
    // At 0.75, should be closer to B (larger y component)
    expect(result2[1]).toBeGreaterThan(result2[0])
  })
}) 