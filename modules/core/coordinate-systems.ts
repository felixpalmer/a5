// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type { vec2, vec3 } from "gl-matrix";

export type Degrees = number & { __brand: 'Degrees' };
export type Radians = number & { __brand: 'Radians' };

// Define different coordinate systems to avoid confusion
// 2D
/**
 * 2D cartesian coordinate system with origin at the center of a dodecahedron face
 */
export type Face = vec2 & { __brand: 'Face' };
/**
 * 2D polar coordinate system with origin at the center of a dodecahedron face
 */
export type Polar = [rho: number, gamma: Radians] & { __brand: 'Polar' };
/**
 * 2D planar coordinate system defined by the eigenvectors of the lattice tiling
 */
export type IJ = vec2 & {__brand: 'IJ'}
/**
 * 2D planar coordinate system formed by the transformation K -> I + J
 */
export type KJ = vec2 & {__brand: 'KJ'}

// 3D (with radius fixed)
/**
 * 3D cartersian system centered on unit sphere/dodecahedron
 */
export type Cartesian = vec3 & { __brand: 'Cartesian' };
/**
 * 3D spherical coordinate system centered on unit sphere/dodecahedron
 */
export type Spherical = [theta: Radians, phi: Radians] & { __brand: 'Spherical' };
/**
 * Geographic longitude & latitude
 */
export type LonLat = [longitude: Degrees, latitude: Degrees] & { __brand: 'LonLat' }; 