const fs = require('fs');
const path = require('path');

// Import constants from the built module
const { 
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
} = require('../../a5-test.cjs');

// Generate constants data with expected values and properties
const constantsData = {
  φ: {
    value: φ,
    expectedValue: (1 + Math.sqrt(5)) / 2,
    properties: {
      goldenRatioSquared: φ * φ,
      goldenRatioPlusOne: φ + 1,
      reciprocal: 1 / φ,
      reciprocalMinusOne: φ - 1
    }
  },
  angles: {
    TWO_PI: {
      value: TWO_PI,
      expectedValue: 2 * Math.PI
    },
    TWO_PI_OVER_5: {
      value: TWO_PI_OVER_5,
      expectedValue: 2 * Math.PI / 5,
      degrees: TWO_PI_OVER_5 * 180 / Math.PI
    },
    PI_OVER_5: {
      value: PI_OVER_5,
      expectedValue: Math.PI / 5,
      degrees: PI_OVER_5 * 180 / Math.PI
    },
    PI_OVER_10: {
      value: PI_OVER_10,
      expectedValue: Math.PI / 10,
      degrees: PI_OVER_10 * 180 / Math.PI
    }
  },
  dodecahedronAngles: {
    dihedralAngle: {
      value: dihedralAngle,
      expectedValue: 2 * Math.atan(φ),
      degrees: dihedralAngle * 180 / Math.PI
    },
    interhedralAngle: {
      value: interhedralAngle,
      expectedValue: Math.PI - dihedralAngle,
      degrees: interhedralAngle * 180 / Math.PI
    },
    faceEdgeAngle: {
      value: faceEdgeAngle,
      expectedValue: -0.5 * Math.PI + Math.acos(-1 / Math.sqrt(3 - φ)),
      degrees: faceEdgeAngle * 180 / Math.PI
    },
    angleSum: dihedralAngle + interhedralAngle
  },
  distances: {
    distanceToEdge: {
      value: distanceToEdge,
      expectedValue: (Math.sqrt(5) - 1) / 2,
      alternativeFormula: φ - 1
    },
    distanceToVertex: {
      value: distanceToVertex,
      expectedValue: 3 - Math.sqrt(5),
      alternativeFormula: 2 * (2 - φ)
    }
  },
  sphereRadii: {
    Rinscribed: {
      value: Rinscribed,
      expectedValue: 1
    },
    Rmidedge: {
      value: Rmidedge,
      expectedValue: Math.sqrt(3 - φ)
    },
    Rcircumscribed: {
      value: Rcircumscribed,
      expectedValue: Math.sqrt(3) * Rmidedge / φ
    },
    relationships: {
      inscribedLessThanMidedge: Rinscribed < Rmidedge,
      midedgeLessThanCircumscribed: Rmidedge < Rcircumscribed
    }
  },
  validationTests: {
    finiteNumbers: [
      φ, TWO_PI, TWO_PI_OVER_5, PI_OVER_5, PI_OVER_10,
      dihedralAngle, interhedralAngle, faceEdgeAngle,
      distanceToEdge, distanceToVertex,
      Rinscribed, Rmidedge, Rcircumscribed
    ].map(val => ({ value: val, isFinite: Number.isFinite(val), isNaN: Number.isNaN(val) })),
    positiveConstants: [
      φ, TWO_PI, TWO_PI_OVER_5, PI_OVER_5, PI_OVER_10,
      dihedralAngle, interhedralAngle,
      distanceToEdge, distanceToVertex,
      Rinscribed, Rmidedge, Rcircumscribed
    ].map(val => ({ value: val, isPositive: val > 0 }))
  }
};

// Save the data to a JSON file
const fixturesDir = path.join(__dirname, './../../../tests/fixtures');
const outputPath = path.join(fixturesDir, 'constants.json');
fs.writeFileSync(outputPath, JSON.stringify(constantsData, null, 2));

console.log('Generated constants fixture');
console.log(`Saved to: ${outputPath}`);