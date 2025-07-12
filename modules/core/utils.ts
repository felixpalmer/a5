// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {vec2, mat2, mat2d, vec3, glMatrix, quat} from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import type { Cartesian, Radians, Spherical, Face, Degrees, LonLat } from './coordinate-systems';
import { toCartesian, fromLonLat, toLonLat, toSpherical } from './coordinate-transforms';
import { Orientation } from "./hilbert";

export type Origin = {
  id: number;
  axis: Spherical;
  quat: quat;
  angle: Radians;
  orientation: Orientation[];
  firstQuintant: number;
};

export type Pentagon = [Face, Face, Face, Face, Face];

export class PentagonShape {
  private vertices: Pentagon;
  public id: {i: number, j: number, k: number, resolution: number, segment?: number, origin?: Origin};

  constructor(vertices: Pentagon) {
    this.vertices = vertices;
    this.id = {i: 0, j: 0, k: 0, resolution: 1};
    if (!this.isWindingCorrect()) {
      this.vertices.reverse();
    }
  }

  getArea(): number {
    let signedArea = 0;
    const N = this.vertices.length;
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      signedArea += (this.vertices[j][0] - this.vertices[i][0]) * (this.vertices[j][1] + this.vertices[i][1]);
    }
    return signedArea;
  }

  private isWindingCorrect(): boolean {
    return this.getArea() >= 0;
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
   * and reverses the winding order to maintain consistent orientation
   * @returns The reflected pentagon
   */
  reflectY(): PentagonShape {
    // First reflect all vertices
    for (const vertex of this.vertices) {
      vertex[1] = -vertex[1];
    }
    
    // Then reverse the winding order to maintain consistent orientation
    this.vertices.reverse();
    
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
   * Tests if a point is inside the pentagon by checking if it's on the correct side of all edges.
   * Assumes consistent winding order (counter-clockwise).
   * @param point The point to test
   * @returns -1 if point is inside, otherwise a value proportional to the distance from the point to the edge
   */
  containsPoint(point: vec2): number {
    // TODO later we can likely remove this, but for now it's useful for debugging
    if (!this.isWindingCorrect()) {
      throw new Error("Pentagon is not counter-clockwise");
    }

    const N = this.vertices.length;
    for (let i = 0; i < N; i++) {
      const v1 = this.vertices[i];
      const v2 = this.vertices[(i + 1) % N];
      
      // Calculate the cross product to determine which side of the line the point is on
      // (v2 - v1) × (point - v1)
      const dx = v2[0] - v1[0];
      const dy = v2[1] - v1[1];
      const px = point[0] - v1[0];
      const py = point[1] - v1[1];
      
      // Cross product: dx * py - dy * px
      // If positive, point is on the wrong side
      // If negative, point is on the correct side
      const crossProduct = (dx * py - dy * px);
      if (crossProduct > 0) {
        // Only normalize by distance of point to edge as we can assume the edges of the
        // pentagon are all the same length
        const pLength = Math.sqrt(px * px + py * py);
        return crossProduct / pLength;
      }
    }
    
    return -1;
  }

  /**
   * Normalizes longitude values in a contour to handle antimeridian crossing
   * @param contour Array of [longitude, latitude] points
   * @returns Normalized contour with consistent longitude values
   */
  static normalizeLongitudes(contour: Contour): Contour {
    // Calculate center in Cartesian space to avoid poles & antimeridian crossing issues
    const points = contour.map(lonLat => toCartesian(fromLonLat(lonLat)));
    const center = vec3.create() as Cartesian;
    for (const point of points) {
      vec3.add(center, center, point);
    }
    vec3.normalize(center, center);
    let centerLon = toLonLat(toSpherical(center))[0];

    // Normalize center longitude to be in the range -180 to 180
    centerLon = ((centerLon + 180) % 360 + 360) % 360 - 180 as Degrees;
    
    // Normalize each point relative to center
    return contour.map(point => {
      let [longitude, latitude] = point;
      
      // Adjust longitude to be closer to center
      while (longitude - centerLon > 180) longitude = longitude - 360 as Degrees;
      while (longitude - centerLon < -180) longitude = longitude + 360 as Degrees;
      return [longitude, latitude] as LonLat;
    });
  }

  /**
   * Splits each edge of the pentagon into the specified number of segments
   * @param segments Number of segments to split each edge into
   * @returns A new PentagonShape with more vertices, or the original PentagonShape if segments <= 1
   */
  splitEdges(segments: number): PentagonShape {
    if (segments <= 1) {
      return this;
    }

    const newVertices: Face[] = [];
    const N = this.vertices.length;
    
    for (let i = 0; i < N; i++) {
      const v1 = this.vertices[i];
      const v2 = this.vertices[(i + 1) % N];
      
      // Add the current vertex
      newVertices.push(vec2.clone(v1) as Face);
      
      // Add interpolated points along the edge (excluding the endpoints)
      for (let j = 1; j < segments; j++) {
        const t = j / segments;
        const interpolated = vec2.create();
        vec2.lerp(interpolated, v1, v2, t);
        newVertices.push(interpolated as Face);
      }
    }
    
    return new PentagonShape(newVertices as Pentagon);
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