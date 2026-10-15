---
description: "The pentagonal tiling behind A5, and how Conway notation relates the Teohedron to geodesic and Goldberg polyhedra."
---

# Teohedron

## Pentagonal tiling

At the heart of A5 is a specific pentagonal tiling. The cells are irregular pentagons which together form a regular pentagon.

<TilingDemo embed="levels" />

A curious property of this tiling is that 12 copies can be arranged in 3D space to form a dodecahedron, which can then be [projected](../../examples/projection) onto a sphere.

<TilingDemo embed="dodecahedron" />

## Conway notation

We call the resulting spherical polyhedron the Teohedron, although it is technically a sequence of ever-refined Teohedra. An alternate way to generate it is by starting with the dodecahedron and applying modifiers to the faces in order to obtain the equivalent topology.

A succinct way to describe these operations is by the use of [Conway Polyhedral notation](https://en.wikipedia.org/wiki/Conway_polyhedron_notation). For the Teohedron we use:

- `D`: the **dodecahedron**
- `o`: the **ortho** operator, which adds extra vertices at face centers and edge midpoints, producing new quadrilateral faces
- `g`: the **gyro** operator, which is similar to **ortho** but it adds one more vertex along the face edge

By convention, the operators are applied right to left, like with matrix multiplication, yielding a progression of: `gD`, `goD`, `gooD`, `goooD` for the A5 series of Teohedra.

<ConwayDemo rows={['teohedron']} />

## Relation to other polyhedral subdivisions

Conway notation gives us an intuitive framework to understand how the A5 grid relates to other grids defined on the sphere, which can be constructed analogously using similar operators:

- `k`: the **kis** operator, which adds one vertex at each face center, producing new triangular faces
- `u`: the **subdivide** operator, which adds extra vertices at edge midpoints, producing new faces (maps one triangle face to 4 triangles)
- `d`: the **dual** operator, which swaps faces for vertices and vice versa

<ConwayDemo rows={['geodesic', 'goldberg']} />

## Related

See also:

- [Conway](../../examples/conway) example
- [Tiling](../../examples/tiling) example
- [Teohedral Curve](../../examples/teohedral-curve) example
