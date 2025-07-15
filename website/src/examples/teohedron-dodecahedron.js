import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/teohedron-dodecahedron/app';

import {makeExample} from '../components';

class TeohedronDodecahedronDemo extends Component {
  static title = 'Teohedron & Dodecahedron';

  static code = `${GITHUB_TREE}/examples/website/teohedron-dodecahedron`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>Geometric solids used by the A5 system.</p>
        <h3>Resolution levels:</h3>
        <h4>0: Dodecahedron</h4>
        <p>12 regular pentagon primitives.</p>
        <h4>1: Pentakis Dodecahedron</h4>
        <p>60 isosceles triangle primitives (quintiles).</p>
        <h4>2+: Teohedron</h4>
        <p>240+ irregular pentagon primitives.</p>
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

export default makeExample(TeohedronDodecahedronDemo); 