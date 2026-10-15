<img src="https://raw.githubusercontent.com/felixpalmer/a5/main/website/static/images/a5-globe.jpg" alt="A5 logo made of pentagonal cells flying onto a globe" width="100%" />

A5 is a geospatial index that partitions the world into [pentagonal cells](https://a5geo.org/examples/teohedron). The cells are available at [31 resolution levels](https://a5geo.org/examples/hierarchy), from a handful covering the whole world down to less than 30mm², and every cell at a given resolution has [exactly the same area](https://a5geo.org/examples/area). Each cell is identified by a 64-bit integer, which is frozen from v1.0: an A5 cell ID stored today will refer to the same place in the future.

Once data is in cells, very different datasets can be joined, aggregated and compared directly: points can be counted per cell, as with the [density of holiday rentals](https://a5geo.org/examples/airbnb) across a city, and regions such as countries or parcels of land become [coverings](https://a5geo.org/docs/api-reference/coverings), sets of cells which support union, intersection and difference.

## Key strengths

- **Equal area, single topology**: every cell is an exactly equal-area pentagon with 5 neighbors, so aggregates are free of bias from unequal cell sizes. See [A5 vs H3](https://a5geo.org/docs/recipes/a5-vs-h3).
- **Built for big data**: cell IDs follow a [space-filling curve](https://a5geo.org/examples/teohedral-curve) that never crosses itself, so polygons and coverings are compact ID ranges. Billions of cells can be filled, combined and counted in seconds.
- **Fast & rich API**: high-level functions for [indexing](https://a5geo.org/docs/api-reference/indexing), [hierarchy](https://a5geo.org/docs/api-reference/hierarchy), [traversal](https://a5geo.org/docs/api-reference/traversal) and [coverings](https://a5geo.org/docs/api-reference/coverings), with a native Rust core.
- **Strong ecosystem**: official libraries for [TypeScript](https://a5geo.org/docs/quickstart/javascript), [Python](https://a5geo.org/docs/quickstart/python) and [Rust](https://a5geo.org/docs/quickstart/rust), with [DuckDB](https://a5geo.org/docs/quickstart/duckdb), [PostgreSQL](https://a5geo.org/docs/quickstart/postgresql), R, QGIS and deck.gl integrations. See the [Ecosystem](https://a5geo.org/docs/ecosystem).

## Where to start

- [Quickstart](https://a5geo.org/docs/quickstart/javascript): index your first cell in your language of choice
- [DuckDB playground](https://a5geo.org/examples/duckdb-playground): use DuckDB to experiment with A5
- [Examples](https://a5geo.org/examples): interactive examples showcasing the system
- [API Reference](https://a5geo.org/docs/api-reference): every function, with snippets in each language
- [What's new](https://a5geo.org/docs/whats-new): the changes in v1.0

A5 is [open source](https://github.com/felixpalmer/a5) and licensed under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0.txt).

## Links

- Website: [a5geo.org](https://a5geo.org)
- Bugs or feature requests: [GitHub Issues](https://github.com/felixpalmer/a5/issues)
- Questions and discussion: [join the community on Slack](https://join.slack.com/t/a5-3ap4392/shared_invite/zt-35rpdc904-2vcsoikrJKFRJF7ncN1fmw)
