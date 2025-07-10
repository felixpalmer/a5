// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import type { Polar, Spherical } from '../core/coordinate-systems';

export class GnomonicProjection {
  /**
   * Projects spherical coordinates to polar coordinates using gnomonic projection
   * @param spherical Spherical coordinates [theta, phi]
   * @returns Polar coordinates [rho, gamma]
   */
  forward([theta, phi]: Spherical): Polar {
    return [Math.tan(phi), theta] as Polar;
  }

  /**
   * Unprojects polar coordinates to spherical coordinates using gnomonic projection
   * @param polar Polar coordinates [rho, gamma]
   * @returns Spherical coordinates [theta, phi]
   */
  inverse([rho, gamma]: Polar): Spherical {
    return [gamma, Math.atan(rho)] as Spherical;
  }
} 