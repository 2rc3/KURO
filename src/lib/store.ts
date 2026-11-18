// Thin localStorage helpers (same keys as the original app so data is familiar).

export function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
}

export function readFlag(key: string, fallback = false): boolean {
  const v = localStorage.getItem(key);
  if (v === null) return fallback;
  return v === "true";
}

export function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "true" : "false");
  } catch {
    /* ignore */
  }
}

export interface Metadata {
  url: string;
  title: string;
  creator: string;
  thumbnailUrl: string | null;
  thumbnails: { url: string; width?: number }[];
  durationSeconds: number | null;
  youtubeVideoId: string | null;
  viewCount: number | null;
  likeCount: number | null;
  dislikeCount: number | null;
}

export interface HistoryItem {
  url: string;
  timestamp: number;
  success: boolean;
  error?: string;
  anondropLink?: string | null;
  metadata?: Metadata;
}

export interface Stats {
  totalDownloads: number;
  successfulDownloads: number;
  failedDownloads: number;
}

export const HISTORY_KEY = "downloadHistory";
export const STATS_KEY = "downloadStatistics";
export const RECENT_KEY = "recentUrls";
export const PREFS_KEY = "userPreferences";
export const QUEUE_KEY = "downloadQueue";
export const API_BASE_KEY = "apiBase";
