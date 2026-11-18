/**
 * Optional YouTube Data API v3 support.
 * Set VITE_YOUTUBE_API_KEY in .env (see .env.example). Vite inlines it into the built JS,
 * so restrict the key in Google Cloud Console (YouTube Data API v3 + your site's HTTP referrers).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
const KEY = ((import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined) ?? "").trim();
const BASE = "https://www.googleapis.com/youtube/v3";

export const hasYouTubeKey = () => KEY.length > 0;

async function yt(endpoint: string, params: Record<string, string>, signal?: AbortSignal): Promise<any> {
  const res = await fetch(`${BASE}/${endpoint}?${new URLSearchParams({ ...params, key: KEY })}`, { signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `YouTube API error: ${res.status}`);
  return data;
}

// search.list returns HTML-escaped text (&amp; &#39; ...).
const decode = (s = "") => {
  const t = document.createElement("textarea");
  t.innerHTML = s;
  return t.value;
};

// search.list pages by token, not number, so remember each query's tokens (kept per tab, survives reloads).
const loadTokens = (q: string): Record<number, string> => {
  try {
    return JSON.parse(sessionStorage.getItem("yt_tokens:" + q) || "{}");
  } catch {
    return {};
  }
};
const saveTokens = (q: string, t: Record<number, string>) => {
  try {
    sessionStorage.setItem("yt_tokens:" + q, JSON.stringify(t));
  } catch {
    /* ignore */
  }
};

export async function ytSearch(
  q: string,
  page: number,
  signal?: AbortSignal,
): Promise<{ results: any[]; hasMore: boolean }> {
  const tokens = loadTokens(q);
  let p = page;
  while (p > 1 && !tokens[p]) p--; // resume from the closest page we hold a token for
  let data: any = {};
  for (;;) {
    data = await yt(
      "search",
      { part: "snippet", type: "video,channel", maxResults: "24", q, ...(p > 1 ? { pageToken: tokens[p] as string } : {}) },
      signal,
    );
    if (data.nextPageToken) tokens[p + 1] = data.nextPageToken;
    if (p >= page || !data.nextPageToken) break;
    p++;
  }
  saveTokens(q, tokens);
  if (p < page) return { results: [], hasMore: false };

  const items: any[] = data.items ?? [];
  const ids = items.map((i) => i.id?.videoId).filter(Boolean) as string[];
  const views: Record<string, string> = {};
  if (ids.length) {
    const v = await yt("videos", { part: "statistics", id: ids.join(",") }, signal);
    for (const x of v.items ?? []) views[x.id] = x.statistics?.viewCount;
  }

  const results = items.flatMap((i) => {
    const s = i.snippet ?? {};
    const th = s.thumbnails ?? {};
    const thumb = (th.medium || th.high || th.default)?.url;
    if (i.id?.videoId) {
      return [
        {
          type: "video",
          videoId: i.id.videoId,
          title: decode(s.title),
          author: decode(s.channelTitle),
          authorId: s.channelId,
          viewCount: views[i.id.videoId] ?? null,
          videoThumbnails: thumb ? [{ url: thumb }] : [],
        },
      ];
    }
    if (i.id?.channelId) {
      return [
        {
          type: "channel",
          channelId: i.id.channelId,
          channelName: decode(s.channelTitle || s.title),
          channelThumbnails: thumb ? [{ url: thumb }] : [],
        },
      ];
    }
    return [];
  });
  return { results, hasMore: Boolean(data.nextPageToken) };
}

export async function ytVideoInfo(id: string, signal?: AbortSignal) {
  const d = await yt("videos", { part: "snippet,statistics", id }, signal);
  const v = d.items?.[0];
  if (!v) throw new Error("Video not found");
  const s = v.snippet ?? {};
  const st = v.statistics ?? {};
  return {
    title: s.title as string | undefined,
    creator: s.channelTitle as string | undefined,
    channelId: s.channelId as string | undefined,
    published: s.publishedAt as string | undefined,
    viewCount: st.viewCount != null ? Number(st.viewCount) : null,
    likeCount: st.likeCount != null ? Number(st.likeCount) : null,
    description: s.description as string | undefined,
  };
}
