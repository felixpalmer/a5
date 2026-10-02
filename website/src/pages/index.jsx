// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React, {useEffect, useRef, useState} from 'react';
import {Home} from '../components';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styled from 'styled-components';
import Layout from '@theme/Layout';
import {Highlight, themes} from 'prism-react-renderer';

import {HomepageHero} from '../examples/homepage';

const Page = styled.div`
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 2rem 6rem;
  color: #c9c9d6;

  h2 {
    color: #ececf4;
    font-size: 1.6rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0 0 1.5rem;
  }
  a {
    color: var(--ifm-color-primary-lighter);
  }
`;

const Section = styled.section`
  padding-top: 5rem;
`;

// Small label above each section's heading
const Eyebrow = styled.div`
  margin-bottom: 0.75rem;
  color: var(--ifm-color-primary-lighter);
  font-family: var(--ifm-font-family-monospace);
  font-size: 0.8rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
`;

const Intro = styled.section`
  padding-top: 3.5rem;
  text-align: center;
`;

const Lead = styled.p`
  max-width: 46rem;
  margin: 0 auto;
  text-align: center;
  font-size: 1.35rem;
  line-height: 1.6;
  color: #dcdce8;
  text-wrap: balance;
`;

// Shared by the moving highlight bar and the text and cell fades
const HIGHLIGHT_TRANSITION = '300ms cubic-bezier(0.65, 0, 0.35, 1)';

const Features = styled.div`
  display: grid;
  grid-template-columns: 240px 1fr;
  align-items: center;
  gap: 4rem;

  svg {
    width: 100%;
    overflow: visible;
  }
  polygon {
    fill: rgba(255, 255, 255, 0.025);
    stroke: rgba(255, 255, 255, 0.2);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
    stroke-linejoin: round;
    transition:
      fill ${HIGHLIGHT_TRANSITION},
      stroke ${HIGHLIGHT_TRANSITION};
  }
  polygon.active {
    fill: rgba(0, 170, 85, 0.2);
    stroke: var(--ifm-color-primary-lighter);
  }
  circle {
    fill: var(--ifm-color-primary-lighter);
  }

  @media screen and (max-width: 996px) {
    grid-template-columns: 1fr;

    svg {
      display: none;
    }
  }
`;

// The highlight bar is a pseudo-element, positioned over the active item by
// the --bar-top and --bar-height properties, so it can slide between items
const FeatureList = styled.ul`
  position: relative;
  margin: 0;
  padding: 0;
  list-style: none;
  border-left: 2px solid rgba(255, 255, 255, 0.08);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -2px;
    width: 2px;
    height: var(--bar-height, 0);
    transform: translateY(var(--bar-top, 0));
    background: var(--ifm-color-primary-lighter);
  }
  &.animate::before {
    transition:
      transform ${HIGHLIGHT_TRANSITION},
      height ${HIGHLIGHT_TRANSITION};
  }
`;

const Feature = styled.li`
  padding: 0.6rem 0 0.6rem 1.5rem;

  h3 {
    margin: 0 0 0.25rem;
    font-size: 1.1rem;
    font-weight: 600;
    color: ${props => (props.$active ? '#ececf4' : '#9a9aac')};
    transition: color ${HIGHLIGHT_TRANSITION};
  }
  p {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.6;
    color: ${props => (props.$active ? '#c9c9d6' : '#6e6e80')};
    transition: color ${HIGHLIGHT_TRANSITION};
  }
`;

const Tabs = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-bottom: 0.75rem;

  button {
    padding: 0.35rem 0.9rem;
    border: 1px solid transparent;
    border-radius: 6px;
    background: none;
    color: #9a9aac;
    font: inherit;
    font-size: 0.9rem;
    cursor: pointer;
  }
  button[aria-selected='true'] {
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.05);
    color: #ececf4;
  }
`;

// Install command, at the end of the tab row
const Install = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: auto;

  code {
    padding: 0;
    border: none;
    background: none;
    color: #8a8a9c;
    font-size: 0.85rem;
  }
  && button {
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.05);
    color: #ececf4;
  }
`;

const Code = styled.pre`
  margin: 0;
  padding: 1.25rem 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: #11111c;
  color: #dcdce8;
  font-size: 0.9rem;
  line-height: 1.7;
  overflow-x: auto;
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;

  a {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.9rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    color: #dcdce8;
    font-size: 0.95rem;
    text-decoration: none;
    transition: border-color 200ms;
  }
  a:hover {
    border-color: var(--ifm-color-primary);
  }
  img {
    width: auto;
    max-width: 2.6em;
    height: 1.3em;
    object-fit: contain;
  }
`;

const Links = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;

  @media screen and (max-width: 996px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media screen and (max-width: 600px) {
    grid-template-columns: 1fr;
  }

  a {
    display: block;
    padding: 1.25rem 1.5rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.025);
    color: #c9c9d6;
    text-decoration: none;
    transition: border-color 200ms;
  }
  a:hover {
    border-color: var(--ifm-color-primary);
  }
  strong {
    display: block;
    margin-bottom: 0.3rem;
    color: #ececf4;
  }
  span {
    font-size: 0.9rem;
  }
`;

const FEATURES = [
  {
    title: 'Strong ecosystem',
    text: 'Robust base libraries, with higher-level tools, applications and visualization support built on top. All interoperable via the A5 cell index.'
  },
  {
    title: 'Fast & rich API',
    text: 'High-level functions make working with the grid easy. The native Rust core indexes over 2 million points per second on a laptop.'
  },
  {
    title: 'Equal area, single topology',
    text: 'Cells are all equal-area pentagons — no exceptions, no kinks. Resolutions all the way down to 30mm² give a common way to represent point, line, polygon and raster data without statistical bias.'
  },
  {
    title: 'Built for big data',
    text: 'A5 is a natural key for partitioning and sharding large datasets, thanks to cell indices following a global space-filling curve.'
  },
  {
    title: 'Unmistakable on a map',
    text: "A5's pentagon mosaic is recognizable at a glance, and renders fast in a variety of geospatial libraries, such as deck.gl, MapLibre or QGIS."
  }
];

// The A5 pentagon (see modules/core/pentagon.ts): vertex a has a 72° angle, so
// five copies rotated about it meet at a point, one cell per feature
const PENTAGON = [
  [0, 0],
  [0, 1],
  [0.7885966681787006, 1.6149108024237764],
  [1.6171013659387945, 1.054928690397459],
  [Math.cos(Math.PI / 10), Math.sin(Math.PI / 10)]
];
const PENTAGON_BISECTOR = (54 * Math.PI) / 180; // Direction halfway between b and e
const PENTAGON_GAP = 0.04; // Nudge each cell outwards to separate the outlines

// Points for cell k, clockwise from the top (SVG y points down)
function flowerCell(k) {
  const angle = Math.PI / 2 - (k * 2 * Math.PI) / 5;
  const rotate = angle - PENTAGON_BISECTOR;
  const [cos, sin] = [Math.cos(rotate), Math.sin(rotate)];
  const dx = PENTAGON_GAP * Math.cos(angle);
  const dy = PENTAGON_GAP * Math.sin(angle);
  return PENTAGON.map(([x, y]) => `${x * cos - y * sin + dx},${-(x * sin + y * cos + dy)}`).join(' ');
}

function FeatureFlower() {
  const [active, setActive] = useState(0);
  const [bar, setBar] = useState(null);
  const [animate, setAnimate] = useState(false);
  const listRef = useRef(null);

  // Highlight by scroll position, a hint to keep scrolling: the first feature
  // as it enters at the bottom of the screen, through to the last as it
  // reaches the top
  useEffect(() => {
    const onScroll = () => {
      const items = listRef.current.children;
      const start = items[0].getBoundingClientRect().top - window.innerHeight;
      const end = items[items.length - 1].getBoundingClientRect().top;
      const progress = -start / (end - start);
      setActive(Math.min(Math.max(Math.floor(progress * items.length), 0), items.length - 1));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, {passive: true});
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // Move the bar over the active item, and keep it there as the text rewraps
  useEffect(() => {
    const measure = () => {
      const item = listRef.current.children[active];
      setBar({top: item.offsetTop, height: item.offsetHeight});
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [active]);

  // Only animate the bar once it has been placed, so it doesn't grow into
  // place on load. Two frames, so the first position is painted first
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setAnimate(true));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <Features>
      <svg viewBox="-1.9 -1.9 3.8 3.8" aria-hidden="true">
        {FEATURES.map(({title}, k) => (
          <polygon key={title} points={flowerCell(k)} className={k === active ? 'active' : undefined} />
        ))}
        <circle r="0.045" />
      </svg>
      <FeatureList
        ref={listRef}
        className={animate ? 'animate' : undefined}
        style={bar && {'--bar-top': `${bar.top}px`, '--bar-height': `${bar.height}px`}}
      >
        {FEATURES.map(({title, text}, k) => (
          <Feature key={title} $active={k === active}>
            <h3>{title}</h3>
            <p>{text}</p>
          </Feature>
        ))}
      </FeatureList>
    </Features>
  );
}

const LANGUAGE = {JavaScript: 'javascript', Python: 'python', Rust: 'rust', R: 'r', DuckDB: 'sql'};

const INSTALL = {
  JavaScript: 'npm install a5-js',
  Python: 'pip install pya5',
  Rust: 'cargo add a5',
  R: 'install.packages("a5R")',
  DuckDB: 'INSTALL a5 FROM community;'
};

// Same order as ECOSYSTEM
const CODE = {
  DuckDB: `INSTALL a5 FROM community;
LOAD a5;

SELECT a5_cell_to_boundary(
  a5_cell_to_parent(a5_lonlat_to_cell(2.2945, 48.8584, 20), 10)
);`,
  Python: `import a5

cell = a5.lonlat_to_cell((2.2945, 48.8584), 20)
district = a5.cell_to_parent(cell, 10)
polygon = a5.cell_to_boundary(district)`,
  R: `library(a5R)

cell <- a5_lonlat_to_cell(2.2945, 48.8584, resolution = 20)
district <- a5_cell_to_parent(cell, resolution = 10)
polygon <- a5_cell_to_boundary(district)`,
  JavaScript: `import {lonLatToCell, cellToParent, cellToBoundary} from 'a5-js';

const cell = lonLatToCell([2.2945, 48.8584], 20);
const district = cellToParent(cell, 10);
const polygon = cellToBoundary(district);`,
  Rust: `use a5::{cell_to_boundary, cell_to_parent, lonlat_to_cell, LonLat};

let cell = lonlat_to_cell(LonLat::new(2.2945, 48.8584), 20)?;
let district = cell_to_parent(cell, Some(10))?;
let polygon = cell_to_boundary(district, None)?;`
};

// Ordered by relevance to data science; logos live in static/images/logos
const ECOSYSTEM = [
  ['DuckDB', '/docs/quickstart/duckdb', 'duckdb.svg'],
  ['Python', '/docs/quickstart/python', 'python.svg'],
  ['R', 'https://belian-earth.github.io/a5R/', 'r.svg'],
  ['TypeScript', '/docs/quickstart/javascript', 'typescript.svg'],
  ['GeoParquet', 'https://geoparquet.io/guide/partition/#by-a5-cells', 'apacheparquet.svg'],
  ['deck.gl', 'https://deck.gl/docs/api-reference/geo-layers/a5-layer', 'deckgl.svg'],
  ['lonboard', 'https://developmentseed.org/lonboard/latest/api/layers/a5-layer/', 'lonboard.png'],
  ['pydeck', 'https://deckgl.readthedocs.io/en/latest/gallery/a5_layer.html', 'deckgl.svg'],
  ['QGIS', 'https://plugins.qgis.org/plugins/vgridtools/', 'qgis.svg'],
  ['Power BI', 'https://icon-map.com/products/slicer/', 'powerbi.svg'],
  ['PostgreSQL', '/docs/quickstart/postgresql', 'postgresql.svg'],
  ['Rust', '/docs/quickstart/rust', 'rust.svg'],
  ['Go', 'https://github.com/corewood-tech/a5go', 'go.svg']
];

const LINKS = [
  ['Introduction', 'A5 overview and how to use', '/docs'],
  ['Quickstart', 'Get up a running in a variety of languages', '/docs/quickstart/javascript'],
  ['Examples', 'Interactive maps and visualizations', '/examples'],
  ['API Reference', 'Functions for working with A5', '/docs/api-reference']
];

function CodeSample() {
  const [language, setLanguage] = useState(Object.keys(CODE)[0]);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(INSTALL[language]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <>
      <Tabs role="tablist">
        {Object.keys(CODE).map(name => (
          <button key={name} role="tab" aria-selected={name === language} onClick={() => setLanguage(name)}>
            {name}
          </button>
        ))}
        <Install>
          <code>{INSTALL[language]}</code>
          <button onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        </Install>
      </Tabs>
      {/* Same Prism theme as the dark-mode code blocks in the docs */}
      <Highlight theme={themes.nightOwl} code={CODE[language]} language={LANGUAGE[language]}>
        {({tokens, getLineProps, getTokenProps}) => (
          <Code>
            <code>
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({line})}>
                  {line.map((token, j) => (
                    <span key={j} {...getTokenProps({token})} />
                  ))}
                </div>
              ))}
            </code>
          </Code>
        )}
      </Highlight>
    </>
  );
}

export default function IndexPage() {
  const baseUrl = useBaseUrl('/');
  const url = path => (path.startsWith('/') ? baseUrl + path.slice(1) : path);

  return (
    <Layout
      title="Home"
      description="A5 divides the Earth into pentagonal cells of exactly equal area, at 31 resolutions down to millimeters, each identified by a 64-bit integer."
    >
      {/* Dark theme for the homepage only: Infima's dark variables are scoped to
          [data-theme='dark'], so they apply within this subtree. The navbar and
          page background are darkened in styles.css via .a5-homepage */}
      <div className="a5-homepage" data-theme="dark">
        <Home HeroExample={HomepageHero} showTitle={false} showLinks={false} underNavbar>
          <Page>
            <Intro>
              <Eyebrow>Why A5?</Eyebrow>
              <Lead>
                A5 turns any location on Earth into a 64-bit cell ID, on a grid of equal-area pentagons that runs from
                continents down to 30mm². Join, aggregate and compare data anywhere, with fast libraries and
                integrations across your whole stack.
              </Lead>
            </Intro>

            <Section>
              <Eyebrow>Key strengths</Eyebrow>
              <FeatureFlower />
            </Section>

            <Section>
              <Eyebrow>Quickstart</Eyebrow>
              <h2>A few lines to your first cell</h2>
              <CodeSample />
            </Section>

            <Section>
              <Eyebrow>Integrations</Eyebrow>
              <h2>Works where you do</h2>
              <Chips>
                {ECOSYSTEM.map(([name, href, logo]) => (
                  <a key={name} href={url(href)}>
                    <img src={`${baseUrl}images/logos/${logo}`} alt="" />
                    {name}
                  </a>
                ))}
                <a href={url('/docs/ecosystem')}>More…</a>
              </Chips>
            </Section>

            <Section>
              <Eyebrow>Get started</Eyebrow>
              <h2>Learn more or explore examples</h2>
              <Links>
                {LINKS.map(([title, text, href]) => (
                  <a key={title} href={url(href)}>
                    <strong>{title}</strong>
                    <span>{text}</span>
                  </a>
                ))}
              </Links>
            </Section>
          </Page>
        </Home>
      </div>
    </Layout>
  );
}
