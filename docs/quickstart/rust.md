# Rust Quickstart

Get started with A5 in Rust by installing the [crate](https://crates.io/crates/a5) and running a simple example.

## Installation

Add the [A5 crate](https://crates.io/crates/a5) to your `Cargo.toml`:

```toml
[dependencies]
a5 = "0.1.0"
serde_json = "1.0"
```

Or using cargo:

```bash
cargo add a5 serde_json
```

## Code Example: Generate A5 Cells

Here's a complete example that generates A5 cells at a specified resolution and outputs them as GeoJSON:

```rust
use a5::{cell_to_boundary, cell_to_children, u64_to_hex};
use serde_json::json;

fn main() {
    let resolution = 2;
    let cell_ids = cell_to_children(0, Some(resolution)).unwrap();
    
    let cells: Vec<_> = cell_ids
        .iter()
        .map(|&cell_id| {
            let boundary: Vec<[f64; 2]> = cell_to_boundary(cell_id, None)
                .unwrap()
                .iter()
                .map(|point| [point.longitude(), point.latitude()])
                .collect();
            
            json!({
                "type": "Feature",
                "geometry": { "type": "Polygon", "coordinates": [boundary] },
                "properties": { "cellIdHex": u64_to_hex(cell_id) }
            })
        })
        .collect();
    
    let geojson = json!({ "type": "FeatureCollection", "features": cells });
    println!("{}", serde_json::to_string_pretty(&geojson).unwrap());
}
```

## Example Output

The above code will produce a collection of cells that cover the whole world.

_Note that the cells all have the same area, they are just warped by the map projection_

import WireframeDemo from 'website-examples/wireframe/app';

<div style={{margin: '20px 0'}}>
  <WireframeDemo />
</div>

## Usage

This will generate A5 cells at resolution 2 and output them as GeoJSON.

```bash
cargo run
```

## Next Steps

- Learn more about [A5 indexing](../api-reference/indexing.md)
- Explore [cell hierarchy](../api-reference/hierarchy.md)
- Check out more [examples](../../examples/)