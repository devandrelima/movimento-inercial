FROM node:22-alpine
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
WORKDIR /app
COPY --chown=root:root --chmod=644 package.json index.mjs auth.mjs store.mjs validate.mjs users.mjs ./
RUN chmod 644 /app/*.mjs /app/package.json
# /data pertence ao usuário sem privilégios; o volume nomeado herda esse dono na primeira montagem.
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "index.mjs"]
