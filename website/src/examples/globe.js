import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/globe/app';

import {makeExample} from '../components';

class GlobeDemo extends Component {
  static title = 'Globe';

  static code = `${GITHUB_TREE}/examples/website/globe`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>Globe</p>
        <p>Visualization of how the globe is mapped onto the faces of the dodecahedron.</p>
        <p>By varying the longitudal offset, different regions can be place in different faces.</p>
        <p>
          The chosen offset maximizes the amount of land mass in the first 8 faces, with the remaining 4 faces being
          mostly uninhabited.
        </p>
        <p>
          Texture: <a href="https://visibleearth.nasa.gov/collection/1484/blue-marble">NASA Blue Marble</a>
        </p>
      </div>
    );
  }

  render() {
    return (
      <div style={{width: '100%', height: '100%', position: 'absolute', background: '#aaa'}}>
        <App {...this.props} />
      </div>
    );
  }
}

export default makeExample(GlobeDemo);
