# Cell Info

Functions for obtaining information about A5 cells.

### getNumCells

Returns the number of cells at a given resolution level.

```ts
function getNumCells(resolution: number): number;
```

#### Parameters

- `resolution` **(number)** The resolution level

#### Return value

- **(number)** Number of cells at the given resolution

#### Example

```ts
import { getNumCells } from 'a5-js';

console.log(getNumCells(0)); // 12
console.log(getNumCells(1)); // 60
console.log(getNumCells(2)); // 240
console.log(getNumCells(3)); // 960
```

### cellArea

Returns the area of a cell at a given resolution in square meters. Within a resolution level, all cells
have exactly the same area.

```ts
function cellArea(resolution: number): number;
```

#### Parameters

- `resolution` **(number)** The resolution level

#### Return value

- **(number)** Area of a cell in square meters

#### Example

```ts
import { cellArea } from 'a5-js';

console.log(cellArea(20)); // ~30 m²
```

### cellEdgeLengthAvg

Returns the average edge length of a cell at a given resolution in meters. Individual
edge lengths vary from the average by roughly ±10%, depending on the cell's
shape and its position on the globe.

```ts
function cellEdgeLengthAvg(resolution: number): number;
```

#### Parameters

- `resolution` **(number)** The resolution level

#### Return value

- **(number)** Average edge length of a cell in meters

#### Example

```ts
import { cellEdgeLengthAvg } from 'a5-js';

console.log(cellEdgeLengthAvg(2)); // ~1,190,000 m
console.log(cellEdgeLengthAvg(10)); // ~4,680 m
```

### isValidCell

Checks whether a 64-bit value is an A5 cell. Use it to validate cell IDs from outside sources, such as a file or a database, before passing them to other A5 functions. The [world cell](../technical/index-encoding#special-case-world-cell) is a valid cell: it has no boundary, but `cellToParent` returns it as the parent of the resolution 0 cells. A [compaction marker](./compaction#coverings-and-the-compaction-marker) is not a cell.

```ts
function isValidCell(index: bigint): boolean;
```

#### Parameters

- `index` **(bigint)** Value to check

#### Return value

- **(boolean)** Whether the value is an A5 cell identifier

#### Example

```ts
import { isValidCell, lonLatToCell, hexToU64 } from 'a5-js';

console.log(isValidCell(lonLatToCell([2.35, 48.85], 10)));  // true
console.log(isValidCell(hexToU64('fd00000000000000')));     // false: resolution 1 has no quintant 63
```
