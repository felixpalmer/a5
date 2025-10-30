# Compaction

Compaction is a way to efficiently represent a set of A5 cells by replacing groups of sibling cells with their parent cell. This reduces the number of cells needed to represent a region while maintaining complete coverage.

For example, if you have all 4 children of a cell, you can represent them with just their parent cell. The `compact()` function performs this optimization, and `uncompact()` reverses it by expanding parent cells back into their children.

### compact

Compacts a set of A5 cells by replacing complete groups of sibling cells with their parent cells.

```ts
function compact(cells: bigint[] | BigUint64Array): BigUint64Array;
```

#### Parameters

- `cells` **(bigint[] | BigUint64Array)** Array of A5 cell identifiers to compact

#### Return value

- **(BigUint64Array)** Compacted array of cell identifiers (typically smaller than input)

#### Example

```ts
import { compact, cellToChildren } from 'a5-js';

// Get 4 sibling cells at resolution 3
const parent = 0x2800000000000000n;  // A cell at resolution 2
const children = cellToChildren(parent, 3);

console.log(children.length);  // 4

// Compact them back to the parent
const compacted = compact(children);
console.log(compacted.length);  // 1
console.log(compacted[0] === parent);  // true
```

#### Notes

- The compaction process is recursive - if compacting cells creates complete sibling groups at coarser resolutions, those will also be compacted
- Duplicate cells in the input are automatically removed
- The output is always sorted
- For optimal performance with large datasets, consider using `BigUint64Array` as input

### uncompact

Expands a set of A5 cells to a target resolution by generating all descendant cells.

```ts
function uncompact(cells: bigint[] | BigUint64Array, targetResolution: number): BigUint64Array;
```

#### Parameters

- `cells` **(bigint[] | BigUint64Array)** Array of A5 cell identifiers to uncompact
- `targetResolution` **(number)** The target resolution level for all output cells

#### Return value

- **(BigUint64Array)** Array of cell identifiers, all at the target resolution

#### Example

```ts
import { uncompact } from 'a5-js';

// Start with a cell at resolution 2
const cell = 0x2800000000000000n;

// Uncompact to resolution 5 (3 levels finer)
const expanded = uncompact([cell], 5);

console.log(expanded.length);  // 64 (4^3)

// All cells are at resolution 5
import { getResolution } from 'a5-js';
console.log(getResolution(expanded[0]));  // 5
```

#### Notes

- All output cells will be at exactly the target resolution
- Cells already at the target resolution are passed through unchanged
- Attempting to uncompact to a coarser resolution throws an error
- The expansion is complete - every descendant cell at the target resolution is included

### Working with BigUint64Array

Both `compact()` and `uncompact()` return `BigUint64Array` for optimal performance. This typed array provides:

- Faster iteration and memory access compared to regular arrays
- Array-like methods (`.map()`, `.filter()`, `.slice()`, etc.)
- Efficient interop with TypedArray APIs

```ts
import { compact } from 'a5-js';

const cells = [0x2800000000000000n, 0x2800000000000001n];
const compacted = compact(cells);

// Use like a regular array
for (const cell of compacted) {
  console.log(cell.toString(16));
}

// Convert to regular array if needed
const array = Array.from(compacted);
```

### Performance Tips

- Use `BigUint64Array` as input for large datasets (~12% faster)
- Compact cells before storing or transmitting to reduce data size
- Cache uncompacted results if you need to access them multiple times at the same resolution
