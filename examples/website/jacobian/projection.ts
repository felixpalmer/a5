// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

/**
 * The projection variants this example compares, kept here rather than in the
 * library.
 *
 * A5 has exactly one projection, DSEA, and that is deliberate: a library that
 * could be switched to another one invites cell ids that mean different things
 * depending on how it was configured. So the alternatives live in the example
 * that studies them, as a fork of `modules/projections/dodecahedron.ts` with the
 * radiating vertex made a parameter. Everything underneath — the equal-area map,
 * the gnomonic step, the CRS, the quintant vertices — is the library's own, so
 * the `dsea` mode reproduces A5's projection exactly rather than approximating it.
 */

import * as vec2 from 'a5/math/vec2';
import * as vec3 from 'a5/math/vec3';
import {toCartesian, toFace, toPolar, toSpherical} from 'a5/core/coordinate-transforms';
import type {Cartesian, Face, Polar, Radians, Spherical, SphericalTriangle} from 'a5/core/coordinate-systems';
import {GnomonicProjection} from 'a5/projections/gnomonic';
import {origins} from 'a5/core/origin';
import {distanceToEdge, interhedralAngle, PI_OVER_5, TWO_PI_OVER_5} from 'a5/core/constants';
import {EqualAreaProjection} from 'a5/projections/equal-area';
import {getQuintantVertices} from 'a5/core/tiling';
import {CRS} from 'a5/projections/crs';
import type {OriginId} from 'a5/core/utils';

/**
 * Which vertex of each face triangle the equal-area projection radiates from.
 *
 * A face triangle has three vertices, so there are exactly three choices, and
 * they are the three cyclic rotations of the same ordering — never swaps, since
 * the closed-form equal-area projection depends on the winding. All three are
 * equal-area; they differ in where the cusps fall and in how shape is distorted.
 *
 * - `dsea` radiates from the dodecahedron face center. A5's projection.
 * - `isea` radiates from the corner, the face center of the dual icosahedron.
 * - `rtsea` radiates from the edge midpoint, which is a face centre of the
 *   rhombic triacontahedron. Included so the design space is closed rather than
 *   because anything uses it.
 *
 * Each is named for the solid whose face fan it radiates from, following the
 * precedent set by ISEA and RTSEA. All three decompose into the same 120 Mobius
 * triangles of the icosahedral symmetry group, differing only in which vertex of
 * each triangle leads.
 *
 * `gnomonic` is not one of them and is not equal-area. It is the plain central
 * projection from the sphere onto the face plane, with no triangle decomposition
 * at all. It is included as the baseline the Snyder family is measured against:
 * it maps great circles to straight lines, so it has no cusps and no sag, and it
 * shows exactly what the equal-area property costs.
 */
export type ProjectionMode = 'dsea' | 'isea' | 'rtsea' | 'gnomonic';

export const DEFAULT_PROJECTION_MODE: ProjectionMode = 'dsea';

type FaceTriangleIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type FaceTriangle = [Face, Face, Face];

const crs = new CRS();

/**
 * The library's canonical face triangle, led by the vertex this mode radiates
 * from.
 *
 * `getCanonicalTriangle` hands back [centre, midpoint, corner]; the other two
 * modes are its cyclic rotations. Rotations rather than swaps, because the closed
 * form in `EqualAreaProjection` bakes in the signed triple product and so depends
 * on the winding.
 */
function canonicalTriangle(mode: ProjectionMode): SphericalTriangle {
  const [centre, midpoint, corner] = crs.getCanonicalTriangle();
  if (mode === 'isea') return [corner, centre, midpoint] as SphericalTriangle;
  if (mode === 'rtsea') return [midpoint, corner, centre] as SphericalTriangle;
  // 'gnomonic' never reaches the equal-area projection; the DSEA ordering keeps
  // the constants well formed
  return [centre, midpoint, corner] as SphericalTriangle;
}

/** `DodecahedronProjection`, with the radiating vertex made a parameter */
export class ModalDodecahedronProjection {
  private faceTriangles: FaceTriangle[] = [];
  private sphericalTriangles: SphericalTriangle[] = [];
  private equalArea: EqualAreaProjection;
  private gnomonic: GnomonicProjection;
  private mode: ProjectionMode;

  constructor(mode: ProjectionMode = DEFAULT_PROJECTION_MODE) {
    this.mode = mode;
    // The gnomonic baseline never reaches the equal-area projection, but the
    // canonical triangle is still built so the field stays non-optional
    this.equalArea = new EqualAreaProjection(canonicalTriangle(mode));
    this.gnomonic = new GnomonicProjection();
  }

  forward(spherical: Spherical, originId: OriginId): Face {
    return this.forwardCartesian(toCartesian(spherical), originId);
  }

  forwardCartesian(unprojected: Cartesian, originId: OriginId): Face {
    const origin = origins[originId];

    // Transform back to origin space
    const out = vec3.create() as Cartesian;
    vec3.transformQuat(out, unprojected, origin.inverseQuat);

    // Unproject gnomonically to polar coordinates in origin space
    const projectedSpherical = toSpherical(out);
    const polar = this.gnomonic.forward(projectedSpherical);

    // Rotate around face axis to remove origin rotation
    polar[1] = (polar[1] - origin.angle) as Radians;

    // The gnomonic baseline stops here: the polar coordinates it already produced
    // are the face coordinates, with no equal-area step and no triangles
    if (this.mode === 'gnomonic') return toFace(polar);

    const faceTriangleIndex = this.getFaceTriangleIndex(polar);
    const reflect = this.shouldReflect(polar);
    const faceTriangle = this.getFaceTriangle(faceTriangleIndex, reflect, false);
    const sphericalTriangle = this.getSphericalTriangle(faceTriangleIndex, originId, reflect);
    return this.equalArea.forward(unprojected, sphericalTriangle, faceTriangle);
  }

  inverse(face: Face, originId: OriginId): Spherical {
    const polar = toPolar(face);

    if (this.mode === 'gnomonic') {
      const origin = origins[originId];
      const rotated = [polar[0], (polar[1] + origin.angle) as Radians] as Polar;
      const unprojected = toCartesian(this.gnomonic.inverse(rotated));
      vec3.transformQuat(unprojected, unprojected, origin.quat);
      return toSpherical(unprojected);
    }

    const faceTriangleIndex = this.getFaceTriangleIndex(polar);
    const reflect = this.shouldReflect(polar);
    const faceTriangle = this.getFaceTriangle(faceTriangleIndex, reflect, false);
    const sphericalTriangle = this.getSphericalTriangle(faceTriangleIndex, originId, reflect);
    const unprojected = this.equalArea.inverse(face, faceTriangle, sphericalTriangle);
    return toSpherical(unprojected);
  }

  /** Whether the point is beyond the edge of the dodecahedron face */
  private shouldReflect(polar: Polar): boolean {
    const [rho, gamma] = polar;
    const D = toFace([rho, this.normalizeGamma(gamma)] as Polar)[0];
    return D > distanceToEdge;
  }

  private getFaceTriangleIndex([, gamma]: Polar): FaceTriangleIndex {
    return ((Math.floor(gamma / PI_OVER_5) + 10) % 10) as FaceTriangleIndex;
  }

  private getFaceTriangle(
    faceTriangleIndex: FaceTriangleIndex,
    reflected: boolean = false,
    squashed: boolean = false
  ): FaceTriangle {
    let index = faceTriangleIndex;
    if (reflected) {
      index += squashed ? 20 : 10;
    }
    if (this.faceTriangles[index]) {
      return this.faceTriangles[index];
    }

    this.faceTriangles[index] = reflected
      ? this._getReflectedFaceTriangle(faceTriangleIndex, squashed)
      : this._getFaceTriangle(faceTriangleIndex);
    Object.freeze(this.faceTriangles[index]);
    return this.faceTriangles[index];
  }

  private _getFaceTriangle(faceTriangleIndex: FaceTriangleIndex): FaceTriangle {
    const quintant = Math.floor((faceTriangleIndex + 1) / 2) % 5;

    const [vCenter, vCorner1, vCorner2] = getQuintantVertices(quintant).getVertices();
    const vEdgeMidpoint = vec2.create() as Face;
    vec2.lerp(vEdgeMidpoint, vCorner1, vCorner2, 0.5);

    // Sign of gamma determines which triangle we want to use, and thus vertex order
    const even = faceTriangleIndex % 2 === 0;

    // Note: center & midpoint compared to DGGAL implementation are swapped
    // as we are using a dodecahedron, rather than a icosahedron.
    // The three modes are the three cyclic rotations of [centre, midpoint, corner],
    // each leading with the vertex the projection radiates from. Rotations, never
    // swaps, so the winding is preserved.
    if (this.mode === 'isea') {
      return even ? [vCorner1, vCenter, vEdgeMidpoint] : [vCorner2, vEdgeMidpoint, vCenter];
    }
    if (this.mode === 'rtsea') {
      return even ? [vEdgeMidpoint, vCorner1, vCenter] : [vEdgeMidpoint, vCenter, vCorner2];
    }
    return even ? [vCenter, vEdgeMidpoint, vCorner1] : [vCenter, vCorner2, vEdgeMidpoint];
  }

  private _getReflectedFaceTriangle(faceTriangleIndex: FaceTriangleIndex, squashed: boolean = false): FaceTriangle {
    // First obtain ordinary unreflected triangle
    const [A, B, C] = this._getFaceTriangle(faceTriangleIndex).map(face => vec2.clone(face)) as FaceTriangle;
    const even = faceTriangleIndex % 2 === 0;

    // In every mode it is the face centre that moves: it is the only vertex not
    // shared with the neighbouring face across the dodecahedron edge. Reflecting
    // it across that edge means negating it (it sits at the origin) and stepping
    // twice along the edge midpoint, which is the foot of the perpendicular.
    // Squashing instead yields the correct spherical triangle when unprojected.
    const step = squashed ? 1 + 1 / Math.cos(interhedralAngle) : 2;

    if (this.mode === 'isea') {
      // [corner, centre, midpoint] (even) or [corner, midpoint, centre] (odd)
      const centre = even ? B : C;
      const midpoint = even ? C : B;
      vec2.negate(centre, centre);
      vec2.scaleAndAdd(centre, centre, midpoint, step);
      return even ? ([A, midpoint, centre] as FaceTriangle) : ([A, centre, midpoint] as FaceTriangle);
    }

    if (this.mode === 'rtsea') {
      // [midpoint, corner, centre] (even) or [midpoint, centre, corner] (odd).
      // A is the midpoint, so the centre moves in place and the order is unchanged.
      const centre = even ? C : B;
      vec2.negate(centre, centre);
      vec2.scaleAndAdd(centre, centre, A, step);
      return [A, B, C] as FaceTriangle;
    }

    // DSEA: the centre leads, so it is A that moves
    const midpoint = even ? B : C;
    vec2.negate(A, A);
    vec2.scaleAndAdd(A, A, midpoint, step);

    // Swap midpoint and corner to maintain correct vertex order
    return [A, C, B] as FaceTriangle;
  }

  private getSphericalTriangle(
    faceTriangleIndex: FaceTriangleIndex,
    originId: OriginId,
    reflected: boolean = false
  ): SphericalTriangle {
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

  private _getSphericalTriangle(
    faceTriangleIndex: FaceTriangleIndex,
    originId: OriginId,
    reflected: boolean = false
  ): SphericalTriangle {
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

  /** Normalizes gamma to the range [-PI_OVER_5, PI_OVER_5] */
  normalizeGamma(gamma: Radians): Radians {
    const segment = gamma / TWO_PI_OVER_5;
    const sCenter = Math.round(segment);
    const sOffset = segment - sCenter;

    // Azimuthal angle from triangle bisector
    return (sOffset * TWO_PI_OVER_5) as Radians;
  }
}
