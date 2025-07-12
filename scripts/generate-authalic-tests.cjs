const { AuthalicProjection } = require("./a5-test.cjs");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "./../tests/projections/data");
const TEST_DATA_PATH = path.join(DATA_DIR, "authalic-test-data.json");

function generateRandomLatitude() {
  // Generate random latitude in radians
  // Range: [-π/2, π/2] (from -90° to 90°)
  return (Math.random() - 0.5) * Math.PI;
}

function generateAuthalicTestData() {
  const authalic = new AuthalicProjection();
  const testData = {
    forward: [],
    inverse: [],
    roundTrip: [],
    specificValues: []
  };

  // Generate 100 random latitudes for forward tests (geodetic to authalic)
  for (let i = 0; i < 100; i++) {
    const input = generateRandomLatitude();
    const expected = authalic.forward(input);
    
    testData.forward.push({
      input: input,
      expected: expected
    });
  }

  // Generate 100 random latitudes for inverse tests (authalic to geodetic)
  for (let i = 0; i < 100; i++) {
    const input = generateRandomLatitude();
    const expected = authalic.inverse(input);
    
    testData.inverse.push({
      input: input,
      expected: expected
    });
  }

  // Generate round-trip test cases
  for (let i = 0; i < 50; i++) {
    const input = generateRandomLatitude();
    const forwardResult = authalic.forward(input);
    const roundTripResult = authalic.inverse(forwardResult);
    
    testData.roundTrip.push({
      input: input,
      forwardResult: forwardResult,
      roundTripResult: roundTripResult
    });
  }

  // Generate specific conversion values test cases
  const specificLatitudes = [
    -90, -67.5, -45, -22.5, 0, 22.5, 45, 67.5, 90
  ];

  specificLatitudes.forEach(deg => {
    const latRad = (deg * Math.PI / 180);
    const authalicRad = authalic.forward(latRad);
    const authalicDeg = (authalicRad * 180 / Math.PI);
    
    testData.specificValues.push({
      geodeticDegrees: deg,
      geodeticRadians: latRad,
      authalicDegrees: authalicDeg,
      authalicRadians: authalicRad
    });
  });

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

  // Update round-trip test cases
  if (existingData.roundTrip) {
    existingData.roundTrip.forEach(testCase => {
      testCase.forwardResult = authalic.forward(testCase.input);
      testCase.roundTripResult = authalic.inverse(testCase.forwardResult);
    });
  }

  // Update specific values test cases
  if (existingData.specificValues) {
    existingData.specificValues.forEach(testCase => {
      testCase.authalicRadians = authalic.forward(testCase.geodeticRadians);
      testCase.authalicDegrees = (testCase.authalicRadians * 180 / Math.PI);
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
      console.log("Generated new test data with forward, inverse, round-trip, and specific value test cases");
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