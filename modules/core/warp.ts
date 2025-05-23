// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type { Radians, Polar } from './coordinate-systems';
import { distanceToEdge, PI_OVER_5, TWO_PI_OVER_5, WARP_FACTOR } from './constants';

export function normalizeGamma(gamma: Radians): Radians {
  const segment = gamma / TWO_PI_OVER_5;
  const sCenter = Math.round(segment);
  const sOffset = segment - sCenter;

  // Azimuthal angle from triangle bisector
  const beta = sOffset * TWO_PI_OVER_5;
  return beta as Radians;
}

function _warpBeta(beta: number) {
  const shiftedBeta = beta * WARP_FACTOR;
  return Math.tan(shiftedBeta);
}

function _unwarpBeta(beta: number) {
  const shiftedBeta = Math.atan(beta);
  return shiftedBeta / WARP_FACTOR;
}

const betaMax = PI_OVER_5;
const WARP_SCALER = _warpBeta(betaMax) / betaMax;

export function warpBeta(beta: number): number {
  return _warpBeta(beta) / WARP_SCALER;
}

export function unwarpBeta(beta: number): number {
  return _unwarpBeta(beta * WARP_SCALER);
}

function warpRho(rho: number, beta: number) {
  const betaRatio = Math.abs(beta) / betaMax;
  const shiftedRho = rho * (0.95 - 0.05 * betaRatio);
  return Math.tan(shiftedRho);
}

function unwarpRho(rho: number, beta: number) {
  const betaRatio = Math.abs(beta) / betaMax;
  const shiftedRho = Math.atan(rho);
  return shiftedRho / (0.95 - 0.05 * betaRatio);
}

export function warpPolar([rho, gamma]: Polar): Polar {
  const beta = normalizeGamma(gamma);
  
  const beta2 = warpBeta(normalizeGamma(gamma));
  const deltaBeta = beta2 - beta;

  // Distance to edge will change, so shift rho to match
  const scale = Math.cos(beta) / Math.cos(beta2);
  const rhoOut = scale * rho;

  const rhoMax = distanceToEdge / Math.cos(beta2);
  const scaler2 = warpRho(rhoMax, beta2) / rhoMax;
  const rhoWarped = warpRho(rhoOut, beta2) / scaler2;

  return [rhoWarped, gamma + deltaBeta] as Polar;
}

export function unwarpPolar([rho, gamma]: Polar): Polar {
  const beta2 = normalizeGamma(gamma);
  const beta = unwarpBeta(beta2);
  const deltaBeta = beta2 - beta;

  // Reverse the rho warping
  const rhoMax = distanceToEdge / Math.cos(beta2);
  const scaler2 = warpRho(rhoMax, beta2) / rhoMax;
  const rhoUnwarped = unwarpRho(rho * scaler2, beta2);
  
  // Reverse the scale adjustment
  const scale = Math.cos(beta) / Math.cos(beta2);
  return [rhoUnwarped / scale, gamma - deltaBeta] as Polar;
}
