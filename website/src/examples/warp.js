import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/warp/app';

import {makeExample} from '../components';

class WarpDemo extends Component {
  static title = 'Warp';

  static code = `${GITHUB_TREE}/examples/website/warp`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>Comparison of a dodecahedron and sphere, showing how the A5 system warps a sphere into a dodecahedron.</p>
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

export default makeExample(WarpDemo); 