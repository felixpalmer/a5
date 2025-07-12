import { vec3, glMatrix } from "gl-matrix";
glMatrix.setMatrixArrayType(Float64Array as any);
import { distanceToVertex } from "../core/constants";
import type { Cartesian, Radians, Spherical } from "../core/coordinate-systems";
import { toCartesian } from "../core/coordinate-transforms";
import { origins } from "../core/origin";

export class CRS {
  private vertices: Cartesian[] = [];

  constructor() {
    this.addFaceCenters();
    this.addVertices();
    console.log(this.vertices);
  }

  private addFaceCenters(): void {
    origins.forEach(origin => this.add(toCartesian(origin.axis)));
  }

  private addVertices(): void {
    const phi = Math.atan(distanceToVertex) as Radians;
    for (let i = 0; i < 5; i++) {
      const theta = (2 * i + 1) * Math.PI / 5 as Radians;
      const v = toCartesian([theta, phi] as Spherical);
      this.add(v);
    }
  }

  private add(newVertex: Cartesian): boolean {
    const existingVertex = this.vertices.find(existingVertex => vec3.distance(newVertex, existingVertex) < 1e-5);
    if (existingVertex) {
      console.log("already added", newVertex);
      return false;
    }
    this.vertices.push(newVertex);
    return true;
  }
}