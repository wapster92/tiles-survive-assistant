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

Для запуска frontend/backend в dev-режиме без Docker используйте `.env` в `frontend/` на основе `frontend/.env.example`, чтобы Vite ходил в `http://localhost:3000`.
