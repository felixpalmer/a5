const { parse } = require('csv-parse/sync');
const { lonLatToCell, cellToLonLat, u64ToHex } = require('../../../dist/a5.cjs');
const fs = require('fs');

// Read and parse the CSV file
const inputFile = process.argv[2];
const outputFile = process.argv[3];
const resolution = parseInt(process.argv[4]);
const outputFormat = process.argv[5] || 'json'; // 'json' or 'parquet'

if (!inputFile || !outputFile || isNaN(resolution)) {
  console.error('Usage: node index.js <input.csv> <output> <resolution> [format]');
  console.error('  resolution: A5 cell resolution (integer)');
  console.error('  format: Output format - "json" or "parquet" (default: json)');
  process.exit(1);
}

if (outputFormat !== 'json' && outputFormat !== 'parquet') {
  console.error('Error: format must be either "json" or "parquet"');
  process.exit(1);
}

async function writeParquet(aggregatedData, outputPath) {
  // Import parquet writer functions
  const { parquetWrite, schemaFromColumnData, fileWriter } = await import('hyparquet-writer');

  // Prepare data arrays
  const cellIds = [];
  const counts = [];

  for (const [cellIdHex, data] of aggregatedData) {
    // Convert hex string back to BigInt for parquet
    cellIds.push(BigInt('0x' + cellIdHex));
    counts.push(data.count);
  }

  const columnData = [
    { name: 'a5', data: cellIds },
    { name: 'count', data: counts }
  ];

  // Create file writer
  const writer = fileWriter(outputPath);

  // Write parquet file with UINT_64 type for a5
  parquetWrite({
    writer,
    columnData,
    schema: schemaFromColumnData({
      columnData,
      schemaOverrides: {
        a5: {
          name: 'a5',
          type: 'INT64',
          converted_type: 'UINT_64',
          repetition_type: 'REQUIRED',
        },
      },
    }),
  });

  const fileSize = fs.statSync(outputPath).size;
  console.log(`File size: ${fileSize} bytes (${(fileSize / 1024).toFixed(2)} KB)`);
}

async function main() {
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
      const cellIdHex = u64ToHex(cellId);

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

    console.log(`Successfully processed ${records.length} points into ${aggregatedData.size} A5 cells at resolution ${resolution}`);

    // Write output in requested format
    if (outputFormat === 'parquet') {
      await writeParquet(aggregatedData, outputFile);
      console.log(`Output written to ${outputFile}`);
    } else {
      // Convert to array and write to JSON file
      const result = Array.from(aggregatedData.values());
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
      console.log(`Output written to ${outputFile}`);
    }

  } catch (error) {
    console.error('Error processing data:', error);
    process.exit(1);
  }
}

main(); 