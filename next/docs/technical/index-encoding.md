# Index Encoding

A5 uses a 64-bit unsigned integer to uniquely identify each cell on Earth. This encoding scheme is carefully designed to efficiently store the location and resolution information while maintaining useful properties like spatial locality and hierarchical relationships.

## Terminology

Generally the term **cell** is used to describe the pentagonal region that the A5 grid is made up of, but in addition cells at resolutions 0 and 1 have special names as they are stored differently in the index:

- Resolution 0 cells are also called **origins**
- Resolution 1 cells correspond to **quintants**, one cell per fifth of a dodecahedron face
- Resolution 2+ cells are just **cells**
- There is a [world cell](#special-case-world-cell) which can be thought of as having resolution -1

See [Platonic Solids](https://a5geo.org/next/docs/technical/platonic-solids.md) for more details.

## 64-Bit Structure

The 64 bits are organized into several distinct sections:

```
┌────────────────────────────────────────────────────────┐
│  6 bits  │ Variable bits │   2 bits   │ Trailing zeros │
│  Origin/ │  Curve index  │ resolution │                │
│ Quintant │               │    tag     │                │
└────────────────────────────────────────────────────────┘
  63 - 58       57 - ...        ..          ... - 0
```

### Components

1. **Bits 63-58 (6 bits)**: origin or quintant
   - Encodes which of the 12 pentagonal faces (**origins**) and/or which of the 60 **quintants** the cell is in
   - For resolution 0: directly encodes origin ID (0-11)
   - For resolution ≥ 1: encodes quintant `5 × origin_id + k` (0-59), where `k` (0-4) is the segment's position within its origin

2. **Curve Position**: Variable length, 0 to 58 bits
   - For resolution ≥ 2: encodes position along the [teohedral curve](https://a5geo.org/next/examples/teohedral-curve), A5's space-filling curve
   - Length = 2 × (resolution - 1) bits
   - Not present for resolution 0 and 1

3. **Resolution Tag (2 bits)**: The right-most `01` or `10` bitpair
   - A tag is the bit pattern read first when processing an index: it says how to interpret the remaining bits (see [Bit Tags](https://a5geo.org/next/docs/technical/bit-tags.md))
   - The position of these bits encodes the resolution level
   - For resolution 0: `10`, resolution 1: `01` (`1` shifts by one bit)
   - For resolution ≥ 2: shifts by 2 bits per resolution (two bits per curve level)

4. **Trailing Zeros**: All remaining bits
   - Pads the integer to 64 bits
   - Allows efficient computation of parents (right-shift) and children (left-shift)
   - Unambigiously determines which bits are the resolution tag bits

## Examples

Let's look at how different cells are encoded. Using London `-0.1276, 51.5074` as our example location:

### Resolution 0: Origin only

At resolution 0, there are only 12 cells covering the entire Earth. The <span style={{color: '#0066FF', fontWeight: 'bold'}}>top 6 bits</span> directly encode the origin (<span style={{color: '#0066FF', fontWeight: 'bold'}}>000100 = 4</span>).

Notice how all bits are <span style={{color: '#999999', fontWeight: 'bold'}}>zeros</span> after the <span style={{color: '#FF0066', fontWeight: 'bold'}}>'10' resolution tag</span>.

### Resolution 1: Quintant (Origin & segment)

At resolution 1, each pentagon is divided into 5 segments, giving 60 total cells. The <span style={{color: '#0066FF', fontWeight: 'bold'}}>top 6 bits</span> encode both origin and segment as (<span style={{color: '#0066FF', fontWeight: 'bold'}}>011000 = 24</span>). This can be decomposed into <span style={{color: '#0066FF', fontWeight: 'bold'}}>5 x 4 + 0 = 24</span>, thus like with resolution 0, we are in origin 4, and in the first of its 5 quintants (as the count starts with 0).

The <span style={{color: '#FF0066', fontWeight: 'bold'}}>resolution tag is now '01'</span>, again followed by <span style={{color: '#999999', fontWeight: 'bold'}}>zeros</span>.

### Resolution 5: Curve Subdivision

From resolution 2 onwards, cells are subdivided along the teohedral curve. At resolution 5, the <span style={{color: '#0066FF', fontWeight: 'bold'}}>top 6 bits</span> encode the **quintant**, just like in resolution level 1.

They are followed by the <span style={{color: '#000000', fontWeight: 'bold'}}>8-bit curve value 11101100</span> encoding position along the space-filling curve.

Finally, there is again the <span style={{color: '#FF0066', fontWeight: 'bold'}}>'10' resolution tag</span>, followed by <span style={{color: '#999999', fontWeight: 'bold'}}>zeros</span>.

## Index explorer

Click on the interactive map below to change the location to index, and zoom to change the resolution. Notice how the indices of nearby locations are similar, sharing many bits. Likewise, when zooming in most of the bits remain the same, just more bits are added to the <span style={{color: '#000000', fontWeight: 'bold'}}>curve S value</span>.

## Special Case: Resolution 30

At resolution 30 the curve requires 2 × 29 = 58 bits, and combined with 6 quintant bits that's already 64 — leaving no room for the resolution tag.

The solution is a **virtual 66-bit layout**: when the final 1, 3 or 5 bits of the 64-bit index are set to a special value - before interpreting the index it must be first shifted right and then treated as a *66* bit integer, where the last two bits are `10` as usual.

Depending on the mask, the quintant value is also offset.

| Pattern    | Pattern bits | Shift  | Quintant offset | Quintant range |
|------------|--------------|--------|-----------------|----------------|
| `...1`     | 1            | 1 bits | 0               | 0–31           |
| `...100`   | 3            | 3 bits | 32              | 32–39          |
| `...10000` | 5            | 5 bits | 40              | 40–41          |

Examples:
- <span style={{color: '#0066FF', fontWeight: 'bold'}}>QQQQQ</span><span style={{color: '#000000', fontWeight: 'bold'}}>S...S</span><span style={{color: '#FF0066', fontWeight: 'bold'}}>1</span> (64 bits) becomes <span style={{color: '#0066FF', fontWeight: 'bold'}}>0QQQQQ</span><span style={{color: '#000000', fontWeight: 'bold'}}>S...S</span><span style={{color: '#FF0066', fontWeight: 'bold'}}>10</span> (66 bits) 
- <span style={{color: '#0066FF', fontWeight: 'bold'}}>Q</span><span style={{color: '#000000', fontWeight: 'bold'}}>S...S</span><span style={{color: '#FF0066', fontWeight: 'bold'}}>10000</span> (64 bits) becomes <span style={{color: '#0066FF', fontWeight: 'bold'}}>10100Q</span><span style={{color: '#000000', fontWeight: 'bold'}}>S...S</span><span style={{color: '#FF0066', fontWeight: 'bold'}}>10</span> (66 bits). _Note static offset of 40 (`101000` in binary)._

### Why this works

The trick above exploits the fact that the indexing scheme has some unused values, which can be used to represent the final resolution level. In the general case, an index value will have a `1` followed by an *odd* number of `0`s, e.g. `...1000`. Thus by choosing patterns that have an *even* number of `0`s, we can be sure to avoid collisions and effectively gain an extra two bits. See [Bit Tags](https://a5geo.org/next/docs/technical/bit-tags.md) for how every tag is assigned.

### Quintants beyond 41

Resolution 30 supports only quintants 0–41, as there isn't room for the remaining quintants in the index space. Any quintant value above 41 falls back to resolution 29, gracefully losing one level of precision rather than failing. See the [teohedron example](https://a5geo.org/next/examples/teohedron) for where the quintants lie.

## Special Case: World Cell

A special cell identifier with value `0n` (all 64 bits are zero) represents the entire world. This cell serves as the root of the A5 hierarchy. It is useful for hierarchical operations where you need to represent the root of all cells, such as:
- Traversing the complete cell hierarchy from the top down
- Representing "all cells" in a compact form
- Computing all resolution 0 cells via `cellToChildren(WORLD_CELL, 0)`, or any other resolution

See [World Cell Encoding](https://a5geo.org/next/docs/technical/bit-tags.md#world-cell-encoding) for how it is encoded.

### World Cell Boundary

A general A5 cell boundary is a set of points which enclose the region represented by that cell. As the world cell contains the whole world it is not bounded by any points. Thus the boundary returned by `cellToBoundary(0n)` is `[]`, an empty array to represent the fact the region is valid, but unbounded.

*Note that other libraries may need to handle this case specially as not all systems have a concept of a geometry that is the entire globe*

### World Cell Location

Conversely, for completeness `cellToLonLat(0n)` will return `[0, 0]`. While this choice is arbitrary, as the world cell covers the whole world and thus has no center - it seems the most natural choice as it is the point at the center of many map projections.

## Key Properties

### 1. Hierarchical Relationships

Parent and child relationships can be computed efficiently:

- **Parent**: Clear the last two curve bits and move the resolution tag up two positions
- **Children**: Append each 2-bit child index and move the resolution tag down two positions

Example (resolution 5 → resolution 4 parent):
```
Child:  011000 11101100 10 00000...  (res 5)
Parent: 011000 111011   10 00000...  (res 4)
                     └─ Last 2 curve bits removed (one curve level)
```

### 2. Spatial Locality

Cells that are geographically close tend to have similar cell IDs, which is excellent for database range queries and spatial clustering.

### 3. Fixed Size

All cell IDs are exactly 64 bits (8 bytes), making them:
- Efficient to store in databases
- Fast to compare and sort
- Compatible with standard integer types in most programming languages

### 4. High resolution

By storing the resolution implicitly and effectively using 6 bits for the quintant, A5 dedicates the remaining 58 bits to the curve at its highest resolution. The [virtual 66-bit encoding](#special-case-resolution-30) at resolution 30 squeezes every last bit out of the 64-bit integer, achieving cell areas of around 30mm² — better than S2 (~1cm²) and H3 (~1m²).
