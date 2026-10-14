import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/conway/app';

import {makeExample} from '../components';

class ConwayDemo extends Component {
  static title = 'Conway Notation';

  static code = `${GITHUB_TREE}/examples/website/conway`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>
          The <a href="./teohedron">Teohedron</a> A5 is built on can be succintly represented using{' '}
          <a href="https://en.wikipedia.org/wiki/Conway_polyhedron_notation">Conway polyhedron notation</a>, which
          decsribes the topology of the system.
        </p>
        <p>
          It relates the topology of the system to the well-known{' '}
          <a href="https://en.wikipedia.org/wiki/Goldberg%E2%80%93Coxeter_construction">
            Goldberg–Coxeter construction
          </a>
          , which produces a triangular or hexagonal subdivision.
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

export default makeExample(ConwayDemo);
