// A5
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) A5 contributors

import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {Banner, BannerContainer, HeroExampleContainer, ProjectName, GetStartedLink, Tagline} from './styled';
import styled from 'styled-components';
import {isMobile} from '../common';

// Height of the Docusaurus navbar (Infima's 3.75rem)
const NAVBAR_HEIGHT = 60;

// With `underNavbar`, the hero example extends up under a translucent navbar,
// receiving its height as an inset so it can keep its layout below it. Without
// `showLinks`, the banner is just the tagline, set large beside the example
export default function renderPage({HeroExample, showTitle = true, showLinks = true, underNavbar = false, children}) {
  const {siteConfig} = useDocusaurusContext();

  // Note: The Layout "wrapper" component adds header and footer etc
  return (
    <>
      <Banner $underNavbar={underNavbar ? NAVBAR_HEIGHT : 0}>
        <HeroExampleContainer>
          {HeroExample && (underNavbar ? <HeroExample insetTop={NAVBAR_HEIGHT} /> : <HeroExample />)}
        </HeroExampleContainer>
        {showLinks ? (
          <BannerContainer>
            {showTitle && <ProjectName>{siteConfig.title}</ProjectName>}
            <p>{siteConfig.tagline}</p>
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
              <GetStartedLink href="./docs/">INTRODUCTION</GetStartedLink>
              <GetStartedLink href="./examples/">EXAMPLES</GetStartedLink>
            </div>
          </BannerContainer>
        ) : (
          <Tagline $top={underNavbar ? NAVBAR_HEIGHT : 0}>
            {showTitle && <ProjectName>{siteConfig.title}</ProjectName>}
            {/* Wrap between words only, never at a word's own hyphen */}
            <p>
              {siteConfig.tagline.split(' ').map((word, i) => (
                <React.Fragment key={i}>
                  {i > 0 && ' '}
                  <span style={{whiteSpace: 'nowrap'}}>{word}</span>
                </React.Fragment>
              ))}
            </p>
          </Tagline>
        )}
      </Banner>
      {children}
    </>
  );
}
