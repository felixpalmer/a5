---
title: Overview
hide_title: true
description: "A5 divides the world into exactly equal-area pentagonal cells at 31 resolutions, each identified by a stable 64-bit integer. What it is for and where to start."
---

import A5Globe from '/images/a5-globe.jpg';

<img src={A5Globe} alt="A5 logo made of pentagonal cells flying onto a globe" style={{width: "100%"}}/>

A5 is a geospatial index that partitions the world into [pentagonal cells](/examples/teohedron). The cells are available at [31 resolution levels](/examples/hierarchy), from a handful covering the whole world down to less than 30mm², and every cell at a given resolution has [exactly the same area](/examples/area). Each cell is identified by a 64-bit integer, which is frozen from v1.0: an A5 cell ID stored today will refer to the same place in the future.

Once data is in cells, very different datasets can be joined, aggregated and compared directly: points can be counted per cell, as with the [density of holiday rentals](/examples/airbnb) across a city, and regions such as countries or parcels of land become [coverings](/docs/api-reference/coverings), sets of cells which support union, intersection and difference.

## Key strengths

- **Equal area, single topology**: every cell is an exactly equal-area pentagon with 5 neighbors, so aggregates are free of bias from unequal cell sizes. See [A5 vs H3](/docs/recipes/a5-vs-h3).
- **Built for big data**: cell IDs follow a [space-filling curve](/examples/teohedral-curve) that never crosses itself, so polygons and coverings are compact ID ranges. Billions of cells can be filled, combined and counted in seconds.
- **Fast & rich API**: high-level functions for [indexing](/docs/api-reference/indexing), [hierarchy](/docs/api-reference/hierarchy), [traversal](/docs/api-reference/traversal) and [coverings](/docs/api-reference/coverings), with a native Rust core.
- **Strong ecosystem**: official libraries for [TypeScript](/docs/quickstart/javascript), [Python](/docs/quickstart/python) and [Rust](/docs/quickstart/rust), with [DuckDB](/docs/quickstart/duckdb), [PostgreSQL](/docs/quickstart/postgresql), R, QGIS and deck.gl integrations. See the [Ecosystem](/docs/ecosystem).

## Where to start

- [Quickstart](/docs/quickstart/javascript): index your first cell in your language of choice
- [Examples](/examples): interactive maps showing A5 in action
- [API Reference](/docs/api-reference/): every function, with snippets in each language
- [What's new](/docs/whats-new): the changes in v1.0

A5 is [open source](https://github.com/felixpalmer/a5) and licensed under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0.txt).
