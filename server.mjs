import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const OUT = process.env.DOWNLOAD_DIR || path.join(os.tmpdir(), 'kuro-downloads');
const jobs = new Map();
fs.mkdirSync(OUT, { recursive: true });

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', ...headers });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1_000_000) reject(new Error('Request too large')); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { reject(new Error('Invalid JSON body')); } });
    req.on('error', reject);
  });
}
function validYouTube(value) {
  try {
    const u = new URL(value);
    const h = u.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    return ['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'music.youtube.com'].includes(h) && ['http:', 'https:'].includes(u.protocol);
  } catch { return false; }
}
function emit(job, data) {
  const packet = `data: ${JSON.stringify(data)}\n\n`;
  job.history.push(packet);
  if (job.history.length > 250) job.history.shift();
  for (const client of job.clients) { try { client.write(packet); } catch {} }
}
function runYtDlp(args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.env.YTDLP_PATH || 'yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let stdout = '', stderr = '';
    p.stdout.on('data', c => stdout += c.toString());
    p.stderr.on('data', c => stderr += c.toString());
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve(stdout.trim()) : reject(new Error((stderr || stdout || `yt-dlp exited ${code}`).slice(-3000))));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type' }); return res.end(); }
  if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, service: 'KURO downloader backend', ytDlp: true });

  if (req.method === 'POST' && url.pathname === '/get-metadata') {
    try {
      const body = await readBody(req);
      if (!validYouTube(body.mediaUrl)) return send(res, 400, { error: 'Please enter a valid YouTube video URL.' });
      const raw = await runYtDlp(['--dump-single-json', '--skip-download', '--no-warnings', '--no-playlist', '--socket-timeout', '20', body.mediaUrl]);
      const m = JSON.parse(raw);
      return send(res, 200, { title: m.title || 'Untitled video', creator: m.uploader || m.channel || 'Unknown creator', thumbnailUrl: m.thumbnail || null, thumbnails: m.thumbnails || [], durationSeconds: m.duration ?? null, youtubeVideoId: m.id || null, viewCount: m.view_count ?? null, likeCount: m.like_count ?? null, dislikeCount: null });
    } catch (e) { return send(res, 502, { error: `Could not read video information: ${e.message}` }); }
  }

  if (req.method === 'POST' && url.pathname === '/download') {
    try {
      const b = await readBody(req);
      if (!validYouTube(b.mediaUrl)) return send(res, 400, { error: 'Only valid YouTube video URLs are supported.' });
      if (b.enablePlaylist) return send(res, 400, { error: 'Playlist downloads are disabled in this initial backend. Download videos individually.' });
      const id = randomUUID();
      const job = { id, clients: new Set(), history: [], process: null, done: false, file: null };
      jobs.set(id, job);
      const dir = path.join(OUT, id); fs.mkdirSync(dir, { recursive: true });
      const resolution = Math.max(144, Math.min(4320, Number.parseInt(b.resolution || '1080', 10) || 1080));
      const type = b.format === 'gif' ? 'gif' : (b.downloadType || (b.format && ['mp3','m4a','opus','ogg','flac','wav'].includes(b.format) ? 'audio' : 'video'));
      const fmt = ['mp3','m4a','opus','ogg','flac','wav'].includes(b.format) ? b.format : 'mp3';
      const args = ['--no-playlist', '--newline', '--progress', '--progress-template', 'download:KURO_PROGRESS:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s', '--print', 'after_move:KURO_FILE:%(filepath)s', '--output', path.join(dir, '%(title).160B [%(id)s].%(ext)s'), '--no-warnings', '--retries', String(Math.max(1, Math.min(20, Number(b.advRetries) || 5))), '--socket-timeout', '30'];
      if (type === 'audio') args.push('-x', '--audio-format', fmt, '--audio-quality', String(b.audioBitrate || '0'));
      else args.push('-f', `bv*[height<=${type === 'gif' ? Math.min(resolution, 480) : resolution}]+ba/b[height<=${type === 'gif' ? Math.min(resolution, 480) : resolution}]/b`, '--merge-output-format', 'mp4');
      if (b.includeSubtitles) args.push('--write-subs', '--write-auto-subs', '--sub-langs', 'all,-live_chat');
      args.push(b.mediaUrl);
      emit(job, { status: 'starting', progress: 0, message: 'Preparing download…' });
      const child = spawn(process.env.YTDLP_PATH || 'yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      job.process = child;
      let stderr = '', stdoutBuf = '';
      const onLine = line => {
        const fileMatch = line.match(/^KURO_FILE:(.+)$/);
        if (fileMatch) { job.file = fileMatch[1].trim(); return; }
        const pm = line.match(/^KURO_PROGRESS:([^|]*)\|([^|]*)\|?(.*)$/);
        if (pm) {
          const progress = Number.parseFloat(pm[1].replace('%', '').trim());
          emit(job, { status: 'downloading', ...(Number.isFinite(progress) ? { progress } : {}), message: [pm[2] ? `Speed ${pm[2]}` : '', pm[3] ? `ETA ${pm[3]}` : ''].filter(Boolean).join(' · ') || 'Downloading…' });
        } else if (line.trim()) emit(job, { status: 'downloading', message: line.trim().slice(0, 500) });
      };
      child.stdout.on('data', c => { stdoutBuf += c.toString(); const lines = stdoutBuf.split(/\r?\n/); stdoutBuf = lines.pop() || ''; lines.forEach(onLine); });
      child.stderr.on('data', c => { const s = c.toString(); stderr = (stderr + s).slice(-5000); s.split(/\r?\n/).filter(Boolean).forEach(onLine); });
      child.on('error', e => { job.done = true; emit(job, { status: 'error', done: true, success: false, error: e.message }); });
      child.on('close', code => {
        if (code === 0 && job.file && fs.existsSync(job.file)) {
          if (type === 'gif') {
            const gifPath = job.file.replace(/\.[^.]+$/, '') + '.gif';
            const ff = spawn('ffmpeg', ['-y', '-i', job.file, '-vf', `fps=${Math.max(1, Math.min(30, Number(b.gifFps) || 15))},scale=${Math.max(160, Math.min(960, Number(b.gifWidth) || 480))}:-1:flags=lanczos`, gifPath]);
            ff.on('close', ffCode => { job.done = true; if (ffCode === 0 && fs.existsSync(gifPath)) { job.file = gifPath; emit(job, { status: 'complete', progress: 100, done: true, success: true, downloadUrl: `/download-file/${id}`, message: 'GIF completed.' }); } else emit(job, { status: 'error', done: true, success: false, error: 'GIF conversion failed. Check that FFmpeg is installed.' }); for (const c of job.clients) { try { c.end(); } catch {} } job.clients.clear(); });
          } else { job.done = true; emit(job, { status: 'complete', progress: 100, done: true, success: true, downloadUrl: `/download-file/${id}`, message: 'Download completed.' }); for (const c of job.clients) { try { c.end(); } catch {} } job.clients.clear(); }
        } else { job.done = true; emit(job, { status: 'error', done: true, success: false, error: stderr.slice(-1500) || `yt-dlp exited with code ${code}` }); for (const c of job.clients) { try { c.end(); } catch {} } job.clients.clear(); }
        for (const c of job.clients) { try { c.end(); } catch {} }
        job.clients.clear();
      });
      return send(res, 200, { jobId: id });
    } catch (e) { return send(res, 400, { error: e.message }); }
  }

  const progressMatch = url.pathname.match(/^\/progress\/([\w-]+)$/);
  if (req.method === 'GET' && progressMatch) {
    const job = jobs.get(progressMatch[1]);
    if (!job) return send(res, 404, { error: 'Download job not found.' });
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'access-control-allow-origin': '*' });
    res.write(': KURO download progress\n\n');
    job.history.forEach(p => res.write(p));
    if (!job.done) job.clients.add(res); else res.end();
    req.on('close', () => job.clients.delete(res));
    return;
  }
  const fileMatch = url.pathname.match(/^\/download-file\/([\w-]+)$/);
  if (req.method === 'GET' && fileMatch) {
    const job = jobs.get(fileMatch[1]);
    if (!job?.file || !fs.existsSync(job.file)) return send(res, 404, { error: 'Download file not found or expired.' });
    const name = path.basename(job.file).replace(/[\r\n"]/g, '_');
    res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename="${name}"`, 'content-length': fs.statSync(job.file).size, 'access-control-allow-origin': '*' });
    fs.createReadStream(job.file).pipe(res); return;
  }
  const cancelMatch = url.pathname.match(/^\/download\/([\w-]+)$/);
  if (req.method === 'DELETE' && cancelMatch) {
    const job = jobs.get(cancelMatch[1]);
    if (!job) return send(res, 404, { error: 'Download job not found.' });
    job.process?.kill('SIGTERM');
    try { fs.rmSync(path.join(OUT, job.id), { recursive: true, force: true }); } catch {}
    job.done = true; emit(job, { status: 'cancelled', done: true, success: false, error: 'Download cancelled.' });
    return send(res, 200, { ok: true });
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname.endsWith('.html'))) {
    const html = path.join(__dirname, 'dist', 'index.html');
    if (fs.existsSync(html)) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return fs.createReadStream(html).pipe(res); }
  }
  return send(res, 404, { error: 'Not found' });
});
server.listen(PORT, HOST, () => console.log(`KURO backend listening on ${HOST}:${PORT}`));
