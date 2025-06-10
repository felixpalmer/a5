const { parse } = require('csv-parse/sync');
const { lonLatToCell, cellToLonLat, bigIntToHex } = require('a5-js');
const fs = require('fs');

// Read and parse the CSV file
const inputFile = process.argv[2];
const outputFile = process.argv[3];
const resolution = parseInt(process.argv[4]);

if (!inputFile || !outputFile || isNaN(resolution)) {
  console.error('Usage: node index.js <input.csv> <output.json> <resolution>');
  console.error('  resolution: A5 cell resolution (integer)');
  process.exit(1);
}

try {
  // Read and parse CSV
  const csvContent = fs.readFileSync(inputFile, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true
  });

  // Aggregate data by A5 cell ID
  const aggregatedData = new Map();

  for (const record of records) {
    const lng = parseFloat(record.lng);
    const lat = parseFloat(record.lat);
    
    if (isNaN(lng) || isNaN(lat)) {
      console.warn(`Skipping invalid coordinates: ${record.lng}, ${record.lat}`);
      continue;
    }

    const cellId = lonLatToCell([lng, lat], resolution);
    const cellIdHex = bigIntToHex(cellId);

    if (!aggregatedData.has(cellIdHex)) {
      aggregatedData.set(cellIdHex, {
        cellId: cellIdHex,
        count: 1
      });
    } else {
      const cell = aggregatedData.get(cellIdHex);
      cell.count++;
    }
  }

  // Convert to array and write to JSON file
  const result = Array.from(aggregatedData.values());
  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
  
  console.log(`Successfully processed ${records.length} points into ${result.length} A5 cells at resolution ${resolution}`);
  console.log(`Output written to ${outputFile}`);

} catch (error) {
  console.error('Error processing data:', error);
  process.exit(1);
} 