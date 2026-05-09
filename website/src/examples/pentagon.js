import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/pentagon/app';

import {makeExample} from '../components';

class PentagonDemo extends Component {
  static title = 'Pentagon';

  static code = `${GITHUB_TREE}/examples/website/pentagon`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>Irregular Pentagon</p>
        <p>
          With two of the angles being 72° and 108°, the remaining three can be calculated by intersecting the arcs
          traced by the rigid edges of the pentagon.
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

export default makeExample(PentagonDemo);
