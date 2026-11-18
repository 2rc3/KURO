FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ffmpeg ca-certificates curl unzip && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL https://deno.land/install.sh | sh \
 && python3 -m venv /opt/yt-dlp \
 && /opt/yt-dlp/bin/pip install --no-cache-dir -U yt-dlp
ENV PATH="/root/.deno/bin:/opt/yt-dlp/bin:${PATH}"
COPY --from=build /app/dist ./dist
COPY server.mjs ./server.mjs
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.mjs"]
