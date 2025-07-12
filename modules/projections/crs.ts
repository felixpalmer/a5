import { vec3, glMatrix } from "gl-matrix";
glMatrix.setMatrixArrayType(Float64Array as any);
import { distanceToEdge, distanceToVertex } from "../core/constants";
import type { Cartesian, Radians, Spherical } from "../core/coordinate-systems";
import { toCartesian } from "../core/coordinate-transforms";
import { origins } from "../core/origin";

export class CRS {
  private vertices: Cartesian[] = [];

  constructor() {
    this.addFaceCenters();
    this.addVertices();
    if (this.vertices.length !== 62) {
      throw new Error("Failed to construct CRS: vertices length is not 62");
    }
    Object.freeze(this.vertices);
  }

  private addFaceCenters(): void {
    origins.forEach(origin => this.add(toCartesian(origin.axis)));
  }

  private addVertices(): void {
    const phiMidpoint = Math.atan(distanceToEdge) as Radians;
    const phiVertex = Math.atan(distanceToVertex) as Radians;

    for (const origin of origins) {
      for (let i = 0; i < 5; i++) {
        // Midpoint
        const thetaMidpoint = (2 * i) * Math.PI / 5 as Radians;
        const midpoint = toCartesian([thetaMidpoint + origin.angle, phiMidpoint] as Spherical);
        vec3.transformQuat(midpoint, midpoint, origin.quat);
        this.add(midpoint);

        // Vertex
        const thetaVertex = (2 * i + 1) * Math.PI / 5 as Radians;
        const vertex = toCartesian([thetaVertex + origin.angle, phiVertex] as Spherical);
        vec3.transformQuat(vertex, vertex, origin.quat);
        this.add(vertex);
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