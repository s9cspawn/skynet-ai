# Local AI Chat

A private Angular chat interface for a local `llama.cpp` model. Nginx is the only browser-facing service; it serves the Angular build and proxies `/api` to an Express API bound to localhost. The API validates requests, discovers the loaded model, and streams the OpenAI-compatible llama.cpp response without buffering it.

```text
Windows browser
      |
      v
Nginx :80
  |       \
  |        +--> Angular static files
  v
/api/* --> Node/Express 127.0.0.1:3000
                         |
                         v
                 llama.cpp 127.0.0.1:8080
                         |
                         v
                    Gemma GGUF
```

## Features

- Incremental token streaming with clean SSE parsing
- Browser cancellation that aborts the upstream llama.cpp request
- Markdown with sanitized HTML, tables, code blocks, and copy controls
- Local conversation history, automatic titles, and persisted settings
- Model health and discovery through `/health`, `/v1/health`, and `/v1/models`
- Responsive dark interface with mobile conversation navigation
- Request validation, size limits, security headers, request IDs, and metadata-only logs

## Prerequisites

- Ubuntu under WSL with systemd enabled when services are desired
- Node.js 20.19 or newer and npm
- Nginx
- A recent llama.cpp build
- A Gemma GGUF model that your llama.cpp build supports

Angular CLI is installed as a project dependency. A global Angular CLI installation is optional.

On Ubuntu, install the OS packages after configuring a current Node.js release:

```bash
sudo apt update
sudo apt install nginx curl
node --version
npm --version
```

## Run llama.cpp

The application does not download or manage model files. Start the server with your existing model path:

```bash
/opt/llama.cpp/build/bin/llama-server \
  -m /path/to/gemma-model.gguf \
  --host 127.0.0.1 \
  --port 8080 \
  -ngl 99
```

Recent llama.cpp builds may also load a compatible Hugging Face repository with `-hf owner/repository[:quant]`. Check the options supported by your installed binary with `llama-server --help`; local GGUF loading remains the predictable production choice.

Verify the running model before starting the application:

```bash
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/v1/models
```

## Configure the API

```bash
cp backend/.env.example backend/.env
```

The defaults are:

```dotenv
LLAMA_BASE_URL=http://127.0.0.1:8080
LLAMA_MODEL=gemma4-12b
API_HOST=127.0.0.1
API_PORT=3000
LLAMA_TIMEOUT_MS=600000
MAX_REQUEST_BYTES=262144
```

`LLAMA_MODEL` is a fallback. When llama.cpp exposes `/v1/models`, the health response reports its actual model identifier. Keep `LLAMA_BASE_URL` in server configuration; the browser cannot supply an upstream URL.

## Development

From the repository root:

```bash
npm install
npm run dev:backend
```

In a second shell:

```bash
npm run dev:frontend
```

Open `http://localhost:4200`. Angular's development proxy maps `/api` to `127.0.0.1:3000`, while llama.cpp stays private on `127.0.0.1:8080`.

## Build and deploy

Build without deploying:

```bash
npm ci
npm run build
```

Angular 22 writes browser assets to `frontend/dist/frontend/browser`. The backend compiles to `backend/dist`.

The deployment script installs dependencies, builds both applications, verifies Angular's actual browser output directory, and copies it to `/var/www/local-ai-chat/browser`:

```bash
chmod +x scripts/*.sh
./scripts/build.sh
```

Only the final directory creation and copy use root privileges. The npm installation and builds run as the current user.

Install and validate Nginx:

```bash
sudo cp nginx/local-ai-chat.conf /etc/nginx/sites-available/local-ai-chat
sudo ln -sfn /etc/nginx/sites-available/local-ai-chat /etc/nginx/sites-enabled/local-ai-chat
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

The Nginx proxy deliberately omits a trailing slash from `proxy_pass`, preserving `/api/chat` and `/api/health` when forwarding to Express. Buffering, request buffering, cache, and gzip are disabled for `/api` so token events reach the browser immediately.

## Run the backend as a service

The included unit assumes the repository is deployed to `/opt/local-ai-chat` and runs under a dedicated account:

```bash
sudo useradd --system --home /opt/local-ai-chat --shell /usr/sbin/nologin local-ai-chat
sudo cp systemd/local-ai-chat-api.service /etc/systemd/system/
sudo mkdir -p /etc/local-ai-chat
sudo cp backend/.env.example /etc/local-ai-chat/api.env
sudo systemctl daemon-reload
sudo systemctl enable --now local-ai-chat-api
sudo systemctl status local-ai-chat-api
```

Edit `/etc/local-ai-chat/api.env` for your model identifier if needed. Restart after configuration changes:

```bash
sudo systemctl restart local-ai-chat-api
sudo journalctl -u local-ai-chat-api -f
```

`systemd/llama-server.service.example` is optional. Review its user, binary path, model path, and GPU layers before copying it. Do not replace an existing llama.cpp unit. A typical environment file is:

```dotenv
LLAMA_MODEL_PATH=/models/gemma-model.gguf
LLAMA_GPU_LAYERS=99
```

If systemd is disabled in WSL, run these in separate shells:

```bash
./scripts/start-backend.sh
sudo nginx -g 'daemon off;'
```

## API checks

```bash
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:8080/health
curl -N -H 'Content-Type: application/json' -X POST \
  http://127.0.0.1:3000/api/chat \
  -d '{"messages":[{"role":"user","content":"Say hello in one sentence."}]}'
curl http://localhost/api/health
```

Or run `./scripts/test-api.sh`. Each streamed response contains llama.cpp SSE events ending with `data: [DONE]`; the browser consumes the event envelope and displays only assistant text.

## Troubleshooting

**Model offline.** Run both llama.cpp health commands above. Confirm it is bound to `127.0.0.1:8080`, then inspect its startup output for model loading failures.

**502 Bad Gateway.** Check `systemctl status local-ai-chat-api`, then call `curl http://127.0.0.1:3000/api/health`. Nginx can return 502 when the API is stopped or bound to a different port.

**Angular refresh returns 404.** Confirm the active Nginx configuration contains `try_files $uri $uri/ /index.html;` and that `/var/www/local-ai-chat/browser/index.html` exists.

**Streaming arrives all at once.** Validate that the `/api/` location has `proxy_buffering off`, `proxy_request_buffering off`, `proxy_cache off`, and `gzip off`. Confirm the browser calls `/api/chat`, not llama.cpp directly.

**Port already in use.** Inspect listeners with `ss -ltnp | grep -E ':(80|3000|8080)\\b'`. Change `API_PORT` only together with the Nginx upstream.

**llama-server model loading fails.** Verify the GGUF path, file permissions, available RAM/VRAM, and whether the model architecture is supported by the installed llama.cpp revision.

**CUDA/GPU is not detected.** Check that llama.cpp was compiled with CUDA support, run `nvidia-smi` inside WSL, and reduce `-ngl` if the model exceeds available VRAM.

**WSL networking.** Current WSL versions normally forward Windows `localhost` to WSL. If another machine must connect, allow TCP 80 in Windows Firewall and use the Windows host address. Keep ports 3000 and 8080 bound to loopback.

## Project layout

```text
frontend/   Angular 22 standalone application
backend/    Express API and llama.cpp provider
nginx/      Production reverse-proxy configuration
scripts/    Build, start, and API verification helpers
systemd/    API unit and optional llama.cpp example
```

Conversation content is stored only in browser `localStorage`. Backend logs contain request IDs, endpoint, status, message count, duration, and upstream failures; prompts and responses are not logged.
