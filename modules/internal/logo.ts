// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import * as vec2 from '../math/vec2';
import {a, b, c, d, e} from './pentagon';

function generatePentagonSVG(): string {
  // Define canvas size.
  const width = 64;
  const height = 64;

  // Center coordinates.
  const cx = 7;
  const cy = 7;
  // Set pentagon radius.
  const scale = 32;

  // Retrieve the vertices of the pentagon.
  const vertices = [a, b, c, d, e];
  // Build a points attribute for the <polygon>; each vertex is "x,y".
  const points = vertices
    .map(v => vec2.scale(v, v, scale))
    .map(v => vec2.add(v, v, [cx, cy]))
    .map(v => `${v[0]},${v[1]}`)
    .join(' ');

  // Build the SVG string.
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <polygon points="${points}" fill="none" stroke="black" stroke-width="2"/>
</svg>`.trim();

  return svg;
}

//  console.log(generatePentagonSVG());
