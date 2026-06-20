FROM node:20-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
RUN npm ci --omit=dev --workspace backend

COPY backend backend

FROM node:20-bookworm-slim

WORKDIR /app/backend

COPY --from=build /app /app

EXPOSE 3000
CMD ["npm", "start"]
