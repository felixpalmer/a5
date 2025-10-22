const fs = require('fs');
const path = require('path');
const parquet = require('parquetjs');

const { lonLatToCell, compact, uncompact, cellArea, cellToBoundary, u64ToHex } = require('../../../dist/a5.cjs');

// London coordinates (central point near Trafalgar Square)
const LONDON_CENTER = [-0.1278, 51.5074]; // [lon, lat]
const RADIUS_KM = 10;
const RESOLUTION = 13;

/**
 * Generate a grid of points within a radius around a center point
 * Uses simple lat/lon grid (not perfect for spherical geometry, but close enough for 10km)
 */
function generatePointsInRadius(centerLonLat, radiusKm, spacingMeters) {
  const [centerLon, centerLat] = centerLonLat;

  // Convert radius to approximate degrees
  // At London's latitude (~51°), 1 degree longitude ≈ 69.6 km
  // 1 degree latitude ≈ 111 km everywhere
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
 * Generate cells at a specific resolution covering the area
 */
function generateCellsAtResolution(resolution) {
  // Calculate optimal point spacing based on cell area
  // Use 75% of cell side length to ensure no holes
  const cellAreaSqm = cellArea(resolution);
  const cellSide = Math.sqrt(cellAreaSqm);
  const spacingMeters = cellSide * 0.75;

  console.log(`\nResolution ${resolution}:`);
  console.log(`  Cell area: ${cellAreaSqm.toFixed(2)} sq meters`);
  console.log(`  Cell side (approx): ${cellSide.toFixed(2)} meters`);
  console.log(`  Point spacing: ${spacingMeters.toFixed(2)} meters`);

  const points = generatePointsInRadius(LONDON_CENTER, RADIUS_KM, spacingMeters);
  console.log(`  Generated ${points.length} points in grid`);

  // Convert all points to cells at this resolution
  const cellSet = new Set();
  for (const point of points) {
    const cell = lonLatToCell(point, resolution);
    cellSet.add(cell);
  }

  const cells = Array.from(cellSet);
  console.log(`  Unique cells: ${cells.length}`);

  return cells;
}

/**
 * Generate compacted cells for London fixture at resolution 13
 */
function generateLondonCompactFixture() {
  console.log('Generating London 10km radius fixture at resolution', RESOLUTION);
  console.log('Center point:', LONDON_CENTER);

  const cells = generateCellsAtResolution(RESOLUTION);

  // Compact the cells
  const compacted = compact(cells);
  console.log(`  Compacted to: ${compacted.length} cells`);
  console.log(`  Compression ratio: ${(cells.length / compacted.length).toFixed(2)}x`);

  // Verify round-trip
  const uncompacted = uncompact(compacted, RESOLUTION);
  console.log(`  Uncompacted back to: ${uncompacted.length} cells`);

  // Check coverage is preserved
  const uncompactedSet = new Set(uncompacted.map(c => c.toString()));
  const originalSet = new Set(cells.map(c => c.toString()));

  let missing = 0;
  let extra = 0;
  for (const cell of originalSet) {
    if (!uncompactedSet.has(cell)) missing++;
  }
  for (const cell of uncompactedSet) {
    if (!originalSet.has(cell)) extra++;
  }

  if (missing > 0 || extra > 0) {
    console.error(`Round-trip verification failed! Missing: ${missing}, Extra: ${extra}`);
    process.exit(1);
  }

  console.log('  ✓ Round-trip verification passed');

  return {
    description: 'Compacted cells covering 10km radius around London (Trafalgar Square)',
    center: LONDON_CENTER,
    radiusKm: RADIUS_KM,
    resolution: RESOLUTION,
    originalCellCount: cells.length,
    compactedCellCount: compacted.length,
    compressionRatio: cells.length / compacted.length,
    compactedCells: compacted
  };
}

// Generate the fixture (for validation only)
const fixture = generateLondonCompactFixture();

// Set fixtures directory
const fixturesDir = path.join(__dirname, '../../../tests/fixtures');

/**
 * Generate GeoJSON for cells at a specific resolution
 */
function generateGeoJSON(cells, resolution, outputPath) {
  console.log(`\nGenerating GeoJSON for ${cells.length} cells at resolution ${resolution}...`);

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
      properties: { cellIdHex }
    });
  }

  const geojson = {
    type: 'FeatureCollection',
    features,
  };

  fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
  console.log(`Written GeoJSON (${features.length} cells) to ${outputPath}`);
  console.log(`File size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
}

/**
 * Write Parquet file for compacted cells
 */
async function writeParquet(compacted, resolution) {
  const parquetPath = path.join(fixturesDir, `compact-london-res${resolution}.parquet`);

  // Define schema for Parquet file
  const schema = new parquet.ParquetSchema({
    cell_id: { type: 'UINT_64', optional: false, encoding: 'PLAIN' }
  });

  // Create writer
  const writer = await parquet.ParquetWriter.openFile(schema, parquetPath);

  // Write rows
  for (const cellId of compacted) {
    await writer.appendRow({
      cell_id: cellId
    });
  }

  await writer.close();

  const fileSize = fs.statSync(parquetPath).size;
  console.log(`  Written Parquet file: ${parquetPath}`);
  console.log(`  File size: ${fileSize} bytes (${(fileSize / 1024).toFixed(2)} KB)`);
}

// Generate GeoJSON and Parquet files for resolutions 13, 14, and 15
async function generateAllFormats() {
  console.log('\n--- Generating compacted cell files for all resolutions ---');

  // Generate and compact cells at resolution 13
  console.log('\nGenerating compacted cells for resolution 13...');
  const cells13 = generateCellsAtResolution(13);
  const compacted13 = compact(cells13);
  console.log(`  Compacted to: ${compacted13.length} cells (from ${cells13.length})`);
  await writeParquet(compacted13, 13);
  generateGeoJSON(compacted13, 13, path.join(fixturesDir, 'compact-london-res13.geojson'));

  // Generate and compact cells at resolution 14
  console.log('\nGenerating compacted cells for resolution 14...');
  const cells14 = generateCellsAtResolution(14);
  const compacted14 = compact(cells14);
  console.log(`  Compacted to: ${compacted14.length} cells (from ${cells14.length})`);
  await writeParquet(compacted14, 14);
  generateGeoJSON(compacted14, 14, path.join(fixturesDir, 'compact-london-res14.geojson'));

  // Generate and compact cells at resolution 15
  console.log('\nGenerating compacted cells for resolution 15...');
  const cells15 = generateCellsAtResolution(15);
  const compacted15 = compact(cells15);
  console.log(`  Compacted to: ${compacted15.length} cells (from ${cells15.length})`);
  await writeParquet(compacted15, 15);
  generateGeoJSON(compacted15, 15, path.join(fixturesDir, 'compact-london-res15.geojson'));

  console.log('\n✓ All formats generated successfully!');
}

// Run the async function
generateAllFormats().catch(err => {
  console.error('Error generating formats:', err);
  process.exit(1);
});
