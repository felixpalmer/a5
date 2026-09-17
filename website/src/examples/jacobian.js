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
          Area elements are ρ·dρ·dγ on the face and sin φ·dφ·dθ on the sphere, so it is sin φ·det J / ρ that an
          equal-area projection holds constant — here at 0.754697, the ratio of a face's area to a twelfth of the
          sphere.
        </p>
        <p>
          The projection is built from ten triangles per face, and the grid rays at multiples of 36° mark where they
          meet. The Jacobian is discontinuous across these cusps.
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
