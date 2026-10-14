---
title: A5 v1.0
description: A permanent cell ID system, coverings with set operations, spatial hierarchy functions and faster indexing, in every language.
authors: [felixpalmer]
tags: [release]
draft: true
---

{/* DRAFT: written from CHANGELOG.md, edit freely. Set the date in the folder name to the release date and remove `draft: true` to publish */}

A5 1.0 is here. It brings a new, permanent cell ID system, so data indexed with A5 today stays valid in every future release, along with coverings and set operations, a spatial hierarchy and large speedups across the API.

<!-- truncate -->

## A permanent cell ID system

The cells are numbered along a space-filling curve, the [teohedral curve](/examples/teohedral-curve), which now never crosses itself, and takes a simpler tour through the 12 faces of the dodecahedron. Resolution 1 cells are now pentagons too, so every cell at every resolution has the same shape.

These changes mean v1 cell IDs differ from those in 0.x. They are the last such change: from 1.0 on, a cell ID is permanent.

To upgrade existing data, re-index it from longitude and latitude, or convert the IDs with [`migrate`](/docs/api-reference/miscellaneous#migrate).

## Coverings and set operations

A [covering](/docs/api-reference/coverings) is a set of cells at one resolution, standing for an area of the globe. Functions such as `polygonToCells`, `sphericalCap` and `gridDisk` return coverings in compacted form, ending with a [compaction marker](/docs/api-reference/compaction#coverings-and-the-compaction-marker) that records their resolution, so `uncompact` needs no resolution argument.

Coverings can be combined with `union`, `intersect` and `difference`, tested with `contains` and `overlaps`, and measured with `count` and `area`, all without uncompacting them.

## Spatial hierarchy

`cellToParent` and `cellToChildren` group cells by index. The new [`cellToSupercell`](/docs/api-reference/hierarchy#celltosupercell) and [`cellToSubcell`](/docs/api-reference/hierarchy#celltosubcell) group them by location instead: a finer cell belongs to the coarser cell containing its center, so aggregating to a coarser resolution attributes each value to the cell it actually lies in.

## Faster

{/* TODO: benchmark numbers */}

`polygonToCells` now fills polygons from their boundary alone, and `gridDisk`, `sphericalCap` and `lineStringToCells` have all been optimized. The slow spiral search in `lonLatToCell` is gone.

## Every language

A5 1.0 is released for TypeScript, Python and Rust, with the same API in each. Support in the DuckDB extension and the a5R package for R follows. {/* TODO: status of DuckDB and R */}

```bash
npm install a5-js@{{A5_VERSION}}
pip install pya5=={{A5_PYPI_VERSION}}
cargo add a5@{{A5_VERSION}}
```

AI coding agents can read the documentation in their language via [llms.txt](pathname:///llms.txt).

The full list of changes is in the [changelog](https://github.com/felixpalmer/a5/blob/main/CHANGELOG.md).
