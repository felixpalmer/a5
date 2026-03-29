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

```bash
Update version in package.json
yarn build
yarn test --run

Update CHANGELOG
git add CHANGELOG.md package.json
git commit -m "x.y.z release"
npm publish

git tag vx.y.z
git push && git push --tags
```
