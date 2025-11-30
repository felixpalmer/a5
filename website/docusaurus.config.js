// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion
import {themes as prismThemes} from 'prism-react-renderer';
const lightCodeTheme = prismThemes.nightOwlLight;
const darkCodeTheme = prismThemes.nightOwl;

const {resolve} = require('path');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'A5',
  tagline: 'Global, equal-area, millimeter-accurate geospatial index',
  url: 'https://a5geo.org',
  baseUrl: process.env.STAGING ? '/a5geo.org/' : '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: '/images/pentagon.svg',
  organizationName: 'felixpalmer', // Usually your GitHub org/user name.
  projectName: 'a5', // Usually your repo name.
  trailingSlash: false,

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          path: '../docs',
          sidebarPath: resolve('./src/docs-sidebar.js'),
          // Point to to the website directory in your repo.
          editUrl: 'https://github.com/felixpalmer/a5/tree/master/website'
        },
        theme: {
          customCss: [
            resolve('./src/styles.css'),
            resolve('./node_modules/maplibre-gl/dist/maplibre-gl.css')
          ]
        }
      })
    ]
  ],

  plugins: [
    [
      'docusaurus-plugin-plausible',
      {
        domain: 'a5geo.org'
      }
    ],
    [
      './ocular-docusaurus-plugin',
      {
        debug: true,
        resolve: {
          modules: [resolve('node_modules'), resolve('../node_modules')],
          alias: {
            'website-examples': resolve('../examples/website'),
            'a5': resolve('../modules/'),
            'a5-internal': resolve('../modules/internal/'),
            react: resolve('node_modules/react'),
            'react-dom': resolve('node_modules/react-dom')
          }
        },
        module: {
          rules: [
            // https://github.com/Esri/calcite-components/issues/2865
            {
              test: /\.m?js/,
              resolve: {
                fullySpecified: false
              }
            }
          ]
        }
      }
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'examples',
        path: './src/examples',
        routeBasePath: 'examples',
        sidebarPath: resolve('./src/examples-sidebar.js'),
        breadcrumbs: false,
        docItemComponent: resolve('./src/components/example/doc-item-component.jsx')
      }
    ]
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'A5',
        logo: {
          alt: 'A5 Logo',
          src: 'images/pentagon.svg',
          srcDark: 'images/pentagon.svg'
        },
        items: [
          {
            to: '/docs',
            position: 'left',
            label: 'About'
          },
          {
            to: '/examples',
            position: 'left',
            label: 'Examples'
          },
          {
            href: 'https://github.com/felixpalmer/a5',
            label: 'GitHub',
            position: 'right'
          }
        ]
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Resources',
            items: [
              {
                label: 'API Reference',
                to: '/docs/api-reference/'
              }
            ]
          },
          {
            title: 'More',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/felixpalmer/a5'
              },
              {
                label: 'Join us on Slack',
                href: 'https://join.slack.com/t/a5-3ap4392/shared_invite/zt-35rpdc904-2vcsoikrJKFRJF7ncN1fmw'
              }
            ]
          }
        ],
        copyright: `Copyright © ${new Date().getFullYear()} A5 contributors`
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme
      }
    })
};

module.exports = config;
