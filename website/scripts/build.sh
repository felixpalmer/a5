#!/bin/bash
set -e

# prod or next
MODE=$1
WEBSITE_DIR=`pwd`
OUTPUT_DIR=build

# rebuild modules from source
(
  cd ..
  # yarn build
)

# clean up cache
docusaurus clear

case $MODE in
  "prod")
    docusaurus build
    ;;
  # Maintainer preview of main, served from a5geo.org/next
  "next")
    NEXT_SITE=true docusaurus build
    ;;
esac
