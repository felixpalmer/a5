const {
  cellToBoundary,
  u64ToHex,
  cellToChildren,
} = require("../../../dist/a5.cjs");
const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

const resolution = parseInt(process.argv[2]);
const outputFile = process.argv[3];

if (!outputFile || isNaN(resolution)) {
  console.error("Usage: node index.js <resolution> <output.json>");
  console.error("  resolution: A5 cell resolution (integer)");
  process.exit(1);
}

// Helper function to normalize numbers for comparison
function normalizeNumber(num) {
  if (typeof num !== 'number') return num;
  // Round to 12 decimal places to account for floating point differences
  return Math.round(num * 1e12) / 1e12;
}

// Recursively normalize all numbers in an object/array
function normalizeData(obj) {
  if (Array.isArray(obj)) {
    return obj.map(normalizeData);
  } else if (obj !== null && typeof obj === 'object') {
    const normalized = {};
    for (const [key, value] of Object.entries(obj)) {
      normalized[key] = normalizeData(value);
    }
    return normalized;
  } else if (typeof obj === 'number') {
    return normalizeNumber(obj);
  }
  return obj;
}

// Function to generate TypeScript output
function generateTypeScriptOutput() {
  console.log("🔷 Generating TypeScript output...");
  const cells = [];
  
  try {
    // Calculate total number of cells at this resolution
    let cellIds = cellToChildren(0n, resolution);

    // Generate all cells
    for (let cellId of cellIds) {
      const cellIdHex = u64ToHex(cellId);
      const boundary = cellToBoundary(cellId, {
        closedRing: true,
        segments: 1,
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

    console.log(`✅ TypeScript: Generated ${cells.length} cells at resolution ${resolution}`);
    return geojson;
  } catch (error) {
    console.error("❌ Error generating TypeScript cells:", error);
    throw error;
  }
}

// Function to generate Python output
function generatePythonOutput() {
  console.log("🐍 Generating Python output...");
  
  const pythonScript = path.resolve(__dirname, "../../../../a5-py/examples/wireframe/index.py");
  const tempOutputFile = path.join(__dirname, `temp_py_${Date.now()}.geojson`);
  
  try {
    // Run the Python script
    const command = `python3 "${pythonScript}" ${resolution} "${tempOutputFile}"`;
    const result = execSync(command, { 
      encoding: 'utf8',
      cwd: path.dirname(pythonScript)
    });
    
    console.log("🐍 Python output:", result.trim());
    
    // Read the generated file
    const pythonData = JSON.parse(fs.readFileSync(tempOutputFile, 'utf8'));
    
    // Clean up temp file
    fs.unlinkSync(tempOutputFile);
    
    console.log(`✅ Python: Generated ${pythonData.features.length} cells at resolution ${resolution}`);
    return pythonData;
  } catch (error) {
    console.error("❌ Error generating Python cells:", error);
    // Clean up temp file if it exists
    try {
      fs.unlinkSync(tempOutputFile);
    } catch (e) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

// Function to compare two GeoJSON outputs
function compareOutputs(tsData, pyData) {
  console.log("\n🔍 Comparing outputs...");
  
  // Normalize both datasets for comparison
  const normalizedTs = normalizeData(tsData);
  const normalizedPy = normalizeData(pyData);
  
  // Basic structure comparison
  if (normalizedTs.type !== normalizedPy.type) {
    console.error("❌ Type mismatch:", normalizedTs.type, "vs", normalizedPy.type);
    return false;
  }
  
  if (normalizedTs.features.length !== normalizedPy.features.length) {
    console.error("❌ Feature count mismatch:", normalizedTs.features.length, "vs", normalizedPy.features.length);
    return false;
  }
  
  const tsSorted = normalizedTs.features;
  const pySorted = normalizedPy.features;
  
  let differences = 0;
  const maxDifferencesToShow = 5;
  
  for (let i = 0; i < tsSorted.length; i++) {
    const tsFeature = tsSorted[i];
    const pyFeature = pySorted[i];
    
    // Compare cell IDs
    if (tsFeature.properties.cellIdHex !== pyFeature.properties.cellIdHex) {
      if (differences < maxDifferencesToShow) {
        console.error(`❌ Cell ID mismatch at index ${i}:`, 
          tsFeature.properties.cellIdHex, "vs", pyFeature.properties.cellIdHex);
      }
      differences++;
      continue;
    }
    
    // Compare coordinates (this is where floating point differences might occur)
    const tsCoords = tsFeature.geometry.coordinates[0];
    const pyCoords = pyFeature.geometry.coordinates[0];
    
    if (tsCoords.length !== pyCoords.length) {
      if (differences < maxDifferencesToShow) {
        console.error(`❌ Coordinate count mismatch for cell ${tsFeature.properties.cellIdHex}:`, 
          `${tsCoords.length} (TS) vs ${pyCoords.length} (PY)`);
        console.error(`   TS original: ${tsCoords.length}, PY original: ${pyCoords.length}`);
      }
      differences++;
      continue;
    }
    
    // Compare each coordinate pair
    let coordDifferences = false;
    for (let j = 0; j < tsCoords.length; j++) {
      const tsCoord = tsCoords[j];
      const pyCoord = pyCoords[j];
      
      if (tsCoord.length !== pyCoord.length) {
        coordDifferences = true;
        if (differences < maxDifferencesToShow) {
          console.error(`   Coord ${j}: Different dimensions: ${tsCoord.length} vs ${pyCoord.length}`);
        }
        break;
      }
      
      if (Math.abs(tsCoord[0] - pyCoord[0]) > 1e-10 || Math.abs(tsCoord[1] - pyCoord[1]) > 1e-10) {
        coordDifferences = true;
        if (differences < maxDifferencesToShow) {
          console.error(`   Coord ${j}: [${tsCoord[0]}, ${tsCoord[1]}] vs [${pyCoord[0]}, ${pyCoord[1]}]`);
        }
        break;
      }
    }
    
    if (coordDifferences) {
      if (differences < maxDifferencesToShow) {
        console.error(`❌ Coordinate differences for cell ${tsFeature.properties.cellIdHex}`);
      }
      differences++;
    }
  }
  
  if (differences === 0) {
    console.log("✅ All outputs match perfectly!");
    return true;
  } else {
    console.log(`⚠️  Found ${differences} differences between TypeScript and Python outputs`);
    if (differences > maxDifferencesToShow) {
      console.log(`   (showing first ${maxDifferencesToShow} differences)`);
    }
    return false;
  }
}

// Main execution
async function main() {
  try {
    console.log(`🚀 Starting cross-check for resolution ${resolution}`);
    console.log(`📄 Output will be written to: ${outputFile}\n`);
    
    // Generate outputs from both implementations
    const tsOutput = generateTypeScriptOutput();
    const pyOutput = generatePythonOutput();
    
    // Compare the outputs
    const match = compareOutputs(tsOutput, pyOutput);
    
    // Write the TypeScript output to the specified file
    fs.writeFileSync(outputFile, JSON.stringify(tsOutput, null, 2));
    console.log(`\n📁 TypeScript output written to ${outputFile}`);
    
    // Exit with appropriate code
    if (match) {
      console.log("\n🎉 Cross-check completed successfully - outputs match!");
      process.exit(0);
    } else {
      console.log("\n⚠️  Cross-check completed with differences found");
      process.exit(1);
    }
    
  } catch (error) {
    console.error("\n💥 Cross-check failed:", error);
    process.exit(1);
  }
}

main();
