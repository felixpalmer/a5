# Indexing

Functions for converting between geospatial coordinates and A5 indices.

Coordinates are specified as per the [GeoJSON spec](https://www.rfc-editor.org/rfc/rfc7946#section-3.1.1), namely: `[longitude, latitude]`.

### lonLatToCell

Indexes the coordinate at a given resolution to an A5 cell index.

```ts
function lonLatToCell(coordinate: [longitude: number, latitude: number], resolution: number): bigint;
```

#### Parameters

- `coordinate` **(number[])** coordinate as `[longitude, latitude]`
- `resolution` **(number)** The resolution level to index at

#### Return value

- **(bigint)** The A5 cell identifier

### cellToLonLat

Returns the geospatial coordinate at the center of an A5 cell.

```ts
function cellToLonLat(cell: bigint): [longitude: number, latitude: number];
```

#### Parameters

- `cell` **(bigint)** A5 cell identifier

#### Return value

- **(number[])** The center coordinate as `[longitude, latitude]`

### cellToBoundary

Returns the vertices that define the boundary of an A5 cell.

```ts
function cellToBoundary(cell: bigint, options?: {
  closedRing?: boolean;
  segments?: number | 'auto';
}): [longitude: number, latitude: number][];
```

#### Parameters

- `cell` **(bigint)** A5 cell identifier
- `options` **(object)** Optional configuration object
  - `closedRing` **(boolean)** Whether to close the ring by repeating the first point at the end. Defaults to `true`.
  - `segments` **(number | 'auto')** Number of segments to use for each edge. When set to 'auto', uses a resolution-appropriate value. Defaults to 'auto'.

#### Return value

- **(number[][])** Array of coordinates defining the cell boundary, each as `[longitude, latitude]`

## Cell representation

A5 cells are stored as 64 bit integers, for performance and to provide a compact representation for use in databases. In JavaScript these can be represented as [BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt) values and collections stored as [BigInt64Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt64Array)s.

For best performance it is recommened to use this representation, but it is also possible to convert them into hexidecimal, for example to encode them in JSON (which does _not_ support 64 bit integers). Two helper functions are provided for this conversion.

### bigIntToHex

```ts
function bigIntToHex(index: bigint): string;
```

#### Parameters

- `index` **(bigint)** A5 cell identifier

#### Return value

- **(string)** Hexadecimal string representation of the cell identifier

### hexToBigInt

```ts
function hexToBigInt(hex: string): bigint;
```

#### Parameters

- `hex` **(string)** Hexadecimal string representation of an A5 cell identifier

#### Return value

- **(bigint)** The A5 cell identifier