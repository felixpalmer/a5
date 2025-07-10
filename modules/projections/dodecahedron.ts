// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { vec2, vec3, quat, glMatrix } from "gl-matrix";
glMatrix.setMatrixArrayType(Float64Array as any);
import { toCartesian, toSpherical, toFace, toPolar } from "../core/coordinate-transforms";
import type { Radians, Spherical, Cartesian, Polar, Face } from "../core/coordinate-systems";
import { GnomonicProjection } from './gnomonic';
import { distanceToEdge, interhedralAngle, TWO_PI_OVER_5 } from '../core/constants';
import { PolyhedralProjection } from "./polyhedral";
import { getQuintantPolar, getQuintantVertices } from "../core/tiling";

type VertexIndex = 0 | 1 | 2;
type VertexOrder = [VertexIndex, VertexIndex, VertexIndex];
const DODECAHEDRON_FACE_CENTER: VertexIndex = 0;
const DODECAHEDRON_VERTEX: VertexIndex = 1;
const DODECAHEDRON_EDGE_MIDPOINT: VertexIndex = 2;

// The first index is always be passed first, the second & third are swapped based on the sign of gamma
const IVEA: VertexOrder = [DODECAHEDRON_FACE_CENTER, DODECAHEDRON_VERTEX, DODECAHEDRON_EDGE_MIDPOINT];
const ISEA: VertexOrder = [DODECAHEDRON_VERTEX, DODECAHEDRON_EDGE_MIDPOINT, DODECAHEDRON_FACE_CENTER];    
const RTEA: VertexOrder = [DODECAHEDRON_EDGE_MIDPOINT, DODECAHEDRON_FACE_CENTER, DODECAHEDRON_VERTEX];    
const VERTEX_ORDER: VertexOrder = IVEA;

type FaceTriangle = [Face, Face, Face];
type SphericalTriangle = [Cartesian, Cartesian, Cartesian];

export class DodecahedronProjection {
  private vertices = new Set<Cartesian>();
  private polyhedral: PolyhedralProjection;
  private gnomonic: GnomonicProjection;

  constructor() {
    this.polyhedral = new PolyhedralProjection();
    this.gnomonic = new GnomonicProjection();
  }
  
  /**
   * Projects spherical coordinates to face coordinates using dodecahedron projection
   * @param spherical Spherical coordinates [theta, phi]
   * @param originTransform Origin quaternion transform
   * @param originRotation Origin rotation in radians
   * @param resolution Resolution parameter
   * @returns Face coordinates [x, y]
   */
  forward(spherical: Spherical, originTransform: quat, originRotation: Radians, resolution: number): Face {
    // Transform back origin space
    const unprojected = toCartesian(spherical);
    const inverseQuat = quat.create();
    quat.invert(inverseQuat, originTransform);
    const out = vec3.create() as Cartesian;
    vec3.transformQuat(out, unprojected, inverseQuat);

    // Unproject gnomonically to polar coordinates in origin space
    const projectedSpherical = toSpherical(out);
    const polar = this.gnomonic.forward(projectedSpherical);

    // Rotate around face axis to remove origin rotation
    polar[1] = (polar[1] - originRotation) as Radians;

    let faceTriangle = this.getFaceTriangle(polar);
    let sphericalTriangle = this.getSphericalTriangle(faceTriangle, originTransform, originRotation);

    return this.polyhedral.forward(unprojected, sphericalTriangle, faceTriangle);
  }

  /**
   * Unprojects face coordinates to spherical coordinates using dodecahedron projection
   * @param face Face coordinates [x, y]
   * @param originTransform Origin quaternion transform
   * @param originRotation Origin rotation in radians
   * @param resolution Resolution parameter
   * @returns Spherical coordinates [theta, phi]
   */
  inverse(face: Face, originTransform: quat, originRotation: Radians, resolution: number): Spherical {
    const polar = toPolar(face);
    let faceTriangle = this.getFaceTriangle(polar);

    const [rho, gamma] = polar;
    const P = toFace([rho, this.normalizeGamma(gamma)] as Polar);
    const reflect = P[0] > distanceToEdge;

    const faceTriangle2 = faceTriangle.map(face => vec2.clone(face)) as FaceTriangle;
    if (reflect) {
      // Reflect dodecahedron center across edge
      const odd = this.normalizeGamma(polar[1]) > 0;
      vec2.negate(faceTriangle[0], faceTriangle[0]);
      const midpoint = odd ? faceTriangle[1] : faceTriangle[2];
      vec2.scaleAndAdd(faceTriangle[0], faceTriangle[0], midpoint, 2);

      // Swap midpoint and corner to maintain correct vertex order
      const temp = faceTriangle[1];
      faceTriangle[1] = faceTriangle[2];
      faceTriangle[2] = temp;

      vec2.negate(faceTriangle2[0], faceTriangle2[0]);
      vec2.scaleAndAdd(faceTriangle2[0], faceTriangle2[0], midpoint, 1 + 1 / Math.cos(interhedralAngle));

      // Swap midpoint and corner to maintain correct vertex order
      const temp2 = faceTriangle2[1];
      faceTriangle2[1] = faceTriangle2[2];
      faceTriangle2[2] = temp2;
    }

    let sphericalTriangle = this.getSphericalTriangle(faceTriangle2, originTransform, originRotation);
    const unprojected = this.polyhedral.inverse(face, faceTriangle, sphericalTriangle);
    return toSpherical(unprojected);
  }

  /**
   * Gets the face triangle for a given polar coordinate
   * @param polar Polar coordinates
   * @returns Face triangle
   */
  private getFaceTriangle(polar: Polar): FaceTriangle {
    const quintant = getQuintantPolar(polar);
    const [vCenter, vCorner1, vCorner2] = getQuintantVertices(quintant).getVertices();
    //const vVertex = [distanceToEdge, distanceToEdge] as Face;
    const vEdgeMidpoint = vec2.create() as Face;
    vec2.lerp(vEdgeMidpoint, vCorner1, vCorner2, 0.5);

    // Sign of gamma determines which triangle we want to use, and thus vertex order
    const odd = this.normalizeGamma(polar[1]) > 0;

    // Note: center & midpoint compared to DGGAL implementation are swapped
    // as we are using a dodecahedron, rather than a icosahedron.
    let facePoints = odd ? [vCenter, vEdgeMidpoint, vCorner1] : [vCenter, vCorner2, vEdgeMidpoint];
    const ia = VERTEX_ORDER[0];
    const ib = VERTEX_ORDER[1];
    const ic = VERTEX_ORDER[2];

    return [facePoints[ia], facePoints[ib], facePoints[ic]] as FaceTriangle; 
  }

  /**
   * Finds a cached vertex that's close to the given vertex
   * @param newVertex The vertex to find a match for
   * @returns Cached vertex or null if not found
   */
  private findCachedVertex(newVertex: Cartesian): Cartesian | null {
    for (const cachedVertex of this.vertices) {
      if (vec3.distance(newVertex, cachedVertex) < 1e-5) {
        return cachedVertex;
      }
    }
    return null;
  }

  /**
   * Gets the spherical triangle for a given face triangle
   * @param faceTriangle The face triangle
   * @param originTransform Origin quaternion transform
   * @param originRotation Origin rotation in radians
   * @returns Spherical triangle
   */
  private getSphericalTriangle(faceTriangle: FaceTriangle, originTransform: quat, originRotation: Radians): SphericalTriangle {
    const sphericalTriangle = faceTriangle.map((face: Face) => {
      const [rho, gamma] = toPolar(face);
      const rotatedPolar = [rho, gamma + originRotation] as Polar;
      const rotated = toCartesian(this.gnomonic.inverse(rotatedPolar));
      vec3.transformQuat(rotated, rotated, originTransform);
      
      const cachedVertex = this.findCachedVertex(rotated);
      if (cachedVertex) {
        return cachedVertex;
      }
      
      // Add new vertex to cache and return it
      this.vertices.add(rotated);
      return rotated;
    });
    return sphericalTriangle as SphericalTriangle;
  }

  /**
   * Normalizes gamma to the range [-PI_OVER_5, PI_OVER_5]
   * @param gamma The gamma value to normalize
   * @returns Normalized gamma value
   */
  private normalizeGamma(gamma: Radians): Radians {
    const segment = gamma / TWO_PI_OVER_5;
    const sCenter = Math.round(segment);
    const sOffset = segment - sCenter;

    // Azimuthal angle from triangle bisector
    const beta = sOffset * TWO_PI_OVER_5;
    return beta as Radians;
  }
} 