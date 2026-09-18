# ISEA vs DSEA for A5

Comparison of the two equal-area arrangements A5 can use, measured with the machinery
added for the [Jacobian example](examples/website/jacobian). Both radiate Snyder's
equal-area projection from a different vertex of each face triangle:

- **DSEA** — radiates from the dodecahedron **face centre**. A5's current projection.
- **ISEA** — radiates from the dodecahedron **corner**, which is the face centre of the
  dual icosahedron.

The two vertex orderings are cyclic rotations of each other, never swaps, because the
closed-form equal-area projection depends on the winding through its signed triple
product.

Both are **exactly** equal area. `R²·sin φ·det J / ρ` is 1.000000 for both, at the same
sphere radius `R = 1.151102` (the radius at which the sphere's area is twelve face
areas). A5's headline guarantee is untouched either way, so the comparison is entirely
about *shape* distortion and about where the projection is non-smooth.

## Recommendation

**ISEA**, on every measure that reaches the cells.

It has lower distortion everywhere, and — the decisive part — A5's cell boundaries are
kink-free under ISEA and are not under DSEA. The two projections are C¹ across
complementary loci, and ISEA's happens to be the one A5's cells actually cross.

The cost is a breaking change to every cell ID, so this is a release-timing decision, not
a geometry one. The geometry is settled.

## Distortion

Tissot's maximum angular deformation ω, area-weighted over one face. Uniform sampling of
the plane is the correct weighting precisely because the map is equal-area. 200k samples,
excluding points within 1e-3 rad of a cusp where central differences are meaningless.

| ω | DSEA | ISEA |
| --- | --- | --- |
| mean | 6.4429° | **4.8217°** |
| median | 6.4210° | **5.1404°** |
| 95th percentile | 9.4937° | **7.7552°** |
| max | 10.1738° | **8.2720°** |
| max σ₁/σ₂ | 1.19459 | **1.15546** |

| ω at | DSEA | ISEA |
| --- | --- | --- |
| face centre | 4.6403° | 3.7408° |
| edge midpoint | 6.4704° | 6.3777° |
| **corner** | **10.1877°** | **7.0697°** |

ISEA is 25% better on the mean, 19% on the peak, and 31% at the face corner — where three
faces meet and cells are already at their most awkward.

## Where each projection is non-smooth

Each face is projected as ten triangles meeting along the rays at multiples of 36°, and
the whole face is bounded by the dodecahedron edge. That is three distinct loci, and they
behave differently.

Jump in shear across each, intrinsic frame:

| locus | DSEA | ISEA |
| --- | --- | --- |
| quintant bisectors (γ = 0 mod 72°) | **0.000018** (smooth) | 0.092492 |
| quintant boundaries (γ = 36° mod 72°) | 0.353275 | 0.107193 |
| dodecahedron face edge | kinked (see below) | **smooth** (see below) |

Neither projection is smooth everywhere. They are smooth in *different places*, and which
one matters is decided entirely by where the cell tiling goes.

## What the cells actually do

Enumerating every cell of one origin and testing all five edges of each against all ten
rays and against the face boundary:

| resolution | cells | edges | crossings of a **bisector** | crossings of a **quintant boundary** | crossings of the **face edge** | cells straddling the face edge |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | 20 | 100 | — | — | 14 | 10 (50.0%) |
| 3 | 80 | 400 | — | — | 38 | 24 (30.0%) |
| 4 | 320 | 1600 | 40 | **0** | 77 | 48 (15.0%) |
| 5 | 1280 | 6400 | 80 | **0** | 175 | 105 (8.2%) |
| 6 | 5120 | 25600 | 160 | **0** | — | — |
| 7 | 20480 | 102400 | 320 | **0** | — | — |

Two things fall out:

**No cell edge ever crosses a quintant boundary.** Cells abut them — a vertex lands on the
ray and the edge stops. So DSEA's most severe cusp, the 0.353 shear jump on the corner
rays, is never traversed at any resolution. It costs nothing. Every bisector crossing, in
turn, happens at exactly 50.0% along the edge.

**Cells do straddle the dodecahedron face edge**, and there are more of those crossings
than bisector crossings at every resolution. The straddling fraction halves with each
level (50% → 30% → 15% → 8.2%), since the band has fixed width while cells shrink, but it
is never zero and it dominates the kink budget at the resolutions where cells are large.

## The kink is zero, on different loci

A genuine kink is independent of the probe step; the smooth curvature of a projected
straight edge falls off linearly with it. Measuring the turn in the great-circle tangent
of the boundary at the crossing, across decades of step size:

**At quintant bisectors** (50 crossings, resolution 5, ρ > 0.2):

| ε | DSEA mean | DSEA max | ISEA mean | ISEA max |
| --- | --- | --- | --- | --- |
| 1e-2 | 3.647e-2° | 5.772e-2° | 0.072974° | 0.110532° |
| 1e-3 | 3.648e-3° | 5.772e-3° | 0.106685° | 0.150158° |
| 1e-4 | 3.648e-4° | 5.772e-4° | 0.110005° | 0.154803° |
| 1e-5 | 3.649e-5° | 5.773e-5° | 0.110336° | 0.155267° |

DSEA falls off exactly linearly — pure curvature, **kink zero**. ISEA converges on
0.1103° mean, a real kink.

**At the dodecahedron face edge** (172 crossings, resolution 5, clear of a face corner):

| ε | DSEA mean | DSEA max | ISEA mean | ISEA max |
| --- | --- | --- | --- | --- |
| 1e-2 | 1.941e+0° | 3.724e+0° | 3.207e-1° | 1.977e+0° |
| 1e-3 | 1.921e+0° | 3.652e+0° | 3.176e-2° | 1.932e-1° |
| 1e-4 | 1.919e+0° | 3.644e+0° | 3.176e-3° | 1.932e-2° |
| 1e-5 | 1.919e+0° | 3.644e+0° | 3.176e-4° | 1.932e-3° |
| 1e-6 | 1.919e+0° | 3.644e+0° | 3.177e-5° | 1.932e-4° |

Exactly reversed. ISEA falls off linearly — **kink zero** — while DSEA converges on 1.919°
mean and 3.644° max.

That ISEA is smooth here is structural: the corner it radiates from and the edge midpoint
are both shared with the neighbouring face across that edge, so the reflected triangle
keeps two vertices fixed including the radiating one, and only the face centre moves.
DSEA radiates from the centre, which is exactly the vertex that does move.

### Totals

Summed over every crossing at resolution 5, one origin, excluding the face corners:

| | crossings | mean kink | total |
| --- | --- | --- | --- |
| DSEA | 80 bisector + 172 face edge | 0° / 1.919° | **330.1°** |
| ISEA | 80 bisector + 172 face edge | 0.1103° / 0.0003° | **8.9°** |

ISEA carries about 1/37th of DSEA's total kink. Its residual is 17× smaller per crossing
and sits on the rarer locus.

### The face corners

Three crossings at resolution 5 land within 0.02 of a dodecahedron vertex, where three
faces meet. Both projections turn by ~84.4° there (DSEA 84.4237°, ISEA 84.5565°) and some
probes fail outright. This is the angular defect of the polyhedron itself, not a property
of either projection, and it does not discriminate between them. Any polyhedral DGGS that
lets cells reach a vertex has it.

## The structure DSEA has and ISEA does not

Under DSEA, rays of constant γ from the face centre map onto meridians *exactly*: θ is
constant along a ray to 4e-13°. Equivalently the image of ρ̂ is parallel to φ̂, `∂θ/∂ρ` is
identically zero, and the Gram-Schmidt rotation is 0 across the whole face (1.5e-9° at
worst). Under ISEA this breaks: θ spreads 0.95° along a ray and the rotation on the face
rises to 0.79°.

It is elegant but **not load-bearing**: `forwardCartesian` derives the face triangle index
from the *gnomonic* polar, not from the equal-area map, so no code path exploits it.

## Cost of switching

The switch moves the same planar point by up to **56 km** on Earth (mean 12 km) — trivial
against a 7053 km face, but far larger than a cell at any resolution past about 5. Every
cell ID changes meaning: fixtures, all three ports, the DuckDB extension and the published
parquet datasets. The `felix/experimental-isea` branch already carries "Update fixtures to
work with ISEA" and "Update datasets to ISEA versions" commits, so the cost is known
rather than hypothetical.

## Method

All figures produced from `modules/projections/` via the example's own code path, with the
projection selected per-instance (`new DodecahedronProjection('isea')`); the library
default is unchanged and all 509 tests pass. The Jacobian is central-difference with the
stencil stepped clear of the cusps and of the face edge, so it reports the one-sided
derivative on the point's own side rather than averaging across a discontinuity.

Distortion is measured from the **metric** Jacobian — the derivative in local orthonormal
frames, `(dρ, ρ·dγ)` on the plane and `(R·dφ, R·sin φ·dθ)` on the sphere — whose singular
values do not depend on either chart.

Cell geometry comes from `_getPentagon(deserialize(cell))`, which returns the planar
pentagon in face coordinates; the lattice is projection-independent, so the same pentagons
are projected under both modes. Kinks are the turn in the great-circle tangent of the
boundary at the crossing, comparing the one-sided directions either side. Crossings within
1e-3 of the face centre, where all ten rays meet and the polar chart is singular, are
excluded.

Not verified here: the comparison with H3's pentagon cells, which are reported to gain
five kinks on alternate resolutions and be decagons in practice. That should be measured
before being claimed alongside these figures.
