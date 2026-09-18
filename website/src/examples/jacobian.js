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
          quintant — two triangles per neighbour — which is the ten-pointed outline drawn dashed. The full neighbouring
          pentagons are not reachable: the projection has no triangle for them.
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
          left over. The squash is √(radial / azimuthal): the two axes scaled against each other, radial by that factor
          and azimuthal by its reciprocal. The scale is √|det|.
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
          The <em>cells</em> toggle draws A5's own cells over the face at resolution 2, 3 or 4, which shows which of
          those loci a cell boundary can actually reach. No cell edge crosses a quintant boundary at any resolution —
          cells abut them, a vertex landing on the ray and the edge stopping there — so DSEA's most severe cusp is never
          traversed. The crossings that do happen are on the quintant bisectors, always at the midpoint of an edge, and
          DSEA passes through those smoothly.
        </p>
        <p>
          Cells do straddle the dodecahedron face edge, though, and there are more of those crossings than bisector
          crossings at every resolution: 20, 48 and 96 against 10, 20 and 40. That is the locus where the two
          projections trade places. DSEA kinks there by 1.919° on average, while ISEA is smooth — its radiating corner
          and the edge midpoint are both shared with the neighbouring face, so only the face centre moves under
          reflection. Switch the projection with the cells drawn to see it.
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
          The <em>dsea</em> and <em>isea</em> toggle switches which vertex of each face triangle the equal-area map
          radiates from. A5 uses DSEA, radiating from the dodecahedron face center; ISEA radiates from the corner, which
          is the face center of the dual icosahedron. The two orderings are cyclic rotations of each other rather than
          swaps, since the closed-form equal-area projection depends on the winding through its signed triple product.
          The library default is unchanged, so cell geometry and the fixtures are untouched — this only builds a second
          projection alongside it.
        </p>
        <p>
          Two of the facts above survive the switch. Both projections are equal-area, R²·sin φ·det J / ρ = 1.000000 for
          the same sphere radius, and in both the frame-free anisotropy σ₁/σ₂ mirrors across a face edge to about 1e-9.
        </p>
        <p>
          The rest are DSEA's alone. Under ISEA the radiating vertex is no longer the face center, so rays from the
          center stop mapping to meridians — θ spreads 0.95° along a ray instead of 4e-13° — and the rotation on the
          face rises from 1.5e-9° to 0.79°, up to 9.98° once the reflected region is included. ISEA also cusps on all
          ten rays rather than five: its one-sided shear jumps ±0.0134 across the edge-midpoint rays where DSEA passes
          through smoothly.
        </p>
        <p>
          The <em>chart</em> and <em>intrinsic</em> toggle decides which frames the matrix is written in. Chart
          differentiates the raw coordinates, so it carries the charts' own distortion. Intrinsic uses the local
          orthonormal frames instead, (dρ, ρ·dγ) on the plane and (R·dφ, R·sin φ·dθ) on the sphere, where the
          determinant is 1 everywhere and the numbers are lengths rather than coordinate steps.
        </p>
        <p>
          All three quantities are measured against the (ρ̂, γ̂) axes, so none of them mirrors across a face edge: those
          axes point away from this face's center, not the mirrored one. Only the singular values are frame free, and
          they do mirror exactly — σ₁/σ₂ agrees to 9 digits between a point and its reflection. It is recoverable from
          the squash, shear and scale, so nothing is lost by plotting the frame-aligned split instead.
        </p>
        <p>
          The raster maps each component over the whole domain to a colour channel — red for rotation, green for shear,
          blue for squash. The area scale is not plotted: it is 1 everywhere in the intrinsic frame, and in the chart
          frame its variation belongs to the charts rather than the projection. Each channel is normalised over its own
          range, ignoring the extreme one percent at each end, and the dot beside each value in the readout shows where
          the hovered point sits in that range.
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
