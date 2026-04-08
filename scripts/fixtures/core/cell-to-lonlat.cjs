const fs = require('fs');
const path = require('path');

const {
  lonLatToCell, cellToLonLat, u64ToHex
} = require('../../a5-test.cjs');

// Test cases: various longitudes including the reported bug at lon > 87°
// (where radToDeg(theta) - 93° offset can exceed [-180, 180])
const testPoints = [
  // From the bug report: https://github.com/felixpalmer/a5-py/issues/39
  [139.7623824402441, 35.677369792795794],
  [80.7623824402441, 35.677369792795794],
  [-80.7623824402441, 35.677369792795794],
  [-139.7623824402441, 35.677369792795794],
  // Longitude sweep to cover the boundary at ~87°
  [87.0, 35.0],
  [88.0, 35.0],
  [90.0, 0.0],
  [120.0, 30.0],
  [150.0, -30.0],
  [170.0, 35.0],
  [179.0, 0.0],
  [-170.0, 35.0],
  [-179.0, 0.0],
  // Polar regions
  [100.0, 80.0],
  [130.0, -70.0],
  // Standard locations
  [0.0, 0.0],
  [-73.9857, 40.7484],  // New York
  [2.3522, 48.8566],    // Paris
  [151.2093, -33.8688], // Sydney
];

const resolutions = [4, 8, 12, 16, 20];

const fixtures = [];
for (const [lon, lat] of testPoints) {
  for (const resolution of resolutions) {
    const cell = lonLatToCell([lon, lat], resolution);
    const center = cellToLonLat(cell);
    fixtures.push({
      input_lonlat: [lon, lat],
      resolution,
      cell_id: u64ToHex(cell),
      center_lonlat: [center[0], center[1]],
    });
  }
}

const outputDir = path.join(__dirname, '../../../tests/fixtures');
const outputPath = path.join(outputDir, 'cell-to-lonlat.json');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(fixtures, null, 2));
console.log(`Generated ${fixtures.length} cell-to-lonlat fixtures at: ${outputPath}`);
