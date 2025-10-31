import A5CellInfoBox from 'website-examples/components/a5-cell-info-box';

# Index Encoding

A5 uses a 64-bit unsigned integer to uniquely identify each cell on Earth. This encoding scheme is carefully designed to efficiently store the location and resolution information while maintaining useful properties like spatial locality and hierarchical relationships.

## Terminology

Generally the term **cell** is used to describe the pentagonal region that the A5 grid is made up of, but in addition cells at resolutions 0 and 1 have special names as they are stored differently in the index:

- Resolution 0 cells are also called **origins**
- Resolution 1 cells are also called **quintants**
- Resolution 2+ cells are just **cells**
- There is a **World Cell** which can be thought of as having Resolution -1, see [below for more details](#special-case-world-cell)

See [Platonic Solids](./platonic-solids) for more details.

## 64-Bit Structure

The 64 bits are organized into several distinct sections:

```
┌────────────────────────────────────────────────────────┐
│  6 bits  │ Variable bits │   2 bits   │ Trailing zeros │
│  Origin/ │ Hilbert Curve │ resolution │                │
│ Quintant │               │   marker   │                │
└────────────────────────────────────────────────────────┘
  63 - 58       57 - ...        ..          ... - 0
```

### Components

1. **Bits 63-58 (6 bits)**: origin or quintant
   - Encodes which of the 12 pentagonal faces (**origins**) and/or which of the 60 **quintants** the cell is in
   - For resolution 0: directly encodes origin ID (0-11)
   - For resolution ≥ 1: encodes quintant `5 × origin_id + segment` (0-59)

2. **Hilbert Curve Position**: Variable length, 0 to 58 bits
   - For resolution ≥ 2: encodes position along the Hilbert space-filling curve
   - Length = 2 × (resolution - 1) bits
   - Not present for resolution 0 and 1

3. **Resolution Marker (2 bits)**: The right-most `01` or `10` bitpair
   - The position of these bits encodes the resolution level
   - For resolution 0: `10`, resolution 1: `01` (`1` shifts by one bit)
   - For resolution ≥ 2: shifts by 2 bits per resolution (accounts for Hilbert curve)

4. **Trailing Zeros**: All remaining bits
   - Pads the integer to 64 bits
   - Allows efficient computation of parents (right-shift) and children (left-shift)
   - Unambigiously determines which bits are the resolution marker bits

## Examples

Let's look at how different cells are encoded. Using London `-0.1276, 51.5074` as our example location:

### Resolution 0: Origin only

At resolution 0, there are only 12 cells covering the entire Earth. The <span style={{color: '#0066FF', fontWeight: 'bold'}}>top 6 bits</span> directly encode the origin (<span style={{color: '#0066FF', fontWeight: 'bold'}}>000100 = 4</span>).

Notice how all bits are <span style={{color: '#999999', fontWeight: 'bold'}}>zeros</span> after the <span style={{color: '#FF0066', fontWeight: 'bold'}}>'10' resolution marker</span>.

<A5CellInfoBox location={[-0.1276, 51.5074]} resolution={0}/>

### Resolution 1: Quintant (Origin & segment)

At resolution 1, each pentagon is divided into 5 segments, giving 60 total cells. The <span style={{color: '#0066FF', fontWeight: 'bold'}}>top 6 bits</span> encode both origin and segment as (<span style={{color: '#0066FF', fontWeight: 'bold'}}>011000 = 24</span>). This can be decomposed into <span style={{color: '#0066FF', fontWeight: 'bold'}}>5 x 4 + 0 = 24</span>, thus like with resolution 0, we are in origin 4 and in the first segment (as the count starts with 0).

The <span style={{color: '#FF0066', fontWeight: 'bold'}}>resolution marker is now '01'</span>, again followed by <span style={{color: '#999999', fontWeight: 'bold'}}>zeros</span>.

<A5CellInfoBox location={[-0.1276, 51.5074]} resolution={1}/>

### Resolution 5: Hilbert Subdivision

From resolution 2 onwards, cells use a Hilbert curve for subdivision. At resolution 5, the <span style={{color: '#0066FF', fontWeight: 'bold'}}>top 6 bits</span> encode the **quintant**, just like in resolution level 1.

They are followed by the <span style={{color: '#000000', fontWeight: 'bold'}}>8-bit Hilbert value 11010011</span> encoding position along the space-filling curve.

Finally, there is again the <span style={{color: '#FF0066', fontWeight: 'bold'}}>'10' resolution marker</span>, followed by <span style={{color: '#999999', fontWeight: 'bold'}}>zeros</span>.

<A5CellInfoBox location={[-0.1276, 51.5074]} resolution={5}/>

## Index explorer

Click on the interactive map below to change the location to index, and zoom to change the resolution. Notice how the indices of nearby locations are similar, sharing many bits. Likewise, when zooming in most of the bits remain the same, just more bits are added to the <span style={{color: '#000000', fontWeight: 'bold'}}>Hilbert S value</span>.

import HierarchyDemo from 'website-examples/hierarchy/app';

<div style={{margin: '20px 0'}}>
  <HierarchyDemo height="500px" />
</div>

## Special Case: World Cell

A special cell identifier with value `0n` (all 64 bits are zero) represents the entire world. This cell serves as the root of the A5 hierarchy. It is useful for hierarchical operations where you need to represent the root of all cells, such as:
- Traversing the complete cell hierarchy from the top down
- Representing "all cells" in a compact form
- Computing all resolution 0 cells via `cellToChildren(WORLD_CELL, 0)`, or any other resolution

### World Cell Encoding

As an encoded index it can be thought of as having:

- No **origin** or **quintant**
- **Resolution -1** one less than the Resolution 0 cells as it acts as their parent
- A **Resolution Marker** shifted so far left that it disappears, so only the zero padding remains

<A5CellInfoBox location={[-0.1276, 51.5074]} resolution={-1}/>

### World Cell Boundary

A general A5 cell boundary is a set of points which enclose the region represented by that cell. As the World Cell contains the whole world it is not bounded by any points. Thus the boundary returned by `cellToBoundary(0n)` is `[]`, an empty array to represent the fact the region is valid, but unbounded.

*Note that other libraries may need to handle this case specially as not all systems have a concept of a geometry that is the entire globe*

### World Cell Location

Conversely, for completeness `cellToLonLat(0n)` will return `[0, 0]`. While this choice is arbitrary, as the World Cell covers the whole world and thus has no center - it seems the most natural choice as it is the point at the center of many map projections.

## Key Properties

### 1. Hierarchical Relationships

Parent and child relationships can be computed efficiently:

- **Parent**: Right-shift to remove child-specific bits
- **Children**: Left-shift and add child indices

Example (resolution 5 → resolution 4 parent):
```
Child:  011101 01100100 01 0101 00000...  (res 5)
Parent: 011101 011001   01 0001 00000...  (res 4)
                └─ Last 2 bits removed (one Hilbert level)
```

### 2. Spatial Locality

Cells that are geographically close tend to have similar cell IDs, which is excellent for database range queries and spatial clustering.


### 3. Fixed Size

All cell IDs are exactly 64 bits (8 bytes), making them:
- Efficient to store in databases
- Fast to compare and sort
- Compatible with standard integer types in most programming languages

### 4. High resolution

By storing the resolution implicitly and effectively using the first 6 bits to store the quintant, the highest resolution A5 is around 30mm², better than S2 (~1cm²) and H3 (~1m²).