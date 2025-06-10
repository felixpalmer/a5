const {
  cellToBoundary,
  bigIntToHex,
  cellToChildren,
} = require("../../../dist/a5.cjs");
const fs = require("fs");

const resolution = parseInt(process.argv[2]);
const outputFile = process.argv[3];

if (!outputFile || isNaN(resolution)) {
  console.error("Usage: node index.js <resolution> <output.json>");
  console.error("  resolution: A5 cell resolution (integer)");
  process.exit(1);
}

const cells = [];
try {
  // Calculate total number of cells at this resolution
  const cellIds = cellToChildren(0n, resolution);

  // Generate all cells
  for (let cellId of cellIds) {
    const cellIdHex = bigIntToHex(cellId);
    const boundary = cellToBoundary(cellId, {
      closedRing: true,
      segments: "auto",
    });

    cells.push({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [boundary],
      },
    });
  }

  // Create GeoJSON FeatureCollection
  const geojson = {
    type: "FeatureCollection",
    features: cells,
  };

  // Write to JSON file
  fs.writeFileSync(outputFile, JSON.stringify(geojson, null, 2));

  console.log(
    `Successfully generated ${cells.length} A5 cells at resolution ${resolution}`
  );
  console.log(`Output written to ${outputFile}`);
} catch (error) {
  console.error("Error generating cells:", error);
  process.exit(1);
}
