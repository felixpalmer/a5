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
          The matrix relates the face's polar coordinates (ρ, γ) to the sphere's spherical coordinates (φ, θ), and is
          computed by central differences. The two small diagrams show a unit patch and the parallelogram it is mapped
          to, which is what the rotation, shear and scaling in the matrix amount to.
        </p>
        <p>
          The first column is nearly vertical: ∂θ/∂ρ is zero because the projection radiates from the face center, so
          rays of constant γ map to meridians of constant θ.
        </p>
        <p>
          Area elements are ρ·dρ·dγ on the face and R²·sin φ·dφ·dθ on the sphere, so the determinant on its own is not
          the area scale. Put those weights back and R²·sin φ·det J / ρ is exactly 1 — the equal-area property. That
          holds for one sphere only: R = 1.151102, the radius at which the sphere's area is twelve face areas. The
          dodecahedron A5 is built on circumscribes the unit sphere, so its faces are larger than the spherical
          pentagons they map onto, and the sphere here is drawn at R to match.
        </p>
        <p>
          The decomposition splits J into the three deformations it performs, using the polar decomposition J = rotation
          · stretch: the rotation is the closest rigid rotation, the shear is the anisotropy σ₁/σ₂ − 1 (zero where a
          small circle stays a circle) and the scale is √|det J|. The Gram-Schmidt decomposition is not used, as its
          rotation is identically zero for the reason above.
        </p>
        <p>
          The raster maps the magnitude of each component over the face to a colour channel — red for rotation, green
          for shear, blue for scale — each normalised over its own range, since the ranges are narrow. The scale channel
          varies even though the projection is equal-area: that variation belongs to the polar and spherical charts, not
          to the projection.
        </p>
        <p>
          The projection is built from ten triangles per face, and the grid rays at multiples of 36° mark where they
          meet. The Jacobian is discontinuous across these cusps, which is what the raster's ten-fold pattern traces.
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
