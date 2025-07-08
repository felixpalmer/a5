import { describe, it, expect } from 'vitest'
import { cellToBoundary } from 'a5/core/cell'
import { hexToBigInt } from 'a5/core/hex'
import type { LonLat } from 'a5/core/coordinate-systems'

// Import test data
import wireframe1 from './integration/wireframe-1.json'
import wireframe2 from './integration/wireframe-2.json'
import wireframe3 from './integration/wireframe-3.json'
import wireframe4 from './integration/wireframe-4.json'
import wireframeAuto1 from './integration/wireframe-auto-edges-1.json'
import wireframeAuto2 from './integration/wireframe-auto-edges-2.json'
import wireframeAuto3 from './integration/wireframe-auto-edges-3.json'
import wireframeAuto4 from './integration/wireframe-auto-edges-4.json'

interface GeoJSON {
  type: string;
  features: Array<{
    type: string;
    properties: {
      cellIdHex: string;
    };
    geometry: {
      type: string;
      coordinates: number[][][];
    };
  }>;
}

// Helper to compare two arrays of coordinates with floating point values
function compareCoordinates(actual: LonLat[], expected: number[][], precision = 6) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) {
    expect(actual[i][0]).toBeCloseTo(expected[i][0], precision);
    expect(actual[i][1]).toBeCloseTo(expected[i][1], precision);
  }
}

describe.skip('wireframe integration tests', () => {
  // Map of test data
  const testData: GeoJSON[] = [
    wireframe1, wireframe2, wireframe3, wireframe4,
    wireframeAuto1, wireframeAuto2, wireframeAuto3, wireframeAuto4
  ];

  for (let i = 0; i < testData.length; i++) {
    it(`matches generated boundaries ${i}`, () => {
      const segments = i < 4 ? 1 : 'auto';
      const geojson = testData[i];

      // Check each cell in the GeoJSON
      for (const feature of geojson.features) {
        const cellIdHex = feature.properties.cellIdHex;
        const expectedBoundary = feature.geometry.coordinates[0];
        
        // Get the boundary from cellToBoundary
        const cellId = hexToBigInt(cellIdHex);
        const actualBoundary = cellToBoundary(cellId, { closedRing: true, segments });

        // Compare the boundaries
        compareCoordinates(actualBoundary, expectedBoundary);
      }
    });
  }
}); 