const fs = require('fs');
const path = require('path');

const { origins } = require('../../a5-test.cjs');

// Generate origins data
const originsData = origins.map(origin => ({
  id: origin.id,
  axis: [origin.axis[0], origin.axis[1]],
  quat: [origin.quat[0], origin.quat[1], origin.quat[2], origin.quat[3]],
  angle: origin.angle,
  orientation: origin.orientation,
  firstQuintant: origin.firstQuintant
}));

// Save the data to a JSON file
const fixturesDir = path.join(__dirname, './../../../tests/fixtures');
const outputPath = path.join(fixturesDir, 'origins.json');
fs.writeFileSync(outputPath, JSON.stringify(originsData, null, 2));

console.log(`Generated origins fixture with ${originsData.length} origins`);
console.log(`Saved to: ${outputPath}`);