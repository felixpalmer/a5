// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { describe, test, expect } from 'vitest';
import {
  φ,
  TWO_PI,
  TWO_PI_OVER_5,
  PI_OVER_5,
  PI_OVER_10,
  dihedralAngle,
  interhedralAngle,
  faceEdgeAngle,
  distanceToEdge,
  distanceToVertex,
  Rinscribed,
  Rmidedge,
  Rcircumscribed
} from 'a5/core/constants';
import constantsFixture from './fixtures/constants.json';

describe('constants.ts', () => {
  describe('golden ratio', () => {
    test('has correct value', () => {
      expect(φ).toBeCloseTo(constantsFixture.φ.expectedValue, 15);
      expect(φ).toBe(constantsFixture.φ.value);
    });

    test('satisfies golden ratio property φ² = φ + 1', () => {
      expect(constantsFixture.φ.properties.goldenRatioSquared).toBeCloseTo(constantsFixture.φ.properties.goldenRatioPlusOne, 15);
    });

    test('satisfies reciprocal property 1/φ = φ - 1', () => {
      expect(constantsFixture.φ.properties.reciprocal).toBeCloseTo(constantsFixture.φ.properties.reciprocalMinusOne, 15);
    });
  });

  describe('angular constants', () => {
    test('TWO_PI equals 2π', () => {
      expect(TWO_PI).toBe(constantsFixture.angles.TWO_PI.value);
      expect(TWO_PI).toBeCloseTo(constantsFixture.angles.TWO_PI.expectedValue, 15);
    });

    test('TWO_PI_OVER_5 equals 2π/5', () => {
      expect(TWO_PI_OVER_5).toBe(constantsFixture.angles.TWO_PI_OVER_5.value);
      expect(TWO_PI_OVER_5).toBeCloseTo(constantsFixture.angles.TWO_PI_OVER_5.expectedValue, 15);
    });

    test('PI_OVER_5 equals π/5', () => {
      expect(PI_OVER_5).toBe(constantsFixture.angles.PI_OVER_5.value);
      expect(PI_OVER_5).toBeCloseTo(constantsFixture.angles.PI_OVER_5.expectedValue, 15);
    });

    test('PI_OVER_10 equals π/10', () => {
      expect(PI_OVER_10).toBe(constantsFixture.angles.PI_OVER_10.value);
      expect(PI_OVER_10).toBeCloseTo(constantsFixture.angles.PI_OVER_10.expectedValue, 15);
    });

    test('angular relationships', () => {
      expect(TWO_PI_OVER_5).toBeCloseTo(2 * PI_OVER_5, 15);
      expect(PI_OVER_5).toBeCloseTo(2 * PI_OVER_10, 15);
    });
  });

  describe('dodecahedron angles', () => {
    test('dihedral angle is correct', () => {
      expect(dihedralAngle).toBe(constantsFixture.dodecahedronAngles.dihedralAngle.value);
      expect(dihedralAngle).toBeCloseTo(constantsFixture.dodecahedronAngles.dihedralAngle.expectedValue, 15);
    });

    test('interhedral angle is correct', () => {
      expect(interhedralAngle).toBe(constantsFixture.dodecahedronAngles.interhedralAngle.value);
      expect(interhedralAngle).toBeCloseTo(constantsFixture.dodecahedronAngles.interhedralAngle.expectedValue, 15);
    });

    test('dihedral and interhedral angles sum to π', () => {
      expect(constantsFixture.dodecahedronAngles.angleSum).toBeCloseTo(Math.PI, 15);
    });

    test('face edge angle is correct', () => {
      expect(faceEdgeAngle).toBe(constantsFixture.dodecahedronAngles.faceEdgeAngle.value);
      expect(faceEdgeAngle).toBeCloseTo(constantsFixture.dodecahedronAngles.faceEdgeAngle.expectedValue, 15);
    });
  });

  describe('distance constants', () => {
    test('distance to edge is correct', () => {
      expect(distanceToEdge).toBe(constantsFixture.distances.distanceToEdge.value);
      expect(distanceToEdge).toBeCloseTo(constantsFixture.distances.distanceToEdge.expectedValue, 15);
      expect(distanceToEdge).toBeCloseTo(constantsFixture.distances.distanceToEdge.alternativeFormula, 15);
    });

    test('distance to vertex is correct', () => {
      expect(distanceToVertex).toBe(constantsFixture.distances.distanceToVertex.value);
      expect(distanceToVertex).toBeCloseTo(constantsFixture.distances.distanceToVertex.expectedValue, 15);
      expect(distanceToVertex).toBeCloseTo(constantsFixture.distances.distanceToVertex.alternativeFormula, 15);
    });
  });

  describe('dodecahedron sphere radii', () => {
    test('inscribed radius is 1', () => {
      expect(Rinscribed).toBe(constantsFixture.sphereRadii.Rinscribed.value);
      expect(Rinscribed).toBe(constantsFixture.sphereRadii.Rinscribed.expectedValue);
    });

    test('midedge radius is correct', () => {
      expect(Rmidedge).toBe(constantsFixture.sphereRadii.Rmidedge.value);
      expect(Rmidedge).toBeCloseTo(constantsFixture.sphereRadii.Rmidedge.expectedValue, 15);
    });

    test('circumscribed radius is correct', () => {
      expect(Rcircumscribed).toBe(constantsFixture.sphereRadii.Rcircumscribed.value);
      expect(Rcircumscribed).toBeCloseTo(constantsFixture.sphereRadii.Rcircumscribed.expectedValue, 15);
    });

    test('radii relationships', () => {
      expect(constantsFixture.sphereRadii.relationships.inscribedLessThanMidedge).toBe(true);
      expect(constantsFixture.sphereRadii.relationships.midedgeLessThanCircumscribed).toBe(true);
    });
  });

  describe('mathematical consistency', () => {
    test('constants are finite numbers', () => {
      constantsFixture.validationTests.finiteNumbers.forEach(test => {
        expect(test.isFinite).toBe(true);
        expect(test.isNaN).toBe(false);
      });
    });

    test('positive constants are positive', () => {
      constantsFixture.validationTests.positiveConstants.forEach(test => {
        expect(test.isPositive).toBe(true);
      });
    });
  });
});