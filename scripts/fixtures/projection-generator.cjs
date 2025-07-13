const fs = require("fs");
const path = require("path");

/**
 * Generic test generator for projection classes
 * @param {Object} config - Configuration object for the projection
 * @param {string} config.projectionName - Name of the projection (e.g., 'gnomonic', 'authalic')
 * @param {Function} config.ProjectionClass - Constructor function for the projection class
 * @param {Function} config.generateRandomForwardInput - Function to generate random input for forward tests
 * @param {Function} config.generateRandomInverseInput - Function to generate random input for inverse tests
 * @param {Array} config.specificForwardInputs - Array of specific inputs to include in forward tests
 * @param {Array} config.specificInverseInputs - Array of specific inputs to include in inverse tests
 * @param {number} config.forwardTestCount - Number of forward tests to generate (default: 100)
 * @param {number} config.inverseTestCount - Number of inverse tests to generate (default: 100)
 * @param {Array} config.forwardParams - Array of additional parameters for forward operations
 * @param {Array} config.inverseParams - Array of additional parameters for inverse operations
 * @param {Function} config.postGenerate - Function to post-process the generated test data
 */
function generateProjectionTestData(config) {
  const {
    projectionName,
    ProjectionClass,
    generateRandomForwardInput,
    generateRandomInverseInput,
    specificForwardInputs = [],
    specificInverseInputs = [],
    forwardTestCount = 100,
    inverseTestCount = 100,
    forwardParams = [],
    inverseParams = [],
  } = config;

  const projection = new ProjectionClass();
  const testData = {
    forward: [],
    inverse: []
  };

  // Generate forward tests: include specific values + random data
  const specificForwardCases = specificForwardInputs.map(input => {
    const expected = projection.forward(input, ...forwardParams);
    return {
      input: input,
      expected: expected
    };
  });

  // Fill remaining space with random data
  const remainingForwardCases = forwardTestCount - specificForwardCases.length;
  for (let i = 0; i < remainingForwardCases; i++) {
    const input = generateRandomForwardInput();
    const expected = projection.forward(input, ...forwardParams);
    
    testData.forward.push({
      input: input,
      expected: expected
    });
  }

  // Add specific cases to the beginning
  testData.forward.unshift(...specificForwardCases);

  // Generate inverse tests: include specific values + random data
  const specificInverseCases = specificInverseInputs.map(input => {
    const expected = projection.inverse(input, ...inverseParams);
    return {
      input: input,
      expected: expected
    };
  });

  // Fill remaining space with random data
  const remainingInverseCases = inverseTestCount - specificInverseCases.length;
  for (let i = 0; i < remainingInverseCases; i++) {
    const input = generateRandomInverseInput();
    const expected = projection.inverse(input, ...inverseParams);
    
    testData.inverse.push({
      input: input,
      expected: expected
    });
  }

  // Add specific cases to the beginning
  testData.inverse.unshift(...specificInverseCases);

  return testData;
}

function updateExistingTestData(existingData, config) {
  const { ProjectionClass, forwardParams = [], inverseParams = [] } = config;
  const projection = new ProjectionClass();
  
  // Update expected values for forward tests
  if (existingData.forward) {
    existingData.forward.forEach(testCase => {
      testCase.expected = projection.forward(testCase.input, ...forwardParams);
    });
  }

  // Update expected values for inverse tests
  if (existingData.inverse) {
    existingData.inverse.forEach(testCase => {
      testCase.expected = projection.inverse(testCase.input, ...inverseParams);
    });
  }

  return existingData;
}

function generateProjectionTests(config) {
  const { projectionName } = config;
  const DATA_DIR = path.join(__dirname, "./../../tests/projections/fixtures");
  const TEST_DATA_PATH = path.join(DATA_DIR, `${projectionName}.json`);

  try {
    let testData;

    // Check if test data file already exists
    if (fs.existsSync(TEST_DATA_PATH)) {
      console.log(`Reading existing ${projectionName} test data file...`);
      const existingData = JSON.parse(fs.readFileSync(TEST_DATA_PATH, 'utf8'));
      testData = updateExistingTestData(existingData, config);
      console.log("Updated expected values in existing test data");
    } else {
      console.log(`Generating new ${projectionName} test data...`);
      testData = generateProjectionTestData(config);
      console.log(`Generated new test data with ${testData.forward.length} forward and ${testData.inverse.length} inverse test cases`);
    }

    // Post-process the test data if provided
    if (config.postGenerate) {
      testData = config.postGenerate(testData);
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
    console.error(`Failed to generate ${projectionName} test data:`, error);
    process.exit(1);
  }
}

module.exports = {
  generateProjectionTestData,
  updateExistingTestData,
  generateProjectionTests
}; 