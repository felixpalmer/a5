// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {vec2, mat2, mat2d, vec3, glMatrix, quat} from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import type { Radians, Spherical, Face, Degrees, LonLat, Cartesian } from './coordinate-systems';
import { quatFromSpherical, radToDeg, toCartesian, toSpherical } from './coordinate-transforms';

export type SphericalPolygon = Cartesian[];
const UP = [0, 0, 1] as Cartesian;

export class SphericalPentagonShape {
  private vertices: SphericalPolygon;

  constructor(vertices: SphericalPolygon) {
    this.vertices = vertices;
    if (!this.isWindingCorrect()) {
      debugger;
      this.vertices.reverse();
    }
  }

  private isWindingCorrect(): boolean {
    return this.getArea() >= 0;
  }

  getArea(): number {
    let signedArea = 0;
    const N = this.vertices.length;
    
    // Project vertices onto tangent plane at north pole
    const projectedVertices = this.vertices.map(v => {
      const z = vec3.dot(v, UP);
      return [v[0]/(1+z), v[1]/(1+z)] as [number, number];
    });

    // Calculate signed area in projected plane
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      signedArea += (projectedVertices[j][0] - projectedVertices[i][0]) * 
                    (projectedVertices[j][1] + projectedVertices[i][1]);
    }
    return signedArea;
  }

  getBoundary(nSegments: number = 1): SphericalPolygon {
    const points: SphericalPolygon = [];
    const N = this.vertices.length;
    for (let s = 0; s < N * nSegments; s++) {
      const t = s / nSegments;
      points.push(this.slerp(t));
    }
    points.push(points[0]);
    
    return points;
  }

  /**
   * Interpolates along boundary of polygon. Pass t = 1.5 to get the midpoint between 2nd and 3rd vertices
   * @param t 
   * @returns Cartesian coordinate
   */
  slerp(t: number): Cartesian {
    const N = this.vertices.length;
    const f = t % 1;
    const i = Math.floor(t % N);
    const j = (i + 1) % N;

    // Points A & B
    const A = this.vertices[i];
    const B = this.vertices[j];

    // Quaternions
    const identity = quat.create();
    const qOA = quat.rotationTo(quat.create(), UP, A);
    const qAB = quat.rotationTo(quat.create(), A, B);
    const qPartial = quat.slerp(quat.create(), identity, qAB, f);
    const qCombined = quat.multiply(quat.create(), qPartial, qOA);

    const out = vec3.fromValues(0, 0, 1);
    vec3.transformQuat(out, out, qCombined);
    return out as Cartesian;
  }

  getVertexQuat(t: number): quat {
    const N = this.vertices.length;
    const i = Math.floor(t % N);
    const j = (i + 1) % N;

    // Points A & B
    const A = this.vertices[i];
    const B = this.vertices[j];

    // Rotation from vertex A to origin (north pole)
    const qAO = quat.rotationTo(quat.create(), A, UP);

    // Rotate B into coordinate system of A
    // const _A = vec3.transformQuat(vec3.create(), A, qAO);
    // const _B = vec3.transformQuat(vec3.create(), B, qAO);
    // const _theta = Math.atan2(_B[1], _B[0]) as Radians;

    // const qTwist = quat.setAxisAngle(quat.create(), UP, -_theta);
    // vec3.transformQuat(_A, _A, qTwist);
    // vec3.transformQuat(_B, _B, qTwist);

    // Rotate such that B lies it is along x-axis
    //quat.multiply(qAO, qTwist, qAO);
    return qAO;
  }

  transformVertices(t: number): [Cartesian, Cartesian] {
    const N = this.vertices.length;
    const i = Math.floor(t % N);
    const j = (i + 1) % N;
    const k = (i + N - 1) % N;

    // Points A & B (vertex before and after)
    const V = this.vertices[i];
    const A = this.vertices[j];
    const B = this.vertices[k];

    // Quat to rotate into coordinate system of vertex
    const qV = this.getVertexQuat(t);

    const _V = vec3.transformQuat(vec3.create(), V, qV);
    const _A = vec3.transformQuat(vec3.create(), A, qV) as Cartesian;
    const _B = vec3.transformQuat(vec3.create(), B, qV) as Cartesian;
    return [_A, _B];

    // const thetaA = Math.atan2(_A[1], _A[0]) as Radians;
    // const thetaB = Math.atan2(_B[1], _B[0]) as Radians;
    // return [thetaA, thetaB];
  }

  containsPoint(point: Cartesian): number {
    const N = this.vertices.length;
    console.log(this.vertices)
    let thetaDeltaMin = Infinity;
    for (let i = 0; i < N; i++) {
      // Transform point into coordinate system of vertex
      const qV = this.getVertexQuat(i);
      const X = vec3.transformQuat(vec3.create(), point, qV);

      // Check if point is within vertex angles
      const [A, B] = this.transformVertices(i);
      A[2] = 0;
      B[2] = 0;
      X[2] = 0;

      vec3.normalize(A, A);
      vec3.normalize(B, B);
      vec3.normalize(X, X);

      const sinXA = vec3.cross(vec3.create(), X, A)[2];
      const sinBX = vec3.cross(vec3.create(), B, X)[2];

      thetaDeltaMin = Math.min(thetaDeltaMin, sinXA, sinBX);
    }
    return thetaDeltaMin;
  }
}