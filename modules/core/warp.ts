// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type { Radians, Polar } from './coordinate-systems';
import { distanceToEdge, PI_OVER_5, TWO_PI_OVER_5, WARP_FACTORS_HIGH } from './constants';

export function normalizeGamma(gamma: Radians): Radians {
  const segment = gamma / TWO_PI_OVER_5;
  const sCenter = Math.round(segment);
  const sOffset = segment - sCenter;

  // Azimuthal angle from triangle bisector
  const beta = sOffset * TWO_PI_OVER_5;
  return beta as Radians;
}

function _warpBeta(beta: number) {
  const x = beta * WARP_FACTORS_HIGH.BETA_SCALE;
  return Math.tan(x);
}

function _unwarpBeta(beta: number) {
  const shiftedBeta = Math.atan(beta);
  return shiftedBeta / WARP_FACTORS_HIGH.BETA_SCALE;
}

const betaMax = PI_OVER_5;
const WARP_SCALER = _warpBeta(betaMax) / betaMax;

export function warpBeta(beta: number): number {
  return _warpBeta(beta) / WARP_SCALER;
}

export function unwarpBeta(beta: number): number {
  const WARP_SCALER = _warpBeta(betaMax) / betaMax;
  return _unwarpBeta(beta * WARP_SCALER);
}

function rhoScaleFactor(betaRatio: number) {
  const beta2 = betaRatio * betaRatio;
  const beta4 = beta2 * beta2;
  return (WARP_FACTORS_HIGH.RHO_SHIFT - WARP_FACTORS_HIGH.RHO_SCALE * beta2 - WARP_FACTORS_HIGH.RHO_SCALE2 * beta4);
}

function warpRho(rho: number, beta: number) {
  const betaRatio = Math.abs(beta) / betaMax;
  const shiftedRho = rho * rhoScaleFactor(betaRatio);
  return Math.tan(shiftedRho);
}

function unwarpRho(rho: number, beta: number) {
  const betaRatio = Math.abs(beta) / betaMax;
  const shiftedRho = Math.atan(rho);
  return shiftedRho / rhoScaleFactor(betaRatio);
}

export function warpPolar([rho, gamma]: Polar): Polar {
  const beta = normalizeGamma(gamma);
  
  const beta2 = warpBeta(beta);
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
