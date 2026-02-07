#!/usr/bin/env bash
# Download @hebcal/core browser bundle and place it in lib/hebcal/.
# Run from project root. No npm required.

set -e
HEBCAL_VERSION="${HEBCAL_VERSION:-6.0.8}"
DEST="lib/hebcal/hebcal-core.min.js"
URL="https://unpkg.com/@hebcal/core@${HEBCAL_VERSION}/dist/bundle.min.js"

mkdir -p lib/hebcal
echo "Fetching @hebcal/core@${HEBCAL_VERSION} to ${DEST}..."
curl -sS -L -o "$DEST" "$URL"
echo "Done. $(wc -c < "$DEST") bytes written to ${DEST}"
