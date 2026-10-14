import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/teohedron/app';

import {makeExample} from '../components';

class TeohedronDemo extends Component {
  static title = 'Teohedron';

  static code = `${GITHUB_TREE}/examples/website/teohedron`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>
          A5 is built on a spherical polyhedron, that we refer to as the Teohedron. It is a <a href="./conway">subdivision</a> of the
          dodecahedron, with aperture 4 where each face is an equal-area pentagon.
        </p>
        <p>
          The orientation is chosen such that the majority of the populated land mass is on the first 8 faces, with the
          remaining 4 faces being mostly uninhabited.
        </p>
        <p>
          Texture: <a href="https://visibleearth.nasa.gov/collection/1484/blue-marble">NASA Blue Marble</a>
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

export default makeExample(TeohedronDemo);
