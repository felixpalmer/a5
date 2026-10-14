---
description: "Upgrading to A5 v1: the new cell IDs, migrating stored v0 data, coverings and API changes, and using A5 with deck.gl."
---

import Unmigrated from '/images/unmigrated.png';

# Upgrade Guide

Please see the [v1 announcement](./whats-new) for new features, this page details only potential issues for `v0.x` users.

## Migrating to new cell IDs

v1 is the first stable release of A5, and its cell IDs are permanent: they will not change in future versions.

The cell IDs are **not** the same as in versions `0.x`, however placement and shape of the cells stays the same. If you still have your source data, the simplest method is to just reprocess it with the new library.

Alternatively you can migrate any previously indexed cell IDs use the [`migrate`](./api-reference/miscellaneous#migrate) function.

### Example of unmigrated data

<img src={Unmigrated} style={{width: "100%", maxWidth: "360px"}}/>

v0 cell ids rendered using v1 appear roughly in the same place but are shuffled around in blocks.

## API changes

- [`compact`](./api-reference/compaction#compact) and other functions that produce compacted data now return a compacted set of cells with a [compaction marker](./api-reference/compaction#coverings-and-the-compaction-marker)
- [`uncompact`](./api-reference/compaction#uncompact) no longer takes a resolution parameter, it reads it from the compaction marker
- [`cellToChildren`](./api-reference/hierarchy#celltochildren) now always returns children in curve (ID) order


## Downstream libraries


### deck.gl v9

The [`A5Layer`](https://deck.gl/docs/api-reference/geo-layers/a5-layer) in `@deck.gl/geo-layers` depends on `a5-js` 0.x (`^0.10.0` as of deck.gl 9.4), a range that does not accept v1. Adding `a5-js` v1 to your app therefore installs a second copy, with the layer decoding cells with the old one: v1 IDs render in the wrong place, without any error.

Until deck.gl depends on v1, force a single copy of `a5-js` with your package manager's overrides:

```json
"overrides": {"a5-js": "{{A5_VERSION}}"} // npm
"resolutions": {"a5-js": "{{A5_VERSION}}"} // yarn
"pnpm": {"overrides": {"a5-js": "{{A5_VERSION}}"}} // pnpm
```

### Shimming old data

If your data still uses v0 IDs, they can be cheaply converted at runtime using a shim, for example using the [deck.gl A5Layer](https://deck.gl/docs/api-reference/geo-layers/a5-layer):


```ts
const layer = new A5Layer({
  data: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/sf.bike.parking.a5.json',
  getPentagon: f => migrate(f.pentagon),
});
