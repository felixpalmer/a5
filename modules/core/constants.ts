// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type { Radians } from "./coordinate-systems";

// Golden ratio
export const φ = (1 + Math.sqrt(5)) / 2;

export const TWO_PI = 2 * Math.PI as Radians;
export const TWO_PI_OVER_5 = 2 * Math.PI / 5 as Radians;
export const PI_OVER_5 = Math.PI / 5 as Radians;
export const PI_OVER_10 = Math.PI / 10 as Radians;

// Angles between faces
export const dihedralAngle = 2 * Math.atan(φ) as Radians; // Angle between pentagon faces (radians) = 116.565°
export const interhedralAngle = Math.PI - dihedralAngle as Radians; // Angle between pentagon faces (radians) = 63.435°
export const faceEdgeAngle = -0.5 * Math.PI + Math.acos(-1 / Math.sqrt(3 - φ)) as Radians; // = 58.28252558853899

// Distance from center to edge of pentagon face
export const distanceToEdge = (Math.sqrt(5) - 1) / 2; // φ - 1;
export const distanceToVertex = 3 - Math.sqrt(5); // 2 * (2 - φ);

// Dodecahedron sphere radii (normalized to unit radius for inscribed sphere)
/**
 * Radius of the inscribed sphere in dodecahedron
 */
export const Rinscribed = 1;

/**
 * Radius of the sphere that touches the dodecahedron's edge midpoints
 */
export const Rmidedge = Math.sqrt(3 - φ);

/**
 * Radius of the circumscribed sphere for dodecahedron
 */
export const Rcircumscribed = Math.sqrt(3) * Rmidedge / φ;

/**
 * Authalic radius of Earth (meters)
 */
export const AUTHALIC_RADIUS_EARTH = 6371007.2; // m

/**
 * Authalic surface area of Earth (square meters)
 */
export const AUTHALIC_AREA_EARTH = 4 * Math.PI * AUTHALIC_RADIUS_EARTH * AUTHALIC_RADIUS_EARTH; // m^2