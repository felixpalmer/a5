const { GnomonicProjection } = require("../modules/projections/gnomonic");
const fs = require("fs");
const path = require("path");

const PROJECTIONS_TESTS_DIR = path.join(__dirname, "./../tests/projections");
const TEST_DATA_PATH = path.join(PROJECTIONS_TESTS_DIR, "gnomonic-test-data.json");

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

function generateGnomonicTestData() {
  const gnomonic = new GnomonicProjection();
  const testData = {
    forward: [],
    inverse: []
  };

  // Generate 100 random spherical coordinates for forward tests
  for (let i = 0; i < 100; i++) {
    const input = generateRandomSpherical();
    const expected = gnomonic.forward(input);
    
    testData.forward.push({
      input: input,
      expected: expected
    });
  }

  // Generate 100 random polar coordinates for inverse tests
  for (let i = 0; i < 100; i++) {
    const input = generateRandomPolar();
    const expected = gnomonic.inverse(input);
    
    testData.inverse.push({
      input: input,
      expected: expected
    });
  }

  return testData;
}

function updateExistingTestData(existingData) {
  const gnomonic = new GnomonicProjection();
  
  // Update expected values for forward tests
  if (existingData.forward) {
    existingData.forward.forEach(testCase => {
      testCase.expected = gnomonic.forward(testCase.input);
    });
  }

  // Update expected values for inverse tests
  if (existingData.inverse) {
    existingData.inverse.forEach(testCase => {
      testCase.expected = gnomonic.inverse(testCase.input);
    });
  }

  return existingData;
}

function main() {
  try {
    let testData;

    // Check if test data file already exists
    if (fs.existsSync(TEST_DATA_PATH)) {
      console.log("Reading existing test data file...");
      const existingData = JSON.parse(fs.readFileSync(TEST_DATA_PATH, 'utf8'));
      testData = updateExistingTestData(existingData);
      console.log("Updated expected values in existing test data");
    } else {
      console.log("Generating new test data...");
      testData = generateGnomonicTestData();
      console.log("Generated new test data with 100 forward and 100 inverse test cases");
    }

    // Ensure output directory exists
    const outputDir = path.dirname(TEST_DATA_PATH);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write test data to file
    fs.writeFileSync(TEST_DATA_PATH, JSON.stringify(testData, null, 2));
    console.log(`Test data written to: ${TEST_DATA_PATH}`);

  } catch (error) {
    console.error("Failed to generate gnomonic test data:", error);
    process.exit(1);
  }
}

main(); 