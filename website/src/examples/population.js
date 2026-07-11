import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/population/app';

import {makeExample} from '../components';

class PopulationDemo extends Component {
  static title = 'World Population';

  static code = `${GITHUB_TREE}/examples/website/population`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>The population of the world, aggregated into A5 cells.</p>
        <p>
          Queries run live in your browser using{' '}
          <a href="https://duckdb.org/docs/stable/clients/wasm/overview.html">DuckDB WASM</a> with the{' '}
          <a href="https://duckdb.org/community_extensions/extensions/a5">A5 community extension</a>. Edit the SQL to
          re-aggregate the cells to a different resolution, or filter to the most densely populated areas.
        </p>
        <p>
          Data: <a href="https://data.humdata.org/dataset/kontur-population-dataset-3km">Kontur Population</a> (CC BY
          4.0)
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

export default makeExample(PopulationDemo);
