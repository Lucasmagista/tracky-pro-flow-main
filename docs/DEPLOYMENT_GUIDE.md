# Guia Completo de Deploy — Tracky Pro Flow

> Guia prático, atualizado e organizado para colocar o Tracky Pro Flow em produção.

![Vercel](https://img.shields.io/badge/hosting-vercel-000000?style=flat&logo=vercel)
![Render](https://img.shields.io/badge/hosting-render-3b82f6?style=flat&logo=render)
![Supabase](https://img.shields.io/badge/database-supabase-08b6ff?style=flat&logo=supabase)
![Docker](https://img.shields.io/badge/container-docker-2496ed?style=flat&logo=docker)

Observação rápida:
- Projeto: frontend React + TypeScript com Vite (build -> `dist/`).
- Backend (opcional): `wppconnect-server.js` — servidor Express que usa WPPConnect (necessita de Chrome/Chromium no ambiente para criação de sessão).
- Supabase: usado para banco de dados e Edge Functions (hospedadas no Supabase).
- Node.js recomendado: >= 20 (conforme README).

## Sumário
- Pré-requisitos
- Variáveis de ambiente importantes
- Build local
- Deploy Frontend (por provedor)
- Deploy Backend Node (`wppconnect-server.js`) — por provedor e com Docker
- Supabase: notas de deploy (migrations & functions)
- Docker e docker-compose (exemplos)
- Kubernetes (manifesto mínimo)
- CI/CD (exemplo de GitHub Actions)
- Checklist de deploy
- Troubleshooting comum

---

## Pré-requisitos

- Node.js >= 20
- npm >= 10 (ou yarn/pnpm conforme preferência)
- Git
- Conta nos provedores que pretende usar (Vercel, Netlify, Cloudflare, AWS, Firebase, Azure, Render, Railway, etc.)
- chaves de API / variáveis (ver seção abaixo)
- (Para backend com WPPConnect) ambiente com Chromium/Chrome instalável — preferir Docker para consistência

## Variáveis de ambiente (extraídas do README)

As variáveis abaixo aparecem no projeto — ajuste conforme seu ambiente. Variáveis com prefixo `VITE_` serão injetadas no bundle cliente.

- VITE_SUPABASE_URL (OBRIGATÓRIO)
- VITE_SUPABASE_ANON_KEY (OBRIGATÓRIO)
- VITE_NUVEMSHOP_APP_ID
- VITE_NUVEMSHOP_APP_SECRET
- VITE_NUVEMSHOP_REDIRECT_URI
- VITE_SMARTENVIOS_API_KEY
- VITE_SMARTENVIOS_ENVIRONMENT
- VITE_SENTRY_DSN
- VITE_GA_ID

Variáveis relacionadas ao servidor WPPConnect (backend):
- WPP_PORT (ex: 21465)
- WPP_SECRET_KEY

Outras variáveis que podem existir nas Edge Functions ou backends: chaves de SMTP, Twilio, credentials de marketplaces, etc.

Importante: mantenha segredos no dashboard do provedor (Vercel/Netlify/Render) ou em GitHub Secrets para CI. Nunca commitar `.env` com segredos.

## Build local

Instalar dependências e gerar build:

```powershell
npm install
npm run build
```

O output do Vite ficará em `dist/`.

## Deploy Frontend — opções e passos rápidos

Observação: o comando de build é `npm run build` e o diretório a publicar é `dist/`.

- Vercel (recomendado para projetos Vite)
  - Conectar repositório no dashboard Vercel.
  - Build Command: `npm run build`
  - Output Directory: `dist`
  - Adicionar variáveis de ambiente no Settings > Environment Variables (usando `VITE_` para variáveis do cliente).
  - Ou usar CLI:
    ```powershell
    npm i -g vercel
    vercel login
    vercel --prod
    ```

- Netlify
  - Criar novo site -> conectar repositório.
  - Build command: `npm run build`
  - Publish directory: `dist`
  - Adicionar Environment Variables no Site settings.

- Cloudflare Pages
  - Criar projeto -> conectar repositório.
  - Build command: `npm run build`
  - Build output directory: `dist`
  - Defina as environment variables (Cloudflare também expõe secrets para build e runtime).

- GitHub Pages
  - Recomendado usar Action para build e deploy para branch `gh-pages` (ex.: `peaceiris/actions-gh-pages` ou `JamesIves/github-pages-deploy-action`).
  - Configure action para rodar `npm run build` e publicar `dist/`.

- AWS S3 + CloudFront
  - Build local (`npm run build`).
  - Faça upload do conteúdo de `dist/` para um bucket S3 (hosting estático ativado).
  - Configure CloudFront como CDN com o bucket S3 como origem; ative invalidações ao publicar.
  - Ferramentas úteis: `aws s3 sync dist/ s3://your-bucket --delete` e `aws cloudfront create-invalidation`.

- Firebase Hosting
  - `npm i -g firebase-tools`
  - `firebase login`
  - `firebase init hosting` (escolha `dist` como diretório público)
  - `firebase deploy --only hosting`

- Azure Static Web Apps
  - Use GitHub Action automática ao conectar o repositório no Azure Static Web Apps.
  - Build command: `npm run build`, App location `/`, Output location `dist`.

- Render / DigitalOcean App Platform
  - Configure um Static Site apontando para o repositório.
  - Build command: `npm run build`, Publish: `dist`.

Considerações de roteamento (SPA)
- Para SPA certifique-se de ativar fallback para `index.html` (Netlify e Cloudflare Pages têm isso por padrão; S3+CloudFront requer configuração de behavior ou lambda@edge).

## Supabase — notas de deploy

- Migrations: use `supabase` CLI para aplicar migrations (`supabase db push` ou `supabase migration`).
- Edge Functions: deploy via `supabase functions deploy <name>`.
- Configure variáveis de ambiente do Supabase no dashboard (SERVICE_ROLE, JWT secret) quando necessário.

## Deploy Backend Node (`wppconnect-server.js`)

O servidor `wppconnect-server.js` usa WPPConnect e precisa de um ambiente com Chrome/Chromium para funcionar corretamente. Recomenda-se Docker para garantir dependências nativas (p.ex. libs do Chromium).

Opções:

- Render
  - Crie um Web Service apontando para o repositório.
  - Build Command: `npm install --production` (ou `npm ci`) e Start Command: `node wppconnect-server.js`.
  - Defina environment variables (`WPP_SECRET_KEY`, `WPP_PORT`, chaves externas) no dashboard.
  - Para Chrome: use uma Dockerfile personalizada que instala Chromium e use o Deploy via Docker no Render.

- Railway
  - Crie um projeto, adicione o serviço Web, defina o Start Command e vars.
  - Se precisar de Chromium, use Dockerfile e deploy via Docker.

- Fly.io
  - Ideal para apps com dependências nativas. Use `fly launch` e um `Dockerfile` que instala Chromium.

- VPS / Docker
  - Crie Dockerfile (exemplo abaixo) que instala Chromium e executa `node wppconnect-server.js`.

- Docker + PM2 / systemd
  - Deploy em VM com Docker Compose ou build de imagem e execução como serviço systemd/PM2.

### Exemplo de Dockerfile (servidor WPPConnect)

Este Dockerfile é um ponto de partida — ajuste conforme necessidades de segurança e arquitetura.

```dockerfile
FROM node:20-bullseye-slim

ENV DEBIAN_FRONTEND=noninteractive

# Instalar dependências do Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  fonts-liberation \
  libnss3 \
  lsb-release \
  wget \
  gnupg \
  xvfb \
  && rm -rf /var/lib/apt/lists/*

# Instalar Chromium do Debian
RUN apt-get update && apt-get install -y chromium \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .

ENV WPP_PORT=21465
ENV WPP_SECRET_KEY=changeme

EXPOSE $WPP_PORT

CMD ["node", "wppconnect-server.js"]
```

Observações:
- Em imagens menores (alpine), instalar Chromium pode ser mais trabalhoso; a imagem `bullseye-slim` costuma ser mais direta.
- Ajuste `browserArgs` no `wppconnect.create()` caso precise desabilitar sandbox em ambientes serverless.

## Docker Compose — Exemplo (frontend servido por nginx + backend)

```yaml
version: '3.8'
services:
  frontend:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./:/app:ro
    command: sh -c "npm ci && npm run build && npm i -g serve && serve -s dist -l 3000"
    ports:
      - "3000:3000"

  wpp:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - WPP_PORT=21465
      - WPP_SECRET_KEY=${WPP_SECRET_KEY}
    ports:
      - "21465:21465"
```

## Kubernetes — manifesto mínimo (Deployment + Service para o backend)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wppconnect
spec:
  replicas: 1
  selector:
    matchLabels:
      app: wppconnect
  template:
    metadata:
      labels:
        app: wppconnect
    spec:
      containers:
        - name: wppconnect
          image: your-registry/wppconnect:latest
          ports:
            - containerPort: 21465
          env:
            - name: WPP_SECRET_KEY
              valueFrom:
                secretKeyRef:
                  name: wpp-secret
                  key: secret

---
apiVersion: v1
kind: Service
metadata:
  name: wppconnect-svc
spec:
  selector:
    app: wppconnect
  ports:
    - protocol: TCP
      port: 21465
      targetPort: 21465
  type: ClusterIP
```

## CI/CD — Exemplo de GitHub Actions

Exemplo: build do frontend e deploy para S3 + CloudFront (alternativa: adaptar para Vercel/Netlify usando actions oficiais). Crie secrets no repo: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`.

```yaml
name: CI Deploy to S3

on:
  push:
    branches: [ main ]

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Use Node.js
        uses: actions/setup-node@v5
        with:
          node-version: '20'
      - name: Install deps
        run: npm ci
      - name: Build
        run: npm run build
      - name: Sync to S3
        uses: jakejarvis/s3-sync-action@v0.5.1
        with:
          args: --acl public-read --follow-symlinks --delete
        env:
          AWS_S3_BUCKET: ${{ secrets.S3_BUCKET }}
          AWS_REGION: ${{ secrets.AWS_REGION }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      - name: Invalidate CloudFront
        uses: chetan/invalidate-cloudfront-action@v1
        with:
          distribution: ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }}
          paths: '/*'
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

Para Vercel/Netlify as actions oficiais ou integração direta do dashboard costumam ser mais simples.

## Checklist de Deploy (pré-lançamento)

1. Build local sem erros: `npm run build`
2. Variáveis de ambiente definidas no provedor
3. Certificados TLS/HTTPS configurados (CDN/provedor)
4. Domínio apontado (DNS) e CNAME/ALIAS configurado
5. RLS e permissões do Supabase verificadas
6. Secrets rotacionados e sem chaves no repositório
7. Monitoramento: Sentry configurado e DSN setado
8. Backups e migrations do DB aplicados (Supabase migration)
9. Testes básicos pós-deploy: health checks, login, rotas principais

## Troubleshooting comum

- Build falha no provedor (ex: Vercel/Netlify): verifique Node version no dashboard e `engines` no package.json.
- Variáveis `VITE_` não aparecem no cliente: confirme que estão definidas no ambiente de build do provedor (são embedadas no build time).
- WPPConnect não gera QR Code / crash: verifique dependências do Chromium no ambiente; usar Docker com Chromium frequentemente resolve.
- 404 em rotas SPA: habilite fallback para `index.html` no provedor (Netlify/Cloudflare/Static Web Apps têm opção). S3/CloudFront precisa de configuração extra.

## Próximos passos recomendados

1. Criar um workflow GitHub Actions para PR checks (lint, tests) e outro para deploy automático em `main`.
2. Criar uma imagem Docker multistage para o frontend (se for preferir servir via CDN estática talvez não precise).
3. Preparar template de Compose/Helm para facilitar deploy em DigitalOcean/Kubernetes.
4. Documentar how-to para rotacionar segredos e monitoramento (Sentry alerts).

---

## Exemplo rápido de verificação / testes pós-deploy

1. Endpoints:
   - Frontend: abrir domínio público e verificar console do browser por erros (F12).
   - Backend: `GET /health` do `wppconnect-server` deve retornar status ok.

2. Teste Supabase: executar uma query simples via client no frontend ou curl nas Edge Functions.

3. Teste WPPConnect: iniciar sessão e garantir QR Code gerado via endpoint `POST /api/:sessionName/start-session` (autenticação com `WPP_SECRET_KEY`).

---

Se quiser, eu posso:

- Gerar um `Dockerfile` otimizado para o frontend (build multistage) e outro para o backend com Chromium pronto.
- Criar um template GitHub Actions completo para deploy automático em Vercel/Netlify/Render.
- Gerar um `docker-compose.yml` completo com nginx reverso e volumes seguros para sessões do WPPConnect.

Diga qual (ou quais) provedores você pretende usar primeiro que eu preparo os arquivos e actions adaptados.
