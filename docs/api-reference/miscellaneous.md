# Miscellaneous

### migrate

Converts a cell ID from the legacy v0 A5 index to the format supported by A5 v1+. The mapping is fast because it only operates on the bit representation. The shape and positions of the cells do not change, so there is no need to re-index data from its original coordinates.

**Note this function will be retired in a future version, there is no plan to support the legacy v0 A5 index going forward**

TypeScript / JavaScript:

```ts
function migrate(cell: bigint): bigint;
```

Python:

```python
def migrate(cell: int) -> int
```

Rust:

```rust
pub fn migrate(cell: u64) -> Result<u64, String>
```

DuckDB:

```sql
a5_migrate(cell UBIGINT) -> UBIGINT
```

R:

```r
a5_migrate(cell)
```

#### Parameters

- `cell` **(bigint)** A cell ID from the legacy v0 A5 index

#### Return value

- **(bigint)** The ID of the same cell in the v1 index

#### Example

TypeScript / JavaScript:

```ts
import { migrate, hexToU64, u64ToHex } from 'a5-js';

const v0Cell = hexToU64('59c4780000000000'); // Resolution 8 cell in the legacy v0 A5 index
console.log(u64ToHex(migrate(v0Cell)));      // '59c4280000000000'
```

Python:

```python
from a5 import migrate, hex_to_u64, u64_to_hex

v0_cell = hex_to_u64('59c4780000000000')  # Resolution 8 cell in the legacy v0 A5 index
print(u64_to_hex(migrate(v0_cell)))       # '59c4280000000000'
```

Rust:

```rust
use a5::{hex_to_u64, migrate, u64_to_hex};

let v0_cell = hex_to_u64("59c4780000000000")?; // Resolution 8 cell in the legacy v0 A5 index
println!("{}", u64_to_hex(migrate(v0_cell)?)); // 59c4280000000000
```

DuckDB:

```sql
-- Resolution 8 cell in the legacy v0 A5 index
SELECT a5_u64_to_hex(a5_migrate(a5_hex_to_u64('59c4780000000000')));  -- '59c4280000000000'
```

R:

```r
library(a5R)

v0_cell <- a5_cell("59c4780000000000")  # Resolution 8 cell in the legacy v0 A5 index
a5_u64_to_hex(a5_migrate(v0_cell))      # "59c4280000000000"
```
