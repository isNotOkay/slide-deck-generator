#!/bin/sh
set -eu

if [ ! -f /app/data/deck.json ]; then
    cp /app/default-deck.json /app/data/deck.json
fi

exec "$@"
