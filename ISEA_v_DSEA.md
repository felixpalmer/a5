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

**Close, with ISEA ahead on three of four criteria and DSEA winning the fourth.**

| criterion | winner | margin |
| --- | --- | --- |
| angular distortion, mean ω | ISEA | 25% |
| kink where cell edges cross a cusp | ISEA | 20× (0.110° vs 2.205°) |
| edge length uniformity | ISEA | spread 3.25% vs 4.03% |
| edge straightness (bowing) | **DSEA** | 1.7× overall, 3.5× near a dodecahedron vertex |

ISEA's advantages are the larger ones in absolute terms — a 2.2° kink is a visible corner,
where the bowing difference is two thousandths of a degree. But DSEA's straighter edges are
a real property, visible at low resolutions, and they mean fewer great-circle segments are
needed to represent a boundary to a given tolerance.

Neither is dominant. Given that switching costs a breaking change to every cell ID, the
case for moving is weaker than the distortion and kink figures alone suggest, and staying
on DSEA is defensible.

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

Neither projection is smooth everywhere. **ISEA is not cusp-free** — it cusps on all ten
internal rays, including the quintant bisectors. It is smooth only at the dodecahedron face
edge. DSEA is the mirror image of that: smooth on the five bisectors, kinked on the five
quintant boundaries and at the face edge.

Measured directly as the turn for a curve crossing each locus at 90°, at ρ = 0.45, ε → 0:

| locus | DSEA | ISEA |
| --- | --- | --- |
| quintant bisector (γ = 0) | **0.000124° smooth** | 1.355642° cusp |
| quintant boundary (γ = 36°) | 18.771055° cusp | 5.633866° cusp |
| dodecahedron face edge | 2.284826° cusp | **0.000152° smooth** |

These are perpendicular crossings, and they are **not** what the cells experience. Because
the map is continuous *along* a locus, the jump in the Jacobian annihilates the locus
direction: it is rank one, Δ = w ⊗ n, so J⁺d = J⁻d + w(n·d). The kink is the *angle*
between those two, which collapses not when the crossing is shallow but when w happens to
be parallel to J⁻d — the jump is then a pure stretch along the tangent rather than a turn.

Where A5's cells cross, at resolution 5:

| | angle to the locus | kink as cells cross | kink if perpendicular |
| --- | --- | --- | --- |
| ISEA, quintant bisector | 69.7° | **0.1103°** | 1.0768° |
| DSEA, face edge | 20.3° | **2.2052°** | 2.4316° |

Every crossing sits at the same angle, fixed by the lattice symmetry rather than varying
per cell. ISEA's cells cross steeply yet get a tenfold reduction from the perpendicular
figure; DSEA's cross shallowly and get barely ten percent. The layout lands close to the
kink-neutral direction on the ISEA locus and close to the worst one on the DSEA locus.

So the comparison that matters is **0.110° against 2.205°**, a factor of twenty — not the
1.36 against 2.28 the perpendicular probes suggest.

They are smooth in *different places*, and which one matters is decided entirely by where
the cell tiling goes.

## What the cells actually do

Every cell of one origin, all five edges of each, tested against all ten rays and against
the face boundary. One rule throughout: a crossing is **interior** when the edge passes
through with both endpoints strictly off the locus, and a **touch** when an endpoint lies
on it.

| res | cells | edges | bisector (int / touch) | quintant boundary (int / touch) | face edge (int / touch) | straddling |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | 20 | 100 | 10 / 20 | **0** / 50 | 10 / 30 | 50.00% |
| 3 | 80 | 400 | 20 / 60 | **0** / 130 | 20 / 70 | 25.00% |
| 4 | 320 | 1600 | 40 / 140 | **0** / 290 | 40 / 150 | 12.50% |
| 5 | 1280 | 6400 | 80 / 300 | **0** / 610 | 80 / 310 | 6.25% |
| 6 | 5120 | 25600 | 160 / 620 | **0** / 1250 | 160 / 630 | 3.13% |
| 7 | 20480 | 102400 | 320 / 1260 | **0** / 2530 | 320 / 1270 | 1.56% |

Three things fall out:

**No cell edge ever crosses a quintant boundary.** Not at any resolution. Cells abut them —
a vertex lands on the ray and the edge stops, which is what the 2530 touches at resolution 7
are. So DSEA's most severe cusp, the 18.77° turn on the corner rays, is never traversed. The
layout cuts the cells exactly there.

**Bisector and face-edge crossings are equally common**, 320 of each at resolution 7. The
two loci are hit the same number of times, so the comparison comes down entirely to the
kink per crossing.

**Cells straddle the face edge**, at a fraction that halves exactly with each level: 50% →
25% → 12.5% → 6.25% → 3.13% → 1.56%. The band has fixed width while cells shrink. It never
reaches zero.

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

With the two loci hit equally often, the totals are just the per-crossing kinks. At
resolution 7, one origin, 320 crossings of each locus, excluding the face corners:

| | bisector | face edge | total |
| --- | --- | --- | --- |
| DSEA | 320 × 0° | 320 × 2.205° | **706°** |
| ISEA | 320 × 0.110° | 320 × 0° | **35°** |

ISEA carries about 1/20th of DSEA's total kink, and the ratio is resolution independent
since both counts scale together.

Both are small in absolute terms — a 2.2° bend in a cell edge is modest — so this is a
directional signal rather than a dramatic one. But it is a signal, not a tie.

Not measured here: the **touches**, where a cell vertex lands on a locus. They are four
times more numerous than the interior crossings. The boundary already turns at a vertex,
so a kink there is a change to an existing corner angle rather than a new corner, and
quantifying it needs a different treatment than the one used above. It is the obvious next
thing to check before any claim is made about A5 cell geometry as a whole.

### The face corners

Three crossings at resolution 5 land within 0.02 of a dodecahedron vertex, where three
faces meet. Both projections turn by ~84.4° there (DSEA 84.4237°, ISEA 84.5565°) and some
probes fail outright. This is the angular defect of the polyhedron itself, not a property
of either projection, and it does not discriminate between them. Any polyhedral DGGS that
lets cells reach a vertex has it.

## Cell edge length and straightness

Edge lengths are arc lengths of the projected edge treated as a **curve**, not chords:
a polyline sum with a Richardson step, on the unit sphere scaled to Earth's authalic
radius. Bowing is the greatest angular departure of that curve from the great circle
joining its endpoints — zero would mean the edge is exactly a great circle.

Resolution 4, one origin, 1600 edges:

| | DSEA | ISEA |
| --- | --- | --- |
| mean edge length | 299.1 km | 297.5 km |
| range | 272.2 – 319.6 km | 279.3 – 314.5 km |
| max / min | 1.174 | **1.126** |
| spread (coefficient of variation) | 4.03% | **3.25%** |
| bowing, mean | **0.0035°** | 0.0058° |
| bowing, max | **0.0446°** | 0.0519° |
| length excess over the great circle | **19.2 ppm** | 40.5 ppm |

The split is consistent at every resolution tested. **ISEA gives more uniform edge
lengths** — about a quarter less spread, which follows from its lower angular distortion.
**DSEA gives straighter edges** — about 1.7× less bowing, and half the length excess.

Filling the gap between each edge and the great circle joining its vertices gives one
number for the whole face — the total area the projection costs in cell shape:

| sag area, as a fraction of the face | DSEA | ISEA |
| --- | --- | --- |
| resolution 2 | **0.727%** | 1.115% |
| resolution 3 | **0.477%** | 0.818% |
| resolution 4 | **0.273%** | 0.479% |

ISEA costs 1.5× to 1.75× more, and the ratio grows slightly with resolution. (Computed as
the integral of the offset along each edge; it agrees with the drawn triangle strip to
within 1%.)

The straightness gap is widest exactly where it looks widest:

| bowing at resolution 4 | DSEA | ISEA |
| --- | --- | --- |
| near a dodecahedron vertex (n=120) | **0.0055°** | 0.0195° |
| elsewhere (n=1480) | **0.0033°** | 0.0047° |

ISEA bows 3.5× more near a vertex against 1.4× elsewhere, so the visual impression that
ISEA bends cell edges most near the dodecahedron vertices is correct and measurable.

In absolute terms both are small: at resolution 4 the mean bow is 0.6 km under DSEA and
2.2 km under ISEA on a 300 km edge, so 0.2% against 0.7% of the edge. The practical
consequence is representation cost — sagitta falls as 1/N² with N great-circle segments,
so ISEA needs about 1.3× more segments for the same tolerance.

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
