const { cellToBoundary, u64ToHex, cellToChildren } = require("../dist/a5.cjs");
const fs = require("fs");
const path = require("path");

const INTEGRATION_TESTS_DIR = path.join(__dirname, "./../tests/integration");

function generateWireframeTest(resolution, segments = "auto") {
  // Use .json extension to enable easier importing in tests
  const filename = segments === "auto" ? `wireframe-auto-edges-${resolution}.json` : `wireframe-${resolution}.json`;
  const outputPath = path.join(INTEGRATION_TESTS_DIR, filename);

  const features = [];
  try {
    // Generate all cells at a given resolution
    const cellIds = cellToChildren(0n, resolution);
    for (let cellId of cellIds) {
      const cellIdHex = u64ToHex(cellId);
      const boundary = cellToBoundary(cellId, { closedRing: true, segments });

      features.push({
        type: "Feature",
        properties: { cellIdHex },
        geometry: { type: "Polygon", coordinates: [boundary] }
      });
    }

    const geojson = { type: "FeatureCollection", features };

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));

    console.log(`Generated ${features.length} A5 cells at resolution ${resolution}: ${outputPath}`);
  } catch (error) {
    console.error(`Error generating cells for resolution ${resolution}:`, error);
    throw error;
  }
}

function main() {
  try {
    // Generate files for resolutions 0-3 with both segment types
    for (let resolution = 0; resolution <= 3; resolution++) {
      generateWireframeTest(resolution, 1);
      generateWireframeTest(resolution, "auto");
    }
    console.log("Wireframe test data generation completed successfully!");
  } catch (error) {
    console.error("Failed to generate wireframe test data:", error);
    process.exit(1);
  }
}

main(); 