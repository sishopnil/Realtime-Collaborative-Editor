# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=20-alpine
ARG APP_ENV=production

FROM node:${NODE_VERSION} AS development
WORKDIR /app
RUN chown -R node:node /app
USER node
COPY --chown=node:node package*.json ./
RUN npm install
EXPOSE 4000
CMD ["npm", "run", "start:dev"]

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm install || true

FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build || true

FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=${APP_ENV}
USER node
COPY --from=builder /app .
EXPOSE 4000
CMD ["node","dist/main.js"]
