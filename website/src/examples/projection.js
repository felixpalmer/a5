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
        <p>
          A5 uses the <a href="https://proj.org/en/stable/operations/projections/dsea.html#a5">DSEA</a> projection
        </p>
        <p>
          This example helps visualize warping introduced by a given projection. A jump in the Jacobian matrix is what
          causes cusps to appear in the projection (kinks in projected lines).
        </p>
        <p>
          There are a number of other similar projections, which were not chosen. DSEA produces minimal cusps (2°) and
          minimal sag (deviation from great circles) in cell edges, compared to{' '}
          <a href="https://proj.org/en/stable/operations/projections/isea.html#dual">ISEA</a> and RTSEA.
        </p>
        <p>
          The remaining three{' '}
          <a href="https://www.tandfonline.com/doi/abs/10.1559/152304006779500687">Parallel Small Circle projections</a>{' '}
          have similar metrics to DSEA but no closed form inverse so are more computationally intensive.
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
