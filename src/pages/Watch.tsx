import { useEffect, useState } from "react";
import { DownloadIcon, ExternalIcon, ShareIcon } from "../components/Icons";
import { useUI } from "../components/ui";
import { apiJson, formatNumber } from "../lib/api";
import { hasYouTubeKey, ytVideoInfo } from "../lib/youtube";
import { navigate, type Route } from "../lib/router";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Info {
  title: string;
  creator: string;
  channelId?: string;
  published?: string | number;
  viewCount?: number | null;
  likeCount?: number | null;
  description?: string;
}
interface Related {
  id: string;
  title: string;
  creator: string;
  thumbnail: string;
}

const QUALITIES: [string, string][] = [
  ["2160", "4K/2160p"],
  ["1440", "2K/1440p"],
  ["1080", "Full HD/1080p"],
  ["720", "HD/720p"],
  ["480", "480p"],
  ["360", "360p"],
  ["240", "240p"],
];

function formatDate(v: unknown): string {
  if (!v) return "";
  const d = typeof v === "number" ? new Date(v * 1000) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function Watch({ route }: { route: Route }) {
  const id = route.params.get("v")?.trim() ?? "";
  const { toast } = useUI();
  const [query, setQuery] = useState("");
  const [info, setInfo] = useState<Info | null>(null);
  const [infoState, setInfoState] = useState<"loading" | "ok" | "error">("loading");
  const [related, setRelated] = useState<Related[] | null>(null);
  const [relatedError, setRelatedError] = useState("");
  const [quality, setQuality] = useState(() => localStorage.getItem("watchQuality") || "1080");

  const validId = /^[\w-]{6,20}$/.test(id);

  useEffect(() => {
    if (!validId) return;
    let dead = false;
    setInfo(null);
    setInfoState("loading");
    setRelated(null);
    setRelatedError("");
    window.scrollTo({ top: 0 });

    (async () => {
      try {
        const backend = () => apiJson<any>("/youtube-info?v=" + encodeURIComponent(id));
        const d: any = hasYouTubeKey() ? await ytVideoInfo(id).catch(backend) : await backend();
        if (d.error) throw new Error(d.error);
        if (!dead) {
          setInfo({
            title: d.title || "Untitled",
            creator: d.creator || "",
            channelId: d.channelId,
            published: d.published,
            viewCount: d.viewCount,
            likeCount: d.likeCount,
            description: d.description,
          });
          setInfoState("ok");
        }
      } catch {
        // Fallback: public oEmbed data (title + channel only).
        try {
          const r = await fetch(
            `https://noembed.com/embed?url=${encodeURIComponent("https://www.youtube.com/watch?v=" + id)}`,
          );
          const j = await r.json();
          if (!j.title) throw new Error("no data");
          if (!dead) {
            setInfo({ title: j.title, creator: j.author_name || "" });
            setInfoState("ok");
          }
        } catch {
          if (!dead) setInfoState("error");
        }
      }
    })();

    apiJson<any>("/youtube-related?v=" + encodeURIComponent(id))
      .then((d) => !dead && setRelated(d.videos ?? []))
      .catch((e: Error) => {
        if (!dead) {
          setRelated([]);
          setRelatedError(e.message);
        }
      });

    return () => {
      dead = true;
    };
  }, [id, validId]);

  useEffect(() => {
    if (info?.title) document.title = `Watch - ${info.title}`;
    return () => {
      document.title = "KURO";
    };
  }, [info?.title]);

  const ytUrl = `https://www.youtube.com/watch?v=${id}`;

  const share = async () => {
    const link = `${window.location.origin}${window.location.pathname}#/watch?v=${id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: info?.title || "Video", url: link });
      } else {
        await navigator.clipboard.writeText(link);
        toast("Link copied to clipboard.", "success");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast("Could not share the link.", "error");
    }
  };

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="fade-up mx-auto w-full max-w-6xl px-4 pb-24 pt-4 sm:px-6">
      <form onSubmit={search} className="mb-8 flex flex-col gap-2 sm:flex-row">
        <input
          className="input flex-1"
          type="search"
          placeholder="Search YouTube videos..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search YouTube videos"
        />
        <button className="btn btn-primary" type="submit">
          Search
        </button>
      </form>

      {!validId ? (
        <div className="card p-10 text-center">
          <h1 className="display mb-3 text-[1rem]">No video selected</h1>
          <p className="mb-6 text-[0.85rem]">Use the search above to find a video to watch.</p>
          <a href="#/search" className="btn btn-primary">
            Go to search
          </a>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0">
            <div className="card aspect-video w-full overflow-hidden">
              <iframe
                key={id}
                className="h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`}
                title={info?.title || "YouTube video player"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>

            <div className="mt-6">
              <h1 className="text-[1.25rem] font-medium leading-snug" style={{ color: "var(--head)" }}>
                {infoState === "loading" && "Loading..."}
                {infoState === "error" && "Video info unavailable"}
                {info?.title}
              </h1>
              {info?.creator && (
                <p className="mt-1 text-[0.85rem]">
                  {info.channelId ? (
                    <a
                      href={`https://www.youtube.com/channel/${encodeURIComponent(info.channelId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {info.creator}
                    </a>
                  ) : (
                    info.creator
                  )}
                </p>
              )}
              {info && (formatDate(info.published) || info.viewCount != null) && (
                <p className="mt-1 text-[0.78rem]" style={{ color: "var(--muted)" }}>
                  {[
                    formatDate(info.published) && `Published ${formatDate(info.published)}`,
                    info.viewCount != null && `${formatNumber(info.viewCount)} views`,
                    info.likeCount != null && `${formatNumber(info.likeCount)} likes`,
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </p>
              )}

              {info?.description && (
                <div className="mt-6">
                  <h3 className="label">Description</h3>
                  <div
                    className="sub-card max-h-72 overflow-y-auto whitespace-pre-wrap p-4 text-[0.82rem] leading-relaxed"
                  >
                    {info.description}
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <a href={`#/?url=${encodeURIComponent(ytUrl)}&res=${quality}`} className="btn btn-primary">
                  <DownloadIcon /> Download Video
                </a>
                <button type="button" className="btn" onClick={share}>
                  <ShareIcon /> Share
                </button>
                <a href={ytUrl} target="_blank" rel="noopener noreferrer" className="btn">
                  <ExternalIcon /> Open on YouTube
                </a>
              </div>
            </div>
          </div>

          <aside className="flex flex-col gap-8">
            <section>
              <h3 className="display mb-3 !text-[0.7rem]">Download Quality</h3>
              <div className="flex flex-wrap gap-2" id="qualityButtons">
                {QUALITIES.map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    className={"chip " + (quality === v ? "active" : "")}
                    aria-pressed={quality === v}
                    onClick={() => {
                      setQuality(v);
                      localStorage.setItem("watchQuality", v);
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[0.72rem]" style={{ color: "var(--muted)" }}>
                Used when you press “Download Video”. Playback quality is controlled in the player's own settings.
              </p>
            </section>

            <section>
              <h3 className="display mb-3 !text-[0.7rem]">Related Videos</h3>
              {related === null ? (
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="skeleton h-16" />
                  ))}
                </div>
              ) : related.length === 0 ? (
                <p className="text-[0.8rem]" style={{ color: "var(--muted)" }}>
                  {relatedError ? "Related videos need the downloader server." : "No related videos found"}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {related.map((v) => (
                    <a
                      key={v.id}
                      href={`#/watch?v=${encodeURIComponent(v.id)}`}
                      className="sub-card group flex gap-3 p-2 no-underline transition-all duration-300 hover:translate-x-1"
                    >
                      <img
                        src={v.thumbnail || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                        alt=""
                        className="aspect-video w-28 shrink-0 object-cover grayscale-[0.5] transition-all group-hover:grayscale-0"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <h4 className="line-clamp-2 text-[0.8rem] font-medium leading-snug" style={{ color: "var(--head)" }}>
                          {v.title}
                        </h4>
                        <p className="mt-1 truncate text-[0.7rem]" style={{ color: "var(--muted)" }}>
                          {v.creator}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
