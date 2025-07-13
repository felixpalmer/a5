const { GnomonicProjection } = require("../../a5-test.cjs");
const { generateProjectionTests } = require("../projection-generator.cjs");

function generateRandomSpherical() {
  // Generate random spherical coordinates
  // theta: [0, 2π] (longitude)
  // phi: [0, π/2] (latitude - limited to avoid singularity at poles)
  const theta = Math.random() * 2 * Math.PI;
  const phi = Math.random() * Math.PI / 2;
  return [theta, phi];
}

function generateRandomPolar() {
  // Generate random polar coordinates
  // rho: [0, 10] (reasonable range for gnomonic projection)
  // gamma: [0, 2π] (angle)
  const rho = Math.random() * 10;
  const gamma = Math.random() * 2 * Math.PI;
  return [rho, gamma];
}

// Define specific test values
const SPECIFIC_SPHERICAL_INPUTS = [
  [0, 0],           // North pole
  [0, Math.PI/2],   // Equator at 0° longitude
  [Math.PI/2, Math.PI/2], // Equator at 90° longitude
  [Math.PI, Math.PI/2],   // Equator at 180° longitude
  [Math.PI/4, Math.PI/4]  // Mid-latitude, mid-longitude
];

const SPECIFIC_POLAR_INPUTS = [
  [0, 0],           // Origin
  [1, 0],           // Unit distance, 0° angle
  [1, Math.PI/2],   // Unit distance, 90° angle
  [2, Math.PI],     // Distance 2, 180° angle
  [0.5, Math.PI/4]  // Half unit distance, 45° angle
];

const config = {
  projectionName: 'gnomonic',
  ProjectionClass: GnomonicProjection,
  generateRandomForwardInput: generateRandomSpherical,
  generateRandomInverseInput: generateRandomPolar,
  specificForwardInputs: SPECIFIC_SPHERICAL_INPUTS,
  specificInverseInputs: SPECIFIC_POLAR_INPUTS,
  forwardTestCount: 100,
  inverseTestCount: 100
};

generateProjectionTests(config); 