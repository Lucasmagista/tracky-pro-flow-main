FROM node:20-bullseye-slim

ENV DEBIAN_FRONTEND=noninteractive

# Instalar dependências mínimas e Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  fonts-liberation \
  libnss3 \
  lsb-release \
  wget \
  gnupg \
  xvfb \
  chromium \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar package.json e instalar dependências (production)
COPY package*.json ./
RUN npm ci --production

# Copiar o resto do código
COPY . .

ENV NODE_ENV=production
ENV WPP_PORT=21465

EXPOSE ${WPP_PORT}

# Healthcheck irá pingar o endpoint /health
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${WPP_PORT}/health || exit 1

CMD ["node", "wppconnect-server.js"]
