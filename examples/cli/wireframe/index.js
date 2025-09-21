const {
  cellToBoundary,
  u64ToHex,
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
  const LIMIT = 10000;
  let cellIds = cellToChildren(0n, 1);
  let r = 1;
  while (r < resolution) {
    r++;
    const newCellIds = [];
    const probability = LIMIT / (cellIds.length * 4);
    for (const c of cellIds) {
      let children = cellToChildren(c, r);
      for (const c of children) {
        if (Math.random() < probability) {
          newCellIds.push(c);
        }
      }
    }

    cellIds = newCellIds;
  }

  // Generate all cells
  for (let cellId of cellIds) {
    const cellIdHex = u64ToHex(cellId);
    const boundary = cellToBoundary(cellId, {
      closedRing: true,
      segments: 10,
    });

    cells.push({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [boundary]
      },
      properties: {cellIdHex}
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
