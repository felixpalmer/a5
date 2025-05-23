// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type { Polar, Spherical } from './coordinate-systems';

export function projectGnomonic([rho, gamma]: Polar): Spherical {
  return [gamma, Math.atan(rho)] as Spherical;
}

export function unprojectGnomonic([theta, phi]: Spherical): Polar {
  return [Math.tan(phi), theta] as Polar;
} 