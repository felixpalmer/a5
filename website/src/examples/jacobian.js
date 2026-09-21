import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/jacobian/app';

import {makeExample} from '../components';

class JacobianDemo extends Component {
  static title = 'Jacobian of the Projection';

  static code = `${GITHUB_TREE}/examples/website/jacobian`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>
          A single dodecahedron face and its image on the sphere. Hover over either one to see the Jacobian of A5's
          equal-area projection at that point.
        </p>
        <p>
          The domain runs past the face itself. Beyond an edge the projection reflects each of its ten triangles across
          that edge and unprojects onto the neighbouring dodecahedron face, so the plane stays in one face's coordinate
          system while the sphere shows five neighbouring regions. Those reflections cover the mirror image of each
          quintant — two triangles per neighbour — which is the ten-pointed outline drawn dashed. The projection has no
          eleventh triangle to reach the rest of a neighbour with, but the unfolding those reflections perform does; see{' '}
          <em>close the vertices</em> below.
        </p>
        <p>
          The matrix relates the face's polar coordinates (ρ, γ) to the sphere's spherical coordinates (φ, θ), and is
          computed by central differences. The two small diagrams show a unit patch and the parallelogram it is mapped
          to, which is what the matrix amounts to.
        </p>
        <p>
          On the face the first column is vertical: ∂θ/∂ρ is zero because the projection radiates from the face center,
          so rays of constant γ map to meridians of constant θ. That stops holding past the edge, where the radiating
          vertex is a mirrored center rather than this face's own.
        </p>
        <p>
          Area elements are ρ·dρ·dγ on the face and R²·sin φ·dφ·dθ on the sphere, so the determinant on its own is not
          the area scale. Put those weights back and R²·sin φ·det J / ρ is exactly 1 — the equal-area property. That
          holds for one sphere only: R = 1.151102, the radius at which the sphere's area is twelve face areas. The
          dodecahedron A5 is built on circumscribes the unit sphere, so its faces are larger than the spherical
          pentagons they map onto, and the sphere here is drawn at R to match.
        </p>
        <p>
          The decomposition is Gram-Schmidt on the columns, giving rotation · shear · scale · squash. The first column
          alone fixes the rotation and the radial scale; the second then splits into the azimuthal scale and the shear
          left over. The squash is √(radial / azimuthal), the two axes scaled against each other: the radial axis ends
          up scaled by scale × squash and the azimuthal by scale / squash. In the intrinsic frame the determinant is 1,
          so the squash is exactly the radial stretch and the azimuthal is its reciprocal — at the edge midpoint, radial
          1.0582 and azimuthal 0.9450 give squash 1.0582, and above 1 means the radial axis is the stretched one. The
          scale is √|det|. The readout shows squash and scale as ratios, while the raster and the marker beside them
          plot the signed deviation from 1, so that zero sits at the middle of the ramp.
        </p>
        <p>
          In DSEA the rotation is zero across the whole face — 1.2e-9° at worst — for the same reason the first column
          is vertical. It appears only past the face edge, which is why the red channel is black over the pentagon and
          lights up only in the reflected points. That is a property of the map, not of the decomposition: θ is constant
          along every ray of constant γ to 4e-13°, so rays from the face center land on meridians exactly.
        </p>
        <p>
          It does not mean the map never turns. Gram-Schmidt anchors on the first column, and the second does turn — the
          image of γ̂ leans off θ̂ by up to 9.96°, and that lean is exactly what the shear reports: shear = tan(lean), to
          2.4e-11. The polar decomposition, which measures the closest rigid rotation instead, reads up to 4.95° on the
          same face.
        </p>
        <p>
          In DSEA, along the five rays through the edge midpoints the matrix is diagonal and the projection can do
          nothing but squash: rotation below 1e-10° and shear below 6e-6, with the squash running from 1.0179 at the
          face center to 1.0582 at the edge midpoint. All ten rays are mirror lines of the pentagon, and reflection
          symmetry pins the image of ρ̂ to the meridian on any of them, which is why the rotation vanishes on a mirror
          ray in either projection.
        </p>
        <p>
          With the cells drawn, the panel reports their edge lengths — arc lengths of the projected edge as a curve, not
          chords — and their bowing, the greatest angular departure from the great circle through the edge's endpoints.
          The two projections split these: ISEA gives more uniform lengths (spread 3.25% against 4.03% at resolution 4)
          while DSEA gives straighter edges (0.0035° against 0.0058° mean bowing, and 3.5× straighter near a
          dodecahedron vertex).
        </p>
        <p>
          The <em>cells</em> toggle draws A5's own cells over the face at resolution 2, 3 or 4, which shows which of
          those loci a cell boundary can actually reach. No cell edge crosses a quintant boundary at any resolution —
          cells abut them, a vertex landing on the ray and the edge stopping there — so DSEA's most severe cusp is never
          traversed. The crossings that do happen are on the quintant bisectors, always at the midpoint of an edge, and
          DSEA passes through those smoothly.
        </p>
        <p>
          Cells do straddle the dodecahedron face edge, though, and those crossings are exactly as numerous as the
          bisector ones — 10, 20 and 40 of each at resolutions 2, 3 and 4. That is the locus where the two projections
          trade places. DSEA kinks there by 1.919° on average, while ISEA is smooth — its radiating corner and the edge
          midpoint are both shared with the neighbouring face, so only the face centre moves under reflection. Switch
          the projection with the cells drawn to see it.
        </p>
        <p>
          The other five rays, through the corners, are the real cusps in DSEA. There the derivative jumps: the
          one-sided shear is −0.160054 on one side and +0.160054 on the other, exact mirror images. A two-sided stencil
          would average them to zero and report a diagonal matrix that holds on neither side, so the difference stencil
          is stepped clear of both the cusps and the face edge and reports the one-sided derivative on the point's own
          side. Straddling the face edge was worth fixing: it put a spurious rotation of 1.30° into an interior that has
          none at all.
        </p>
        <p>
          The projection toggle switches which vertex of each face triangle the equal-area map radiates from. There are
          three such vertices and so three members of the family, each named for the solid whose face fan it radiates
          from: DSEA the dodecahedron face centre, ISEA the corner, RTSEA the edge midpoint. The fourth option,
          <em>gnomonic</em>, is the plain central projection — not equal-area, but it maps great circles to straight
          lines, so it has no cusps and no sag at all. It is the baseline that shows what equal-area costs: choose it
          with the scale raster to see cell area vary by a factor of two across one face.
        </p>
        <p>
          A5 uses DSEA. The three Snyder orderings are cyclic rotations of each other rather than swaps, since the
          closed-form equal-area projection depends on the winding through its signed triple product, and all three
          decompose into the same 120 Möbius triangles. The library default is unchanged, so cell geometry and the
          fixtures are untouched — the alternatives are built alongside it.
        </p>
        <p>
          Two of the facts above survive the switch between DSEA and ISEA. Both are equal-area, R²·sin φ·det J / ρ =
          1.000000 for the same sphere radius, and in both the frame-free anisotropy σ₁/σ₂ mirrors across a face edge to
          about 1e-9. Gnomonic is neither: its area ratio runs from 0.67 to 1.33 across a single face.
        </p>
        <p>
          The rest are DSEA's alone. Under ISEA the radiating vertex is no longer the face center, so rays from the
          center stop mapping to meridians — θ spreads 0.95° along a ray instead of 4e-13° — and the rotation on the
          face rises from 1.5e-9° to 0.79°, up to 9.98° once the reflected region is included. ISEA also cusps on all
          ten rays rather than five: its one-sided shear jumps ±0.0134 across the edge-midpoint rays where DSEA passes
          through smoothly.
        </p>
        <p>
          By default every point is measured in the frame of the face it belongs to, which is what A5 itself does —
          there are twelve radiating vertices, not one. A point past this face's edge is handed to its neighbour, and a
          point and its mirror then agree exactly: identical squash, sign-flipped shear, rotation zero on both sides.
          Under DSEA the rotation over the whole domain is identically zero this way.
        </p>
        <p>
          <em>Grid from</em> chooses which side of the projection the grid is drawn from. From the <em>plane</em> it is
          the lines of constant ρ and γ, straight and circular on the face and bent on the sphere. From the{' '}
          <em>sphere</em> it is the meridians and parallels of constant θ and φ, straight there and kinked on the face.
          The lines are the same curves either way; what changes is which window the distortion appears in.
        </p>
        <p>
          The sphere side puts the cusps where they are easiest to read. A parallel pulled back onto the face kinks by
          19.4018° where it crosses a quintant boundary under DSEA — and by exactly that at every colatitude from 10° to
          35°, to four decimals — against 5.938° under ISEA and 13.1–14.7° under RTSEA. Crossing a quintant bisector
          instead, DSEA reads 0.0000° and RTSEA 16.75°; crossing the face edge, ISEA reads 0.0000° and DSEA 1.46–3.22°.
          Gnomonic reads zero at all three. Crossing the interior of a triangle, where nothing is glued, every mode
          reads zero, which is the check that the method is sound. Under DSEA and gnomonic a meridian pulls back to an
          exactly straight ray, γ constant along it to 0.000000°, while ISEA leaves 0.93° and RTSEA 0.67°.
        </p>
        <p>
          The grid follows the frame, so that it reads the same way the raster does: each face draws its own rays and
          rings, and the five neighbours radiate from their own centres rather than continuing this one's. Under DSEA
          every one of those rays lands on a meridian of the face it belongs to, longitude constant along it to
          0.000000°, where this face's rays continued outward bend by up to 34.98° over the same region. ISEA and RTSEA
          leave 0.92° and 0.64°, which is their own departure from rays-to-meridians and nothing to do with the fold.
        </p>
        <p>
          <em>Single face frame</em> measures the whole domain in this one face's frame instead, which is what the
          reflected triangles give. That exposes the seam at the face edge, but it exaggerates everything past it, since
          the chart is being used far from the face it belongs to: DSEA's rotation goes from zero to ±2.87° and ISEA's
          from ±1.05° to ±8.54°, none of which is distortion the system actually produces. Its grid is this face's own
          rays, continued outward with it. It is still the frame to use for the cusps: a cusp is a comparison of the two
          sides of a locus and needs one ruler across it. At γ = 18° the kink of a ray crossing the face edge, measured
          on the sphere with no chart at all, is 2.2848° under DSEA and 0.0000° under ISEA — which is what this frame
          reports (2.2853° and 0.0027°) and what the own face frame does not (0.0000° and −2.1171°, the ρ̂ axis having
          turned over between the two sides).
        </p>
        <p>
          <em>Close the vertices</em> adds the other two triangles each neighbour contributes at a corner, ten in all.
          A5's reflections stop at the two that abut the shared edge, but the unfolding they amount to — rotate the
          neighbouring face flat about that edge, a turn of exactly −36° — carries on, and the rest of the neighbour
          comes with it. Inside the reflected region the two agree to 1e-13°, so the added triangles continue the same
          chart rather than replacing it.
        </p>
        <p>
          They bring every dodecahedron vertex of this face up to 108° from this face and 108° from each of the two
          neighbours that meet there: all 324° the solid has. The 36° left over is the vertex's angular defect, and it
          is why the outline notches inward at every corner instead of closing into a decagon. The ten triangles come to
          exactly one face of area between them, 1.047198 — a twelfth of the sphere.
        </p>
        <p>
          Which face <em>maps</em> a point and which frame the answer is <em>written in</em> are separate choices. The
          map has to come from the face the point belongs to — this face's projection saturates past the reflected
          region, the equal-area charts being assembled one triangle at a time with no eleventh to reach further with —
          but the frame need not, and it is the frame alone that the single face option moves. In the own face frame
          DSEA's rotation is identically zero over the whole closed domain, against ±1.05° for ISEA and ±2.35° for
          RTSEA. In the single face frame all three run to about ±17°, this face's chart now being read two faces from
          home. Gnomonic is the exception to the first half: a single central projection covering the whole plane, so
          there the added triangles stay in this face's chart and go on shrinking — its reflected region already covers
          0.599 of a face's area, against exactly 1.000 for all three Snyder modes.
        </p>
        <p>
          The matrix is written in the local orthonormal frames, (dρ, ρ·dγ) on the plane and (R·dφ, R·sin φ·dθ) on the
          sphere, so both sides measure length. Its determinant is then 1 by construction and everything that varies is
          shape. The raw coordinate derivative is not offered: its singular values depend on the charts rather than the
          projection, and its determinant varies across the face even though the map is exactly equal-area, which
          invites precisely the wrong conclusion.
        </p>
        <p>
          All three quantities are measured against the (ρ̂, γ̂) axes, so none of them mirrors across a face edge unless
          the reflected region is measured in its own face: those axes point away from this face's center, not the
          mirrored one. Only σ₁/σ₂ is frame free, and it mirrors exactly either way, agreeing to 9 digits between a
          point and its reflection. It is shown in the readout and is recoverable from the squash, shear and scale, so
          nothing is lost by plotting the frame-aligned split.
        </p>
        <p>
          Switching the frame at a fixed point shows what that means. One point of a reflected triangle under DSEA reads
          rotation 2.5586° with shear −0.0027 and squash 1.0697 in this face's frame, and rotation 0 with shear +0.1350
          and squash 1.0067 in its own — while σ₁/σ₂ is 1.144197289 and the determinant 1 in both. Changing either frame
          is a rotation of an orthonormal basis, so it can only move quantity between the three; the singular values
          cannot move at all. The split is bookkeeping and the invariants are the map, which is why a rotation of zero
          is a statement about the chart — rays landing on meridians — and not a claim that the projection does not
          turn. It does: the image of γ̂ leans up to 9.96° off θ̂ on the face itself, all of it booked as shear.
        </p>
        <p>
          The raster shows one quantity at a time on a diverging ramp, each quantity with its own colour pair — green
          and red for rotation, cyan and orange for shear, blue and yellow for squash, purple and lime for scale — with
          zero at the midpoint and the range symmetric about it. The sign is the point: rotation and shear both flip
          across a cusp, so a cusp is a jump from one extreme to the other and appears as a hard green/red boundary.
          Packing three magnitudes into red, green and blue hid exactly that — the two sides of a cusp came out
          identical. The area scale is not offered: it is 1 everywhere in the intrinsic frame, and in the chart frame
          its variation belongs to the charts rather than the projection, and in the intrinsic frame it is flat for any
          of the Snyder modes — which is what equal-area means, and the legend says so instead of amplifying its noise.
          It is worth choosing for the gnomonic baseline, where it is the whole story. The range ignores the extreme one
          percent at each end, and the dot beside each value in the readout sits on the same range, coloured by the same
          ramp.
        </p>
      </div>
    );
  }

  render() {
    return (
      <div style={{width: '100%', height: '100%', position: 'absolute', background: '#111'}}>
        <App {...this.props} />
      </div>
    );
  }
}

export default makeExample(JacobianDemo, {collapsible: true});
