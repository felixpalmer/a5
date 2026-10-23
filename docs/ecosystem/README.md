---
description: "Official A5 libraries for TypeScript, Python and Rust, community libraries, and integrations such as DuckDB, deck.gl and QGIS."
---

# Libraries & Integrations

The A5 project maintains official implementations in TypeScript, Python, and Rust using [polyglot mirroring](polyglot-mirroring.md) to ensure feature parity and consistency. The wider ecosystem includes community-contributed libraries and integrations in additional languages and platforms. Contributions are welcome!

For practical examples on how to use these tools, see the [Recipes](./recipes) section.

## Core Libraries

The TypeScript, Python, and Rust libraries are maintained directly by the A5 project.

### TypeScript
📖 [Quickstart](../quickstart/javascript.md) • 📦 [Package](https://www.npmjs.com/package/a5-js) • 🔗 [Source](https://github.com/felixpalmer/a5)

### Python
📖 [Quickstart](../quickstart/python.md) • 📦 [Package](https://pypi.org/project/pya5/) • 🔗 [Source](https://github.com/felixpalmer/a5-py)

### Rust
📖 [Quickstart](../quickstart/rust.md) • 📦 [Package](https://crates.io/crates/a5) • 🔗 [Source](https://github.com/felixpalmer/a5-rs)

## Community Libraries

### Bevy (Rust)
A [Bevy](https://bevyengine.org/) plugin that places the A5 cell hierarchy under a game world.

📖 [Docs](https://docs.rs/bevy_a5) • 📦 [Package](https://crates.io/crates/bevy_a5) • 🔗 [Source](https://github.com/jonititan/bevy_a5)

### Go
🔗 [Source](https://github.com/corewood-tech/a5go)

### JavaScript (GeoJSON conversion)
Converts A5 cells to GeoJSON, and GeoJSON polygons and lines to A5 cells.

📦 [Package](https://www.npmjs.com/package/a5-to-geojson) • 🔗 [Source](https://github.com/alrico88/a5-to-geojson)

### R
📖 [Docs](https://belian-earth.github.io/a5R/) • 📦 [Package](https://cran.r-project.org/package=a5R) • 🔗 [Source](https://github.com/belian-earth/a5R)

## Integrations

### deck.gl
📖 [Docs](https://deck.gl/docs/api-reference/geo-layers/a5-layer) • 🌍 [Demo app](https://deck.gl/examples/global-grids) • 🔗 [Source](https://github.com/visgl/deck.gl/blob/master/modules/geo-layers/src/a5-layer/a5-layer.ts)

### DuckDB
📖 [Quickstart](../quickstart/duckdb.md) • 📦 [Extension](https://query.farm/products/extensions/a5/) • 🔗 [Source](https://github.com/Query-farm/a5)

### GeoLibre
The [DGGS Plugin](https://geolibre.app/user-guide/plugins/) renders and identifies A5 cells over the current view, and [DGGS Processing](https://geolibre.app/user-guide/processing/) generates, bins and compacts A5 cells.

🔗 [Website](https://geolibre.app/) • 📖 [Docs](https://geolibre.app/user-guide/plugins/) • 🔗 [Source](https://github.com/opengeos/GeoLibre)

### GeoParquet
 🔗 [Website](https://geoparquet.io/) • 📖 [Docs](https://geoparquet.io/guide/partition/#by-a5-cells) • 🔗 [Source](https://github.com/geoparquet/geoparquet-io)

### kepler.gl
📖 [Docs](https://github.com/keplergl/kepler.gl/blob/master/docs/user-guides/c-types-of-layers/q-a5.md) • 🌍 [App](https://kepler.gl/) • 🔗 [Source](https://github.com/keplergl/kepler.gl)

### lonboard
📖 [Docs](https://developmentseed.org/lonboard/latest/api/layers/a5-layer/) • 📦 [Package](https://pypi.org/project/lonboard/) • 🔗 [Source](https://github.com/developmentseed/lonboard/blob/main/lonboard/layer/_a5.py)

### PostgreSQL
📖 [Quickstart](../quickstart/postgresql.md) • 📦 [Extension](https://github.com/decision-labs/a5pg) • 🔗 [Source](https://github.com/decision-labs/a5pg)

### pycnogrid
R package for pycnophylactic interpolation of polygon totals to A5 and other grid systems.

📖 [Docs](https://higgicd.github.io/pycnogrid/) • 📦 [Package](https://cran.r-project.org/package=pycnogrid) • 🔗 [Source](https://github.com/higgicd/pycnogrid)

### pydeck
📖 [Docs](https://deckgl.readthedocs.io/en/latest/gallery/a5_layer.html) • 📦 [Package](https://pypi.org/project/pydeck/) • 🔗 [Source](https://github.com/visgl/deck.gl/blob/master/bindings/pydeck/examples/a5_layer.py)

### QGIS
📖 [Guide](https://vgridtools.gishub.vn/) • 📦 [Plugin](https://plugins.qgis.org/plugins/vgridtools/) • 🔗 [Source](https://github.com/opengeoshub/vgridtools)

### raster2dggs
📖 [Quickstart](https://github.com/manaakiwhenua/raster2dggs?tab=readme-ov-file#installation) • 📦 [Package](https://pypi.org/project/raster2dggs/) • 🔗 [Source](https://github.com/manaakiwhenua/raster2dggs)

### spml
Spatial machine learning from [PySAL](https://pysal.org/), with A5 cells for spatial cross-validation.

📖 [Docs](https://pysal.org/spml/) • 📦 [Package](https://pypi.org/project/spml/) • 🔗 [Source](https://github.com/pysal/spml)

### Streamlit
📖 [Demo](https://a5-vs-h3-app-demo.streamlit.app/) • 📦 [Package](https://pypi.org/project/streamlit-hexviz/) • 🔗 [Source](https://github.com/Robert-Ziegltrum/streamlit-hexviz)

### vector2dggs
📖 [Quickstart](https://github.com/manaakiwhenua/vector2dggs?tab=readme-ov-file#installation) • 📦 [Package](https://pypi.org/project/vector2dggs/) • 🔗 [Source](https://github.com/manaakiwhenua/vector2dggs)

## Products

### PowerBI
📖 [Example](https://icon-map.com/blog/30-day-map-challenge-day-17-a-new-tool.html) • 📦 [Plugin](https://marketplace.microsoft.com/en-us/product/power-bi-visuals/tekantislimited1706613112857.iconmap_slicer) • 🔗 [Overview](https://icon-map.com/products/slicer/)

### Other
- [d3geo-dggs](https://github.com/eKerney/d3geo-dggs) 3D [D3 globe](https://ekerney.github.io/d3geo-dggs/) transforming countries into H3 hexagons and A5 pentagons
- [greenpy](https://github.com/sdgresearch/greenpy) Urban greenery metrics pipeline that can aggregate to A5 cells
- [vgrid libraries](https://github.com/opengeoshub) A5 tools & utilities for [MapLibre](https://gishub.vn/pages/dggs/a5/), [pandas](https://vgridpandas.gishub.vn/notebooks/03_a5/), [QGIS](https://github.com/opengeoshub/vgridtools) & more

_Have a library you would like to share? Make an [Issue](https://github.com/felixpalmer/a5/issues)_
