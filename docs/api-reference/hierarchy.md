# Hierarchy

The A5 tiling system supports subdividing the world all the way from the 12 dodecahedron faces at resolution 0 to milimeter-scale leaf cells.

The cells are arranged in a logical hierarchy, with each cell having an integer resolution. Each cell has exactly 4 child cells, at the next resolution level, and one parent cell at the previous resolution level.

Naturally the 12 resolution 0 cells, representing the dodecahedron faces, have no parent and similarly leaf cells no children.

### getResolution

Returns the resolution of an A5 cell

```ts
function getResolution(index: bigint): number;
```

#### Parameters

- `index` **(bigint)** A5 cell identifier

#### Return value

- **(number)** The resolution level of the cell

### cellToParent

Returns the parent cell of an A5 cell. 

```ts
function cellToParent(index: bigint, parentResolution?: number): bigint;
```

#### Parameters

- `index` **(bigint)** A5 cell identifier
- `parentResolution` **(number, optional)** By default one level coarser than input resolution.

#### Return value

- **(bigint)** The parent cell identifier

### cellToChildren

Returns the child cells of an A5 cell.

```ts
function cellToChildren(index: bigint, childResolution?: number): bigint[];
```

#### Parameters

- `index` **(bigint)** A5 cell identifier
- `childResolution` **(number, optional)** By default one level finer than input resolution.

#### Return value

- **(bigint[])** Array of child cell identifiers

### getRes0Cells

Returns resolution 0 cells of the A5 system, which serve as a starting point for all higher-resolution subdivisions in the hierarchy.

```ts
function getRes0Cells(): bigint[];
```

#### Return value

- **(bigint[])** Array of 12 A5 cell identifiers

#### Example

```ts
import { getRes0Cells, cellToChildren } from 'a5-js';

const res0Cells = getRes0Cells();
const res1Cells = res0Cells.flatMap(cell => cellToChildren(cell, 1))
```