// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import {useColorMode} from '@docusaurus/theme-common';

// Website examples in reduced form, for use in docs pages. They draw on a
// transparent background, so follow the page's colour mode.
function Embedded({load, ...props}) {
  const dark = useColorMode().colorMode === 'dark';
  return (
    <div style={{margin: '16px 0'}}>
      <BrowserOnly>
        {() => {
          const App = load().default;
          return <App {...props} dark={dark} />;
        }}
      </BrowserOnly>
    </div>
  );
}

// <TilingDemo embed="levels" /> or <TilingDemo embed="dodecahedron" />
export function TilingDemo(props) {
  return <Embedded load={() => require('website-examples/tiling/app')} {...props} />;
}

// <ConwayDemo rows={['geodesic', 'goldberg']} />
export function ConwayDemo({rows, ...props}) {
  return <Embedded load={() => require('website-examples/conway/app')} embed={rows} {...props} />;
}
