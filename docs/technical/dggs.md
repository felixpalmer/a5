---
description: "What a Discrete Global Grid System is, and the steps for constructing one."
---

# Discrete Global Grid Systems

There exist many different ways to partition our world into:

- Regions with human names, such as countries, states, cities, etc.
- Regions with numerical identifiers, such as postal codes, census blocks, etc.
- Regions with spatial coordinates, such as latitude and longitude, or x and y coordinates.
- Regions arranged in a grid, such as a square grid or a hexagonal grid.

Some of these methods are inherently *human*, in that they relate to the way we see our world, while others are purely *mathematical*, in that they are based on the geometry of a sphere.

We will focus on the mathematical methods, in particular the [Discrete Global Grid Systems](https://en.wikipedia.org/wiki/Discrete_global_grid).

## Problem Statement

At a high level, in constructing a DGGS, we are trying to split a sphere into a collection of cells, such that:

- The cells are as uniform as possible in shape and area.
- The perimeter of each cell is minimized. In other words, the cells are as close to a circle as possible.
- There are no overlaps or gaps between cells, meaning that we can assign a unique cell to each point on the sphere.

We proceed as follows:

1) Choose a platonic solid which we will use as the base shape to approximate the sphere.
2) Choose a shape which tiles a 2D plane, with a symmetry which matches the symmetry of the platonic solid. For example, if we choose a cube, we can use a square grid.
3) Cover each face of the platonic solid with the tiling of our chosen shape.
4) Project the faces of the platonic solid, and thus the cell tiling onto the sphere.

## The Ideal Cell

It can be shown that no convex polygon with 7 or more sides can tile a plane, so we need to consider polygons with 6 or fewer sides. This leaves us with the following options:

- Triangles
- Squares
- Pentagons
- Hexagons

Of these four, regular triangles, squares and hexagons can be used to tile a plane, and there are many common examples of these, from bathrooms to board games. Pentagons, however often get dismissed due to the fact that the regular pentagon does not tile a plane.

## Why so rigid?

It is worth asking whether we should be restricting ourselves to regular polygons. After all, after constructing the tiling on the faces of the platonic solid, the projection will warp all the cells and thus the resulting shapes on the sphere will be anything but regular. This can be seen in the [area example](/examples/area).

Perhaps it would be better to try to find a [non-regular pentagon](./the-pentagon-that-could) which tiles with a minimal warping of the cells...