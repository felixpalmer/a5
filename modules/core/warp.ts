// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type { Radians, Polar } from './coordinate-systems';
import { distanceToEdge, PI_OVER_5, TWO_PI_OVER_5, WARP_FACTORS } from './constants';
import type { WarpType } from './constants';

export function normalizeGamma(gamma: Radians): Radians {
  const segment = gamma / TWO_PI_OVER_5;
  const sCenter = Math.round(segment);
  const sOffset = segment - sCenter;

  // Azimuthal angle from triangle bisector
  const beta = sOffset * TWO_PI_OVER_5;
  return beta as Radians;
}

function _warpBeta(beta: number, warpType: WarpType) {
  const {BETA_SCALE} = WARP_FACTORS[warpType];
  const x = beta * BETA_SCALE;
  return Math.tan(x);
}

function _unwarpBeta(beta: number, warpType: WarpType) {
  const {BETA_SCALE} = WARP_FACTORS[warpType];
  const shiftedBeta = Math.atan(beta);
  return shiftedBeta / BETA_SCALE;
}

const betaMax = PI_OVER_5;

export function warpBeta(beta: number, warpType: WarpType): number {
  const WARP_SCALER = _warpBeta(betaMax, warpType) / betaMax;
  return _warpBeta(beta, warpType) / WARP_SCALER;
}

export function unwarpBeta(beta: number, warpType: WarpType): number {
  const WARP_SCALER = _warpBeta(betaMax, warpType) / betaMax;
  return _unwarpBeta(beta * WARP_SCALER, warpType);
}

function rhoScaleFactor(betaRatio: number, warpType: WarpType) {
  const {RHO_SHIFT, RHO_SCALE, RHO_SCALE2} = WARP_FACTORS[warpType];
  const beta2 = betaRatio * betaRatio;
  const beta4 = beta2 * beta2;
  return (RHO_SHIFT - RHO_SCALE * beta2 - RHO_SCALE2 * beta4);
}

function warpRho(rho: number, beta: number, warpType: WarpType) {
  const betaRatio = Math.abs(beta) / betaMax;
  const shiftedRho = rho * rhoScaleFactor(betaRatio, warpType);
  return Math.tan(shiftedRho);
}

function unwarpRho(rho: number, beta: number, warpType: WarpType) {
  const betaRatio = Math.abs(beta) / betaMax;
  const shiftedRho = Math.atan(rho);
  return shiftedRho / rhoScaleFactor(betaRatio, warpType);
}

export function warpPolar([rho, gamma]: Polar, warpType: WarpType): Polar {
  const beta = normalizeGamma(gamma);
  
  const beta2 = warpBeta(beta, warpType);
  const deltaBeta = beta2 - beta;

  // Distance to edge will change, so shift rho to match
  const scale = Math.cos(beta) / Math.cos(beta2);
  const rhoOut = scale * rho;

  const rhoMax = distanceToEdge / Math.cos(beta2);
  const scaler2 = warpRho(rhoMax, beta2, warpType) / rhoMax;
  const rhoWarped = warpRho(rhoOut, beta2, warpType) / scaler2;

  return [rhoWarped, gamma + deltaBeta] as Polar;
}

export function unwarpPolar([rho, gamma]: Polar, warpType: WarpType): Polar {
  const beta2 = normalizeGamma(gamma);
  const beta = unwarpBeta(beta2, warpType);
  const deltaBeta = beta2 - beta;

  // Reverse the rho warping
  const rhoMax = distanceToEdge / Math.cos(beta2);
  const scaler2 = warpRho(rhoMax, beta2, warpType) / rhoMax;
  const rhoUnwarped = unwarpRho(rho * scaler2, beta2, warpType);
  
  // Reverse the scale adjustment
  const scale = Math.cos(beta) / Math.cos(beta2);
  return [rhoUnwarped / scale, gamma - deltaBeta] as Polar;
}
