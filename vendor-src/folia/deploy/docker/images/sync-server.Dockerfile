FROM node:24-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY sync-server/package.json sync-server/package-lock.json ./
RUN npm ci

COPY sync-server/tsconfig.json ./
COPY sync-server/src ./src
RUN npm run build:node

FROM node:24-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/folia-sync.db

RUN apk add --no-cache python3 make g++ su-exec
COPY sync-server/package.json sync-server/package-lock.json ./
RUN npm ci --omit=dev \
    && apk del python3 make g++ \
    && mkdir -p /app/data \
    && chown node:node /app/data

COPY --from=builder /app/dist ./dist
COPY deploy/docker/sync-server/entrypoint.sh /usr/local/bin/folia-sync-server
RUN chmod 0555 /usr/local/bin/folia-sync-server

VOLUME ["/app/data"]
EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/folia-sync-server"]
