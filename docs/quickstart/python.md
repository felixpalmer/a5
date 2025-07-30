# Python Quickstart

Get started with A5 in Python by installing the package and running a simple example.

## Installation

Install the A5 package using pip:

```bash
pip install pya5
```

Or using uv:

```bash
uv add pya5
```

## Example: Generate A5 Cells

Here's a complete example that generates A5 cells at a specified resolution and outputs them as GeoJSON:

```python
#!/usr/bin/env python3

import sys
import json

from a5 import bigint_to_hex, cell_to_boundary, cell_to_children

# Generate all cells at the specified resolution
resolution = 2
cells = []
cell_ids = cell_to_children(0, resolution)

# Generate boundary for each cell
for cell_id in cell_ids:
    boundary = cell_to_boundary(cell_id)
    
    cells.append({
        "type": "Feature",
        "geometry": { "type": "Polygon", "coordinates": [boundary] },
        "properties": { "cellIdHex": bigint_to_hex(cell_id) },
    })

# Create GeoJSON FeatureCollection
geojson = { "type": "FeatureCollection", "features": cells }
```

## Usage

The code above in CLI form is available [here](https://github.com/felixpalmer/a5-py/tree/main/examples/wireframe).

```bash
python index.py 2 a5.geojson
```

Or if you're using uv in a project:

```bash
uv run index.py 2 a5.geojson
```

This will generate A5 cells at resolution 2 and save them as GeoJSON in `a5.geojson`.

## Next Steps

- Learn more about [A5 indexing](../api-reference/indexing.md)
- Explore [cell hierarchy](../api-reference/hierarchy.md)
- Check out more [examples](../../examples/)