import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/projection/app';

import {makeExample} from '../components';

class ProjectionDemo extends Component {
  static title = 'Projection';

  static code = `${GITHUB_TREE}/examples/website/projection`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>A dodecahedron face and its image on the sphere.</p>
        <p>
          Hover over either one to read the Jacobian of A5's equal-area projection there, split into a rotation, a shear
          and two scalings.
        </p>
        <p>
          The panel colours the face by any one of those, draws A5 cells over it, and swaps DSEA for the other
          projections in its family.
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

export default makeExample(ProjectionDemo);
