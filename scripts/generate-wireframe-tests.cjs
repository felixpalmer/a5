const { cellToBoundary, bigIntToHex, cellToChildren } = require("../dist/a5.cjs");
const fs = require("fs");
const path = require("path");

const INTEGRATION_TESTS_DIR = path.join(__dirname, "../a5-js/tests/integration");

function generateWireframeTest(resolution, outputPath) {
  console.log(`Generating wireframe test data for resolution ${resolution}...`);
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

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write to JSON file
    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));

    console.log(
      `Successfully generated ${cells.length} A5 cells at resolution ${resolution}`
    );
    console.log(`Output written to ${outputPath}`);
  } catch (error) {
    console.error(`Error generating cells for resolution ${resolution}:`, error);
    throw error;
  }
}

function main() {
  // For now, just generate wireframe-1.json (resolution 1)
  const outputPath = path.join(INTEGRATION_TESTS_DIR, "wireframe-1.json");
  try {
    generateWireframeTest(1, outputPath);
    console.log("Wireframe test data generation completed successfully!");
  } catch (error) {
    console.error("Failed to generate wireframe test data:", error);
    process.exit(1);
  }
}

main(); 