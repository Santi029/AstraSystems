#!/bin/sh
# Local/build-only checks. No deployment action, credentials or remote writes.
set -eu
npm test
npm run build:static
node static-hosting/check-build.mjs
node scripts/test-static-hold-browser.mjs
