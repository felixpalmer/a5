import A5CellInfoBox from 'website-examples/components/a5-cell-info-box';

# Bit Tags

The A5 API passes around 64-bit unsigned integers, which represent:

- [cell IDs](./index-encoding), which are what users will most frequently encounter

and a few special cases:

- the [world cell](./index-encoding#special-case-world-cell),
- the [compaction marker](../api-reference/compaction#coverings-and-the-compaction-marker) that indicates the compaction resolution of a set of compacted cells

All of them share one rule for telling them apart: the **tag**, inspired by [Tagged Pointers](https://en.wikipedia.org/wiki/Tagged_pointer) used in other programming contexts. The API provides [`isValidCell`](../api-reference/cell-info#isvalidcell) and [`isCompactionMarker`](../api-reference/compaction#iscompactionmarker) to easily check 64-bit values.

## The tag

The tag is obtained from a 64-bit integer by reading the number of zeros that follow the last `1`. The tag value is just the count of these zeroes.

The tag is  first thing read when processing a 64-bit value, because it specifies how to interpret the remaining bits. In the mainline case, they represent an A5 cell, and here the tag value also specified the cell resolution.

By exploiting an identity from twos-compliment arithemtic, obtaining the tag is a single, constant-time operation, `value & -value`.

## Tag table


| Tag value            | Tag (low bits)                 | Interpretation                                                        |
|----------------------|--------------------------------|--------------------------------------------------------------|
| 57                   | `1` + 57 zeros                 | Cell at resolution 0                                         |
| 56                   | `1` + 56 zeros                 | Cell at resolution 1                                         |
| 55, 53, …, 3, 1      | `1` + odd number of zeros      | Cell at resolution 2–29, bit `59 - 2r` for resolution `r`    |
| 4, 2, 0              | `10000`, `100`, `1`            | Cell at [resolution 30](./index-encoding#special-case-resolution-30) |
| 64                   | 64 zeros (no space for `1`)    | [World cell](./index-encoding#special-case-world-cell) (resolution -1) | 
| 6                    | `1000000`                      | [Compaction marker](../api-reference/compaction#coverings-and-the-compaction-marker), with quintant 60 |
| 8, 10, ...odd values | `100000000`, `10000000000`...  | Not used: not a valid A5 value                               |

For more information on the index encoding, see [64-Bit Structure](./index-encoding#64-bit-structure)).

### Why this works

A5 has an aperture of 4, in other words the number of cells quadruples in general at every resolution level. Thus two more bits of storage are needed to represent each level. By appending a tag of the form `100...000` after the bit needed to store the cell index we generally end up with an *odd* number of zeroes following the final `1`. Thus binary values that have an even number of zeros are available for specific use cases.


## World Cell Encoding

The [world cell](./index-encoding#special-case-world-cell) is the value `0`. As an encoded index it can be thought of as having:

- No **origin** or **quintant**
- **Resolution -1** one less than the Resolution 0 cells as it acts as their parent
- A **Resolution Tag** shifted so far left that its `1` is pushed off the end, so the tag is all 64 zeros

<A5CellInfoBox cell={0n}/>

## Compaction Marker Encoding

A [covering](../api-reference/compaction#coverings-and-the-compaction-marker) represents a set of cells at given resolution `R` by grouping them into parent cells at a coarser resolution. In order to correctly interpret such a covering it is necessary to supply the resolution `R`, which has been effectively stripped by the compaction procedure. The *compaction marker* is a special 64bit value that encodes the resolution `R` for this purpose.

The resolution is encoded in the 2nd byte of the 64bit value, with the tag value of `6`. In order for the marker to sort after all A5 cells a value of `60` is written into the bits normally reserved for the [origin and quintant](./index-encoding#terminology).

For example, the compaction marker for resolution 10 is `0xf00a000000000040`: quintant 60 (`f0`), resolution 10 (`0a`) and the marker tag (`40`).

<A5CellInfoBox cell={0xf00a000000000040n}/>
