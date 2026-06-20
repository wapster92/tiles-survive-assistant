# Tails Survive

Рабочее название проекта для калькулятора накопления очков недельного события `Turbo Turtle / Турбочерепашка` в `Tiles Survive`.

## Структура

- `frontend/` — Vue + Vite.
- `backend/` — Express API.
- `docs/` — контекст игры, архитектура и продуктовые заметки.

## Локальный запуск

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

По умолчанию backend слушает `http://localhost:3000`, frontend — `http://localhost:5173`.

В dev-режиме frontend проксирует `/api`, `/api-docs`, `/openapi.json` и `/health` на backend. Если backend запущен не на `http://localhost:3000`, задайте `VITE_DEV_API_URL` в `frontend/.env`.

Swagger UI backend доступен по адресу `http://localhost:3000/api-docs`, OpenAPI JSON — `http://localhost:3000/openapi.json`.

## Docker

```bash
docker compose up --build
```

Приложение будет доступно на `http://localhost:8080`.

Проектный nginx отдает собранный Vue-фронт и проксирует:

- `/api/*` → backend;
- `/api-docs/*` → Swagger UI;
- `/openapi.json` → OpenAPI JSON.
- `/health` → проверка backend.

SQLite-база backend хранится в Docker volume `sqlite-data`. Локально путь можно переопределить через `SQLITE_DATABASE_PATH`.

### Production на VPS

На сервере внешний nginx проксирует домен `assistant.1062685-cv77550.tmweb.ru` на проектный nginx по `127.0.0.1:8081`.

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```
