import {lonLatToCell, compact, cellArea, cellToBoundary, u64ToHex} from '../../../dist/a5.js';
import fs from 'fs';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    lon: null,
    lat: null,
    radius: null,
    resolution: null,
    output: null,
    geojson: false,
    uncompacted: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--lon':
        options.lon = parseFloat(args[++i]);
        break;
      case '--lat':
        options.lat = parseFloat(args[++i]);
        break;
      case '--radius':
        options.radius = parseFloat(args[++i]);
        break;
      case '--resolution':
        options.resolution = parseInt(args[++i]);
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--geojson':
        options.geojson = true;
        break;
      case '--uncompacted':
        options.uncompacted = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
      default:
        console.error(`Unknown option: ${arg}`);
        printUsage();
        process.exit(1);
    }
  }

  // Validate required arguments
  if (options.lon === null || options.lat === null || options.radius === null ||
    options.resolution === null || !options.output) {
    console.error('Error: Missing required arguments\n');
    printUsage();
    process.exit(1);
  }

  if (isNaN(options.lon) || isNaN(options.lat) || isNaN(options.radius) || isNaN(options.resolution)) {
    console.error('Error: Invalid numeric arguments\n');
    printUsage();
    process.exit(1);
  }

  return options;
}

function printUsage() {
  console.log(`
Usage: node index.js --lon <longitude> --lat <latitude> --radius <km> --resolution <res> --output <file> [--geojson] [--uncompacted]

Arguments:
  --lon <longitude>      Center point longitude (decimal degrees)
  --lat <latitude>       Center point latitude (decimal degrees)
  --radius <km>          Radius around center point in kilometers
  --resolution <res>     Target A5 resolution (integer)
  --output <file>        Output file path (without extension)
  --geojson              Also generate GeoJSON output (optional)
  --uncompacted          Output uncompacted cells instead of compacted (optional)

Example:
  node index.js --lon -0.1278 --lat 51.5074 --radius 10 --resolution 13 --output london

This will generate:
  - london.parquet       Compacted cells in Parquet format
  - london.geojson       GeoJSON visualization (if --geojson specified)
`);
}

/**
 * Generate a grid of points within a radius around a center point
 */
function generatePointsInRadius(centerLonLat, radiusKm, spacingMeters) {
  const [centerLon, centerLat] = centerLonLat;

  // Convert radius to approximate degrees
  // At the given latitude, calculate degrees per km
  const latDegreesPerKm = 1 / 111;
  const lonDegreesPerKm = 1 / (111 * Math.cos(centerLat * Math.PI / 180));

  const radiusDegLat = radiusKm * latDegreesPerKm;
  const radiusDegLon = radiusKm * lonDegreesPerKm;

  // Convert spacing to degrees
  const spacingKm = spacingMeters / 1000;
  const stepLat = spacingKm * latDegreesPerKm;
  const stepLon = spacingKm * lonDegreesPerKm;

  const points = [];

  // Create grid covering bounding box
  const minLat = centerLat - radiusDegLat;
  const maxLat = centerLat + radiusDegLat;
  const minLon = centerLon - radiusDegLon;
  const maxLon = centerLon + radiusDegLon;

  // Generate points
  for (let lat = minLat; lat <= maxLat; lat += stepLat) {
    for (let lon = minLon; lon <= maxLon; lon += stepLon) {
      // Check if point is within radius (simple Euclidean approximation)
      const dLat = lat - centerLat;
      const dLon = lon - centerLon;
      const distKm = Math.sqrt(
        (dLat / latDegreesPerKm) ** 2 +
        (dLon / lonDegreesPerKm) ** 2
      );

      if (distKm <= radiusKm) {
        points.push([lon, lat]);
      }
    }
  }

  return points;
}

/**
 * Generate cells covering the specified area
 * Returns both uncompacted and compacted cells
 */
function generateCells(centerLonLat, radiusKm, resolution) {
  // Calculate optimal point spacing based on cell area
  // Use 75% of cell side length to ensure no holes
  const cellAreaSqm = cellArea(resolution);
  const cellSide = Math.sqrt(cellAreaSqm);
  const spacingMeters = cellSide * 0.75;

  console.log(`Resolution ${resolution}:`);
  console.log(`  Cell area: ${cellAreaSqm.toFixed(2)} sq meters`);
  console.log(`  Cell side (approx): ${cellSide.toFixed(2)} meters`);
  console.log(`  Point spacing: ${spacingMeters.toFixed(2)} meters`);

  const points = generatePointsInRadius(centerLonLat, radiusKm, spacingMeters);
  console.log(`  Generated ${points.length} points in grid`);

  // Convert all points to cells at this resolution
  const cellSet = new Set();
  for (const point of points) {
    const cell = lonLatToCell(point, resolution);
    cellSet.add(cell);
  }

  const cells = Array.from(cellSet);
  console.log(`  Unique cells: ${cells.length}`);

  // Compact the cells
  const compacted = compact(cells);
  console.log(`  Compacted to: ${compacted.length} cells`);
  console.log(`  Compression ratio: ${(cells.length / compacted.length).toFixed(2)}x`);

  return { uncompacted: cells, compacted };
}

/**
 * Write Parquet file for cells
 */
async function writeParquet(cells, outputPath) {
  const parquetPath = `${outputPath}.parquet`;

  // Ensure all values are BigInt (some might be plain numbers)
  const cellIds = cells.map(id => typeof id === 'bigint' ? id : BigInt(id));

  // Import parquet writer functions
  const { ByteWriter, parquetWrite, schemaFromColumnData, fileWriter } = await import('hyparquet-writer');

  const columnData = [
    { name: 'cell_id', data: cellIds }
  ];

  // Create file writer
  const writer = fileWriter(parquetPath);

  // Write parquet file with UINT_64 type using schemaOverrides
  parquetWrite({
    writer,
    columnData,
    // Override schema for cell_id column to use UINT_64
    schema: schemaFromColumnData({
      columnData,
      schemaOverrides: {
        cell_id: {
          name: 'cell_id',
          type: 'INT64',
          converted_type: 'UINT_64',
          repetition_type: 'REQUIRED',
        },
      },
    }),
  });

  const fileSize = fs.statSync(parquetPath).size;
  console.log(`\nWritten Parquet file: ${parquetPath}`);
  console.log(`  File size: ${fileSize} bytes (${(fileSize / 1024).toFixed(2)} KB)`);
}

/**
 * Generate GeoJSON for cells
 */
function writeGeoJSON(cells, outputPath) {
  const geojsonPath = `${outputPath}.geojson`;

  console.log(`\nGenerating GeoJSON for ${cells.length} cells...`);

  const features = [];
  for (const cellId of cells) {
    const cellIdHex = u64ToHex(cellId);
    const boundary = cellToBoundary(cellId, {
      closedRing: true,
      segments: 10,
    });

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [boundary]
      },
      properties: {cellIdHex}
    });
  }

  const geojson = {
    type: 'FeatureCollection',
    features,
  };

  fs.writeFileSync(geojsonPath, JSON.stringify(geojson, null, 2));
  console.log(`Written GeoJSON: ${geojsonPath}`);
  console.log(`  File size: ${(fs.statSync(geojsonPath).size / 1024).toFixed(2)} KB`);
}

// Main execution
async function main() {
  try {
    const options = parseArgs();

    console.log(`\nGenerating ${options.uncompacted ? 'uncompacted' : 'compacted'} A5 cells:`);
    console.log(`  Center: [${options.lon}, ${options.lat}]`);
    console.log(`  Radius: ${options.radius} km`);
    console.log(`  Resolution: ${options.resolution}\n`);

    // Generate cells (both uncompacted and compacted)
    const { uncompacted, compacted } = generateCells(
      [options.lon, options.lat],
      options.radius,
      options.resolution
    );

    // Choose which cells to output
    const cellsToOutput = options.uncompacted ? uncompacted : compacted;

    // Write Parquet file
    await writeParquet(cellsToOutput, options.output);

    // Optionally write GeoJSON
    if (options.geojson) {
      writeGeoJSON(cellsToOutput, options.output);
    }

    console.log('\n✓ Generation complete!');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
