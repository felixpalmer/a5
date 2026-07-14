const fs = require('fs');
const path = require('path');

const {getPentagonVertices, getQuintantVertices, getFaceVertices, getQuintantPolar} = require('../../a5-test.cjs');

// Generate test data for tiling functions

const tilingData = {
  getPentagonVertices: [],
  getQuintantVertices: [],
  getFaceVertices: null,
  getQuintantPolar: []
};

// Test getPentagonVertices across the four pentagon flavors, several triples,
// quintants and resolutions
const testCases = [
  {resolution: 1, quintant: 0, triple: {x: 0, y: 0, z: 0}, flavor: 0},
  {resolution: 1, quintant: 1, triple: {x: 0, y: 0, z: 0}, flavor: 1},
  {resolution: 1, quintant: 2, triple: {x: 0, y: 1, z: 0}, flavor: 2},
  {resolution: 1, quintant: 3, triple: {x: 0, y: 1, z: -1}, flavor: 3},
  {resolution: 1, quintant: 4, triple: {x: -1, y: 1, z: 0}, flavor: 0},

  {resolution: 2, quintant: 0, triple: {x: -1, y: 2, z: 0}, flavor: 1},
  {resolution: 2, quintant: 2, triple: {x: 0, y: 2, z: -1}, flavor: 2},
  {resolution: 2, quintant: 4, triple: {x: -2, y: 3, z: -1}, flavor: 3},

  {resolution: 3, quintant: 1, triple: {x: -3, y: 5, z: -2}, flavor: 0},
  {resolution: 3, quintant: 3, triple: {x: 0, y: 4, z: -3}, flavor: 1}
];

testCases.forEach(({resolution, quintant, triple, flavor}) => {
  try {
    const pentagon = getPentagonVertices(resolution, quintant, triple, flavor);
    const vertices = pentagon.getVertices();

    tilingData.getPentagonVertices.push({
      input: {resolution, quintant, triple, flavor},
      output: {
        vertices: vertices.map(v => [v[0], v[1]]),
        area: pentagon.getArea(),
        center: pentagon.getCenter()
      }
    });
  } catch (error) {
    console.warn(
      `Error with getPentagonVertices(${resolution}, ${quintant}, ${JSON.stringify(triple)}, ${flavor}):`,
      error.message
    );
  }
});

// Test getQuintantVertices for all quintants
for (let quintant = 0; quintant < 5; quintant++) {
  try {
    const pentagon = getQuintantVertices(quintant);
    const vertices = pentagon.getVertices();

    tilingData.getQuintantVertices.push({
      input: {quintant},
      output: {
        vertices: vertices.map(v => [v[0], v[1]]),
        area: pentagon.getArea(),
        center: pentagon.getCenter()
      }
    });
  } catch (error) {
    console.warn(`Error with getQuintantVertices(${quintant}):`, error.message);
  }
}

// Test getFaceVertices
try {
  const faceShape = getFaceVertices();
  const vertices = faceShape.getVertices();

  tilingData.getFaceVertices = {
    vertices: vertices.map(v => [v[0], v[1]]),
    area: faceShape.getArea(),
    center: faceShape.getCenter()
  };
} catch (error) {
  console.warn('Error with getFaceVertices():', error.message);
}

// Test getQuintantPolar with various polar coordinates
const polarTestCases = [
  [1.0, 0.0], // 0 radians
  [1.0, Math.PI / 5], // π/5 radians
  [1.0, (2 * Math.PI) / 5], // 2π/5 radians
  [1.0, (3 * Math.PI) / 5], // 3π/5 radians
  [1.0, (4 * Math.PI) / 5], // 4π/5 radians
  [1.0, Math.PI], // π radians
  [1.0, (6 * Math.PI) / 5], // 6π/5 radians
  [1.0, (7 * Math.PI) / 5], // 7π/5 radians
  [1.0, (8 * Math.PI) / 5], // 8π/5 radians
  [1.0, (9 * Math.PI) / 5], // 9π/5 radians
  [1.0, 2 * Math.PI], // 2π radians
  [0.5, Math.PI / 10], // Different radius
  [2.0, -Math.PI / 5] // Negative angle
];

polarTestCases.forEach(polar => {
  try {
    const quintant = getQuintantPolar(polar);
    tilingData.getQuintantPolar.push({
      input: {polar},
      output: {quintant}
    });
  } catch (error) {
    console.warn(`Error with getQuintantPolar([${polar[0]}, ${polar[1]}]):`, error.message);
  }
});

// Save the data to a JSON file
const fixturesDir = path.join(__dirname, './../../../tests/fixtures');
const outputPath = path.join(fixturesDir, 'tiling.json');
fs.writeFileSync(outputPath, JSON.stringify(tilingData, null, 2));

console.log(`Generated tiling fixtures with:`);
console.log(`- ${tilingData.getPentagonVertices.length} getPentagonVertices test cases`);
console.log(`- ${tilingData.getQuintantVertices.length} getQuintantVertices test cases`);
console.log(`- 1 getFaceVertices test case`);
console.log(`- ${tilingData.getQuintantPolar.length} getQuintantPolar test cases`);
