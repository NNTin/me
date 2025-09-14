#!/bin/bash

set -e

# Install Ruby dependencies
bundle install

# Build the Jekyll site to the _site directory
bundle exec jekyll build --destination _site/me

# Add .nojekyll to prevent GitHub Pages from rebuilding the site
touch _site/me/.nojekyll