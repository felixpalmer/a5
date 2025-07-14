# Cell Info

Functions for working with A5 cell information and metadata.

### getRes0Cells

Resolution 0 cells are the foundational cells of the A5 system, serving as a starting point for all higher-resolution subdivisions in the hierarchy.

```ts
function getRes0Cells(): bigint[];
```

#### Return value

- **(bigint[])** Array of 12 A5 cell identifiers representing the dodecahedron faces

#### Example

```ts
import { getRes0Cells, cellToChildren } from 'a5-js';

const res0Cells = getRes0Cells();
const res1Cells= res0Cells.flatMap(cell => cellToChildren(cell, 1));

```

## Resolution 0 Cells
