import A5CellInfoBox from 'website-examples/components/a5-cell-info-box';

# Index Encoding

A5 uses a 64-bit unsigned integer to uniquely identify each cell on Earth. This encoding scheme is carefully designed to efficiently store the location and resolution information while maintaining useful properties like spatial locality and hierarchical relationships.

## Terminology

The goal of the indexing system is to provide a unique 64-bit integer for every cell in the system. The system is hierarchical, with cells at a higher resolution levels, always having a parent cell at a lower level, all the way up to the whole planet.

In general, the aperture of the A5 is 4, in other words each resolution level has 4 times as many cells as the preceding level. 

See [Platonic Solids](./platonic-solids) for more details.

## 64-Bit Structure

The 64 bits are organized into several distinct sections:

```
┌──────────────────────────────────────────────────────────────┐
│ 6 bits  │    Variable bits     │   2 bits   │ Trailing zeros │
│ Origin/ │   Hilbert Curve (S)  │ resolution │                │
│Quintant │                      │   marker   │                │
└──────────────────────────────────────────────────────────────┘
  63 - 58        57 - ...              ..          ... - 0
```

### Components

1. **Bits 63-58 (6 bits)**: origin or quintant
   - Encodes which of the 12 pentagonal faces (origins) and which of the 60 quintants the cell is in
   - For resolution 0: directly encodes origin ID (0-11)
   - For resolution ≥ 1: encodes quintant `5 × origin_id + segment` (0-59)

2. **Hilbert Curve Position (S)**: Variable length, 0 to 58 bits
   - For resolution ≥ 2: encodes position along the Hilbert space-filling curve
   - Length = 2 × (resolution - 1) bits
   - Not present for resolution 0 and 1

3. **Resolution Marker**: The right-most `01` or `10` bitpair
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

<A5CellInfoBox
  location={[-0.1276, 51.5074]}
  resolution={0}
/>

### Resolution 1: Quintant (Origin & segment)

At resolution 1, each pentagon is divided into 5 segments, giving 60 total cells. The <span style={{color: '#0066FF', fontWeight: 'bold'}}>top 6 bits</span> encode both origin and segment as (<span style={{color: '#0066FF', fontWeight: 'bold'}}>011000 = 24</span>). This can be decomposed into <span style={{color: '#0066FF', fontWeight: 'bold'}}>5 x 4 + 0 = 24</span>, thus like with resolution 0, we are in origin 4 and in the first segment (as the count starts with 0).

The <span style={{color: '#FF0066', fontWeight: 'bold'}}>resolution marker is now '01'</span>, again followed by <span style={{color: '#999999', fontWeight: 'bold'}}>zeros</span>.

<A5CellInfoBox
  location={[-0.1276, 51.5074]}
  resolution={1}
/>

### Resolution 5: Hilbert Subdivision

From resolution 2 onwards, cells use a Hilbert curve for subdivision. At resolution 5, the <span style={{color: '#0066FF', fontWeight: 'bold'}}>top 6 bits</span> encode the quintant, just like in resolution level 1.

They are followed by the <span style={{color: '#000000', fontWeight: 'bold'}}>8-bit Hilbert S value 11010011</span> encoding position along the space-filling curve.

Finally, there is again the <span style={{color: '#FF0066', fontWeight: 'bold'}}>'10' resolution marker</span>, followed by <span style={{color: '#999999', fontWeight: 'bold'}}>zeros</span>.

<A5CellInfoBox
  location={[-0.1276, 51.5074]}
  resolution={5}
/>

### Index explorer

This allows the resolution to be determined in O(1) time by finding the position of the first `1` bit.

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

Cells that are geographically close tend to have similar cell IDs, which is excellent for:
- Database range queries
- Spatial clustering


### 3. Fixed Size

All cell IDs are exactly 64 bits (8 bytes), making them:
- Efficient to store in databases
- Fast to compare and sort
- Compatible with standard integer types in most programming languages

### 4. Compact Representation

The use of a resolution marker allows variable-length data to fit in a fixed 64-bit space:
- Low resolutions waste more trailing zero bits
- High resolutions use most of the 64 bits for position data
- Maximum resolution is 30 (would need 58 bits for S, plus marker)
