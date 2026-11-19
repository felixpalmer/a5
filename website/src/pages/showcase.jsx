// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React from 'react';
import styled from 'styled-components';
import Layout from '@theme/Layout';
import useBaseUrl from '@docusaurus/useBaseUrl';

const ExternalLink = ({href, children}) => (
  <a href={href} target="_blank" rel="noopener">
    {children}
  </a>
);

// Projects built with A5. Thumbnails are 960x600 (16:10) in /static/images/showcase
const PROJECTS = [
  {
    title: 'Fields of The World',
    url: 'https://research.taylorgeospatial.org/global-ftw-2e/',
    author: 'Taylor Geospatial',
    authorUrl: 'https://taylorgeospatial.org',
    image: '/images/showcase/fields-of-the-world.jpg',
    description: (
      <>
        Over 3 billion agricultural field boundaries, mapped from{' '}
        <ExternalLink href="https://sentinels.copernicus.eu/copernicus/sentinel-2">Sentinel-2</ExternalLink> imagery for
        every year from 2017 to 2025. A5 cells are used to provide aggregated overviews at low zooms. Data served using{' '}
        <ExternalLink href="https://docs.protomaps.com/pmtiles/">PMTiles</ExternalLink>, generated with{' '}
        <ExternalLink href="https://geoparquet-io.github.io/tylertoo">TylerToo</ExternalLink>.
      </>
    ),
    tags: ['GeoParquet', 'TylerToo', 'PMTiles']
  },
  {
    title: 'A5 Pyramids',
    url: 'https://a5-pyramids.belian.earth/',
    author: 'Belian Earth',
    authorUrl: 'https://belian.earth',
    image: '/images/showcase/a5-pyramids.jpg',
    description: (
      <>
        <ExternalLink href="https://deepmind.google/discover/blog/alphaearth-foundations-helps-map-our-planet-in-unprecedented-detail/">
          AlphaEarth Foundations
        </ExternalLink>{' '}
        satellite embeddings for Sabah, Borneo, resampled to A5 cells and colored by the principal components of
        whatever is on screen.{' '}
        <ExternalLink href="https://belian-earth.github.io/a5pyramid/">A5 Cell pyramids</ExternalLink> stream Parquet
        tiles and are colored on the GPU using a{' '}
        <ExternalLink href="https://github.com/belian-earth/deck.gl-a5pyramid">custom deck.gl layer</ExternalLink>, with
        no tile server needed.
      </>
    ),
    tags: ['AlphaEarth', 'Parquet', 'a5px']
  },
  {
    title: 'FIRMS Explorer',
    url: 'https://portolan-mirrors.github.io/firms-catalog/',
    author: 'Portolan',
    authorUrl: 'https://github.com/portolan-mirrors',
    image: '/images/showcase/firms-explorer.jpg',
    description: (
      <>
        NASA <ExternalLink href="https://www.earthdata.nasa.gov/data/tools/firms">FIRMS</ExternalLink> active fire
        detections since November 2000, with real-time spatial and temporal filtering and aggregation to A5 cells
        visualized using deck.gl{' '}
        <ExternalLink href="https://deck.gl/docs/api-reference/geo-layers/a5-layer">A5Layer</ExternalLink>. Built and
        served using <ExternalLink href="https://portolan-sdi.org">Portolan</ExternalLink> as a{' '}
        <ExternalLink href="https://stacspec.org">STAC</ExternalLink> catalog of{' '}
        <ExternalLink href="https://geoparquet.org">GeoParquet</ExternalLink> files with no server.
      </>
    ),
    tags: ['GeoParquet', 'STAC', 'Portolan', 'deck.gl']
  }
];

const SUBMIT_URL = 'https://github.com/felixpalmer/a5/issues/new?title=Showcase%3A%20';

const Page = styled.main`
  max-width: 1200px;
  margin: 0 auto;
  padding: 4rem 2rem 6rem;
  @media screen and (max-width: 632px) {
    padding: 2.5rem 16px 4rem;
  }
`;

// Small label above the heading, as on the homepage
const Eyebrow = styled.div`
  margin-bottom: 0.75rem;
  color: var(--ifm-color-primary);
  font-family: var(--ifm-font-family-monospace);
  font-size: 0.8rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
`;

const Header = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem 3rem;
  margin-bottom: 3rem;

  h1 {
    margin: 0 0 1rem;
    font-size: 2.6rem;
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  p {
    max-width: 38rem;
    margin: 0;
    font-size: 1.15rem;
    line-height: 1.6;
    color: var(--ifm-color-content-secondary);
    text-wrap: pretty;
  }
`;

const SubmitLink = styled.a`
  flex-shrink: 0;
  padding: 0.6rem 1.1rem;
  border: 1px solid var(--ifm-color-emphasis-300);
  border-radius: 999px;
  color: var(--ifm-font-color-base);
  font-size: 0.9rem;
  font-weight: 500;
  transition:
    border-color var(--ifm-transition-fast),
    color var(--ifm-transition-fast);
  &:hover {
    border-color: var(--ifm-color-primary);
    color: var(--ifm-color-primary);
    text-decoration: none;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 2rem;
  @media screen and (max-width: 632px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.article`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--ifm-color-emphasis-200);
  border-radius: 14px;
  background: var(--ifm-background-surface-color);
  transition:
    transform 250ms ease,
    box-shadow 250ms ease,
    border-color 250ms ease;

  &:hover {
    transform: translateY(-3px);
    border-color: var(--ifm-color-emphasis-300);
    box-shadow: 0 16px 40px -16px rgba(0, 0, 0, 0.35);
  }
`;

const Thumbnail = styled.a`
  display: block;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background: #0a0a12;

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 600ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  ${Card}:hover & img {
    transform: scale(1.04);
  }
`;

const Body = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 1.25rem 1.4rem 1.4rem;

  h2 {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  h2 a {
    color: inherit;
  }
  p {
    flex: 1;
    margin: 0.75rem 0 1rem;
    font-size: 0.95rem;
    line-height: 1.6;
    color: var(--ifm-color-content-secondary);
  }
`;

const Author = styled.div`
  margin-top: 0.2rem;
  font-size: 0.85rem;
  color: var(--ifm-color-emphasis-600);
  a {
    color: inherit;
    text-decoration: underline;
    text-decoration-color: var(--ifm-color-emphasis-300);
    text-underline-offset: 2px;
  }
`;

const Tags = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0 0 1.25rem;
  padding: 0;
  list-style: none;

  li {
    padding: 0.15rem 0.55rem;
    border-radius: 6px;
    background: var(--ifm-color-emphasis-100);
    color: var(--ifm-color-emphasis-700);
    font-family: var(--ifm-font-family-monospace);
    font-size: 0.75rem;
  }
`;

const Links = styled.div`
  display: flex;
  gap: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--ifm-color-emphasis-200);
  font-size: 0.9rem;
  font-weight: 500;
`;

function ProjectCard({project}) {
  const {title, url, author, authorUrl, image, description, tags} = project;
  return (
    <Card>
      <Thumbnail href={url} target="_blank" rel="noopener" tabIndex={-1} aria-hidden>
        <img src={useBaseUrl(image)} alt="" loading="lazy" />
      </Thumbnail>
      <Body>
        <h2>
          <a href={url} target="_blank" rel="noopener">
            {title}
          </a>
        </h2>
        <Author>
          by{' '}
          <a href={authorUrl} target="_blank" rel="noopener">
            {author}
          </a>
        </Author>
        <p>{description}</p>
        <Tags>
          {tags.map(tag => (
            <li key={tag}>{tag}</li>
          ))}
        </Tags>
        <Links>
          <a href={url} target="_blank" rel="noopener">
            Open ↗
          </a>
        </Links>
      </Body>
    </Card>
  );
}

export default function Showcase() {
  return (
    <Layout title="Showcase" description="Apps and tools built with A5, the equal-area pentagonal geospatial index">
      <Page>
        <Header>
          <div>
            <Eyebrow>Showcase</Eyebrow>
            <h1>Built with A5</h1>
            <p>Maps, apps and tools from the community that use A5</p>
          </div>
          <SubmitLink href={SUBMIT_URL} target="_blank" rel="noopener">
            Submit your project →
          </SubmitLink>
        </Header>
        <Grid>
          {PROJECTS.map(project => (
            <ProjectCard key={project.title} project={project} />
          ))}
        </Grid>
      </Page>
    </Layout>
  );
}
