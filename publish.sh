#!/usr/bin/env bash
# Tag the current package version (vX.Y.Z) and push it, triggering
# .github/workflows/publish.yml to build + publish a5-js to npm via trusted publishing.
#
#   ./publish.sh beta   # prerelease (1.0.0-beta.N) — typically from main
#   ./publish.sh prod   # stable release (X.Y.Z) — only from a *-release branch
#
# Run AFTER bumping "version" in package.json, updating CHANGELOG.md, and committing.
# The same `./publish.sh <mode>` entry point exists in all three repos (a5, a5-py, a5-rs);
# only the version-source manifest differs.
set -euo pipefail

MODE="${1:-}"
case "$MODE" in
  beta|prod) ;;
  *) echo "usage: ./publish.sh <beta|prod>" >&2; exit 2 ;;
esac

VERSION="$(node -p "require('./package.json').version")"
TAG="v${VERSION}"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# Cross-check: mode must match the version string, both ways.
case "$VERSION" in
  *-*)
    if [ "$MODE" = "prod" ]; then
      echo "error: version ${VERSION} is a prerelease but mode is 'prod' — use 'beta'" >&2
      exit 1
    fi ;;
  *)
    if [ "$MODE" = "beta" ]; then
      echo "error: version ${VERSION} is stable but mode is 'beta' — bump to a prerelease or use 'prod'" >&2
      exit 1
    fi ;;
esac

# Prod releases must come from a release branch; prereleases usually come from main.
if [ "$MODE" = "prod" ]; then
  case "$BRANCH" in
    *-release) ;;
    *) echo "error: 'prod' releases must be run from a *-release branch (on '${BRANCH}')" >&2; exit 1 ;;
  esac
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "error: working tree is not clean — commit the version bump + CHANGELOG first" >&2
  exit 1
fi

# Guard: tag must not already exist. If it does, the version was almost certainly not bumped.
if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  echo "error: tag ${TAG} already exists locally — did you forget to bump the version?" >&2
  exit 1
fi
if git ls-remote --exit-code --tags origin "refs/tags/${TAG}" >/dev/null 2>&1; then
  echo "error: tag ${TAG} already exists on origin — did you forget to bump the version?" >&2
  exit 1
fi

# Guard: CHANGELOG must have an entry for this version (heading form: "[v<version>]").
if ! grep -qF "[${TAG}]" CHANGELOG.md; then
  echo "error: no CHANGELOG.md entry for ${TAG} (expected a '[${TAG}]' heading)" >&2
  exit 1
fi

echo "Publishing ${TAG} (${MODE}) from '${BRANCH}' — tagging and pushing to trigger CI..."
git tag "${TAG}"
git push origin HEAD --tags
echo "Pushed ${TAG}. Watch the 'publish' workflow under GitHub Actions."
