FROM node:20-bookworm-slim AS build

WORKDIR /app/backend

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package.json package.json
RUN npm install --omit=dev

COPY backend .

FROM node:20-bookworm-slim

WORKDIR /app/backend

COPY --from=build /app/backend /app/backend

EXPOSE 3000
CMD ["npm", "start"]
