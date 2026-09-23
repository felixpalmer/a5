// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion
import {themes as prismThemes} from 'prism-react-renderer';
const lightCodeTheme = prismThemes.nightOwlLight;
const darkCodeTheme = prismThemes.nightOwl;

const {resolve} = require('path');

// The maintainer preview of `main`, served from a5geo.org/next (see
// .github/workflows/website-next.yml). It is a standalone build of the same
// site: no version switcher and no links to or from the production site.
const isNext = process.env.NEXT_SITE === 'true';

const baseUrl = isNext ? '/next/' : '/';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'A5',
  tagline: 'Global, equal-area, millimeter-accurate geospatial index',
  url: 'https://a5geo.org',
  baseUrl,
  // /next is for maintainers testing trunk, so keep it out of search results
  noIndex: isNext,
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
          customCss: [resolve('./src/styles.css'), resolve('./node_modules/maplibre-gl/dist/maplibre-gl.css')]
        }
      })
    ]
  ],

  plugins: [
    // Analytics on the production site only — /next visits are maintainers
    // testing their own changes and would skew a5geo.org's stats
    ...(isNext
      ? []
      : [
          [
            'docusaurus-plugin-plausible',
            {
              domain: 'a5geo.org'
            }
          ]
        ]),
    [
      './ocular-docusaurus-plugin',
      {
        debug: true,
        resolve: {
          modules: [resolve('node_modules'), resolve('../node_modules')],
          alias: {
            'website-examples': resolve('../examples/website'),
            a5: resolve('../modules/'),
            // deck.gl's A5Layer imports the published package name; point it
            // at the local source so the site always demos this checkout
            'a5-js': resolve('../modules/'),
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
            },
            // Examples address the site's static files from the root
            // ('/data/...', '/textures/...'). Point those at the base path on
            // /next, so it reads its own data rather than falling through to
            // the production site's copy.
            ...(isNext
              ? [
                  {
                    enforce: 'pre',
                    test: /\.[jt]sx?$/,
                    include: resolve('../examples/website'),
                    use: [
                      {
                        loader: resolve('./scripts/rebase-static-urls-loader.js'),
                        options: {baseUrl}
                      }
                    ]
                  }
                ]
              : [])
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
        title: isNext ? 'A5 (next)' : 'A5',
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
