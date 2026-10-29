# FiscalHub — imagem de produção
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production TZ=America/Sao_Paulo FUSO_HORARIO=America/Sao_Paulo DATA_DIR=/dados
RUN apk add --no-cache tzdata
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY package.json ./
RUN mkdir -p /dados && chown node:node /dados
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3000/api/saude || exit 1
CMD ["node", "dist/server.js"]
