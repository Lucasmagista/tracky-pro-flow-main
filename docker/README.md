# Docker — Tracky Pro Flow

Este diretório contém Dockerfiles e instruções para rodar o frontend e o backend localmente com Docker.

Arquivos relevantes

- `docker/wppconnect/Dockerfile` — imagem do backend (Node + Chromium) com HEALTHCHECK.
- `docker/frontend/Dockerfile` — Docker multistage (build com Node + serve via Nginx).
- `docker-compose.yml` — Compose na raiz (usa `docker/wppconnect/Dockerfile` e volume `wpp_sessions`).

Como rodar localmente

1) Subir apenas o backend (WPPConnect):

```powershell
# build e iniciar o serviço wppconnect
docker compose up --build -d wppconnect
```

2) Subir ambos (backend + frontend via compose se quiser adaptar):

```powershell
# build e iniciar todos os serviços
docker compose up --build -d
```

3) Rodar só o frontend (imagem multistage):

```powershell
# build da imagem
docker build -f docker/frontend/Dockerfile -t tracky-frontend:latest .
# rodar
docker run --rm -p 8080:80 tracky-frontend:latest
```

Volumes e persistência

- `wpp_sessions` (volume Docker nomeado) é usado para persistir as sessões do WPPConnect em `/data/wpp-sessions`.
- Ao usar Render, configure um Persistent Disk / Mount para `/data/wpp-sessions`.

Environment variables (exemplos)

- `WPP_SECRET_KEY` — token para autenticar requests para o backend.
- `WPP_PORT` — porta em que o servidor WPPConnect irá rodar (default 21465).
- `WPP_TOKEN_DIR` — diretório para salvar tokens/sessions (dentro do container), ex: `/data/wpp-sessions`.

Dicas

- Nunca exponha o diretório de sessões sem autenticação adequada.
- Use Watchtower ou CI para manter as imagens atualizadas em produção.

