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
          The Jacobian is discontinuous across the face edge. Crossing it at γ = 18°, ∂θ/∂ρ jumps from 0 to 0.068 and
          the rotation from 1.49° to 3.59°, while the scale passes through unchanged. The area check holds on both
          sides.
        </p>
        <p>
          The matrix relates the face's polar coordinates (ρ, γ) to the sphere's spherical coordinates (φ, θ), and is
          computed by central differences. The two small diagrams show a unit patch and the parallelogram it is mapped
          to, which is what the rotation, shear and scaling in the matrix amount to.
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
          The decomposition splits the matrix into the three deformations it performs, using the polar decomposition =
          rotation · stretch: the rotation is the closest rigid rotation, the shear is the anisotropy σ₁/σ₂ − 1 (zero
          where a small circle stays a circle) and the scale is √|det|. The Gram-Schmidt decomposition is not used, as
          its rotation is identically zero for the reason above.
        </p>
        <p>
          The <em>chart</em> and <em>intrinsic</em> toggle decides which frames that matrix is written in. Chart
          differentiates the raw coordinates, so it carries the charts' own distortion: both are centred on this face,
          and reflecting across a face edge is not a symmetry of either. A point and its mirror therefore disagree — (ρ
          0.5500, γ 10.00°) reads rotation 0.71°, shear 0.076, while its mirror at (0.7010, 7.83°) reads 1.69° and
          0.082.
        </p>
        <p>
          Intrinsic writes the same derivative in the local orthonormal frames instead, (dρ, ρ·dγ) on the plane and
          (R·dφ, R·sin φ·dθ) on the sphere. Its singular values do not depend on either chart, so they are the
          projection's own distortion, and they mirror exactly: both of those points read shear 0.105602, agreeing to 9
          digits across the whole face. The reflected triangles really are mirror images — the squash that builds them
          is applied only when deriving the spherical triangle, never to the planar one, which is reflected by a factor
          of exactly 2.
        </p>
        <p>
          In the intrinsic frame the determinant is 1 everywhere, so its scale channel is constant and is drawn as such.
          That is also why the area element shows no cusp at the face edge in either frame: equal-area pins det J to ρ /
          (R²·sin φ), and ρ and φ are both continuous across the edge, so det J must be too. Only the shape is free to
          jump, and it does — ∂θ/∂ρ leaves zero and the rotation more than doubles.
        </p>
        <p>
          The raster maps the magnitude of each component over the whole domain to a colour channel — red for rotation,
          green for shear, blue for scale — each normalised over its own range, since the ranges are narrow. The range
          ignores the extreme one percent at each end: central differences are meaningless within a step of a cusp or of
          the face edge, and those few pixels would otherwise flatten everything else.
        </p>
        <p>
          The projection is built from ten triangles per face, and the grid rays at multiples of 36° mark where they
          meet. The Jacobian is discontinuous across these cusps too, which is what the raster's ten-fold pattern
          traces.
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

export default makeExample(JacobianDemo);
