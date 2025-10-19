# JavaScript Quickstart

Get started with A5 in JavaScript by installing the [package](https://www.npmjs.com/package/a5-js) and running a simple example.

## Installation

Install the [A5 package](https://www.npmjs.com/package/a5-js) using npm:

```bash
npm install a5-js
```

Or using yarn:

```bash
yarn add a5-js
```

## Code Example: Generate A5 Cells

Here's a complete example that generates A5 cells at a specified resolution and outputs them as GeoJSON:

```javascript
import { cellToBoundary, u64ToHex, cellToChildren } from "a5-js";

// Generate all cells at the specified resolution
const resolution = 2;
const cells = [];
const cellIds = cellToChildren(0n, resolution);

// Generate boundary for each cell
for (let cellId of cellIds) {
  const cellIdHex = u64ToHex(cellId);
  const boundary = cellToBoundary(cellId);

  cells.push({
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [boundary] },
    properties: { cellIdHex }
  });
}

// Create GeoJSON FeatureCollection
const geojson = { type: "FeatureCollection", features: cells };
```

## Example Output

The above code will produce a collection of cells that cover the whole world.

_Note that the cells all have the same area, they are just warped by the map projection_

import WireframeDemo from 'website-examples/wireframe/app';

<div style={{margin: '20px 0'}}>
  <WireframeDemo />
</div>

## CLI Usage

The code above in CLI form is available [here](https://github.com/felixpalmer/a5/tree/main/examples/cli/wireframe).

```bash
node index.js 2 a5.geojson
```

This will generate A5 cells at resolution 2 and save them as GeoJSON in `a5.geojson`.

## Next Steps

- Learn more about [A5 indexing](../api-reference/indexing.md)
- Explore [cell hierarchy](../api-reference/hierarchy.md)
- Check out more [examples](../../examples/)