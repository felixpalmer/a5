// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import {vec2, mat2, mat2d, vec3, glMatrix, quat} from 'gl-matrix';
glMatrix.setMatrixArrayType(Float64Array as any);
import type { Radians, Spherical, Face, Degrees, LonLat, Cartesian } from './coordinate-systems';
import { quatFromSpherical, radToDeg, toCartesian, toSpherical } from './coordinate-transforms';

export type SphericalPolygon = Spherical[];
const UP = [0, 0, 1] as Cartesian;

export class SphericalPentagonShape {
  private vertices: SphericalPolygon;

  constructor(vertices: SphericalPolygon) {
    this.vertices = vertices;
    if (!this.isWindingCorrect()) {
      this.vertices.reverse();
    }
  }

  private isWindingCorrect(): boolean {
    return this.getArea() >= 0;
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

  getBoundary(nSegments: number = 1): Spherical[] {
    const points: Spherical[] = [];
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
   * @returns Spherical (lat, lon) coordinate
   */
  slerp(t: number): Spherical {
    const N = this.vertices.length;
    const f = t % 1;
    const i = Math.floor(t % N);
    const j = (i + 1) % N;

    // Points A & B
    const A = toCartesian(this.vertices[i]);
    const B = toCartesian(this.vertices[j]);

    // Quaternions
    const identity = quat.create();
    const qOA = quat.rotationTo(quat.create(), UP, A);
    const qAB = quat.rotationTo(quat.create(), A, B);
    const qPartial = quat.slerp(quat.create(), identity, qAB, f);
    const qCombined = quat.multiply(quat.create(), qPartial, qOA);

    const out = vec3.fromValues(0, 0, 1);
    vec3.transformQuat(out, out, qCombined);
    return toSpherical(out as Cartesian);
  }

  getVertexQuat(t: number): quat {
    const N = this.vertices.length;
    const i = Math.floor(t % N);
    const j = (i + 1) % N;

    // Points A & B
    const A = toCartesian(this.vertices[i]);
    const B = toCartesian(this.vertices[j]);

    // Rotation from vertex A to origin (north pole)
    const qAO = quat.rotationTo(quat.create(), A, UP);

    // Rotate B into coordinate system of A
    const _A = vec3.transformQuat(vec3.create(), A, qAO);
    const _B = vec3.transformQuat(vec3.create(), B, qAO);
    const _theta = Math.atan2(_B[1], _B[0]) as Radians;


    const qTwist = quat.setAxisAngle(quat.create(), UP, -_theta);
    vec3.transformQuat(_A, _A, qTwist);
    vec3.transformQuat(_B, _B, qTwist);

    // Rotate such that B lies it is along x-axis
    quat.multiply(qAO, qTwist, qAO);
    return qAO;
  }

  getVertexAngles(t: number): [Radians, Radians] {
    const N = this.vertices.length;
    const i = Math.floor(t % N);
    const j = (i + 1) % N;
    const k = (i + N - 1) % N;

    // Points A & B (vertex before and after)
    const V = toCartesian(this.vertices[i]);
    const A = toCartesian(this.vertices[j]);
    const B = toCartesian(this.vertices[k]);

    // Quat to rotate into coordinate system of vertex
    const qV = this.getVertexQuat(t);

    vec3.transformQuat(V, V, qV);
    vec3.transformQuat(A, A, qV);
    vec3.transformQuat(B, B, qV);

    const thetaA = Math.atan2(A[1], A[0]) as Radians;
    const thetaB = Math.atan2(B[1], B[0]) as Radians;
    return [thetaA, thetaB];
  }

  containsPoint(point: Spherical): number {
    const N = this.vertices.length;
    let thetaDelta = Infinity;
    for (let i = 0; i < N; i++) {
      // Transform point into coordinate system of vertex
      const X = toCartesian(point);
      const qV = this.getVertexQuat(i);
      vec3.transformQuat(X, X, qV);

      // Check if point is within vertex angles
      const vertexAngles = this.getVertexAngles(i);
      const thetaX = Math.atan2(X[1], X[0]) as Radians;
      thetaDelta = Math.min(thetaDelta, thetaX - vertexAngles[0], vertexAngles[1] - thetaX);
    }
    return thetaDelta;
  }
}