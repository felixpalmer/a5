// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import styled from 'styled-components';
import {isMobile} from '../common';

// $underNavbar: pixels the banner extends up behind the (translucent) navbar
export const Banner = styled.section`
  position: relative;
  height: calc(30rem + ${props => props.$underNavbar ?? 0}px);
  margin-top: -${props => props.$underNavbar ?? 0}px;
  background: var(--ifm-color-gray-400);
  color: var(--ifm-color-gray-200);
  z-index: 0;
  ${isMobile} {
    height: calc(80vh + ${props => props.$underNavbar ?? 0}px);
  }
`;

export const Container = styled.div`
  position: relative;
  padding: 2rem;
  max-width: 80rem;
  width: 100%;
  height: 100%;
  margin: 0;
`;

export const BannerContainer = styled(Container)`
  position: absolute;
  bottom: 0;
  height: auto;
  padding-left: 4rem;
  z-index: 0;
  pointer-events: none;
  ${isMobile} {
    pointer-events: auto;
    padding-left: 2rem;
  }
`;

export const HeroExampleContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: -1;
`;

export const Section = styled.section`
  &:nth-child(2n + 1) {
    background: var(--ifm-color-gray-300);
  }
`;

export const ProjectName = styled.h1`
  font-size: 5em;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 4px;
  font-weight: 700;
  margin: 0;
  margin-bottom: 16px;
`;

export const GetStartedLink = styled.a`
  pointer-events: all;
  font-size: 12px;
  line-height: 44px;
  letter-spacing: 2px;
  font-weight: bold;
  margin: 12px 0;
  padding: 0 2rem;
  pointer-events: all;
  display: inline-block;
  text-decoration: none;
  transition:
    background-color 250ms ease-in,
    color 250ms ease-in;
  background-color: var(--ifm-color-primary-lightest);
  border: solid 2px var(--ifm-color-primary);
  color: var(--ifm-color-gray-900);
  border-image: linear-gradient(to right, var(--ifm-color-gray-700) 0%, var(--ifm-color-gray-400) 100%);
  border-image-slice: 2;
  width: fit-content;
  &:active {
    color: var(--ifm-color-white);
  }
  &:hover {
    color: var(--ifm-color-white);
    background-color: var(--ifm-color-primary);
  }
`;

// The banner's tagline on its own: large, vertically centered in the space
// left of the hero example (below $top pixels covered by the navbar). The
// example publishes where its logo starts as --hero-logo-left; the tagline
// ends 2rem short of it, scaling its text down to fit (its longest line is
// ~8.8em wide). Dropped along with the full navbar, where there's no room
export const Tagline = styled.div`
  position: absolute;
  top: ${props => props.$top ?? 0}px;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: calc(var(--hero-logo-left, 38rem) - 2rem);
  padding-left: 4rem;
  pointer-events: none;

  p {
    margin: 0;
    /* Three lines, around its longest word */
    max-width: 10em;
    font-size: min(2.1rem, calc((var(--hero-logo-left, 38rem) - 6rem) / 8.8));
    line-height: 1.25;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: #ececf4;
    text-wrap: balance;
  }
  @media screen and (max-width: 996px) {
    display: none;
  }
`;
