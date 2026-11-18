import { useEffect, useState } from "react";
import { SearchIcon } from "../components/Icons";
import { apiJson } from "../lib/api";
import { hasYouTubeKey, ytSearch } from "../lib/youtube";
import { navigate, type Route } from "../lib/router";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Item {
  type?: string;
  videoId?: string;
  title?: string;
  author?: string;
  authorId?: string;
  viewCount?: number | string | null;
  videoThumbnails?: { url: string }[];
  channelId?: string;
  channelName?: string;
  channelThumbnails?: { url: string }[];
  subCount?: number | string;
  videoCount?: number | string;
}

const num = (v: unknown, fb = "N/A") => {
  if (v === undefined || v === null || v === "") return fb;
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : fb;
};

export default function Search({ route }: { route: Route }) {
  const q = route.params.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(route.params.get("page") || "1", 10) || 1);
  const [input, setInput] = useState(q);
  const [items, setItems] = useState<Item[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setInput(q), [q]);

  useEffect(() => {
    if (!q) {
      setItems([]);
      setHasMore(false);
      setError("");
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError("");
    (hasYouTubeKey()
      ? ytSearch(q, page, ctrl.signal)
      : apiJson<{ results?: Item[]; hasMore?: boolean }>(`/api/search?q=${encodeURIComponent(q)}&page=${page}`, {
          signal: ctrl.signal,
        })
    )
      .then((d) => {
        const r = d.results ?? [];
        setItems(r);
        setHasMore(d.hasMore === true && r.length > 0);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setItems([]);
        setHasMore(false);
        setError(`Error fetching search results: ${e.message}`);
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [q, page]);

  const go = (query: string, p = 1) => {
    const t = query.trim();
    if (!t) return;
    navigate(`/search?q=${encodeURIComponent(t)}${p > 1 ? `&page=${p}` : ""}`);
  };

  const fallbackThumb = (id?: string) => (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : "");

  return (
    <div className="fade-up mx-auto w-full max-w-5xl px-4 pb-24 pt-4 sm:px-6">
      <div className="mb-8">
        <p className="eyebrow mb-3">KURO</p>
        <h1 className="display text-[1.2rem] sm:text-[1.7rem]">YouTube Search</h1>
      </div>

      <form
        className="mb-8 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          go(input);
        }}
      >
        <input
          id="searchInput"
          className="input flex-1"
          type="search"
          placeholder="Search YouTube videos..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
          aria-label="Search YouTube videos"
        />
        <button type="submit" className="btn btn-primary" id="searchBtn">
          <SearchIcon /> Search
        </button>
      </form>

      {error && (
        <div
          role="alert"
          className="mb-6 border-l-2 px-4 py-3 text-[0.82rem]"
          style={{ borderColor: "var(--err)", color: "var(--err)", background: "rgba(248,113,113,.06)" }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="sub-card overflow-hidden">
              <div className="skeleton aspect-video" />
              <div className="space-y-2 p-4">
                <div className="skeleton h-4 w-4/5" />
                <div className="skeleton h-3 w-2/5" />
              </div>
            </div>
          ))}
        </div>
      ) : !q ? (
        <p className="py-16 text-center text-[0.85rem]" style={{ color: "var(--muted)" }}>
          Search for videos or channels to see results here.
        </p>
      ) : items.length === 0 && !error ? (
        <p className="py-16 text-center text-[0.85rem]" style={{ color: "var(--muted)" }}>
          {page === 1 ? "No results found." : "No more results found."}
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => {
            if (!it) return null;
            if (it.type === "channel") {
              if (!it.channelId) return null;
              const meta = [
                it.subCount ? `${num(it.subCount)} subscribers` : "",
                it.videoCount ? `${num(it.videoCount)} videos` : "",
              ]
                .filter(Boolean)
                .join(" • ");
              return (
                <a
                  key={"c" + it.channelId + i}
                  href={`https://www.youtube.com/channel/${encodeURIComponent(it.channelId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sub-card group flex items-center gap-4 p-4 no-underline transition-all duration-300 hover:-translate-y-1"
                  style={{ borderColor: "var(--line)" }}
                >
                  {it.channelThumbnails?.[0]?.url && (
                    <img
                      src={it.channelThumbnails[0].url}
                      alt=""
                      className="h-16 w-16 rounded-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0"
                      loading={i >= 8 ? "lazy" : undefined}
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate text-[0.95rem] font-medium" style={{ color: "var(--head)" }}>
                      {it.channelName}
                    </h3>
                    <p className="text-[0.74rem]" style={{ color: "var(--muted)" }}>
                      {meta || "Channel on YouTube ↗"}
                    </p>
                  </div>
                </a>
              );
            }
            if (!it.videoId) return null;
            const thumb = it.videoThumbnails?.[0]?.url || fallbackThumb(it.videoId);
            return (
              <article
                key={it.videoId + i}
                className="sub-card group overflow-hidden transition-all duration-300 hover:-translate-y-1"
                style={{ boxShadow: "none" }}
              >
                <a href={`#/watch?v=${encodeURIComponent(it.videoId)}`} className="block no-underline">
                  <div className="aspect-video overflow-hidden" style={{ background: "var(--bg)" }}>
                    <img
                      src={thumb}
                      alt=""
                      className="h-full w-full object-cover grayscale-[0.5] transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0"
                      loading={i >= 8 ? "lazy" : undefined}
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <h3
                    className="line-clamp-2 px-4 pt-4 text-[0.9rem] font-medium leading-snug"
                    style={{ color: "var(--head)" }}
                  >
                    {it.title}
                  </h3>
                </a>
                <div className="px-4 pb-4 pt-1.5">
                  {it.authorId ? (
                    <a
                      href={`https://www.youtube.com/channel/${encodeURIComponent(it.authorId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[0.76rem] no-underline hover:underline"
                      style={{ color: "var(--text)" }}
                    >
                      {it.author || "Unknown"}
                    </a>
                  ) : (
                    <p className="text-[0.76rem]">{it.author || "Unknown"}</p>
                  )}
                  <p className="text-[0.7rem]" style={{ color: "var(--muted)" }}>
                    {num(it.viewCount) === "N/A" ? "N/A views" : `${num(it.viewCount)} views`}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {(page > 1 || hasMore) && !loading && (
        <div className="mt-10 flex items-center justify-center gap-6">
          {page > 1 && (
            <button className="btn btn-sm" onClick={() => go(q, page - 1)}>
              ← Previous
            </button>
          )}
          <span className="eyebrow">Page {page}</span>
          {hasMore && (
            <button className="btn btn-sm" onClick={() => go(q, page + 1)}>
              Next →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export type { Item };
