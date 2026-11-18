import { API_BASE_KEY } from "./store";

/**
 * The downloader needs the yt-dlp server (the same one the original site runs).
 * By default requests go to the same origin ("/get-metadata", "/download", ...),
 * so deploy this build behind that server or set a custom API base in Settings.
 */
export function getApiBase(): string {
  try {
    return (localStorage.getItem(API_BASE_KEY) || "").replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export function setApiBase(v: string) {
  const clean = v.trim().replace(/\/+$/, "");
  if (clean) localStorage.setItem(API_BASE_KEY, clean);
  else localStorage.removeItem(API_BASE_KEY);
}

export function apiUrl(path: string): string {
  return getApiBase() + path;
}

export class BackendError extends Error {}

/** fetch + JSON with friendly errors when no backend is reachable. */
export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), init);
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new BackendError(
      "Network error. The downloader server could not be reached. Check your connection or the API server in Settings.",
    );
  }
  const type = res.headers.get("content-type") || "";
  if (!type.includes("json")) {
    throw new BackendError(
      `The downloader server is not available here (HTTP ${res.status}). Set the API server in Settings → API Server.`,
    );
  }
  const data = await res.json();
  if (!res.ok) throw new BackendError(data?.error || `Server error: ${res.status}`);
  return data as T;
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "N/A";
  const v = Number(n);
  if (v >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(v);
}

export function formatClock(sec: number, ms = false): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const base = [h, m, s].map((x) => String(x).padStart(2, "0")).join(":");
  if (!ms) return base;
  return base + "." + String(Math.round((sec % 1) * 1000)).padStart(3, "0");
}

/** "HH:MM:SS(.mmm)" | "MM:SS(.mmm)" → seconds, or null when invalid. */
export function parseClock(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  if (!/^(\d{1,2}:)?\d{1,2}:\d{2}(\.\d{1,3})?$/.test(t)) return null;
  const [main, frac] = t.split(".");
  const parts = main.split(":").map(Number);
  let sec = 0;
  for (const p of parts) sec = sec * 60 + p;
  return sec + (frac ? Number("0." + frac) : 0);
}

export function formatEta(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

export function extractYouTubeId(input: string): string | null {
  try {
    const u = new URL(input.trim());
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{6,})/);
      if (m) return m[2];
    }
  } catch {
    /* not a URL */
  }
  return null;
}

export function isValidUrl(v: string): boolean {
  try {
    const u = new URL(v.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
