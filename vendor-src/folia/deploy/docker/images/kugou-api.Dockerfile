FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY deploy/docker/kugou-api/package.json deploy/docker/kugou-api/package-lock.json ./
RUN npm ci --omit=dev
COPY deploy/docker/scripts/patch-music-api-client-ip.mjs /usr/local/lib/folia/patch-music-api-client-ip.mjs
RUN node /usr/local/lib/folia/patch-music-api-client-ip.mjs kugou

USER node
EXPOSE 3000

CMD ["node", "node_modules/kugoumusicapi/app.js"]
