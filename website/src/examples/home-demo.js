// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React, {Component} from 'react';
import App from 'website-examples/hierarchy/app';

import {makeExample} from '../components';

class HomeDemo extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    return <App showCellId={false} />;
  }
}

export default makeExample(HomeDemo, {isInteractive: false});
