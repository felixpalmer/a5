// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { describe, test, expect } from 'vitest';
import { quat, vec3 } from 'gl-matrix';
import { quaternions } from 'a5/core/dodecahedron-quaternions';
import quaternionsFixture from './fixtures/dodecahedron-quaternions.json';

describe('dodecahedron-quaternions.ts', () => {
  describe('quaternion array', () => {
    test('has 12 quaternions for 12 dodecahedron faces', () => {
      expect(quaternions).toHaveLength(quaternionsFixture.metadata.totalQuaternions);
    });

    test('all quaternions are normalized', () => {
      expect(quaternionsFixture.validationTests.allNormalized).toBe(true);
      quaternionsFixture.quaternions.forEach((data, i) => {
        expect(data.magnitude).toBeCloseTo(1.0, 10);
      });
    });

    test('first quaternion is identity (north pole)', () => {
      expect(quaternionsFixture.validationTests.northPoleIdentity).toBe(true);
      expect(quaternions[0]).toEqual([0, 0, 0, 1]);
    });

    test('last quaternion represents south pole rotation', () => {
      expect(quaternionsFixture.validationTests.southPoleCorrect).toBe(true);
      expect(quaternions[11]).toEqual([0, -1, 0, 0]);
    });

    test('quaternions are valid', () => {
      expect(quaternionsFixture.validationTests.allFinite).toBe(true);
      quaternions.forEach((q, i) => {
        expect(q).toHaveLength(4);
        q.forEach(component => {
          expect(Number.isFinite(component)).toBe(true);
          expect(Number.isNaN(component)).toBe(false);
        });
      });
    });
  });

  describe('quaternion properties', () => {
    test('first ring quaternions (indices 1-5) have consistent structure', () => {
      for (let i = 1; i <= 5; i++) {
        const q = quaternions[i];
        // Third component should be 0 for first ring
        expect(q[2]).toBeCloseTo(0, 15);
        // Fourth component should be cosAlpha for first ring
        const cosAlpha = Math.sqrt((1 + Math.sqrt(0.2)) / 2);
        expect(q[3]).toBeCloseTo(cosAlpha, 10);
      }
    });

    test('second ring quaternions (indices 6-10) have consistent structure', () => {
      for (let i = 6; i <= 10; i++) {
        const q = quaternions[i];
        // Third component should be 0 for second ring
        expect(q[2]).toBeCloseTo(0, 15);
        // Fourth component should be sinAlpha for second ring
        const sinAlpha = Math.sqrt((1 - Math.sqrt(0.2)) / 2);
        expect(q[3]).toBeCloseTo(sinAlpha, 10);
      }
    });

    test('quaternions represent rotations around axes perpendicular to face centers', () => {
      // Test that rotating the north pole (0, 0, 1) by each quaternion
      // gives a valid point on the unit sphere
      const northPole = vec3.fromValues(0, 0, 1);
      
      quaternions.forEach((q, i) => {
        const rotated = vec3.create();
        vec3.transformQuat(rotated, northPole, q);
        
        // Should be on unit sphere
        const magnitude = vec3.length(rotated);
        expect(magnitude).toBeCloseTo(1.0, 10);
        
        // For non-identity quaternions, should be different from north pole
        if (i !== 0) {
          const distance = vec3.distance(rotated, northPole);
          expect(distance).toBeGreaterThan(0.1);
        }
      });
    });

    test('quaternions produce distinct face centers', () => {
      const northPole = vec3.fromValues(0, 0, 1);
      const facecenters: vec3[] = [];
      
      quaternions.forEach(q => {
        const rotated = vec3.create();
        vec3.transformQuat(rotated, northPole, q);
        facecenters.push(rotated);
      });
      
      // All face centers should be distinct
      for (let i = 0; i < facecenters.length; i++) {
        for (let j = i + 1; j < facecenters.length; j++) {
          const distance = vec3.distance(facecenters[i], facecenters[j]);
          expect(distance).toBeGreaterThan(0.1);
        }
      }
    });
  });

  describe('mathematical consistency', () => {
    test('quaternion conjugates reverse rotations', () => {
      const testVector = vec3.fromValues(1, 0, 0);
      
      quaternions.forEach(q => {
        const conjugate = quat.create();
        quat.conjugate(conjugate, q);
        
        const rotated = vec3.create();
        const backRotated = vec3.create();
        
        vec3.transformQuat(rotated, testVector, q);
        vec3.transformQuat(backRotated, rotated, conjugate);
        
        expect(vec3.distance(testVector, backRotated)).toBeCloseTo(0, 10);
      });
    });

    test('quaternions maintain orthogonality', () => {
      // Test that quaternion rotations preserve orthogonal vectors
      const v1 = vec3.fromValues(1, 0, 0);
      const v2 = vec3.fromValues(0, 1, 0);
      
      quaternions.forEach(q => {
        const rotated1 = vec3.create();
        const rotated2 = vec3.create();
        
        vec3.transformQuat(rotated1, v1, q);
        vec3.transformQuat(rotated2, v2, q);
        
        const dotProduct = vec3.dot(rotated1, rotated2);
        expect(dotProduct).toBeCloseTo(0, 10);
      });
    });

    test('quaternions preserve vector magnitudes', () => {
      const testVectors = [
        vec3.fromValues(1, 0, 0),
        vec3.fromValues(0, 1, 0),
        vec3.fromValues(0, 0, 1),
        vec3.fromValues(1, 1, 1)
      ];
      
      quaternions.forEach(q => {
        testVectors.forEach(v => {
          const originalLength = vec3.length(v);
          const rotated = vec3.create();
          vec3.transformQuat(rotated, v, q);
          const newLength = vec3.length(rotated);
          
          expect(newLength).toBeCloseTo(originalLength, 10);
        });
      });
    });
  });

  describe('dodecahedron geometry', () => {
    test('face centers have correct distribution', () => {
      // Generate all face centers by rotating north pole
      const northPole = vec3.fromValues(0, 0, 1);
      const facecenters: vec3[] = [];
      
      quaternions.forEach(q => {
        const rotated = vec3.create();
        vec3.transformQuat(rotated, northPole, q);
        facecenters.push(rotated);
      });
      
      // Check that we have correct z-distribution:
      // 1 at z=1 (north), 1 at z=-1 (south), 5 at each intermediate level
      const zValues = facecenters.map(fc => fc[2]);
      zValues.sort((a, b) => b - a);
      
      expect(zValues[0]).toBeCloseTo(1, 10); // North pole
      expect(zValues[11]).toBeCloseTo(-1, 10); // South pole
      
      // Two rings of 5 each at intermediate z values
      const INV_SQRT5 = Math.sqrt(0.2);
      const firstRingZ = zValues.slice(1, 6);
      const secondRingZ = zValues.slice(6, 11);
      
      firstRingZ.forEach(z => expect(z).toBeCloseTo(INV_SQRT5, 5));
      secondRingZ.forEach(z => expect(z).toBeCloseTo(-INV_SQRT5, 5));
    });

    test('face centers form regular pentagonal arrangements', () => {
      const northPole = vec3.fromValues(0, 0, 1);
      const facecenters: vec3[] = [];
      
      quaternions.forEach(q => {
        const rotated = vec3.create();
        vec3.transformQuat(rotated, northPole, q);
        facecenters.push(rotated);
      });
      
      // Check angular distribution for first ring (indices 1-5)
      const firstRing = facecenters.slice(1, 6);
      for (let i = 0; i < 5; i++) {
        const next = (i + 1) % 5;
        const angle1 = Math.atan2(firstRing[i][1], firstRing[i][0]);
        const angle2 = Math.atan2(firstRing[next][1], firstRing[next][0]);
        let angleDiff = angle2 - angle1;
        if (angleDiff < 0) angleDiff += 2 * Math.PI;
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
        
        // Should be approximately 2π/5 = 72 degrees
        expect(angleDiff).toBeCloseTo(2 * Math.PI / 5, 1);
      }
    });
  });

  describe('fixture validation', () => {
    test('fixture metadata is current', () => {
      expect(quaternionsFixture.metadata.totalQuaternions).toBe(12);
      expect(quaternionsFixture.constants.INV_SQRT5).toBeCloseTo(Math.sqrt(0.2), 15);
      expect(quaternionsFixture.constants.expectedPentagonAngle).toBeCloseTo(2 * Math.PI / 5, 15);
    });
  });
});