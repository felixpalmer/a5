// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import { vec2, vec3, quat, glMatrix } from "gl-matrix";
glMatrix.setMatrixArrayType(Float64Array as any);
import { toCartesian, toSpherical, toFace, toPolar } from "../core/coordinate-transforms";
import type { Radians, Spherical, Cartesian, Polar, Face } from "../core/coordinate-systems";
import { GnomonicProjection } from './gnomonic';
import { origins } from "../core/origin";
import { distanceToEdge, interhedralAngle, PI_OVER_5, TWO_PI_OVER_5 } from '../core/constants';
import { PolyhedralProjection } from "./polyhedral";
import { getQuintantVertices } from "../core/tiling";
import { OriginId } from "a5/core/utils";
import { CRS } from "./crs";

type FaceTriangleIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type FaceTriangle = [Face, Face, Face];
import type { SphericalTriangle } from '../core/coordinate-systems';

const crs = new CRS();

export class DodecahedronProjection {
  private faceTriangles: FaceTriangle[] = [];
  private sphericalTriangles: SphericalTriangle[] = [];
  private polyhedral: PolyhedralProjection;
  private gnomonic: GnomonicProjection;

  constructor() {
    this.polyhedral = new PolyhedralProjection();
    this.gnomonic = new GnomonicProjection();
  }
  
  /**
   * Projects spherical coordinates to face coordinates using dodecahedron projection
   * @param spherical Spherical coordinates [theta, phi]
   * @param originId Origin ID
   * @returns Face coordinates [x, y]
   */
  forward(spherical: Spherical, originId: OriginId): Face {
    const origin = origins[originId];

    // Transform back origin space
    const unprojected = toCartesian(spherical);
    const out = vec3.create() as Cartesian;
    vec3.transformQuat(out, unprojected, origin.inverseQuat);

    // Unproject gnomonically to polar coordinates in origin space
    const projectedSpherical = toSpherical(out);
    const polar = this.gnomonic.forward(projectedSpherical);

    // Rotate around face axis to remove origin rotation
    polar[1] = (polar[1] - origin.angle) as Radians;
    const faceTriangleIndex = this.getFaceTriangleIndex(polar);

    const reflect = this.shouldReflect(polar);
    let faceTriangle = this.getFaceTriangle(faceTriangleIndex, reflect, false);
    let sphericalTriangle = this.getSphericalTriangle(faceTriangleIndex, originId, reflect);
    return this.polyhedral.forward(unprojected, sphericalTriangle, faceTriangle);
  }

  /**
   * Unprojects face coordinates to spherical coordinates using dodecahedron projection
   * @param face Face coordinates [x, y]
   * @param originId Origin ID
   * @returns Spherical coordinates [theta, phi]
   */
  inverse(face: Face, originId: OriginId): Spherical {
    const polar = toPolar(face);
    const faceTriangleIndex = this.getFaceTriangleIndex(polar);

    const reflect = this.shouldReflect(polar);
    const faceTriangle = this.getFaceTriangle(faceTriangleIndex, reflect, false);
    const sphericalTriangle = this.getSphericalTriangle(faceTriangleIndex, originId, reflect);
    const unprojected = this.polyhedral.inverse(face, faceTriangle, sphericalTriangle);
    return toSpherical(unprojected);
  }

  /**
   * Detects when point is beyond the edge of the dodecahedron face
   * In the standard case (reflect = false), the face and spherical triangle can be
   * used directly.
   * In the reflected case (reflect = true), the point is beyond the edge of the dodecahedron face,
   * and so the face triangle is squashed to unproject correctly onto the neighboring dodecahedron face.
   * @param polar Polar coordinates
   * @returns True if point is beyond the edge of the dodecahedron face
   */
  private shouldReflect(polar: Polar): boolean {
    const [rho, gamma] = polar;
    const D = toFace([rho, this.normalizeGamma(gamma)] as Polar)[0];
    return D > distanceToEdge;
  }

  /**
   * Given a polar coordinate, returns the index of the face triangle it belongs to
   * @param polar Polar coordinates
   * @returns Face triangle index, value from 0 to 9
   */
  private getFaceTriangleIndex([_, gamma]: Polar): FaceTriangleIndex {
    return (Math.floor(gamma / PI_OVER_5) + 10) % 10 as FaceTriangleIndex;
  }

  /**
   * Gets the face triangle for a given polar coordinate
   * @param faceTriangleIndex Face triangle index, value from 0 to 9
   * @returns FaceTriangle: 3 vertices in counter-clockwise order
   */
  private getFaceTriangle(faceTriangleIndex: FaceTriangleIndex, reflected: boolean = false, squashed: boolean = false): FaceTriangle {
    let index = faceTriangleIndex;
    if (reflected) {
      index += squashed ? 20 : 10;
    }
    if (this.faceTriangles[index]) {
      return this.faceTriangles[index];
    }

    this.faceTriangles[index] = reflected ?
      this._getReflectedFaceTriangle(faceTriangleIndex, squashed) :
      this._getFaceTriangle(faceTriangleIndex);
    Object.freeze(this.faceTriangles[index]);
    return this.faceTriangles[index];
  }

  private _getFaceTriangle(faceTriangleIndex: FaceTriangleIndex): FaceTriangle {
    const quintant = Math.floor((faceTriangleIndex + 1) / 2) % 5;

    const [vCenter, vCorner1, vCorner2] = getQuintantVertices(quintant).getVertices();
    //const vVertex = [distanceToEdge, distanceToEdge] as Face;
    const vEdgeMidpoint = vec2.create() as Face;
    vec2.lerp(vEdgeMidpoint, vCorner1, vCorner2, 0.5);

    // Sign of gamma determines which triangle we want to use, and thus vertex order
    const even = faceTriangleIndex % 2 === 0;

    // Note: center & midpoint compared to DGGAL implementation are swapped
    // as we are using a dodecahedron, rather than a icosahedron.
    return even ? [vCenter, vEdgeMidpoint, vCorner1] : [vCenter, vCorner2, vEdgeMidpoint];
  }

  private _getReflectedFaceTriangle(faceTriangleIndex: FaceTriangleIndex, squashed: boolean = false): FaceTriangle {
    // First obtain ordinary unreflected triangle
    let [A, B, C] = this._getFaceTriangle(faceTriangleIndex).map(face => vec2.clone(face)) as FaceTriangle;

    // Reflect dodecahedron center (A) across edge (BC)
    const even = faceTriangleIndex % 2 === 0;
    vec2.negate(A, A);
    const midpoint = even ? B : C;

    // Squashing is important. A squashed triangle when unprojected will yield the correct spherical triangle.
    vec2.scaleAndAdd(A, A, midpoint, squashed ? 1 + 1 / Math.cos(interhedralAngle) : 2);

    // Swap midpoint and corner to maintain correct vertex order
    return [A, C, B] as FaceTriangle;
  }

  /**
   * Gets the spherical triangle for a given face triangle index and origin
   * @param faceTriangleIndex Face triangle index
   * @param originId Origin ID
   * @returns Spherical triangle
   */
  private getSphericalTriangle(faceTriangleIndex: FaceTriangleIndex, originId: OriginId, reflected: boolean = false): SphericalTriangle {
    let index = 10 * originId + faceTriangleIndex; // 0-119
    if (reflected) {
      index += 120;
    }
    if (this.sphericalTriangles[index]) {
      return this.sphericalTriangles[index];
    }

    this.sphericalTriangles[index] = this._getSphericalTriangle(faceTriangleIndex, originId, reflected);
    Object.freeze(this.sphericalTriangles[index]);
    return this.sphericalTriangles[index];
  }


  private _getSphericalTriangle(faceTriangleIndex: FaceTriangleIndex, originId: OriginId, reflected: boolean = false): SphericalTriangle {
    const origin = origins[originId];
    const faceTriangle = this.getFaceTriangle(faceTriangleIndex, reflected, true);
    
    const sphericalTriangle = faceTriangle.map((face: Face) => {
      const [rho, gamma] = toPolar(face);
      const rotatedPolar = [rho, gamma + origin.angle] as Polar;
      const rotated = toCartesian(this.gnomonic.inverse(rotatedPolar));
      vec3.transformQuat(rotated, rotated, origin.quat);
      return crs.getVertex(rotated);
    });
    return sphericalTriangle as SphericalTriangle;
  }

  /**
   * Normalizes gamma to the range [-PI_OVER_5, PI_OVER_5]
   * @param gamma The gamma value to normalize
   * @returns Normalized gamma value
   */
  normalizeGamma(gamma: Radians): Radians {
    const segment = gamma / TWO_PI_OVER_5;
    const sCenter = Math.round(segment);
    const sOffset = segment - sCenter;

    // Azimuthal angle from triangle bisector
    const beta = sOffset * TWO_PI_OVER_5;
    return beta as Radians;
  }
} 