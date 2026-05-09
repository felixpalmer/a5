import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/world-cells/app';

import {makeExample} from '../components';

class WorldCellsDemo extends Component {
  static title = 'World Cells';

  static code = `${GITHUB_TREE}/examples/website/world-cells`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>Every country in Natural Earth pre-converted to compacted A5 cells (Parquet, ~13 KB) and colored by country.</p>
        <p>Data: <a href="https://www.naturalearthdata.com/downloads/50m-cultural-vectors/">Natural Earth</a> · regenerate via <code>examples/cli/world-cells</code>.</p>
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

export default makeExample(WorldCellsDemo);
