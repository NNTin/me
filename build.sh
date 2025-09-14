#!/bin/bash

set -e

# Install Ruby dependencies
bundle install

# Build the Jekyll site to the _site directory
bundle exec jekyll build
# Add .nojekyll to prevent GitHub Pages from rebuilding the site
touch _site/.nojekyll