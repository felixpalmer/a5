import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/country-polygons/app';

import {makeExample} from '../components';

class CountryPolygonsDemo extends Component {
  static title = 'Country Polygons';

  static code = `${GITHUB_TREE}/examples/website/country-polygons`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>Countries of the world encoded as A5 cells using <a href="/docs/api-reference/regions#polygontocells"><code>polygonToCells</code></a>.</p>
        <p>Data: <a href="https://www.naturalearthdata.com/downloads/50m-cultural-vectors/">Natural Earth</a></p>
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

export default makeExample(CountryPolygonsDemo);
