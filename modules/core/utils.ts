// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {vec2, mat2, mat2d, vec3, glMatrix} from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import { Origin } from './origin';
import { Triangle } from './triangle';
import type { Degrees, LonLat, Face } from './coordinate-systems';

export type Pentagon = [Face, Face, Face, Face, Face];

export class PentagonShape {
  private vertices: Pentagon;
  public id: {i: number, j: number, k: number, resolution: number, segment?: number, origin?: Origin};
  private triangles?: Triangle[];

  constructor(vertices: Pentagon) {
    this.vertices = vertices;
    this.id = {i: 0, j: 0, k: 0, resolution: 1};
  }

  getVertices(): Pentagon {
    return this.vertices;
  }

  scale(scale: number): PentagonShape {
    for (const vertex of this.vertices) {
      vec2.scale(vertex, vertex, scale);
    }
    return this;
  }

  /**
   * Rotates the pentagon 180 degrees (equivalent to negating x & y)
   * @returns The rotated pentagon
   */
  rotate180(): PentagonShape {
    for (const vertex of this.vertices) {
      vec2.negate(vertex, vertex);
    }
    return this;
  }

  /**
   * Reflects the pentagon over the x-axis (equivalent to negating y)
   * @returns The reflected pentagon
   */
  reflectY(): PentagonShape {
    for (const vertex of this.vertices) {
      vertex[1] = -vertex[1];
    }
    return this;
  }

  translate(translation: vec2): PentagonShape {
    for (const vertex of this.vertices) {
      vec2.add(vertex, vertex, translation);
    }
    return this;
  }

  transform(transform: mat2): PentagonShape {
    for (const vertex of this.vertices) {
      vec2.transformMat2(vertex, vertex, transform);
    }
    return this;
  }

  transform2d(transform: mat2d): PentagonShape {
    for (const vertex of this.vertices) {
      vec2.transformMat2d(vertex, vertex, transform);
    }
    return this;
  }

  clone(): PentagonShape {
    const newPentagon = new PentagonShape(this.vertices.map(v => vec2.clone(v)) as Pentagon);
    return newPentagon;
  }

  getCenter(): Face {
    return this.vertices.reduce(
      (sum, v) => [sum[0] + v[0] / 5, sum[1] + v[1] / 5],
      [0, 0]
    ) as Face;
  }

  /**
   * Tests if a point is inside the pentagon by checking if it's in any of the three triangles
   * that make up the pentagon. Assumes pentagon is convex.
   * @param point The point to test
   * @returns true if the point is inside the pentagon
   */
  containsPoint(point: vec2): boolean {
    // Split pentagon into three triangles from first vertex
    const v0 = this.vertices[0];
    
    if (!this.triangles) {
      this.triangles = [];
      // Order triangles by size to increase chance of early return
      for (const i of [2, 1, 3]) {
        const v1 = this.vertices[i];
        const v2 = this.vertices[i + 1];
        this.triangles.push(new Triangle(v0, v1, v2));
      }
    }

    for (const triangle of this.triangles) {
      if (triangle.containsPoint(point)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Normalizes longitude values in a contour to handle antimeridian crossing
   * @param contour Array of [longitude, latitude] points
   * @returns Normalized contour with consistent longitude values
   */
  static normalizeLongitudes(contour: Contour): Contour {
    const longitudes = contour.map(([lon]) => {
      return ((lon + 180) % 360 + 360) % 360 - 180;
    });

    // Calculate center longitude
    let centerLon = longitudes.reduce((sum, p) => sum + p, 0) / longitudes.length;
    
    // Normalize center longitude to be in the range -180 to 180
    centerLon = ((centerLon + 180) % 360 + 360) % 360 - 180;
    
    // Normalize each point relative to center
    return contour.map(point => {
      let [longitude, latitude] = point;
      
      // Adjust longitude to be closer to center
      while (longitude - centerLon > 180) longitude = longitude - 360 as Degrees;
      while (longitude - centerLon < -180) longitude = longitude + 360 as Degrees;
      return [longitude, latitude] as LonLat;
    });
  }
} 

export type A5Cell = {
  /**
   * Origin representing one of pentagon face of the dodecahedron
   */
  origin: Origin;
  /**
   * Index (0-4) of triangular segment within pentagonal dodecahedron face
   */
  segment: number;
  /**
   * Position along Hilbert curve within triangular segment
   */
  S: bigint;
  /**
   * Resolution of the cell
   */
  resolution: number;
}
export type Contour = LonLat[];

/**
 * Calculate the area of a triangle given three vertices in 3D space
 */
function triangleArea(v1: vec3, v2: vec3, v3: vec3): number {
  // Create vectors for two edges of the triangle
  const edge1 = vec3.create();
  const edge2 = vec3.create();
  vec3.subtract(edge1, v2, v1);
  vec3.subtract(edge2, v3, v1);
  
  // Calculate cross product
  const cross = vec3.create();
  vec3.cross(cross, edge1, edge2);
  
  // Area is half the magnitude of the cross product
  return 0.5 * vec3.length(cross);
}

export function pentagonArea(pentagon: vec3[]): number {
  let area = 0;
  const v1 = pentagon[0];
  for (let i = 1; i < 4; i++) {
    const v2 = pentagon[(i)];
    const v3 = pentagon[(i + 1)];
    area += Math.abs(triangleArea(v1, v2, v3));
  }
  return area;
}
