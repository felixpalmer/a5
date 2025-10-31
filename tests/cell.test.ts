import { describe, it, expect } from 'vitest';
import type {Degrees,LonLat } from "a5/core/coordinate-systems";
import { cellToBoundary, cellToLonLat, lonLatToCell,a5cellContainsPoint } from 'a5/core/cell'
import { deserialize, MAX_RESOLUTION } from 'a5/core/serialization';
import { hexToU64 } from 'a5/core/hex';
import populatedPlaces from './data/ne_50m_populated_places_nameonly.json';

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

describe('Cell ID Validation Tests', () => {
    it('should return WORLD_CELL for resolution -1', () => {
        const cellId = lonLatToCell([0, 0], -1);
        expect(cellId).toBe(0n);
    });

    it('should return [0, 0] for WORLD_CELL center', () => {
        const lonLat = cellToLonLat(0n);
        expect(lonLat).toEqual([0, 0]);
    });

    it('should return empty array for WORLD_CELL boundary', () => {
        const boundary = cellToBoundary(0n);
        expect(boundary).toEqual([]);
    });
});

describe('Antimeridian Cell Tests', () => {
    const antimeridianCells = [ 'eb60000000000000', '2e00000000000000' ];
    const segments = [1, 10, 'auto'];
    it('Antimeridian cell should have longitude span less than 180 degrees', () => {
        for (const cellId of antimeridianCells) {
            for (const segment of segments) {
                const cellIdBigInt = hexToU64(cellId);
                const boundary = cellToBoundary(cellIdBigInt, {segments: segment as number});

                // Check for antimeridian crossing
                const longitudes = boundary.map(([lon]) => lon);
                const minLon = Math.min(...longitudes);
                const maxLon = Math.max(...longitudes);
                const lonSpan = maxLon - minLon;
                expect(lonSpan).toBeLessThan(180);
            }
        }
    });
});

describe('Cell Boundary Tests', () => {
    it('should contain the original point for all resolutions', () => {
        // Extract coordinates from GeoJSON features
        const testPoints: LonLat[] = populatedPlaces.features.map((feature: any) => {
            const [lon, lat] = feature.geometry.coordinates;
            return [lon as Degrees, lat as Degrees] as LonLat;
        });

        console.log(`Testing with ${testPoints.length} points from GeoJSON file`);

        // Dictionary to store failures for each resolution and point
        const failures: Record<string, Record<number, string[]>> = {};

        console.log(`Skipping resolution ${MAX_RESOLUTION} as lonLatToCell is not implemented for this resolution yet`);
        
        // Test each point from GeoJSON
        for (const [pointIndex, testLonlat] of testPoints.entries()) {
            const featureName = populatedPlaces.features[pointIndex].properties?.name || `Unnamed ${pointIndex}`;
            const pointKey = `Point ${pointIndex} - ${featureName} (${testLonlat[0]}, ${testLonlat[1]})`;

            // Test resolutions from 0 to MAX_RESOLUTION
            for (let resolution = 1; resolution <= MAX_RESOLUTION; resolution++) {
                if (resolution === MAX_RESOLUTION || Math.abs(testLonlat[1]) > 80) { // Issues in polar regions, TODO fix
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
                    if (a5cellContainsPoint(cell, testLonlat) < 0) {
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
                    if (!failures[pointKey]) {
                        failures[pointKey] = {};
                    }
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