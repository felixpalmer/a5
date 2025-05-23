import { describe, it, expect } from 'vitest'
import { 
  degToRad, 
  radToDeg,
  toCartesian,
  toSpherical,
  fromLonLat,
  toLonLat
} from 'a5/core/coordinate-transforms'
import type { Degrees, LonLat, Radians, Spherical } from 'a5/core/coordinate-systems'

describe('angle conversions', () => {
  it('converts degrees to radians', () => {
    expect(degToRad(180 as Degrees)).toBe(Math.PI)
    expect(degToRad(90 as Degrees)).toBe(Math.PI / 2)
    expect(degToRad(0 as Degrees)).toBe(0)
  })

  it('converts radians to degrees', () => {
    expect(radToDeg(Math.PI as Radians)).toBe(180)
    expect(radToDeg((Math.PI / 2) as Radians)).toBe(90)
    expect(radToDeg(0 as Radians)).toBe(0)
  })
})

describe('coordinate conversions', () => {
  it('converts spherical to cartesian coordinates', () => {
    // Test north pole
    const northPole = toCartesian([0, 0] as Spherical)
    expect(northPole[0]).toBeCloseTo(0)
    expect(northPole[1]).toBeCloseTo(0)
    expect(northPole[2]).toBeCloseTo(1)

    // Test equator at 0 longitude
    const equator0 = toCartesian([0, Math.PI/2] as Spherical)
    expect(equator0[0]).toBeCloseTo(1)
    expect(equator0[1]).toBeCloseTo(0)
    expect(equator0[2]).toBeCloseTo(0)

    // Test equator at 90° longitude
    const equator90 = toCartesian([Math.PI/2, Math.PI/2] as Spherical)
    expect(equator90[0]).toBeCloseTo(0)
    expect(equator90[1]).toBeCloseTo(1)
    expect(equator90[2]).toBeCloseTo(0)
  })

  it('converts cartesian to spherical coordinates', () => {
    // Test round trip conversion
    const original: Spherical = [Math.PI/4, Math.PI/6]
    const cartesian = toCartesian(original)
    const spherical = toSpherical(cartesian)
    
    expect(spherical[0]).toBeCloseTo(original[0])
    expect(spherical[1]).toBeCloseTo(original[1])
  })
})

describe('LonLat to/from spherical', () => {
  it('converts longitude/latitude to spherical coordinates', () => {
    // Test Greenwich equator
    const greenwich = fromLonLat([0, 0] as LonLat)
    // Match OFFSET_LON: 93
    expect(greenwich[0]).toBeCloseTo(degToRad(93 as Degrees))
    expect(greenwich[1]).toBeCloseTo(Math.PI/2)  // 90° colatitude = equator

    // Test north pole
    const northPole = fromLonLat([0, 90] as LonLat)
    expect(northPole[1]).toBeCloseTo(0)  // 0° colatitude = north pole

    // Test south pole
    const southPole = fromLonLat([0, -90] as LonLat)
    expect(southPole[1]).toBeCloseTo(Math.PI)  // 180° colatitude = south pole
  })

  it('converts spherical to longitude/latitude coordinates', () => {
    // Test round trip conversion
    const TEST_POINTS: Array<[number, number]> = [
      [0, 0],     // Greenwich equator
      [0, 90],    // North pole
      [0, -90],   // South pole
      [180, 45],  // Date line mid-latitude
      [-90, -45], // West hemisphere mid-latitude
    ];

    TEST_POINTS.forEach(([lon, lat]) => {
      const spherical = fromLonLat([lon, lat] as LonLat)
      const [newLon, newLat] = toLonLat(spherical)
      
      expect(newLon).toBeCloseTo(lon)
      expect(newLat).toBeCloseTo(lat)
    })
  })
}) 