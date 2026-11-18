# KURO — YouTube Downloader

KURO preserves the original k38a7 downloader interface and functionality, rebranded as KURO. The original ZIP contained the frontend and downloader controls, but not the backend. This project adds a Node.js API backed by yt-dlp and FFmpeg.

## What works
- Original responsive downloader UI, settings, queue, history, video/audio options, and progress interface.
- `POST /get-metadata` for video title, creator, thumbnail, duration and stats.
- `POST /download` starts a server-side download job.
- `GET /progress/:jobId` streams progress with Server-Sent Events.
- `GET /download-file/:jobId` serves the finished file as an attachment.
- `DELETE /download/:jobId` cancels a running job.
- Single-file frontend build: `dist/index.html` (CSS and JS inlined by Vite).

## Run locally
Requires Node.js 22+, Python 3, FFmpeg, and yt-dlp installed and available on PATH.

```bash
npm ci
npm run build
node server.mjs
```

Open http://localhost:3000.

## Deploy
Deploy this repository to Render as a **Docker** web service. `Dockerfile` installs yt-dlp and FFmpeg, builds the single-file frontend, and runs the backend. The `render.yaml` file contains the service configuration.

## Important
Use downloads only for videos you own or have permission to download, and comply with the relevant platform terms and copyright rules. The backend intentionally accepts YouTube URLs only, rejects playlist downloads in this initial release, and does not support DRM-protected services. Render's free filesystem is ephemeral and free instances may sleep; files can disappear after restart/sleep and long downloads may be interrupted. For a production service, use persistent storage and a suitable host.
