# Index Encoding

A5 uses a 64-bit unsigned integer to uniquely identify each cell on Earth. This encoding scheme is carefully designed to efficiently store the location and resolution information while maintaining useful properties like spatial locality and hierarchical relationships.

## 64-Bit Structure

The 64 bits are organized into several distinct sections:

```
┌─────────────────────────────────────────────────────────────────┐
│ 6 bits │    Variable bits     │ Marker │   Trailing zeros      │
│ Origin │   Hilbert Curve (S)  │   (1)  │                       │
│Segment │                      │        │                       │
└─────────────────────────────────────────────────────────────────┘
  63-58        57-...              ...          ...-0
```

### Components

1. **Bits 63-58 (6 bits)**: Origin and Segment
   - Encodes which of the 12 pentagonal faces (origins) and which of the 5 segments
   - For resolution 0: directly encodes origin ID (0-11)
   - For resolution ≥ 1: encodes `5 × origin_id + segment` (0-59)

2. **Hilbert Curve Position (S)**: Variable length, 0 to 58 bits
   - For resolution ≥ 2: encodes position along the Hilbert space-filling curve
   - Length = 2 × (resolution - 1) bits
   - Not present for resolution 0 and 1

3. **Resolution Marker**: A single `1` bit
   - The position of this bit encodes the resolution level
   - For resolution < 2: shifts by 1 bit per resolution
   - For resolution ≥ 2: shifts by 2 bits per resolution (accounts for Hilbert curve)

4. **Trailing Zeros**: All remaining bits
   - Pads the integer to 64 bits
   - Allows efficient computation of parents (right-shift) and children (left-shift)

## Examples

Let's look at how different cells are encoded. Using London ([-0.1276, 51.5074]) as our example location:

### Resolution 0: Base Pentagon

```
Cell ID (binary):   011000000000000000000000000000000000000000000000000000000000000
Cell ID (hex):      0x3000000000000000
Decimal:            3458764513820540928

Structure:
  ┌─ Origin/Segment (6 bits): 011000 = origin 3
  │  ┌─ Resolution marker (1 bit): 1
  │  │  ┌─ Trailing zeros (57 bits)
  │  │  │
011000 1 00000000000000000000000000000000000000000000000000000000000
```

At resolution 0, there are only 12 cells covering the entire Earth. The top 6 bits directly encode the origin ID (0-11).

### Resolution 1: Segment

```
Cell ID (binary):   011101000000000000000000000000000000000000000000000000000000000
Cell ID (hex):      0x3a00000000000000
Decimal:            4179340454199820288

Structure:
  ┌─ Origin/Segment (6 bits): 011101 = 29 = (5×3 + 4) = origin 3, segment 4
  │       ┌─ Resolution marker (2 bits): 10
  │       │  ┌─ Trailing zeros (56 bits)
  │       │  │
011101 10 00000000000000000000000000000000000000000000000000000000
```

At resolution 1, each pentagon is divided into 5 segments, giving 60 total cells. The encoding uses `5 × origin_id + segment_id`.

### Resolution 5: Hilbert Subdivision

```
Cell ID (binary):   011101011001000001010100000000000000000000000000000000000000000
Cell ID (hex):      0x3b221500000000000
Decimal:            4267244732121088000

Structure:
  ┌─ Origin/Segment (6 bits): 011101
  │       ┌─ Hilbert S (8 bits): 01100100 = 100
  │       │           ┌─ Resolution marker (2 bits): 01
  │       │           │  ┌─ Trailing zeros (48 bits)
  │       │           │  │
011101 01100100 01 01 01 00000000000000000000000000000000000000000000
```

From resolution 2 onwards, cells use a Hilbert curve for subdivision. At resolution 5:
- Hilbert bits = 2 × (5 - 1) = 8 bits
- This encodes position S along the Hilbert curve within the segment

### Resolution 10: Fine Detail

```
Cell ID (binary):   011101100001100011010110100000000000000000000000000000000000000
Cell ID (hex):      0x3b1869a000000000
Decimal:            4267914910944534528

Structure:
  ┌─ Origin/Segment (6 bits): 011101
  │       ┌─ Hilbert S (18 bits): 100001100011010110 = 136,022
  │       │                     ┌─ Resolution marker (2 bits): 10
  │       │                     │  ┌─ Trailing zeros (38 bits)
  │       │                     │  │
011101 100001100011010110 10 00000000000000000000000000000000000000
```

At resolution 10:
- Hilbert bits = 2 × (10 - 1) = 18 bits
- Allows for 2^18 = 262,144 possible positions per segment

## Resolution Encoding

The position of the resolution marker (the first `1` bit after the data) encodes the resolution level:

| Resolution | Marker Position | Calculation |
|------------|----------------|-------------|
| 0          | Bit 57         | 58 - (0 + 1) = 57 |
| 1          | Bit 56         | 58 - (1 + 1) = 56 |
| 2          | Bit 55         | 58 - (2 + 2) = 56 |
| 3          | Bit 53         | 58 - (4 + 2) = 52 |
| 10         | Bit 38         | 58 - (18 + 2) = 38 |
| 15         | Bit 28         | 58 - (28 + 2) = 28 |
| 30         | Bit -2         | 58 - (58 + 2) = -2 (max) |

The formula is:
- For resolution < 2: `marker_position = 58 - (resolution + 1)`
- For resolution ≥ 2: `marker_position = 58 - (2×(resolution-1) + 2)`

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
- B-tree indexing
- Spatial clustering

Example - nearby cells at resolution 10:
```
Cell 1: 0x3b1869a000000000  (S = 136,022)
Cell 2: 0x3b1869e000000000  (S = 136,023)
Cell 3: 0x3b186a2000000000  (S = 136,024)
```

Notice how the IDs are sequential when cells follow the Hilbert curve.

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

## Resolution Limits

The 64-bit encoding imposes a maximum resolution of 30:

```
6 bits (origin/segment) + 58 bits (Hilbert S) + 2 bits (marker) = 66 bits > 64 bits
6 bits (origin/segment) + 56 bits (Hilbert S) + 2 bits (marker) = 64 bits ✓
```

Therefore:
- Maximum Hilbert bits: 58
- Maximum resolution: 58 / 2 + 1 = 30

At resolution 30, A5 achieves sub-centimeter precision globally.

## Implementation Notes

### Bit Manipulation Constants

```typescript
const HILBERT_START_BIT = 58n;           // Start of data section
const REMOVAL_MASK = 0x3ffffffffffffffn;  // Mask for bits 0-57 (bottom 58 bits)
const ORIGIN_SEGMENT_MASK = 0xfc00000000000000n; // Mask for bits 58-63 (top 6 bits)
const MAX_RESOLUTION = 30;
```

### Extracting Components

To extract origin and segment:
```typescript
const top6Bits = Number(cellId >> 58n);

if (resolution === 0) {
  originId = top6Bits;
  segment = 0;
} else {
  originId = Math.floor(top6Bits / 5);
  segment = top6Bits % 5;
}
```

To extract Hilbert S:
```typescript
if (resolution >= 2) {
  const hilbertLevels = resolution - 1;
  const hilbertBits = BigInt(2 * hilbertLevels);
  const shift = 58n - hilbertBits;
  const S = (cellId & REMOVAL_MASK) >> shift;
}
```

### Computing Resolution

Finding the resolution requires locating the first `1` bit after the data:

```typescript
function getResolution(cellId: bigint): number {
  if (cellId === 0n) return -1; // World cell

  let resolution = 30;
  let shifted = cellId >> 1n;

  // Use bit manipulation to find position of first 1 bit
  // Then map that position back to resolution level
  // (Actual implementation uses optimized bit scanning)

  return resolution;
}
```

## Comparison with Other Systems

Compared to other DGGS systems:

| System | Cell ID Size | Encoding Method | Max Resolution |
|--------|--------------|-----------------|----------------|
| A5     | 64 bits      | Position-based with marker | 30 |
| H3     | 64 bits      | Bit-packed fields | 15 |
| S2     | 64 bits      | Hilbert curve + face | 30 |

A5's encoding is similar to S2 but uses a dodecahedron base instead of a cube, providing more uniform cell areas.

## Further Reading

- See [Platonic Solids](./platonic-solids.md) for the geometric foundation
- See the [Hierarchy API reference](../api-reference/hierarchy.md) for working with parent/child relationships
- See the [Hierarchy example](/examples/hierarchy) for an interactive visualization
