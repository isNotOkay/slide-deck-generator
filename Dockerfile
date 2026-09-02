FROM node:24-alpine AS build

WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    STATIC_DIR=/app/browser

COPY --from=build /workspace/dist/server/ ./
COPY --from=build /workspace/dist/slide-deck-generator/browser/ ./browser/
COPY --from=build /workspace/data/deck.json ./default-deck.json
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /app/data \
    && chown -R node:node /app \
    && chmod 0555 /usr/local/bin/docker-entrypoint.sh

VOLUME ["/app/data"]
EXPOSE 3001

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD node --input-type=module -e "fetch('http://127.0.0.1:3001/healthz').then(response => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "/app/server/index.js"]
