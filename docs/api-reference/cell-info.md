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
