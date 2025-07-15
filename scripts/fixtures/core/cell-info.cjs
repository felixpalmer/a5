const fs = require('fs');
const path = require('path');

const { getNumCells, cellArea } = require('../../a5-test.cjs');

// Generate data for resolutions 0 to 30
const cellInfoData = { numCells: [], cellArea: [] };

for (let resolution = 0; resolution <= 30; resolution++) {
  const count = getNumCells(resolution);
  const countBigInt = getNumCells(BigInt(resolution));
  const areaM2 = cellArea(resolution);
  
  cellInfoData.numCells.push({ resolution, count, countBigInt: countBigInt.toString() });
  cellInfoData.cellArea.push({ resolution, areaM2 });
}

// Save the data to a JSON file
const fixturesDir = path.join(__dirname, './../../../tests/fixtures');
const outputPath = path.join(fixturesDir, 'cell-info.json');
fs.writeFileSync(outputPath, JSON.stringify(cellInfoData, null, 2)); 