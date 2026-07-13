import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/duckdb-playground/app';

import {makeExample} from '../components';

class DuckDBPlaygroundDemo extends Component {
  static title = 'DuckDB Playground';

  static code = `${GITHUB_TREE}/examples/website/duckdb-playground`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>Query global datasets indexed with A5 cells, live in your browser.</p>
        <p>
          Queries run using <a href="https://duckdb.org/docs/stable/clients/wasm/overview.html">DuckDB WASM</a> with the{' '}
          <a href="https://duckdb.org/community_extensions/extensions/a5">A5 community extension</a>.
        </p>
        <p>
          Data: <a href="https://www.ncei.noaa.gov/products/etopo-global-relief-model">ETOPO 2022</a> (public domain),{' '}
          <a href="https://data.humdata.org/dataset/kontur-population-dataset-3km">Kontur Population</a> (CC BY 4.0),{' '}
          <a href="https://www.naturalearthdata.com/">Natural Earth</a> (public domain),{' '}
          <a href="https://worldclim.org/data/worldclim21.html">WorldClim 2.1</a>
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

export default makeExample(DuckDBPlaygroundDemo);
