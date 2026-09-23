# ISEA vs DSEA for A5

Comparison of the equal-area arrangements A5 can use, measured with the machinery added
for the [Projection example](examples/website/projection). Snyder's equal-area projection
radiates from one vertex of each face triangle, and a triangle has three vertices, so that
arrangement has **exactly three members**:

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
three. Within the radiating arrangement the space is closed — there is no fourth vertex.

It is not, however, the whole design space: radiating from a vertex is one choice of
cutting family among many. [The parallel small circle
family](#the-parallel-small-circle-family), measured after the recommendation here was
settled, carries less sag than DSEA but is worse on the cusps A5 actually meets and has no
known closed-form inverse. It does not change the recommendation.

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

#### The kink does not take over as cells shrink

The obvious objection to weighting sag over kinks is that a kink angle is resolution
independent while bowing shrinks, so the kink should eventually dominate. It does not.
Measured for DSEA across four resolutions, splitting edges by whether they cross the face
edge:

| res | edges | crossing the face edge | their share of the sag | mean bow, kinked | mean bow, clean | ratio |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | 400 | 25 | 21.4% | 0.04946° | 0.00995° | 5.0× |
| 4 | 1600 | 52 | 17.2% | 0.02213° | 0.00288° | 7.7× |
| 5 | 6400 | 105 | 15.5% | 0.01059° | 0.00076° | 13.8× |
| 6 | 25600 | 193 | 14.7% | 0.00565° | 0.00020° | 28.8× |

A kinked edge's bow halves with each level (it scales as the edge length L, since the angle
is fixed) while a clean edge's quarters (it scales as L², being pure curvature). But kinked
edges number ~2ʳ against ~4ʳ in total, so both contributions to the sag scale as 2⁻ʳ and
**the share stays flat**. The same holds for DPEA, at a higher level: 36.4%, 32.9%, 31.2%,
30.3% over the same resolutions.

What does grow without bound is the last column — a kinked edge is 5× more bent than a
clean one at resolution 3 and 29× at resolution 6, because the clean edges become straight
relative to their own size and the kinked ones do not. That is a statement about the
*shape* of one cell, not about the cost of the grid, and it does not change the ranking:
the fraction is fixed at **0.82% of an edge length under DSEA and 1.13% under DPEA**, at
every resolution, and 2° of turn is well below anything a user perceives. A cell's own
corners are 100–120° turns.

#### A kink is cheap to represent; a curve is not

This is the practical form of the same point. A corner is *exactly* representable with one
extra vertex, placed where the edge crosses the locus — a position A5 knows, since it knows
where its own face edges are. Smooth bowing has no such shortcut and converges only as
1/N² in the number of segments. So on representation cost, which is what the sag figure
actually predicts, the kink is the cheap defect and the bowing is the expensive one.

The one place the kink does dominate is *uniform* tessellation, where its error falls as
1/N against 1/N² for curvature, so at tight enough tolerance the ~2% of kinked edges take
over the vertex budget. That is an argument about a boundary routine — put a vertex at the
crossing — not about which projection to ship.

### The seam closes exactly

A5 projects each face independently and only reaches the reflected triangles when a cell
straddles an edge, which raises the question of whether cells from adjacent faces meet
cleanly there. They do, and the reason is stronger than continuity.

Sampling inside every straddling cell of one origin and asking `lonLatToCell` which cell
each point belongs to:

| resolution | straddling cells | samples on the face | samples beyond the edge | disagreements |
| --- | --- | --- | --- | --- |
| 3 | 24 | 8438 | 1162 | **0** |
| 4 | 48 | 16803 | 2397 | **0** |
| 5 | 105 | 37184 | 4816 | **0** |

Every point inside a cell's planar pentagon — including the eighth of them that lie past
the face edge and are reached through the reflected triangles — is assigned back to that
same cell. No gaps, no overlaps.

The mechanism is that face 0's chart, continued past its edge by the reflection, and face
1's own chart differ by a **rigid motion of the plane**. Over 400 points in the overlap
seen from both faces, all 79800 pairwise distances agree to **4.2e-16**. Since every face
carries the same lattice, a rigid motion that fixes the shared edge carries one lattice
onto the other exactly, so the cell boundaries coincide rather than merely meeting.

C⁰ continuity alone would not give this. A merely continuous join would guarantee the
surface does not tear, but not that two independently projected lattices land on the same
curves. It is the isometry that does that.

**All three Snyder modes close the seam, and close it identically.** Over the same 300
points in the overlap, 44850 pairwise distances each:

| projection | worst distance error | | placement in the neighbour's chart |
| --- | --- | --- | --- |
| DSEA | 1.3e-15 | rigid | reference |
| ISEA | 9.8e-16 | rigid | agrees with DSEA to 1.1e-15 |
| RTSEA | 1.4e-15 | rigid | agrees with DSEA to 1.6e-15 |
| gnomonic | **8.2e-2** | **not rigid** | differs by up to 4.9e-2 |

The three Snyder modes do not merely each produce *a* rigid motion, they produce *the
same* one, so the seam is identical whichever is chosen and the tiling result carries over
unchanged.

### The rotation jump at the face edge *is* the cusp

The two look like separate phenomena and are not. For a curve crossing the face edge
**radially** the curve's direction is ρ̂ itself, so its image is the matrix's first column,
and the angle of that column off φ̂ is what the decomposition calls the rotation. The jump
in rotation and the kink are the same number reached two ways:

| γ | rotation inside | rotation outside | jump | kink measured on the sphere |
| --- | --- | --- | --- | --- |
| 6° | 0.000000 | 0.853306 | 0.8533° | 0.8533° |
| 12° | −0.000000 | 1.637566 | 1.6376° | 1.6375° |
| 18° | −0.000000 | 2.284852 | 2.2849° | 2.2848° |
| 24° | −0.000000 | 2.728760 | 2.7288° | 2.7287° |
| 30° | −0.000000 | 2.903223 | 2.9032° | 2.9033° |

The rotation being exactly *zero* inside is a chart property — ρ̂ happens to lie along a
preserved great circle there — but the *jump* is not: both frames are smooth across the
edge, so a discontinuity measured against them is a genuine discontinuity of the
derivative. It is DSEA's face-edge cusp, and it is what the sag charges DSEA for.

The identification needs **one ruler across the edge**, which is what the single face frame
provides. Measured per-face instead, the two sides use different ρ̂ and the reported jump
stops meaning anything. At γ = 18°:

| at the face edge, γ = 18° | DSEA | ISEA |
| --- | --- | --- |
| kink on the sphere, no chart | **2.2848°** | **0.0000°** |
| rotation jump, single face frame | 2.2853° | 0.0027° |
| rotation jump, own face frame | 0.0000° | −2.1171° |

The own-face row is the warning: it reports no jump where there is a 2.28° kink, and a
2.12° jump where there is none at all.

The same ray crossing the *outer* boundary of the reflected region — a neighbour's own
corner ray, the 18.8° corner locus seen from the other side — kinks much harder:

| kink of a ray at the reflected region's outer edge | γ = 3.6° | 18° | 32.4° |
| --- | --- | --- | --- |
| DSEA | 8.08° | 12.72° | **17.16°** |
| ISEA | 2.41° | 3.82° | 4.88° |
| RTSEA | 6.23° | 8.96° | 13.06° |
| gnomonic | 0.00° | 0.00° | 0.00° |

No A5 cell edge ever reaches that locus (cells abut the quintant boundaries, never cross
them), which is why it costs the index nothing — but it is the largest kink either
projection has.

### Measuring the reflected region in its own face

The figures above measure the whole domain in the central face's chart, which is what the
reflected triangles give and what exposes the seam — the example's *single face frame*,
an opt-in rather than the default. A5 projects every point from *its own* face, twelve
radiating vertices and not one, so the reflected region is more honestly measured in the
neighbour's frame; doing so restores the symmetry exactly, a point and its mirror reporting
identical squash and sign-flipped shear with rotation zero on both sides.

Range over the whole domain, intrinsic frame:

| | measured in this face | measured in its own face |
| --- | --- | --- |
| DSEA rotation | ±2.8704° | **0 exactly (constant)** |
| ISEA rotation | ±8.5408° | ±1.0528° |
| RTSEA rotation | ±4.8908° | ±2.3702° |
| gnomonic scale | −0.3873 … +0.1434 | −0.1575 … +0.1434 |

Measured per-face, DSEA's rotation is identically zero across the *entire* domain, not just
the central face — rays mapping to meridians is a property of the system, not of one face's
chart, and the ±2.87° seen otherwise is that chart being used past the face it belongs to.
This changes none of the cusp results, but the large values in the reflected region should
not be read as distortion the system produces.

### Why the reflection is an exact mirror

The reflected triangle steps twice along the edge midpoint — a true mirror. The code also
builds a *squashed* triangle, stepping 1 + 1/cos(interhedral) = 3.236068, but only to derive
the spherical vertices, never as the planar triangle. Using the squashed one to unproject
instead does not help:

| step along the edge midpoint | cusp at γ = 18° | seam with the neighbour |
| --- | --- | --- |
| 1.849404 (tuned) | **0.0000°** | not rigid, 2.4e-2 |
| **2.000000 (true mirror)** | 2.2848° | **rigid, 1.1e-15** |
| 3.236068 (squashed) | 18.6774° | not rigid, 7.5e-2 |

Squashing makes the cusp eight times worse. Tuning the step does remove it — but only at
the γ it was tuned for, leaving 0.04° to 0.91° elsewhere along the edge, and a single scalar
cannot zero a quantity that varies along the seam.

More decisively, **any step other than the exact mirror breaks the rigid seam**, and with it
the tiling — the same failure mode as gnomonic. The factor of two is not a tuning choice.
It is forced by the requirement that cells from adjacent faces align, and DSEA's face-edge
cusp is the price of that alignment. ISEA avoids the cusp while keeping the mirror, which is
precisely why it wins the sag comparison there.

### And at the vertices

An edge is shared by two faces, but a dodecahedron **vertex** is shared by three, and there
the three charts provably cannot all agree: the dodecahedron's angular defect is 36°, so
unfolding all three faces flat around a vertex leaves a 36° wedge missing. Composing the
three pairwise rigid motions around the vertex gives a 36° rotation, not the identity.

The tiling closes anyway. Rings of points centred exactly on a vertex, tested against the
assigned cell's own planar pentagon — A5's definition of containment, no boundary
approximation — 3600 points per ring, three origins represented:

| distance from the vertex | 500 km | 50 km | 5 km | 0.5 km | 5 m |
| --- | --- | --- | --- | --- | --- |
| outside the assigned cell, res 5 | 0 | 0 | 0 | 0 | 0 |
| outside the assigned cell, res 8 | 0 | 0 | 0 | 0 | 0 |
| outside the assigned cell, res 12 | 0 | 0 | 0 | 0 | 0 |

The defect never bites because **no cell ever wraps a corner**: a straddling cell lies
beyond exactly one of its face's five edges, never two.

| resolution | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- |
| straddling cells | 20 | 40 | 80 | 160 | 320 |
| wrapping two edges | **0** | **0** | **0** | **0** | **0** |

So every cell needs at most one reflection and only ever meets its neighbours across
pairwise seams, each of which is rigid. The three-way disagreement is real but nothing is
ever asked to span it.

**Gnomonic does not close the seam at all.** Two gnomonic charts of a region are related by
a projective map, not a rigid one: it preserves straight lines, which is why its cell edges
stay great circles, but not distance, so the two faces disagree about where a shared
lattice point belongs.

| under gnomonic | gap between the two faces' placement |
| --- | --- |
| mean | **100.5 km** |
| worst | **300.3 km** |

An A5 cell edge is 299 km at resolution 4, so the misalignment is of the order of a whole
cell: gnomonic would tear the grid apart at every face boundary. A second and independent
disqualification on top of not being equal-area — even setting area aside, it cannot tile.

Nor does the asymmetry visible in the raster contradict it: that is measured in the polar
chart centred on *this* face, which has no reason to be symmetric about the face's own
edge. The frame-free quantities are symmetric — σ₁/σ₂ mirrors across the edge to 1e-9 —
while the frame-aligned ones are not, and only the former describe the geometry.

The unfolding the reflections perform — a rotation by exactly −36° — can be continued past
the two triangles A5 uses, to close each vertex with four triangles from every neighbour.
Doing so agrees with A5's reflected chart to 1e-13° wherever the two overlap, changes none
of the distortion figures (per-face, DSEA's rotation is still identically zero, ISEA's
±1.07°, RTSEA's ±2.37°), and makes the ten added triangles come to exactly one face of area
— 1.047198, a twelfth of the sphere — under all three Snyder modes. Under gnomonic they
come to 0.470 of a face, the same failure its reflected region already shows at 0.599
against an exact 1.000.

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

**One caution for the paper.** On angular distortion the ranking reverses: ISEA has the
lower mean Tissot ω, 4.81° against 6.40°, on the same dodecahedral cell structure with only
the radiating vertex changed. Snyder's "the dodecahedron, not the icosahedron, is the most
distortion-free in the equal-area form" is about the choice of *base solid*, not about the
radiating vertex within a fixed dodecahedral arrangement, and a reader may not separate the
two. Make the distinction explicitly or a reviewer will measure ω and find ISEA ahead.

The answer is that ISEA's advantages are sub-perceptual — 4.81° against 6.40° of ω, 3.25%
against 4.03% of edge spread — while its 20× kink advantage is already inside the sag
figure and outweighed there. But that is a judgement about which metric matters rather than
a mathematical dominance, and the paper should say so: a reviewer preferring angular
distortion as the standard DGGS measure would choose ISEA. The argument for DSEA is that
distortion at this magnitude is invisible, whereas the containment disagreement is
something a user can hit, reproduce and file.

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

Measured directly as the turn for a curve crossing each locus at 90°, at ρ = 0.45, ε → 0.
The parallel small circle modes are included here for reference; they are introduced
[below](#the-parallel-small-circle-family), and **which locus is smooth follows the leading
vertex rather than the cutting family** — DPEA is smooth at the bisectors exactly as DSEA
is, IPEA at the face edge exactly as ISEA is, RPEA nowhere like RTSEA. Smoothness across a
seam needs the leading vertex to be shared with the neighbour across it, which is a
property of the vertex, not of how the triangle is cut.

| locus | DSEA | ISEA | RTSEA | DPEA | IPEA | RPEA | gnomonic |
| --- | --- | --- | --- | --- | --- | --- | --- |
| quintant bisector | **smooth** | 0.50-1.39° | 16.7° | **smooth** | 1.34-6.74° | 0.13-2.45° | **none** |
| quintant boundary | 19.41° | **5.90°** | 13.1-14.2° | 4.80-12.77° | 14.1-20.9° | 7.60-11.90° | **none** |
| dodecahedron face edge | 0.86-2.43° | **smooth** | 8.62-9.16° | 0.99-2.92° | **smooth** | 1.94-4.99° | **none** |
| triangle interior (control) | smooth | smooth | smooth | smooth | smooth | smooth | smooth |

For DSEA and ISEA alone, at higher precision and a fixed ρ = 0.45: bisector 0.000124° and
1.355642°, quintant boundary 18.771055° and 5.633866°, face edge 2.284826° and 0.000152°.
RTSEA cusps at all three loci, which is the clearest single statement of why it is
dominated; DSEA and ISEA each cusp at two of the three, on complementary sets. The control
row is the check that the method is sound: crossing the interior of a triangle, where
nothing is glued, every mode reads zero. And DSEA's quintant-boundary figure is
**independent of colatitude** — 19.4018° at every φ from 10° to 35°, to four decimals —
where RTSEA's drifts with it.

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
straight edge falls off linearly with it. Turn in the great-circle tangent of the boundary
at the crossing, across decades of step size:

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

ISEA being smooth here is structural: the corner it radiates from and the edge midpoint are
both shared with the neighbouring face across that edge, so the reflected triangle keeps two
vertices fixed including the radiating one and only the face centre moves. DSEA radiates
from the centre, which is exactly the vertex that does move.

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
directional signal rather than a dramatic one, and [Why the sag is the axis that
matters](#why-the-sag-is-the-axis-that-matters) is where it gets weighed.

**Still not measured: the touches**, where a cell vertex lands on a locus. They are four
times more numerous than the interior crossings, but the boundary already turns at a
vertex, so a kink there changes an existing corner angle rather than adding one, and
quantifying it needs a different treatment. It is the obvious next thing to check before
any claim is made about A5 cell geometry as a whole.

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

## The parallel small circle family

The three projections above are one instance of a more general recipe: the
**slice-and-dice** method of van Leeuwen & Strebe (2006), *A "Slice-and-Dice" Approach to
Area Equivalence in Polyhedral Map Projections*, CaGIS 33(4), 269-286. Sweep a family of
curves across the spherical triangle and a matching family of lines across the plane one,
pairing them so that each cuts off the same fraction of its own triangle's area; then
slide the point along its line so that it cuts its own slice in the same ratio. Any family
of curves gives an exactly equal-area projection. **The family is the design space.**

DSEA, ISEA and RTSEA are the paper's *vertex-oriented great circle* instance, where the
curves radiate from a chosen vertex. The paper's other worked instance runs them
**parallel to a chosen side** instead, as small circles shrinking to a point at the
opposite vertex. That gives a second family of three, indexed the same way:

| leading vertex | great circles radiating from it | small circles parallel to the opposite side |
| --- | --- | --- |
| dodecahedron face centre | DSEA | **DPEA** |
| corner — icosahedron face centre | ISEA | **IPEA** |
| edge midpoint — rhombic triacontahedron face centre | RTSEA | **RPEA** |

P is for parallel, S for Snyder. The paper gives the parallel case in closed form only
where the chosen side is a *leg* of the right triangle — its equations 8-15 need the right
angle at A and the third side running through the pole — which would yield two variants,
not three. Taking the cap area from Gauss-Bonnet instead covers the third side as well:
the area above a cut is the angle sum less pi, less the small circle's geodesic curvature
`tan t` integrated along its length `cos t · dlambda`, which is exactly the `d sin b` term
of the paper's equation 8 arrived at without assuming which side was chosen.

All six round-trip to 1e-13 and hold `R²·sin φ·det J / ρ = 1` to 1e-9, which is the
central-difference floor of the measurement rather than of the projection.

### Angular distortion

Maximum angular deformation 2ω, area-weighted over the face, same recipe as the headline
table (it reproduces the figures there to 2%):

| | DSEA | ISEA | RTSEA | DPEA | IPEA | RPEA |
| --- | --- | --- | --- | --- | --- | --- |
| 2ω, mean | 6.2826° | **4.7711°** | 6.9726° | 5.2411° | 6.8586° | 5.2967° |
| 2ω, max | 10.2430° | **8.0916°** | 10.8549° | 8.2821° | 12.7891° | 8.6990° |

ISEA still leads, but **DPEA is second and beats DSEA** — 17% lower mean, 19% lower max.

### Cusps

Where each of the six is non-smooth is tabulated in [Where each projection is
non-smooth](#where-each-projection-is-non-smooth), since the pattern is the same for both
families: the smooth locus follows the leading vertex.

On worst case over the loci ISEA leads at 5.90°, with DPEA and RPEA beating DSEA's 19.41°.
That ranking does not matter: as [What the cells actually do](#what-the-cells-actually-do)
establishes, no cell edge crosses a quintant boundary at any resolution, so the worst
column above — DSEA's 19.41° and IPEA's 20.87° — is never traversed by anything A5 draws.
The parallel family changes nothing there; its crossing counts are the lattice's, not the
projection's.

Turn in the great-circle tangent of the cell boundary at the crossings that do happen,
resolution 5, 80 bisector and 70 face-edge crossings, refined from 1e-3 to 1e-4:

| | bisector | face edge | total turn |
| --- | --- | --- | --- |
| DSEA | **smooth** | 2.031° | 142° |
| ISEA | 0.166° | **smooth** | **13°** |
| RTSEA | 1.934° | 7.329° | 668° |
| DPEA | **smooth** | 2.647° | 185° |
| IPEA | 0.536° | **smooth** | 43° |
| RPEA | 0.181° | 4.214° | 310° |

**DPEA is worse than DSEA here** — 2.647° against 2.031° — so on the cusps A5 actually
meets, the parallel family does not improve on the radiating one. The ordering is the same
one the radiating family already shows, for the same reason: being smooth at the face edge
is worth more than being smooth at the bisectors, because that is where the expensive
crossings are.

### Sag, and cell edges

Sag area as a fraction of the face — the measure this document argues is decisive, since
it samples the real projected curve and so already contains the kinks:

| resolution | DSEA | ISEA | RTSEA | DPEA | IPEA | RPEA |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | **0.727%** | 1.115% | 0.756% | 0.755% | 0.735% | 0.763% |
| 3 | 0.477% | 0.818% | 0.593% | **0.385%** | 0.395% | 0.401% |
| 4 | 0.273% | 0.479% | 0.366% | **0.196%** | 0.201% | 0.202% |

**All three parallel modes beat DSEA from resolution 3 up, and the margin grows with
resolution**: DPEA against DSEA is 1.24× at resolution 3, 1.39× at 4 and 1.47× at 5
(0.099% against 0.145%). At resolution 2 the cells are too coarse for the effect and DSEA
is marginally ahead. Against ISEA, DPEA carries less than half the sag at resolution 4.

Resolution 4, one origin, 1600 edges:

| | DSEA | ISEA | RTSEA | DPEA | IPEA | RPEA |
| --- | --- | --- | --- | --- | --- | --- |
| mean edge length | 299.1 km | 297.5 km | 299.1 km | 298.2 km | 299.5 km | 298.2 km |
| max / min | 1.174 | **1.126** | 1.169 | 1.136 | 1.194 | 1.139 |
| spread | 4.03% | **3.25%** | 4.12% | 3.42% | 4.33% | 3.41% |
| bowing, mean | 0.0035° | 0.0058° | 0.0052° | 0.0026° | **0.0025°** | 0.0028° |
| bowing, max | 0.0446° | 0.0519° | 0.0884° | 0.0681° | **0.0114°** | 0.0917° |

IPEA is the outlier worth noting separately: it has both the lowest mean bowing and, by a
factor of four over DSEA, much the lowest **maximum** bowing — no badly bent edge anywhere
on the face — while also inheriting ISEA's smooth face edge. Its worst cusp is at the
quintant boundaries, which no cell edge crosses, so it pays for that nowhere the grid can
see.

DPEA carries less sag than DSEA while kinking *more* at the face edge, which looks like a
contradiction and is not. Splitting the sag at resolution 4 by what each edge crosses, the
way this document does above for DSEA and ISEA (1600 edges: 52 cross the face edge, 59 a
bisector, 1489 nothing):

| mean bowing, share of that mode's sag | DSEA | ISEA | DPEA | IPEA | RPEA |
| --- | --- | --- | --- | --- | --- |
| crosses the face edge | 0.0221° (17.2%) | 0.0099° (5.7%) | 0.0304° (32.9%) | **0.0023°** (3.1%) | 0.0448° (46.3%) |
| crosses a bisector | 0.0015° (1.7%) | 0.0021° (1.2%) | **0.0014°** (2.2%) | 0.0047° (5.5%) | 0.0027° (3.6%) |
| **crosses nothing** | 0.0029° (81.2%) | 0.0058° (93.1%) | 0.0017° (64.9%) | 0.0024° (91.3%) | **0.0013°** (50.0%) |

The same argument that settled DSEA against ISEA settles DPEA against DSEA, one level
further out. DPEA's kinked edges are worse and take a larger share of its total — 33%
against DSEA's 17% — but there are only 52 of them, while on the 93% of edges that cross
nothing at all **DPEA is 1.7× straighter than DSEA**. That is where its sag advantage comes
from, and it is the same place DSEA's advantage over ISEA came from.

### Verdict

**DPEA wins the axis this document calls decisive, and loses on the cusps.**

| criterion | DSEA | DPEA | |
| --- | --- | --- | --- |
| **sag area, resolution 4** | 0.273% | **0.196%** | DPEA 1.39× |
| bowing on uncrossed edges, 93% of them | 0.0029° | **0.0017°** | DPEA 1.7× |
| 2ω, mean | 6.2826° | **5.2411°** | DPEA 17% |
| 2ω, max | 10.2430° | **8.2821°** | DPEA 19% |
| edge length spread | 4.03% | **3.42%** | DPEA 15% |
| bowing, mean | 0.0035° | **0.0026°** | DPEA 26% |
| realised cusp at the face edge | **2.031°** | 2.647° | DSEA 1.30× |
| bowing, max | **0.0446°** | 0.0681° | DSEA 1.53× |

**The recommendation is unchanged: DSEA.** DPEA carries less sag, but it loses on the two
things that decide it.

**The inverse.** No closed-form inverse for the parallel family is known — the paper gives
a forward procedure only, for both of its families, and none was found here either — so the
slice step is solved numerically: bracketed Newton, about four evaluations per point,
roughly 2.5× a great circle mode (870 ms against 350 ms for a 384² field). The iteration
count does not grow with resolution, and in fact falls near the apex where the flat-triangle
initial guess becomes exact, so this is a flat multiplier rather than a compounding one. It
is still a first-order cost paid on every projection call forever, against a fraction of a
percent of boundary fidelity. That trade does not need the measurements to be close.

**The realised cusp.** DPEA kinks 2.647° where cell edges cross the face edge against
DSEA's 2.031°, so it is worse on the one defect that stays a fixed fraction of a cell at
every resolution. Its sag advantage comes entirely from the 93% of edges that cross nothing
— which are the edges that become straight relative to their own size anyway.

So DPEA wins an aggregate dominated by edges that end up near-perfect under either
projection, and loses on the edges that do not. Combined with the inverse, that settles it.

Two things worth leaving on the record. The verdict on the inverse is about the state of
the art, not a proof: the great circle family's own closed form is not in the paper either
— it is Brenton Recht's, found later — and until it existed that case would have looked as
transcendental as this one does. And six is still not the whole space; slice-and-dice
admits any cutting family at all, so "there is no seventh variant" would be the same
mistake as "there is no fourth" was.

Measured in `examples/website/projection/parallel.ts`; the library is untouched and still
implements DSEA alone.

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
values do not depend on either chart. The raw coordinate derivative, referred to below as
the chart Jacobian, is used only where the text says so; the interactive example offers the
metric frame alone, since a chart determinant that varies across an exactly equal-area map
is more misleading than it is instructive.

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
5. **DSEA**, held. Reading the paper the method comes from showed that radiating from a
   vertex is one cutting family among many, and that DPEA carries less sag than DSEA — but
   it is worse on the realised cusp and has no known closed-form inverse. Steps 1-4 compared
   three projections carefully and assumed they were all there was, which was wrong; the
   conclusion survived anyway.

Two lessons about cusp figures, both learned the hard way here. A locus the projection is
discontinuous across is only a defect of the *grid* if a cell boundary crosses it, and
A5's never crosses the quintant boundaries — so the largest cusp in every one of these
projections is invisible to the thing being designed. And "this defect is resolution
independent while the others shrink" is not on its own an argument for weighting it: it has
to clear an absolute threshold as well, and 2° of turn in a cell edge does not.

The lesson for anyone revisiting this: a per-crossing kink figure is a ratio over a small
population, and it needs weighting by how many edges are affected before it can be compared
with a field-wide measure.
