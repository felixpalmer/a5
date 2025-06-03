import { describe, it, expect } from 'vitest';
import type {Degrees,LonLat } from "a5/core/coordinate-systems";
import { cellToBoundary, cellToLonLat, lonLatToCell,a5cellContainsPoint } from 'a5/core/cell'
import { deserialize, MAX_RESOLUTION } from 'a5/core/serialization';

interface GeoJSONFeature {
    type: 'Feature';
    properties: {
        resolution: number;
    };
    geometry: {
        type: 'Polygon';
        coordinates: number[][][];
    };
}

interface GeoJSONFeatureCollection {
    type: 'FeatureCollection';
    features: GeoJSONFeature[];
}

function boundaryToGeoJSON(boundary: LonLat[], resolution: number): GeoJSONFeatureCollection {
    // Create coordinates list with first point appended at the end to close the polygon
    const coordinates = boundary.map(([lon, lat]) => [lon, lat]);
    if (coordinates.length > 0) {
        coordinates.push(coordinates[0]); // Close the polygon
    }

    // Create a polygon feature
    const feature: GeoJSONFeature = {
        type: 'Feature',
        properties: {
            resolution
        },
        geometry: {
            type: 'Polygon',
            coordinates: [coordinates] // Wrap in list as per GeoJSON spec
        }
    };

    // Create a feature collection
    const featureCollection: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [feature]
    };

    return featureCollection;
}

describe('Cell Boundary Tests', () => {
    it('should contain point and have valid boundaries for all resolutions', () => {
        // Test coordinates 
        const testLonlat = [106.706360 as Degrees, 10.775305 as Degrees] as LonLat;
        
        // Dictionary to store failures for each resolution
        const failures: Record<number, string[]> = {};
        // Test resolutions from 0 to MAX_RESOLUTION
        for (let resolution = 1; resolution <= MAX_RESOLUTION; resolution++) {
            const resolutionFailures: string[] = [];
            
            try {
                // Get cell ID for the coordinates
                const cellId = lonLatToCell(testLonlat, resolution);
                
                // Get cell boundary
                const boundary = cellToBoundary(cellId);
                
                // Convert boundary to GeoJSON and print it
                const geojson = boundaryToGeoJSON(boundary, resolution);
                console.log(`\nResolution ${resolution} GeoJSON:\n`, JSON.stringify(geojson));
                
                // Verify the original point is contained within the cell
                const cell = deserialize(cellId);
                if (!a5cellContainsPoint(cell, testLonlat)) {
                    resolutionFailures.push(`Cell does not contain the original point ${testLonlat}`);
                    // Add cell center for reference
                    const center = cellToLonLat(cellId);
                    resolutionFailures.push(`Cell center is at ${center}`);
                }
                
                // Verify boundary points are valid coordinates
                boundary.forEach((point, i) => {
                    if (!Array.isArray(point)) {
                        resolutionFailures.push(`Boundary point ${i} is not an array, got ${typeof point}`);
                    } else if (point.length !== 2) {
                        resolutionFailures.push(`Boundary point ${i} should have 2 coordinates, got ${point.length}`);
                    } else {
                        const [lon, lat] = point;
                        if (lon < -180 || lon > 180) {
                            resolutionFailures.push(`Boundary point ${i} has invalid longitude: ${lon}`);
                        }
                        if (lat < -90 || lat > 90) {
                            resolutionFailures.push(`Boundary point ${i} has invalid latitude: ${lat}`);
                        }
                    }
                });
                
            } catch (e) {
                resolutionFailures.push(`Unexpected error: ${e instanceof Error ? e.message : String(e)}`);
                if (e instanceof Error && e.stack) {
                    resolutionFailures.push(`Traceback: ${e.stack}`);
                }
            }
            
            // Store failures for this resolution if any occurred
            if (resolutionFailures.length > 0) {
                failures[resolution] = resolutionFailures;
            }
        }
        
        // Report all failures
        if (Object.keys(failures).length > 0) {
            let failureMessage = '\nFailures by resolution:\n';
            for (const [resolution, resolutionFailures] of Object.entries(failures)) {
                failureMessage += `\nResolution ${resolution}:\n`;
                for (const failure of resolutionFailures) {
                    failureMessage += `  - ${failure}\n`;
                }
            }
            throw new Error(failureMessage);
        }
    });
}); 