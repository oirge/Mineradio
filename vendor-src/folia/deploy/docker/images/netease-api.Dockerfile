FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV ENABLE_GENERAL_UNBLOCK=false

COPY deploy/docker/netease-api/package.json deploy/docker/netease-api/package-lock.json ./
RUN npm ci --omit=dev
COPY deploy/docker/scripts/patch-music-api-client-ip.mjs /usr/local/lib/folia/patch-music-api-client-ip.mjs
RUN node /usr/local/lib/folia/patch-music-api-client-ip.mjs netease

USER node
EXPOSE 3000

CMD ["node", "node_modules/@neteasecloudmusicapienhanced/api/app.js"]
