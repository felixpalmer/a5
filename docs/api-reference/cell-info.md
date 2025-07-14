# Cell Info

Functions for working with A5 cell information and metadata.

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

Returns the area of a cell at a given resolution in square kilometers.

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

console.log(cellArea(0)); // ~42,506,000 km² 1 12th of world's surface
```