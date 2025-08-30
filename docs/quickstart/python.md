# Python Quickstart

Get started with A5 in Python by installing the [package](https://pypi.org/project/pya5/) and running a simple example.

## Installation

Install the [A5 package](https://pypi.org/project/pya5/) using pip:

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
from a5 import u64_to_hex, cell_to_boundary, cell_to_children

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
        "properties": { "cellIdHex": u64_to_hex(cell_id) },
    })

# Create GeoJSON FeatureCollection
geojson = { "type": "FeatureCollection", "features": cells }
```

## Example Output

The above code will produce a collection of cells that cover the whole world.

_Note that the cells all have the same area, they are just warped by the map projection_

import WireframeDemo from 'website-examples/wireframe/app';

<div style={{margin: '20px 0'}}>
  <WireframeDemo />
</div>

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