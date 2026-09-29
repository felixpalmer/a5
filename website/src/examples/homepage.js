// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React, {Component} from 'react';
import App from 'website-examples/homepage/app';

import {makeExample} from '../components';

// Hero for the homepage, not listed in the examples sidebar
class HomepageDemo extends Component {
  render() {
    return <App />;
  }
}

// On the homepage the banner's tagline and buttons overlay the left side, and
// the hero extends under the navbar (see Home)
export function HomepageHero({insetTop = 0}) {
  return <App besideTagline insetTop={insetTop} />;
}

export default makeExample(HomepageDemo, {isInteractive: false});
