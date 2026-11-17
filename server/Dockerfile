FROM node:24-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4180 \
    KUROHA_DB=/data/db.json \
    KUROHA_UPLOADS=/data/uploads

WORKDIR /app

COPY package.json ./
COPY server.js ./

RUN mkdir -p /data && chown -R node:node /data

USER node

VOLUME /data
EXPOSE 4180

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4180) + '/api/health').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
