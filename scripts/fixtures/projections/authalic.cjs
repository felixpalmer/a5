const { AuthalicProjection } = require("../../a5-test.cjs");
const { generateProjectionTests } = require("../projection-generator.cjs");

function generateRandomLatitude() {
  // Generate random latitude in radians
  // Range: [-π/2, π/2] (from -90° to 90°)
  return (Math.random() - 0.5) * Math.PI;
}

// Define specific test values at the top
const SPECIFIC_LATITUDES = [
  -90, -67.5, -45, -22.5, 0, 22.5, 45, 67.5, 90
];

const SPECIFIC_LATITUDE_RADIANS = SPECIFIC_LATITUDES.map(deg => (deg * Math.PI / 180));

const config = {
  projectionName: 'authalic',
  ProjectionClass: AuthalicProjection,
  generateRandomForwardInput: generateRandomLatitude,
  generateRandomInverseInput: generateRandomLatitude,
  specificForwardInputs: SPECIFIC_LATITUDE_RADIANS,
  specificInverseInputs: SPECIFIC_LATITUDE_RADIANS,
  forwardTestCount: 100,
  inverseTestCount: 100
};

generateProjectionTests(config); 