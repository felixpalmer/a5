# Contributing to A5

Thank you for contributing to the TypeScript version of [A5](https://a5geo.org). We are actively looking for new contributors.

## Setting up environment

First, make sure you have [Node.js](https://nodejs.org/) and [Yarn](https://yarnpkg.com/) installed.

```bash
# Install dependencies
yarn install
```

## Run tests

```bash
yarn test --run
```

## Build

```bash
yarn build
```

## Formatting

This project uses [Prettier](https://prettier.io/) for code formatting. The config in `.prettierrc.json` is the source of truth; editors that respect Prettier (Zed, VS Code, JetBrains, vim plugins) will pick it up automatically.

```bash
yarn format         # format all files in place
yarn format:check   # exit non-zero if any file would be reformatted (CI use)
```

## Generate fixtures

```bash
yarn generate-fixtures
```

## Sync fixtures to Python & Rust ports

After generating fixtures, sync them to the sibling `a5-py` and `a5-rs` repos:

```bash
yarn sync-fixtures            # copy updated fixtures
yarn sync-fixtures --dry-run  # preview what would be copied
yarn sync-fixtures --check    # exit 1 if any fixtures are out of sync (useful in CI)
```

## Publish (for maintainers)

### Git strategy

Prereleases run from `main`, stable from the `*-release` branches.
Each minor version gets a branch, e.g. `1.2-release` which is cut from `main`:

```bash
git checkout main
git pull
git checkout -b 1.2-release
```

PRs are merged to `main` and then cherry-picked to the latest release branch (in principle to older releases also, but this is rare).

```bash
git checkout 1.2-release
git cherry-pick 1234abcd
```

### Website update

Any changes pushed to the newest (based on npm) release branch updates the website

```bash
git checkout 1.2-release
git push origin 1.2-release
```

Trunk is published separately: every push to `main` deploys to
[a5geo.org/next](https://a5geo.org/next), so maintainers can preview the upcoming
version. It is a plain build of the same site with `baseUrl: '/next/'` (`yarn build-next`
in `website/`), deployed into the `next/` folder of `gh-pages`. The two sites are
independent — neither links to the other, and `/next` is excluded from search engines
and analytics. Examples keep their root-absolute asset paths (`/data/…`); a webpack loader
rewrites them to the base path in that build, so `/next` reads its own data.


### Publishing to npm

`./publish.sh` tags `v<version>` and pushes; CI builds, tests, and publishes to npm via trusted
publishing (no local `npm publish`).

```bash
# Update version in package.json (e.g. 1.0.0-beta.1 or 0.10.1)
# Add a "#### A5 [v<version>] - <date>" entry to CHANGELOG.md
git add package.json CHANGELOG.md
git commit -m "x.y.z release"

./publish.sh beta   # prerelease (-beta.N), from main
./publish.sh prod   # stable X.Y.Z, from a *-release branch
```
