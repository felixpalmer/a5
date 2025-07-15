import { describe, it, expect } from 'vitest'
import { 
  degToRad, radToDeg, 
  faceToBarycentric, barycentricToFace,
  toCartesian, toSpherical,
  fromLonLat, toLonLat,
  normalizeLongitudes, type Contour
} from 'a5/core/coordinate-transforms'
import type { Degrees, LonLat, Radians, Spherical, Face, Barycentric, FaceTriangle } from 'a5/core/coordinate-systems'
import { TEST_POINTS } from './projections/data/polyhedral-test-data'

const TEST_POINTS_LONLAT: Array<LonLat> = [
  [0, 0],     // Equator
  [90, 0],    // Equator
  [180, 0],   // Equator
  [0, 45],    // Mid latitude
  [0, -45],   // Mid latitude
  [-90, -45], // West hemisphere mid-latitude
  [180, 45],  // Date line mid-latitude
  [90, 45],   // East hemisphere mid-latitude
  [0, 90],    // North pole
  [0, -90],   // South pole
  [123, 45],  // Arbitrary point
] as LonLat[];

// Test triangle for barycentric tests
const TEST_TRIANGLE: FaceTriangle = [[0, 0], [1, 0], [0, 1]] as FaceTriangle;

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

describe('barycentric coordinate functions', () => {
  it('faceToBarycentric and barycentricToFace round-trip preserves coordinates', () => {
    const TOLERANCE = 12;
    for (const point of TEST_POINTS) {
      // Convert to barycentric coordinates
      const bary = faceToBarycentric(point, TEST_TRIANGLE);
      
      // Convert back to face coordinates
      const result = barycentricToFace(bary, TEST_TRIANGLE);
      
      // Check round-trip accuracy
      expect([...result]).toBeCloseToArray([...point], TOLERANCE);
      
      // Check that barycentric coordinates sum to 1
      expect(bary[0] + bary[1] + bary[2]).toBeCloseTo(1, TOLERANCE);
      
      // Check that all barycentric coordinates are non-negative (point is inside triangle)
      expect(bary[0]).toBeGreaterThanOrEqual(0);
      expect(bary[1]).toBeGreaterThanOrEqual(0);
      expect(bary[2]).toBeGreaterThanOrEqual(0);
    }
  });
  
  it('barycentricToFace and faceToBarycentric round-trip preserves barycentric coordinates', () => {
    // Test barycentric coordinates starting with the specific case
    const testBaryCoords: Barycentric[] = [
      [0.043821975867140296, 0.9561208684797726, 0.00005715565308705983],
      [0.5, 0.3, 0.2],
      [0.1, 0.8, 0.1],
      [0.33, 0.33, 0.34],
      [0.9, 0.05, 0.05],
      [0.001, 0.999, 0.000],
    ] as Barycentric[];
    
    for (const bary of testBaryCoords) {
      // Convert barycentric to face coordinates
      const face = barycentricToFace(bary, TEST_TRIANGLE);
      
      // Convert back to barycentric
      const resultBary = faceToBarycentric(face, TEST_TRIANGLE);
      
      // Check round-trip accuracy
      expect(resultBary).toBeCloseToArray(bary, 12);
      
      // Check that barycentric coordinates sum to 1
      expect(resultBary[0] + resultBary[1] + resultBary[2]).toBeCloseTo(1, 12);
    }
  });
  
  it('handles triangle vertices correctly', () => {
    // Test each vertex
    const vertices: Face[] = [TEST_TRIANGLE[0], TEST_TRIANGLE[1], TEST_TRIANGLE[2]];
    const expectedBary: [number, number, number][] = [
      [1, 0, 0],  // pai -> [1, 0, 0]
      [0, 1, 0],  // pbi -> [0, 1, 0]
      [0, 0, 1],  // pci -> [0, 0, 1]
    ];
    
    for (let i = 0; i < vertices.length; i++) {
      const bary = faceToBarycentric(vertices[i], TEST_TRIANGLE);
      
      // Check barycentric coordinates
      expect(bary).toBeCloseToArray(expectedBary[i], 12);
      
      // Round-trip test
      const result = barycentricToFace(bary, TEST_TRIANGLE);
      expect([...result]).toBeCloseToArray([...vertices[i]], 12);
    }
  });
  
  it('handles edge midpoints correctly', () => {
    const edgeMidpoints: Face[] = [
      [0.5, 0],    // Midpoint of pai-pbi edge
      [0, 0.5],    // Midpoint of pai-pci edge
      [0.5, 0.5],  // Midpoint of pbi-pci edge
    ] as Face[];
    
    const expectedBary: [number, number, number][] = [
      [0.5, 0.5, 0],  // pai-pbi midpoint
      [0.5, 0, 0.5],  // pai-pci midpoint
      [0, 0.5, 0.5],  // pbi-pci midpoint
    ];
    
    for (let i = 0; i < edgeMidpoints.length; i++) {
      const bary = faceToBarycentric(edgeMidpoints[i], TEST_TRIANGLE);
      
      // Check barycentric coordinates
      expect(bary).toBeCloseToArray(expectedBary[i], 12);
      
      // Round-trip test
      const result = barycentricToFace(bary, TEST_TRIANGLE);
      expect([...result]).toBeCloseToArray([...edgeMidpoints[i]], 12);
    }
  });
});

describe('coordinate conversions', () => {
  it('converts spherical to cartesian coordinates', () => {
    // Test north pole
    const northPole = toCartesian([0, 0] as Spherical)
    expect(northPole).toBeCloseToArray([0, 0, 1]);

    // Test equator at 0 longitude
    const equator0 = toCartesian([0, Math.PI/2] as Spherical)
    expect(equator0).toBeCloseToArray([1, 0, 0]);

    // Test equator at 90° longitude
    const equator90 = toCartesian([Math.PI/2, Math.PI/2] as Spherical)
    expect(equator90).toBeCloseToArray([0, 1, 0]);
  })

  it('converts cartesian to spherical coordinates', () => {
    // Test round trip conversion
    const original: Spherical = [Math.PI/4 as Radians, Math.PI/6 as Radians] as Spherical
    const cartesian = toCartesian(original)
    const spherical = toSpherical(cartesian)
    
    expect(spherical).toBeCloseToArray(original);
  })
})

describe('LonLat to/from spherical', () => {
  it('converts longitude/latitude to spherical coordinates', () => {
    // Test Greenwich equator
    const greenwich = fromLonLat([0, 0] as LonLat)
    // Match OFFSET_LON: 93
    expect(greenwich).toBeCloseToArray([degToRad(93 as Degrees), Math.PI/2]);

    // Test north pole
    const northPole = fromLonLat([0, 90] as LonLat)
    expect(northPole).toBeCloseToArray([degToRad(93 as Degrees), 0]);

    // Test south pole
    const southPole = fromLonLat([0, -90] as LonLat)
    expect(southPole).toBeCloseToArray([degToRad(93 as Degrees), Math.PI]);
  })

  it('converts spherical to longitude/latitude coordinates', () => {
    // Test round trip conversion
    TEST_POINTS_LONLAT.forEach(([lon, lat]) => {
      const spherical = fromLonLat([lon, lat] as LonLat)
      const [newLon, newLat] = toLonLat(spherical)
      
      expect([newLon, newLat]).toBeCloseToArray([lon, lat]);
    })
  })
});

describe('normalizeLongitudes', () => {
  it('handles simple contour without wrapping', () => {
    const contour: Contour = [
      [0, 0] as LonLat,
      [10, 0] as LonLat,
      [10, 10] as LonLat,
      [0, 10] as LonLat,
      [0, 0] as LonLat
    ];
    const normalized = normalizeLongitudes(contour);
    expect(normalized).toEqual(contour);
  });

  it.skip('normalizes contour crossing antimeridian', () => {
    const contour: Contour = [
      [170, 0] as LonLat,
      [175, 0] as LonLat,
      [-175, 0] as LonLat,  // This should become 185
      [-170, 0] as LonLat,  // This should become 190
    ];
    const normalized = normalizeLongitudes(contour);
    expect(normalized[3][0]).toBeCloseTo(185 as Degrees);
    expect(normalized[4][0]).toBeCloseTo(190 as Degrees);
  });

  it('normalizes contour crossing antimeridian in opposite direction', () => {
    const contour: Contour = [
      [-170, 0] as LonLat,
      [-175, 0] as LonLat,
      [-180, 0] as LonLat,
      [175, 0] as LonLat,   // This should become -185
      [170, 0] as LonLat,   // This should become -190
    ];
    const normalized = normalizeLongitudes(contour);
    expect(normalized[3][0]).toBeCloseTo(-185 as Degrees);
    expect(normalized[4][0]).toBeCloseTo(-190 as Degrees);
  });
});