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
          The geometric solids used by A5, above, and below the same cells unfolded onto the faces of the dodecahedron.
        </p>
        <h3>Resolution levels:</h3>
        <h4>0: Dodecahedron</h4>
        <p>12 regular pentagon primitives.</p>
        <h4>1: Pentagonal Hexecontahedron</h4>
        <p>60 congruent pentagon primitives, one per quintant of the pentakis dodecahedron.</p>
        <h4>2+: Teohedron</h4>
        <p>240+ irregular pentagon primitives.</p>
        <p>
          The dodecahedron is oriented to place as much land as possible on the first 8 faces, with the remaining 4
          faces being mostly uninhabited.
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
