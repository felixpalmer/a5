import { describe, it, expect } from 'vitest';
import type {Degrees,LonLat } from "a5/core/coordinate-systems";
import { cellToBoundary, cellToLonLat, lonLatToCell,a5cellContainsPoint } from 'a5/core/cell'
import { deserialize, MAX_RESOLUTION } from 'a5/core/serialization';

interface GeoJSONFeature {
    type: 'Feature';
    properties: {
        resolution: number;
        cell_id: string;
        origin_point: string;
    };
    geometry: {
        type: 'Polygon' | 'Point';
        coordinates: number[][][] | number[];
    };
}

interface GeoJSONFeatureCollection {
    type: 'FeatureCollection';
    features: GeoJSONFeature[];
}

function boundaryToGeoJSON(boundary: LonLat[], resolution: number, cellId: string, originPoint: LonLat): GeoJSONFeatureCollection {
    // Create coordinates list with first point appended at the end to close the polygon
    const coordinates = boundary.map(([lon, lat]) => [lon, lat]);
    if (coordinates.length > 0) {
        coordinates.push(coordinates[0]); // Close the polygon
    }

    // Create a polygon feature for the cell
    const cellFeature: GeoJSONFeature = {
        type: 'Feature',
        properties: {
            resolution,
            cell_id: cellId,
            origin_point: `${originPoint[0]},${originPoint[1]}`
        },
        geometry: {
            type: 'Polygon',
            coordinates: [coordinates] // Wrap in list as per GeoJSON spec
        }
    };

    // Create a point feature for the origin point
    const pointFeature: GeoJSONFeature = {
        type: 'Feature',
        properties: {
            resolution,
            cell_id: cellId,
            origin_point: `${originPoint[0]},${originPoint[1]}`
        },
        geometry: {
            type: 'Point',
            coordinates: originPoint
        }
    };

    // Create a feature collection with both features
    const featureCollection: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [cellFeature, pointFeature]
    };

    return featureCollection;
}

describe('Cell Boundary Tests', () => {
    it('should contain the original point for all resolutions', () => {
        // Generate 100 random points
        const randomPoints: LonLat[] = Array.from({ length: 100 }, () => [
            (Math.random() * 360 - 180) as Degrees,  // longitude: -180 to 180
            (Math.random() * 180 - 90) as Degrees    // latitude: -90 to 90
        ] as LonLat);

        // Dictionary to store failures for each resolution and point
        const failures: Record<string, Record<number, string[]>> = {};
        
        // Test each random point
        for (const [pointIndex, testLonlat] of randomPoints.entries()) {
            const pointKey = `Point ${pointIndex} (${testLonlat[0]}, ${testLonlat[1]})`;
            failures[pointKey] = {};

            // Test resolutions from 0 to MAX_RESOLUTION
            for (let resolution = 1; resolution <= MAX_RESOLUTION; resolution++) {
                if (resolution === MAX_RESOLUTION) {
                    console.log(`Skipping resolution ${resolution} as lonLatToCell is not implemented for this resolution yet`);
                    continue;
                }

                const resolutionFailures: string[] = [];
                
                try {
                    // Get cell ID for the coordinates
                    const cellId = lonLatToCell(testLonlat, resolution);
                    
                    // Get cell boundary
                    const boundary = cellToBoundary(cellId);
                    
                    // Convert boundary to GeoJSON
                    const geojson = boundaryToGeoJSON(boundary, resolution, cellId.toString(), testLonlat);
                    
                    // Verify the original point is contained within the cell
                    const cell = deserialize(cellId);
                    if (!a5cellContainsPoint(cell, testLonlat)) {
                        resolutionFailures.push(`Cell ${cellId} does not contain the original point ${testLonlat}`);
                        resolutionFailures.push(`GeoJSON:\n ${JSON.stringify(geojson)}`);
                    }
                    
                } catch (e) {
                    resolutionFailures.push(`Unexpected error: ${e instanceof Error ? e.message : String(e)}`);
                    if (e instanceof Error && e.stack) {
                        resolutionFailures.push(`Traceback: ${e.stack}`);
                    }
                }
                
                // Store failures for this resolution if any occurred
                if (resolutionFailures.length > 0) {
                    failures[pointKey][resolution] = resolutionFailures;
                }
            }
        }
        
        // Report all failures
        if (Object.keys(failures).length > 0) {
            let failureMessage = '\nFailures by point and resolution:\n';
            for (const [pointKey, pointFailures] of Object.entries(failures)) {
                if (Object.keys(pointFailures).length > 0) {
                    failureMessage += `\n${pointKey}:\n`;
                    for (const [resolution, resolutionFailures] of Object.entries(pointFailures)) {
                        failureMessage += `  Resolution ${resolution}:\n`;
                        for (const failure of resolutionFailures) {
                            failureMessage += `    - ${failure}\n`;
                        }
                    }
                }
            }
            throw new Error(failureMessage);
        }
    });
}); 