import { vec3, glMatrix } from "gl-matrix";
glMatrix.setMatrixArrayType(Float64Array as any);
import { distanceToEdge, distanceToVertex } from "../core/constants";
import type { Cartesian, Radians, Spherical } from "../core/coordinate-systems";
import { toCartesian } from "../core/coordinate-transforms";
import { origins } from "../core/origin";

/**
 * The Coordinate Reference System (CRS) of the dodecahedron is a set of 62 vertices:
 * - 12 face centers
 * - 20 vertices
 * - 30 edge midpoints
 * 
 * The vertices are used as a rigid frame of reference for the dodecahedron in the
 * dodecahedron projection. By constructing them once, we can avoid recalculating
 * and be sure of their correctness.
 */
export class CRS {
  private vertices: Cartesian[] = [];
  private invocations = 0;

  constructor() {
    this.addFaceCenters(); // 12 centers
    this.addVertices(); // 20 vertices
    this.addMidpoints(); // 30 midpoints
    if (this.vertices.length !== 62) {
      throw new Error("Failed to construct CRS: vertices length is not 62");
    }
    Object.freeze(this.vertices);
  }

  getVertex(point: Cartesian): Cartesian {
    this.invocations++;
    if (this.invocations === 10000) {
      console.warn('Too many CRS invocations, results should be cached');
    }
    for (const vertex of this.vertices) {
      if (vec3.distance(point, vertex) < 1e-5) {
        return vertex;
      }
    }

    throw new Error("Failed to find vertex in CRS");
  }

  private addFaceCenters(): void {
    origins.forEach(origin => this.add(toCartesian(origin.axis)));
  }

  private addVertices(): void {
    const phiVertex = Math.atan(distanceToVertex) as Radians;

    for (const origin of origins) {
      for (let i = 0; i < 5; i++) {
        const thetaVertex = (2 * i + 1) * Math.PI / 5 as Radians;
        const vertex = toCartesian([thetaVertex + origin.angle, phiVertex] as Spherical);
        vec3.transformQuat(vertex, vertex, origin.quat);
        this.add(vertex);
      }
    }
  }

  private addMidpoints(): void {
    const phiMidpoint = Math.atan(distanceToEdge) as Radians;

    for (const origin of origins) {
      for (let i = 0; i < 5; i++) {
        const thetaMidpoint = (2 * i) * Math.PI / 5 as Radians;
        const midpoint = toCartesian([thetaMidpoint + origin.angle, phiMidpoint] as Spherical);
        vec3.transformQuat(midpoint, midpoint, origin.quat);
        this.add(midpoint);
      }
    }
  }

  private add(newVertex: Cartesian): boolean {
    const normalized = vec3.normalize(vec3.create(), newVertex) as Cartesian;
    const existingVertex = this.vertices.find(existingVertex => vec3.distance(normalized, existingVertex) < 1e-5);
    if (existingVertex) {
      return false;
    }
    this.vertices.push(normalized);
    return true;
  }
}