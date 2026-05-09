import React, {Component} from 'react';
import {GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/airbnb/app';

import {makeExample} from '../components';

class AirbnbDemo extends Component {
  static title = 'Airbnb';

  static code = `${GITHUB_TREE}/examples/website/airbnb`;

  static parameters = {};

  static renderInfo(meta) {
    return (
      <div>
        <p>Aggregated AirBnb listing in Malta vs Oslo.</p>
        <p>
          Due to the unequal cell sizes, H3 incorrectly suggests that in Malta the density of rental apartments is twice
          that of Oslo.
        </p>
        <p>It can also been seen how the cell sizes are different for H3, while with A5 they are equal.</p>
        <p>
          Data: <a href="https://insideairbnb.com/get-the-data/">Inside Airbnb</a>
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

export default makeExample(AirbnbDemo);
