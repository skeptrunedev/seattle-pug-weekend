#!/usr/bin/env bash
# Assemble the clean Pages output dir (only public files; functions/ is compiled
# separately by wrangler, node_modules/configs/drafts never get published).
set -e
cd "$(dirname "$0")"
rm -rf dist && mkdir -p dist/assets
cp index.html style.css app.js sw.js manifest.webmanifest _headers \
   favicon.ico favicon-16.png favicon-32.png apple-touch-icon.png icon-192.png icon-512.png dist/
cp -r assets/img dist/assets/
echo "built dist/ ($(find dist -type f | wc -l) files)"
