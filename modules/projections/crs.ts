import {vec3, glMatrix} from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import {distanceToEdge, distanceToVertex} from '../core/constants';
import type {Cartesian, Radians, Spherical, SphericalTriangle} from '../core/coordinate-systems';
import {toCartesian} from '../core/coordinate-transforms';
import {origins} from '../core/origin';

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

  /**
   * A canonical spherical face triangle (vertex/corner, face center, edge
   * midpoint) of the dodecahedron, taken from origin 0's CRS vertices. All face
   * triangles used by DodecahedronProjection are congruent and consistently
   * wound with this one, so it serves as the fixed source of the
   * EqualAreaProjection shape constants — independent of projection call order.
   *
   * The order is radiating-vertex-first: A5 uses ISEA, radiating the equal-area
   * projection from the dodecahedron corner (the dual icosahedron's face centre)
   * rather than the face centre. The corner leads, then the centre, then the edge
   * midpoint — a cyclic (winding-preserving) ordering of [centre, midpoint,
   * corner]; the winding must be preserved because the closed-form
   * EqualAreaProjection bakes in the signed triple product.
   *
   * The indices rely on the construction order above: vertices[0] is origin
   * 0's face center, vertices[12] its first corner (after the 12 centers) and
   * vertices[32] its first edge midpoint (after the 20 corners). The corner
   * and midpoint are adjacent (π/5 apart), forming a genuine face triangle —
   * the constants-agreement test verifies this against every face triangle.
   */
  getCanonicalTriangle(): SphericalTriangle {
    return [this.vertices[12], this.vertices[0], this.vertices[32]] as SphericalTriangle;
  }

  constructor() {
    this.addFaceCenters(); // 12 centers
    this.addVertices(); // 20 vertices
    this.addMidpoints(); // 30 midpoints
    if (this.vertices.length !== 62) {
      throw new Error('Failed to construct CRS: vertices length is not 62');
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

    throw new Error('Failed to find vertex in CRS');
  }

  private addFaceCenters(): void {
    origins.forEach(origin => this.add(toCartesian(origin.axis)));
  }

  private addVertices(): void {
    const phiVertex = Math.atan(distanceToVertex) as Radians;

    for (const origin of origins) {
      for (let i = 0; i < 5; i++) {
        const thetaVertex = (((2 * i + 1) * Math.PI) / 5) as Radians;
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
        const thetaMidpoint = ((2 * i * Math.PI) / 5) as Radians;
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
