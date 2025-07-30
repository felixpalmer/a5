import { describe, it, expect } from 'vitest'
import { vec3, quat } from 'gl-matrix'
import {
  origins,
  findNearestOrigin,
  haversine,
  quintantToSegment,
  segmentToQuintant,
  isNearestOrigin,
} from 'a5/core/origin'
import { PI_OVER_5 } from 'a5/core/constants'
import type { Spherical } from 'a5/core/coordinate-systems'
import { toCartesian } from 'a5/core/coordinate-transforms'
import expectedOrigins from './fixtures/origins.json'
import { Origin } from 'a5/core/utils'

describe('origin constants', () => {
  it('has 12 origins for dodecahedron faces', () => {
    expect(origins.length).toBe(12)
  })

  it('should match expected origins from fixture', () => {
    expect(origins.length).toBe(expectedOrigins.length)
    
    origins.forEach((origin, index) => {
      const expected = expectedOrigins[index]
      
      // Check id
      expect(origin.id).toBe(expected.id)
      
      // Check axis (spherical coordinates)
      expect(origin.axis).toBeCloseToArray(expected.axis)
      
      // Check quaternion
      expect(origin.quat).toBeCloseToArray(expected.quat)
      
      // Check angle
      expect(origin.angle).toBeCloseTo(expected.angle)
      
      // Check orientation array
      expect(origin.orientation).toEqual(expected.orientation)
      
      // Check firstQuintant
      expect(origin.firstQuintant).toBe(expected.firstQuintant)
    })
  })
})

describe('origin properties', () => {
  it('each origin has required properties', () => {
    for (const origin of origins) {
      // Check properties exist
      expect(origin.axis).toBeDefined()
      expect(origin.quat).toBeDefined()
      expect(origin.angle).toBeDefined()
      
      // Check axis is unit vector when converted to cartesian
      const cartesian = toCartesian(origin.axis);
      const length = vec3.length(cartesian)
      expect(length).toBeCloseTo(1)
      
      // Check quaternion is normalized
      const qLength = quat.length(origin.quat)
      expect(qLength).toBeCloseTo(1)
    }
  })
})

describe('findNearestOrigin', () => {
  it('finds correct origin for points at face centers', () => {
    for (const origin of origins) {
      const point = origin.axis;
      const nearest = findNearestOrigin(point);
      expect(nearest).toBe(origin);
    }
  });

  it('finds correct origin for points at face boundaries', () => {
    // Test points halfway between adjacent origins
    const BOUNDARY_POINTS = [
      // Between north pole and equatorial faces
      {point: [0, PI_OVER_5/2], expectedOrigins: [0, 1]},
      // Between equatorial faces
      {point: [2*PI_OVER_5, PI_OVER_5], expectedOrigins: [3, 4]},
      // Between equatorial and south pole
      {point: [0, Math.PI - PI_OVER_5/2], expectedOrigins: [9, 10]},
    ] as {point: Spherical, expectedOrigins: number[]}[];

    for (const {point, expectedOrigins} of BOUNDARY_POINTS) {
      const nearest = findNearestOrigin(point);
      expect(expectedOrigins).toContain(nearest.id);
    }
  });

  it('handles antipodal points', () => {
    // Test points opposite to face centers
    for (const origin of origins) {
      const [theta, phi] = origin.axis;
      // Add π to theta and π-phi to get antipodal point
      const antipodal = [theta + Math.PI, Math.PI - phi] as Spherical;
      
      const nearest = findNearestOrigin(antipodal);
      // Should find one of the faces near the antipodal point
      expect(nearest).not.toBe(origin);
    }
  });
});

describe('haversine', () => {
  it('returns 0 for identical points', () => {
    const point = [0, 0] as Spherical;
    expect(haversine(point, point)).toBe(0);

    const point2 = [Math.PI/4, Math.PI/3] as Spherical;
    expect(haversine(point2, point2)).toBe(0);
  });

  it('is symmetric', () => {
    const p1 = [0, Math.PI/4] as Spherical;
    const p2 = [Math.PI/2, Math.PI/3] as Spherical;
    
    const d1 = haversine(p1, p2);
    const d2 = haversine(p2, p1);
    
    expect(d1).toBeCloseTo(d2);
  });

  it('increases with angular separation', () => {
    const origin = [0, 0] as Spherical;
    const distances = [
      [0, Math.PI/6],      // 30°
      [0, Math.PI/4],      // 45°
      [0, Math.PI/3],      // 60°
      [0, Math.PI/2],      // 90°
    ] as Spherical[];

    let lastDistance = 0;
    distances.forEach(point => {
      const distance = haversine(origin, point);
      expect(distance).toBeGreaterThan(lastDistance);
      lastDistance = distance;
    });
  });

  it('handles longitude separation', () => {
    const lat = Math.PI/4;  // Fixed latitude
    const p1 = [0, lat] as Spherical;
    const p2 = [Math.PI, lat] as Spherical;
    const p3 = [Math.PI/2, lat] as Spherical;

    const d1 = haversine(p1, p2);  // 180° separation
    const d2 = haversine(p1, p3);  // 90° separation

    expect(d1).toBeGreaterThan(d2);
  });

  it('matches expected values for known cases', () => {
    // Test against some pre-calculated values
    const CASES = [
      {
        p1: [0, 0],
        p2: [0, Math.PI/2],
        expected: 0.5  // sin²(π/4) = 0.5
      },
      {
        p1: [0, Math.PI/4],
        p2: [Math.PI/2, Math.PI/4],
        expected: 0.25  // For points at same latitude
      }
    ] as {p1: Spherical, p2: Spherical, expected: number}[];

    CASES.forEach(({p1, p2, expected}) => {
      expect(haversine(p1, p2)).toBeCloseTo(expected, 4);
    });
  });
});

describe('quintant conversion', () => {
  it('converts between quintants and segments', () => {
    const origin = origins[0];
    for (let quintant = 0; quintant < 5; quintant++) {
      const {segment, orientation} = quintantToSegment(quintant, origin);
      const {quintant: roundTripQuintant} = segmentToQuintant(segment, origin);
      expect(roundTripQuintant).toBe(quintant);
    }
  });
});

describe('isNearestOrigin', () => {
  it('returns true for points at face centers', () => {
    for (const origin of origins) {
      const nearest = findNearestOrigin(origin.axis);
      expect(nearest).toBe(origin);
    }
  });

  it('returns false for points at face boundaries', () => {
    // Test points halfway between adjacent origins
    const BOUNDARY_POINTS = [
      // Between north pole and equatorial faces
      {point: [0, PI_OVER_5/2], origin: origins[0]},
      // Between equatorial faces
      {point: [2*PI_OVER_5, PI_OVER_5], origin: origins[3]},
      // Between equatorial and south pole
      {point: [0, Math.PI - PI_OVER_5/2], origin: origins[9]},
    ] as {point: Spherical, origin: Origin}[];

    for (const {point, origin} of BOUNDARY_POINTS) {
      expect(isNearestOrigin(point, origin)).toBe(false);
    }
  });
}); 