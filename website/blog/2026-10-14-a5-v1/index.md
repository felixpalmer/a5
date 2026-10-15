---
title: A5 v1.0
description: A permanent cell ID system, coverings with set operations, spatial hierarchy functions and faster indexing, in every language.
authors: [felixpalmer]
tags: [release]
---

![A5 logo made of pentagonal cells flying onto a globe](./a5globe.jpg)

It has been 18 months since the first announcement of A5. What started off as an experiment in visualization (and an obsession with pentagons) has grown into a useful tool, with a wealth of [libraries, tools and software](/docs/ecosystem) building on top.

Today I'm excited to announce that the `v1.0` version of A5 is out, bringing a [powerful set of features and performance improvements](/docs/whats-new) as well as [crystallizing the grid and index definition](/docs/upgrade-guide) for the future.

<!-- truncate -->

If you're new to A5, in a nutshell it is a grid system that allows the representation of any position, line or polygon region on the globe as a compact 64-bit integer. The industry term for this is a DGGS, and there are already a number of other systems out there which are powering some of the world's largest companies and data analytics pipelines. For a concrete example of an application, take a look at the [FIRMS Explorer](https://portolan-mirrors.github.io/firms-catalog/) which uses A5 to aggregate 631 million fires worldwide since November 2000.

<img src={require('./firms.jpg').default} alt="FIRMS Explorer: fire detections worldwide aggregated to A5 cells" style={{width: "100%", maxWidth: "600px"}}/>

## Powerful data analytics

### Compacted data processing

New in `v1.0` is a whole new set of functions for working with collections of cells, known as [coverings](/docs/api-reference/coverings).

<img src={require('./coverings.jpg').default} alt="A covering built with set operations, drawn as its compacted cells" style={{width: "100%", maxWidth: "600px"}}/>

### Equal area

One of the key strengths of A5 has always been the guarantee that every cell is **exactly** the same area at a given resolution, which means that any analysis run using the system is [free of bias](/docs/recipes/a5-vs-h3) due to unequal cell sizes. Newly in `v1.0`, all the cells at all resolutions have the same pentagonal topology - unlike a common limitation of hexagon-cell systems which must include 12 pentagonal cells, which complicate the topology and break the pure equal-area guarantee.



### Vibrant ecosystem

One of the important characteristics of a grid system is its support across a range of tools and software, both in industry and academia. By standardizing on a definition of the grid and cell identifiers, it is easy to move data between systems and applications. For example, the FIRMS explorer above was built using:

- [Geoparquet.io](https://geoparquet.io/) to [aggregate](https://geoparquet.io/concepts/spatial-indices/?h=a5#a5-cells) the data: `gpio add a5 input.parquet output.parquet --resolution 15`
- [Portolan](https://www.portolan-sdi.org/) to host
- a5-js and the [A5Layer](https://deck.gl/docs/api-reference/geo-layers/a5-layer) in deck.gl to visualize

Along with a raft of implementations in popular systems, such as [DuckDB](https://query.farm/products/extensions/a5/), [R](https://belian-earth.github.io/a5R/dev/index.html), [Python](https://github.com/felixpalmer/a5-py) and more, having a common standard for

### Under the hood

Over the past 18 months, the design of A5 has been refined - both from the point of view of internals, low-level geometry and algorithms as well as the APIs exposed to make the life of developers easier.

The key change that the majority of the other improvements flow from is the implementation (and well, discovery!) of a [new space-filling curve](/examples/teohedral-curve), which defines the order in which the cells are indexed. The new curve passes around the whole world, without ever intersecting itself while also grouping cells such that they form a spatial hierarchy.

![The teohedral curve touring the 12 faces of the dodecahedron](./teohedral-curve.jpg)

The fact that it doesn't self-intersect is crucial to some of the algorithms that can be built on top. For example when filling a polygon with cells we can immediately deduce which cells are on the interior of the region without having to perform a costly flood fill. The benchmarks below are instructive:

![polygonToCells time against the number of cells in the result, for old and new A5, H3 and S2](./polygon-perf.jpg)

Prior to v1, A5 couldn't handle polygon fills with over a million cells, with the runtime going through the roof. The same is true of [H3](https://h3geo.org/) today. By contrast, [S2](https://s2geometry.io/) is able to handle up to a billion cells without any issues, as is the new version of A5. It is no coincidence that S2 also uses a space-filling curve ([Hilbert](https://en.wikipedia.org/wiki/Hilbert_curve)) which doesn't self-intersect, while H3 does not.

Similar algorithmic tricks can be used to speed up other operations, like intersections or area counts. For an interactive example of these operations, see the [Coverings](/examples/coverings) example.
