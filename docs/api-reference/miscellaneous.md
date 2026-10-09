# Miscellaneous

### migrate

Converts a cell ID from the legacy v0 A5 index to the format supported by A5 v1+. The mapping is fast because it only operates on the bit representation. The shape and positions of the cells do not change, so there is no need to re-index data from its original coordinates.

**Note this function will be retired in a future version, there is no plan to support the legacy v0 A5 index going forward**

```ts
function migrate(cell: bigint): bigint;
```

#### Parameters

- `cell` **(bigint)** A cell ID from the legacy v0 A5 index

#### Return value

- **(bigint)** The ID of the same cell in the v1 index

#### Example

```ts
import { migrate, hexToU64, u64ToHex } from 'a5-js';

const v0Cell = hexToU64('59c4780000000000'); // Resolution 8 cell in the legacy v0 A5 index
console.log(u64ToHex(migrate(v0Cell)));      // '59c4280000000000'
```
