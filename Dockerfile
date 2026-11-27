FROM node:22-slim AS builder
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .
ARG VITE_GOOGLE_MAPS_API_KEY=""
ARG VITE_API_BASE_URL="/api"
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build && npm run build:server

FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV AUTH_MODE=session
ENV DATA_BACKEND=dynamodb
ENV AWS_REGION=ap-south-1

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/public ./public
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist-server/server.mjs"]
