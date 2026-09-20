# ISEA vs DSEA for A5

Comparison of the equal-area arrangements A5 can use, measured with the machinery added
for the [Jacobian example](examples/website/jacobian). Snyder's equal-area projection
radiates from one vertex of each face triangle, and a triangle has three vertices, so the
design space has **exactly three members**:

Each is named for the solid whose face fan it radiates from, following the precedent set
by ISEA and RTSEA. All three decompose into the same 120 Möbius triangles of the
icosahedral symmetry group:

| solid | faces × triangles | radiating vertex, in dodecahedron terms | projection |
| --- | --- | --- | --- |
| dodecahedron | 12 × 10 | the face centre | **DSEA** |
| icosahedron | 20 × 6 | the corner | **ISEA** |
| rhombic triacontahedron | 30 × 4 | the edge midpoint | **RTSEA** |

The three orderings are the cyclic rotations of each other, never swaps, because the
closed-form equal-area projection depends on the winding through its signed triple
product. All three are exactly equal-area and round-trip to 3e-15.

| resolution 4 | DSEA | ISEA | RTSEA |
| --- | --- | --- | --- |
| Tissot ω, mean | 6.4019° | **4.8140°** | 7.0024° |
| Tissot ω, max | 10.1506° | **8.2676°** | 10.9349° |
| edge length spread | 4.03% | **3.25%** | 4.12% |
| sag area | **0.2733%** | 0.4787% | 0.3660% |
| worst gap, as a fraction of an edge | **1.66%** | 1.94% | 3.29% |

**RTSEA is dominated by DSEA** on every measure, and has the worst single excursion of the
three. The design space is closed — there is no fourth variant for anyone to propose.

Both are **exactly** equal area. `R²·sin φ·det J / ρ` is 1.000000 for both, at the same
sphere radius `R = 1.151102` (the radius at which the sphere's area is twelve face
areas). A5's headline guarantee is untouched either way, so the comparison is entirely
about *shape* distortion and about where the projection is non-smooth.

## Recommendation

**DSEA**, on the merits.

The two projections are better on different axes, and the case for DSEA does not rest on
the cost of changing the index. It rests on the fact that only one of those axes has an
observable failure mode.

| criterion | winner | margin |
| --- | --- | --- |
| pointwise shape distortion, mean Tissot ω | ISEA | 25% |
| edge length uniformity | ISEA | spread 3.25% vs 4.03% |
| kink where a cell edge crosses a cusp | ISEA | 20× (0.110° vs 2.205°) |
| **total boundary shape deviation (sag area)** | **DSEA** | **1.75×** (0.273% vs 0.479% of the face) |

The last row is the one that reframes the others, because **the sag measurement already
contains the kinks** — it samples the real projected curve, so a kinked edge shows up as a
larger departure from its great circle. Decomposing the sag area at resolution 4 by what
each edge crosses:

| | edges | DSEA mean bowing | ISEA mean bowing | share of DSEA sag | share of ISEA sag |
| --- | --- | --- | --- | --- | --- |
| crosses the face edge | 40 | 0.0282° | 0.0114° | 16.1% | 4.9% |
| crosses a bisector | 40 | 0.0012° | 0.0026° | 0.9% | 1.0% |
| crosses nothing | 1520 | **0.0029°** | 0.0057° | 82.9% | 94.1% |

DSEA's kinked edges are visibly worse — ten times the bowing of an uncrossed edge — but
there are only forty of them, and they account for 16% of its total. ISEA's kinked edges
contribute 1%. What dominates for both is the 95% of edges that cross nothing at all, and
there **DSEA is twice as straight**.

So ISEA's 20× kink advantage is real but carries little weight, while DSEA's straightness
advantage applies to almost every edge. That is why the two metric families disagree:
Tissot ω measures distortion *at a point*, while sag measures how far the image of a
straight line strays, which depends on how fast the distortion field *varies*. ISEA
distorts less but less evenly.

### Why the sag is the axis that matters

Every consumer that draws or tests an A5 cell will treat it as the polygon through its
vertices, joined by great circles. The sag is **exactly** the region where that polygon and
the true cell disagree: a point inside one and outside the other. It is the same class of
surprise that H3 users report, where a point indexes into a cell it appears to sit outside.

Disputed area, as a percentage of a cell:

| res | cell edge | DSEA | ISEA | RTSEA |
| --- | --- | --- | --- | --- |
| 2 | 1190 km | **0.7275%** | 1.1147% | 0.7560% |
| 3 | 598 km | **0.4771%** | 0.8179% | 0.5933% |
| 4 | 299 km | **0.2733%** | 0.4787% | 0.3660% |
| 5 | 150 km | **0.1454%** | 0.2567% | 0.2043% |
| 6 | 75 km | **0.0748%** | 0.1327% | 0.1085% |

Worst single gap, the furthest a point can sit outside the great-circle polygon and still
be in the cell:

| res | DSEA | ISEA | RTSEA |
| --- | --- | --- | --- |
| 2 | **15.30 km** | 17.37 km | 30.33 km |
| 4 | **4.96 km** | 5.77 km | 9.83 km |
| 6 | **1.26 km** | 1.47 km | 2.51 km |

DSEA is lowest at every resolution on both, and RTSEA has by far the worst single
excursion despite beating ISEA on total area.

The disputed area halves with each resolution — the ratio converges to 0.51 — so this is a
coarse-resolution phenomenon that decays as O(2⁻ʳ) for all three. The worst-case excursion
settles at a resolution-independent **1.69% of an edge length under DSEA, 1.97% under ISEA
and 3.35% under RTSEA**, and the disputed area at about 1.75× in DSEA's favour over ISEA.

### The gnomonic baseline: what equal-area costs

The plain central projection is available as a fourth option. It is not a member of the
Snyder family and is **not equal-area**, but it maps great circles to straight lines, so a
straight planar cell edge is *exactly* a great-circle arc. It is the baseline that shows
what the equal-area property is bought with.

| resolution 4 | area ratio across one face | Tissot ω mean / max | sag area | worst gap |
| --- | --- | --- | --- | --- |
| DSEA | **1.0000 – 1.0000** | 6.404° / 10.151° | 0.27327% | 4.96 km |
| ISEA | **1.0000 – 1.0000** | 4.816° / 8.268° | 0.47873% | 5.77 km |
| RTSEA | **1.0000 – 1.0000** | 7.004° / 10.935° | 0.36601% | 9.83 km |
| gnomonic | 0.6697 – 1.3250 | 5.618° / **13.003°** | **0.00000%** | **0.0000 km** |

Gnomonic is perfect on exactly the axis this document has spent its length on — zero sag,
zero containment disagreement, and no cusps at all — and it is disqualified anyway, because
the area of a cell varies by a factor of **1.98** across a single face. A grid built on it
would have cells at one end of a face nearly twice the true area of those at the other. Its
worst-case angular distortion is also the highest of the four, at 13.0°.

So the trade A5 makes is: give up exact great-circle edges, costing 0.27% of a cell's area
in containment disagreement and a shear discontinuity at the triangle boundaries, in return
for area error of exactly zero rather than ±33%. Stated that way the Snyder family is not a
close call, and the argument among DSEA, ISEA and RTSEA is about how well each recovers
what gnomonic gives away for free.

### Cusps, measured directly

The turn in the boundary direction crossing each locus, measured by projecting points
rather than through the Jacobian, so no difference stencil is involved. Step-independent
values are genuine cusps; values that shrink with the step are smooth curvature:

| locus | DSEA | ISEA | RTSEA | gnomonic |
| --- | --- | --- | --- | --- |
| quintant bisector | smooth | 1.36° | 17.4° | **none** |
| quintant boundary | 18.8° | 5.64° | 13.4° | **none** |
| dodecahedron face edge | 2.28° | smooth | 7.50° | **none** |

RTSEA cusps at all three loci, which is the clearest single statement of why it is
dominated. DSEA and ISEA each cusp at two of the three, on complementary sets.

### Which part of the Jacobian jumps

The decomposition is rotation · shear · scale · squash. Taking Gram-Schmidt on the columns,
`radial` is the length of the first column and `azimuthal` is `det / radial`, so the two
axis scale factors come out as `scale × squash` and `scale / squash` with
`squash = √(radial / azimuthal)` and `scale = √|det|`. In the intrinsic frame `det` is 1,
so the squash is exactly the radial stretch and the azimuthal is its reciprocal.

The cusps are not spread evenly across these four. Measured on both sides of each locus in the intrinsic frame at ρ = 0.45:

| locus | rotation | shear | squash | scale |
| --- | --- | --- | --- | --- |
| any of the ten internal rays | continuous | **jumps, sign-flipped** | continuous | continuous |
| dodecahedron face edge | **jumps** | **jumps** | **jumps** | continuous |

**Scale never jumps**, at any locus, in any of the three projections — agreement to 1e-12.
Equal-area pins it: det is forced to ρ/(R²·sin φ), and ρ and φ are both continuous.

**Across the ten internal rays the cusp is pure shear.** Rotation and squash agree to 1e-12
on either side while the shear flips sign — ±0.165285 for DSEA at a quintant boundary,
±0.011838 for ISEA at a bisector, ±0.153381 for RTSEA at a bisector.

That is forced rather than incidental. The map is continuous *along* a locus, so the jump
Δ = J⁺ − J⁻ annihilates the locus tangent: it is rank one. Along a ray of constant γ that
tangent is ρ̂ itself, so the first column of the matrix is continuous. Gram-Schmidt anchors
both the rotation and the radial scale on that column, so both survive; det is already
fixed, so the azimuthal scale and hence the squash follow. Of the matrix's four degrees of
freedom, three are pinned and the shear is the only one left free to jump.

**At the face edge the tangent is oblique to ρ̂**, so the first column is no longer
protected and rotation, shear and squash all jump together — DSEA by 2.28°, 0.035 and
0.012, RTSEA by 7.5°, 0.11 and 0.039. ISEA is smooth there and jumps in nothing.

### The ordering follows the vertex defect

The measured ranking is the one the vertex-defect argument predicts — quality set by the
defect of the solid the projection is named for:

| projection | solid | vertex defect | disputed area, res 4 |
| --- | --- | --- | --- |
| DSEA | dodecahedron | **36.000°** | **0.2733%** |
| RTSEA | rhombic triacontahedron | 42.825° | 0.3660% |
| ISEA | icosahedron | 60.000° | 0.4787% |

Monotonic, though not proportional — the area-per-degree runs 0.0076, 0.0086, 0.0080. Worth
pinning down for the paper: the rhombic triacontahedron has **two** vertex defects, 42.825°
at its twelve degree-5 vertices and 10.305° at its twenty degree-3 ones. Only the degree-5
figure gives an ordering consistent with the measurement; the degree-3 figure would predict
RTSEA as the best of the three, and it is not.

One caution for the paper. On **angular distortion** the ranking is the other way round:
ISEA has the lower mean Tissot ω, 4.81° against DSEA's 6.40°, measured on the same
dodecahedral cell structure with only the radiating vertex changed. Snyder's "the
dodecahedron, not the icosahedron, is the most distortion-free in the equal-area form" is a
statement about the choice of *base solid*, not about the radiating vertex within a fixed
dodecahedral arrangement, and a reader may not separate the two. The cusp claim holds; the
distortion claim needs the distinction made explicitly, or a reviewer will measure ω and
find ISEA ahead.

Against that, ISEA's advantages are sub-perceptual. A mean Tissot ω of 4.81° against 6.40°
is not something a user can see in a cell; nor is an edge-length spread of 3.25% against
4.03%. And its 20× kink advantage is already inside the sag figure, where it is outweighed:
kinked edges are 2.5% of the population and contribute 16% of DSEA's disputed area, while
the 95% of edges that cross nothing are twice as straight under DSEA.

This is a judgement about which metric matters, not a mathematical dominance, and a paper
should say so. A reviewer preferring angular distortion as the standard DGGS measure would
choose ISEA. The argument for DSEA is that angular distortion at this magnitude is
invisible, whereas the containment disagreement is something a user can hit, reproduce and
file.

This is the fourth position this document has held; see the note at the end.

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


## A note on how this changed

The recommendation moved four times as the measurements got better, which is worth
recording so the reasoning can be audited:

1. **ISEA**, on Tissot distortion alone (25% lower mean ω).
2. **DSEA**, after finding that cell edges never cross a quintant boundary and that DSEA is
   C¹ across the bisectors they do cross. This was wrong: only the ten internal rays had
   been tested, not the dodecahedron face edge.
3. **ISEA**, after finding that cells straddle the face edge, where DSEA kinks by 1.9–2.2°
   and ISEA is smooth.
4. **DSEA**, after measuring the sag — which subsumes both bowing and kinks — and finding
   that kinked edges are a small share of the total, while DSEA is twice as straight on the
   95% of edges that cross nothing.

The lesson for anyone revisiting this: a per-crossing kink figure is a ratio over a small
population, and it needs weighting by how many edges are affected before it can be compared
with a field-wide measure.
