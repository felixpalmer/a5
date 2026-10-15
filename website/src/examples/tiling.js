import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/tiling/app';

import {makeExample} from '../components';

class TilingDemo extends Component {
  static title = 'A5 Pentagon Tiling';

  static code = `${GITHUB_TREE}/examples/website/tiling`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>A5 tiles each face of a dodecahedron with a single pentagon shape.</p>
        <p>
          When assembled and <a href="./projection">projected</a> onto a sphere, it completely covers the surface
          without any gaps or kinks.
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

export default makeExample(TilingDemo);
