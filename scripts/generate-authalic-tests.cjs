const { AuthalicProjection } = require("./a5-test.cjs");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "./../tests/projections/data");
const TEST_DATA_PATH = path.join(DATA_DIR, "authalic-test-data.json");

// Define specific test values at the top
const SPECIFIC_LATITUDES = [
  -90, -67.5, -45, -22.5, 0, 22.5, 45, 67.5, 90
];

function generateRandomLatitude() {
  // Generate random latitude in radians
  // Range: [-π/2, π/2] (from -90° to 90°)
  return (Math.random() - 0.5) * Math.PI;
}

function generateAuthalicTestData() {
  const authalic = new AuthalicProjection();
  const testData = {
    forward: [],
    inverse: []
  };

  // Generate forward tests: include specific values + random data
  const specificForwardCases = SPECIFIC_LATITUDES.map(deg => {
    const latRad = (deg * Math.PI / 180);
    const expected = authalic.forward(latRad);
    return {
      input: latRad,
      expected: expected
    };
  });

  // Fill remaining space with random data
  const remainingForwardCases = 100 - specificForwardCases.length;
  for (let i = 0; i < remainingForwardCases; i++) {
    const input = generateRandomLatitude();
    const expected = authalic.forward(input);
    
    testData.forward.push({
      input: input,
      expected: expected
    });
  }

  // Add specific cases to the beginning
  testData.forward.unshift(...specificForwardCases);

  // Generate inverse tests: include specific values + random data
  const specificInverseCases = SPECIFIC_LATITUDES.map(deg => {
    const latRad = (deg * Math.PI / 180);
    const authalicRad = authalic.forward(latRad); // Convert to authalic first
    const expected = authalic.inverse(authalicRad);
    return {
      input: authalicRad,
      expected: expected
    };
  });

  // Fill remaining space with random data
  const remainingInverseCases = 100 - specificInverseCases.length;
  for (let i = 0; i < remainingInverseCases; i++) {
    const input = generateRandomLatitude();
    const expected = authalic.inverse(input);
    
    testData.inverse.push({
      input: input,
      expected: expected
    });
  }

  // Add specific cases to the beginning
  testData.inverse.unshift(...specificInverseCases);

  return testData;
}

function updateExistingTestData(existingData) {
  const authalic = new AuthalicProjection();
  
  // Update expected values for forward tests
  if (existingData.forward) {
    existingData.forward.forEach(testCase => {
      testCase.expected = authalic.forward(testCase.input);
    });
  }

  // Update expected values for inverse tests
  if (existingData.inverse) {
    existingData.inverse.forEach(testCase => {
      testCase.expected = authalic.inverse(testCase.input);
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
      testData = generateAuthalicTestData();
      console.log("Generated new test data with forward and inverse test cases");
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
    console.error("Failed to generate authalic test data:", error);
    process.exit(1);
  }
}

main(); 