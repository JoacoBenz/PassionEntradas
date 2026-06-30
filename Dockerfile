# =============================================================================
# Multi-stage. Runtime sobre la imagen oficial de Playwright (trae Chromium y
# el usuario no-root `pwuser`). El front Next.js NO va acá.
# =============================================================================

# ---- Builder ----------------------------------------------------------------
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- Runtime ----------------------------------------------------------------
# La versión DEBE coincidir con la de `playwright` en package.json.
FROM mcr.microsoft.com/playwright:v1.55.1-jammy AS runtime
ENV NODE_ENV=production \
    STATE_DIR=/data \
    HEALTH_PORT=8080
WORKDIR /app

# Volumen de estado (storageState/cookies). Permisos restringidos al usuario no-root.
RUN mkdir -p /data && chown -R pwuser:pwuser /data

COPY --chown=pwuser:pwuser package.json ./
COPY --from=builder --chown=pwuser:pwuser /app/node_modules ./node_modules
COPY --from=builder --chown=pwuser:pwuser /app/dist ./dist

USER pwuser
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["node", "dist/healthcheck.js"]

CMD ["node", "dist/index.js"]
