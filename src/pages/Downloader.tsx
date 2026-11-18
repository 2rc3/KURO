import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ClipEditor from "../components/ClipEditor";
import {
  ChevronIcon,
  CopyIcon,
  DislikeIcon,
  DiscordIcon,
  ExportIcon,
  EyeIcon,
  GitHubIcon,
  HistoryIcon,
  ImportIcon,
  InfoIcon,
  LikeIcon,
  QueueIcon,
  SettingsIcon,
  TrashIcon,
  UserIcon,
  YouTubeIcon,
} from "../components/Icons";
import { LINKS, ThemeSwitch } from "../components/Chrome";
import { Field, Modal, SelectField, ToggleRow, useUI, Warning } from "../components/ui";
import {
  apiJson,
  apiUrl,
  BackendError,
  extractYouTubeId,
  formatEta,
  formatNumber,
  getApiBase,
  isValidUrl,
  parseClock,
  setApiBase,
} from "../lib/api";
import {
  applyPreset,
  buildPayload,
  DEFAULT_SETTINGS,
  isDrmHost,
  PRESETS,
  SB_CATEGORIES,
  type PresetKey,
  type Settings,
} from "../lib/settings";
import {
  HISTORY_KEY,
  PREFS_KEY,
  QUEUE_KEY,
  read,
  readFlag,
  RECENT_KEY,
  STATS_KEY,
  write,
  writeFlag,
  type HistoryItem,
  type Metadata,
  type Stats,
} from "../lib/store";

interface QueueItem {
  url: string;
  settings: Settings;
}

const EMPTY_STATS: Stats = { totalDownloads: 0, successfulDownloads: 0, failedDownloads: 0 };

export default function Downloader({
  light,
  setLight,
  initialUrl,
  initialResolution,
}: {
  light: boolean;
  setLight: (v: boolean) => void;
  initialUrl?: string;
  initialResolution?: string;
}) {
  const { toast, confirm } = useUI();

  /* ----- persisted state ----- */
  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULT_SETTINGS,
    ...read<Partial<Settings>>(PREFS_KEY, {}),
    // clip fields are per-video, never restore them
    enableClipping: false,
    clipStartTime: "",
    clipEndTime: "",
    ...(initialResolution && /^\d+$/.test(initialResolution) ? { resolution: initialResolution, downloadType: "video" as const } : {}),
  }));
  const [history, setHistory] = useState<HistoryItem[]>(() => read(HISTORY_KEY, []));
  const [stats, setStats] = useState<Stats>(() => read(STATS_KEY, EMPTY_STATS));
  const [queue, setQueue] = useState<QueueItem[]>(() => read(QUEUE_KEY, []));
  const [recent, setRecent] = useState<string[]>(() => read(RECENT_KEY, []));
  const [preset, setPreset] = useState<string | null>(() => localStorage.getItem("formatPreset"));

  /* ----- form state ----- */
  const [url, setUrl] = useState(initialUrl ?? "");
  const [meta, setMeta] = useState<Metadata | null>(null);
  const [metaState, setMetaState] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const [metaError, setMetaError] = useState("");
  const [modal, setModal] = useState<null | "history" | "queue" | "settings">(null);
  const [dragging, setDragging] = useState(false);

  /* ----- job state ----- */
  const [running, setRunning] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [status, setStatus] = useState("");
  const [percent, setPercent] = useState(0);
  const [playlistText, setPlaylistText] = useState("");
  const [speed, setSpeed] = useState("");
  const [eta, setEta] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [fileHref, setFileHref] = useState<string | null>(null);
  const [anondrop, setAnondrop] = useState<string | null>(null);

  const jobId = useRef<string | null>(null);
  const es = useRef<EventSource | null>(null);
  const busy = useRef(false);
  const processingQueue = useRef(false);
  const metaCache = useRef(new Map<string, Metadata>());
  const urlInput = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);

  const validUrl = isValidUrl(url) && !!extractYouTubeId(url);
  const type = settings.downloadType;
  const youtubeId = meta?.youtubeVideoId || extractYouTubeId(url);
  const drmActive = type === "audio" && isDrmHost(url);

  /* ---------------------------------------------------------------- */
  /* Persistence                                                       */
  /* ---------------------------------------------------------------- */
  useEffect(() => write(HISTORY_KEY, history.slice(0, 100)), [history]);
  useEffect(() => write(STATS_KEY, stats), [stats]);
  useEffect(() => write(QUEUE_KEY, queue), [queue]);
  useEffect(() => {
    if (readFlag("autoSavePreferences")) write(PREFS_KEY, settings);
  }, [settings]);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  /* ---------------------------------------------------------------- */
  /* Metadata                                                          */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!validUrl) {
      setMeta(null);
      setMetaState("idle");
      return;
    }
    const key = url.trim() + "|" + settings.enablePlaylist;
    const cached = metaCache.current.get(key);
    if (cached) {
      setMeta(cached);
      setMetaState("ready");
      return;
    }
    setMeta(null);
    setMetaState("loading");
    setMetaError("");
    const ctrl = new AbortController();
    const timeout = window.setTimeout(() => ctrl.abort(), 30000);
    const t = window.setTimeout(async () => {
      try {
        const data = await apiJson<Record<string, any>>("/get-metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaUrl: url.trim(), enablePlaylist: settings.enablePlaylist }),
          signal: ctrl.signal,
        });
        if (data.error || !data.title) throw new Error(data.error || "No media found at this URL.");
        const m: Metadata = {
          url: url.trim(),
          title: data.title,
          creator: data.creator || "Unknown creator",
          thumbnailUrl: data.thumbnailUrl || null,
          thumbnails: Array.isArray(data.thumbnails) ? data.thumbnails : [],
          durationSeconds: Number.isFinite(data.durationSeconds) ? data.durationSeconds : null,
          youtubeVideoId: data.youtubeVideoId || null,
          viewCount: data.viewCount ?? null,
          likeCount: data.likeCount ?? null,
          dislikeCount: data.dislikeCount ?? null,
        };
        metaCache.current.set(key, m);
        setMeta(m);
        setMetaState("ready");
      } catch (e) {
        if ((e as Error).name === "AbortError" && !ctrl.signal.aborted) return;
        const err = e as Error;
        // Limited fallback for YouTube links when the yt-dlp server is unreachable.
        const id = extractYouTubeId(url);
        if (id && err instanceof BackendError) {
          let title = `YouTube video (${id})`;
          let creator = "";
          try {
            const r = await fetch(
              `https://noembed.com/embed?url=${encodeURIComponent("https://www.youtube.com/watch?v=" + id)}`,
            );
            const j = await r.json();
            if (j.title) title = j.title;
            if (j.author_name) creator = j.author_name;
          } catch {
            /* keep generic title */
          }
          if (ctrl.signal.aborted && err.name !== "AbortError") return;
          setMeta({
            url: url.trim(),
            title,
            creator: creator || "YouTube",
            thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            thumbnails: [],
            durationSeconds: null,
            youtubeVideoId: id,
            viewCount: null,
            likeCount: null,
            dislikeCount: null,
          });
          setMetaState("ready");
          setMetaError(err.message);
          return;
        }
        if (err.name === "AbortError") setMetaError("Request timed out. Server may be overloaded.");
        else setMetaError(err.message || "Unknown error");
        setMetaState("error");
      }
    }, 550);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(timeout);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, validUrl, settings.enablePlaylist]);

  /* ---------------------------------------------------------------- */
  /* Download job                                                      */
  /* ---------------------------------------------------------------- */
  const addLog = useCallback((m: string) => {
    const line = m.trim();
    if (!line) return;
    setLogs((l) => [...l.slice(-400), line]);
  }, []);

  const resetJobUi = useCallback(() => {
    setRunning(false);
    busy.current = false;
    jobId.current = null;
    es.current?.close();
    es.current = null;
  }, []);

  const finishJob = useCallback(
    (ok: boolean, jobUrl: string, error?: string, anon?: string | null) => {
      const item: HistoryItem = { url: jobUrl, timestamp: Date.now(), success: ok, error, anondropLink: anon ?? null };
      const m = metaCache.current.get(jobUrl + "|" + settingsRef.current.enablePlaylist);
      if (m) item.metadata = m;
      setHistory((h) => [item, ...h].slice(0, 100));
      setStats((s) => ({
        totalDownloads: s.totalDownloads + 1,
        successfulDownloads: s.successfulDownloads + (ok ? 1 : 0),
        failedDownloads: s.failedDownloads + (ok ? 0 : 1),
      }));
      resetJobUi();
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(ok ? "Download Complete" : "Download Failed", {
          body: ok ? (anon ? "Upload ready in AnonDrop!" : "Your file is ready!") : error || "An error occurred",
        });
      }
    },
    [resetJobUi],
  );

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const startDownload = useCallback(
    async (jobUrl: string, s: Settings) => {
      if (busy.current) {
        toast("A download request is already in progress.", "info");
        return;
      }
      const trimmed = jobUrl.trim();
      if (!trimmed) {
        toast("Please enter a URL.", "warning");
        urlInput.current?.focus();
        return;
      }
      if (!isValidUrl(trimmed) || !extractYouTubeId(trimmed)) {
        toast("Please enter a valid YouTube video, Shorts, or playlist URL.", "error");
        return;
      }
      if (s.enableClipping) {
        const a = parseClock(s.clipStartTime);
        const b = parseClock(s.clipEndTime);
        if ((s.clipStartTime.trim() && a === null) || (s.clipEndTime.trim() && b === null)) {
          toast("Clip times must look like HH:MM:SS or MM:SS.", "error");
          return;
        }
        if (a !== null && b !== null && b <= a) {
          toast("The clip end time must be after the start time.", "error");
          return;
        }
      }

      busy.current = true;
      setRunning(true);
      setShowProgress(true);
      setLogs([]);
      setPercent(0);
      setStatus("Starting…");
      setSpeed("");
      setEta("");
      setPlaylistText("");
      setFileHref(null);
      setAnondrop(null);

      if (readFlag("saveRecentUrls", true)) {
        setRecent((r) => {
          const next = [trimmed, ...r.filter((x) => x !== trimmed)].slice(0, 10);
          write(RECENT_KEY, next);
          return next;
        });
      }

      try {
        const data = await apiJson<{ jobId?: string; duplicate?: boolean; message?: string }>("/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(trimmed, s)),
        });
        if (!data.jobId) throw new Error("Server did not return a job ID.");
        jobId.current = data.jobId;
        if (data.duplicate) addLog(data.message || "An identical download is already in progress. Reusing that job.");
        listen(data.jobId, trimmed, s);
      } catch (err) {
        setStatus("Error");
        addLog((err as Error).message);
        toast((err as Error).message, "error", 6000);
        resetJobUi();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const triggerFile = (href: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = "";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const listen = (id: string, jobUrl: string, s: Settings) => {
    const source = new EventSource(apiUrl(`/progress/${id}`));
    es.current = source;
    const started = Date.now();
    let errors = 0;
    let last = 0;
    let playlistTotal = 0;
    let playlistCur = 0;

    source.onmessage = (ev) => {
      errors = 0;
      try {
        const d = JSON.parse(ev.data);
        const msg: string = (d.message ?? "").trim();

        if (s.enablePlaylist && msg) {
          const m = msg.match(/Downloading item (\d+) of (\d+)/i) || msg.match(/^\[(\d+)\/(\d+)\]/);
          if (m) {
            playlistCur = parseInt(m[1], 10);
            playlistTotal = parseInt(m[2], 10);
            setPlaylistText(` (${playlistCur}/${playlistTotal})`);
          }
        }

        if (d.progress !== undefined) {
          let p = Number(d.progress);
          if (s.enablePlaylist && playlistTotal > 1) {
            const cur = Math.max(1, Math.min(playlistCur || 1, playlistTotal));
            p = ((cur - 1 + Math.max(0, Math.min(100, p)) / 100) / playlistTotal) * 100;
            if (p < last && !d.done) p = last;
          }
          if (Number.isFinite(p)) {
            last = p;
            setPercent(Math.max(0, Math.min(100, p)));
            if (p > 0.5) {
              const remaining = (((Date.now() - started) / 1000) / p) * (100 - p);
              setEta(Number.isFinite(remaining) && remaining < 86400 ? `ETA: ${formatEta(remaining)}` : "");
            }
          }
        }

        if (d.status) {
          const f = String(d.status);
          setStatus(f.charAt(0).toUpperCase() + f.slice(1));
          if (s.enablePlaylist && /zipping/i.test(f) && last < 99) {
            last = 99;
            setPercent(99);
          }
        }

        if (msg) {
          const sp = msg.match(/(\d+\.?\d*\s*[KMG]iB\/s)/);
          if (sp) setSpeed(`Speed: ${sp[1]}`);
          addLog(msg);
        }

        if (d.done) {
          const remote: string | null = d.anondropLink || d.teraboxLink || null;
          if (d.success && (d.downloadUrl || remote)) {
            setPercent(100);
            setStatus("Complete");
            setEta("");
            if (d.downloadUrl) {
              const href = apiUrl(d.downloadUrl);
              setFileHref(href);
              triggerFile(href);
            }
            if (remote) {
              setAnondrop(remote);
              toast("Uploaded to AnonDrop successfully!", "success");
            }
            finishJob(true, jobUrl, undefined, remote);
            if (processingQueue.current) window.setTimeout(processNext, 1200);
          } else {
            setStatus("Error");
            addLog(`Job failed. Error: ${d.error || "Unknown error"}`);
            toast(d.error || "Download failed.", "error", 6000);
            finishJob(false, jobUrl, d.error);
          }
        }
      } catch {
        addLog("Received a malformed message from server.");
      }
    };

    source.onerror = () => {
      errors++;
      if (source.readyState === EventSource.CLOSED || errors >= 5) {
        setStatus("Error");
        addLog("Lost connection to the server.");
        toast("Lost connection to the server.", "error");
        finishJob(false, jobUrl, "Lost connection to the server.");
      }
    };
  };

  const cancelDownload = useCallback(() => {
    if (!busy.current) return;
    const id = jobId.current;
    if (id) fetch(apiUrl(`/download/${id}`), { method: "DELETE" }).catch(() => {});
    processingQueue.current = false;
    es.current?.close();
    setStatus("Cancelled");
    setPercent(0);
    addLog("Download cancelled by user. Files removed.");
    resetJobUi();
  }, [addLog, resetJobUi]);

  useEffect(
    () => () => {
      es.current?.close();
    },
    [],
  );

  /* ---------------------------------------------------------------- */
  /* Queue                                                             */
  /* ---------------------------------------------------------------- */
  const processNext = useCallback(() => {
    const [next, ...rest] = queueRef.current;
    if (!next) {
      processingQueue.current = false;
      return;
    }
    setQueue(rest);
    queueRef.current = rest;
    setUrl(next.url);
    setSettings(next.settings);
    startDownload(next.url, next.settings);
  }, [startDownload]);

  const processQueue = () => {
    if (!queue.length) return toast("Queue is empty.", "info");
    processingQueue.current = true;
    setModal(null);
    processNext();
  };

  useEffect(() => {
    if (readFlag("autoProcessQueue") && queueRef.current.length) {
      const t = window.setTimeout(() => {
        processingQueue.current = true;
        processNext();
      }, 2000);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addToQueue = () => {
    const u = url.trim();
    if (!u) return toast("Please enter a URL first.", "warning");
    if (!isValidUrl(u)) return toast("Please enter a valid URL.", "error");
    setQueue((q) => [...q, { url: u, settings }]);
    toast("Added to queue!", "success");
  };

  /* ---------------------------------------------------------------- */
  /* History / settings import-export                                  */
  /* ---------------------------------------------------------------- */
  const clearHistory = async () => {
    if (!history.length) return toast("History is already empty.", "info");
    const ok = await confirm("Are you sure you want to clear your download history?", {
      title: "Clear History",
      confirmText: "Clear",
      danger: true,
    });
    if (ok) {
      setHistory([]);
      toast("History cleared.", "success");
    }
  };

  const exportSettings = () => {
    const data = { preferences: settings, history, statistics: stats, version: "1.0" };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `kuro-settings-${Date.now()}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    toast("Settings exported.", "success");
  };

  const importSettings = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (typeof data !== "object" || data === null) throw new Error("bad");
        if (data.preferences) {
          setSettings({ ...DEFAULT_SETTINGS, ...data.preferences });
          write(PREFS_KEY, data.preferences);
        }
        if (Array.isArray(data.history)) setHistory(data.history);
        if (data.statistics) setStats({ ...EMPTY_STATS, ...data.statistics });
        toast("Settings imported successfully!", "success");
        setModal(null);
      } catch {
        toast("Failed to import settings: Invalid file format.", "error");
      }
    };
    reader.readAsText(file);
  };

  const applyPresetKey = (key: PresetKey, name: string) => {
    setSettings((s) => applyPreset(s, key));
    setPreset(key);
    localStorage.setItem("formatPreset", key);
    toast(`Applied "${name}" preset`, "success", 2000);
  };

  /* ---------------------------------------------------------------- */
  /* Keyboard shortcuts                                                */
  /* ---------------------------------------------------------------- */
  const submitRef = useRef<() => void>(() => {});
  submitRef.current = () => startDownload(url, settings);
  const cancelRef = useRef(cancelDownload);
  cancelRef.current = cancelDownload;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "Enter") {
        e.preventDefault();
        submitRef.current();
      } else if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        urlInput.current?.focus();
      } else if (mod && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setModal("history");
      } else if (mod && e.key.toLowerCase() === "q") {
        e.preventDefault();
        setModal("queue");
      } else if (e.key === "Escape" && !document.querySelector('[role="dialog"]')) {
        cancelRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Derived                                                           */
  /* ---------------------------------------------------------------- */
  const thumb = useMemo(() => {
    if (!meta) return null;
    const sorted = [...meta.thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
    return sorted[0]?.url || meta.thumbnailUrl;
  }, [meta]);

  const highRes = type === "video" && Number(settings.resolution) >= 1440;
  const copyLog = async () => {
    try {
      await navigator.clipboard.writeText(logs.join("\n"));
      toast("Log copied to clipboard.", "success", 2000);
    } catch {
      toast("Could not copy the log.", "error");
    }
  };

  const toggleCategory = (key: "sponsorblockMark" | "sponsorblockRemove", cat: string) =>
    update({
      [key]: settings[key].includes(cat) ? settings[key].filter((c) => c !== cat) : [...settings[key], cat],
    } as Partial<Settings>);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const text = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (text) setUrl(text.split("\n")[0].trim());
  };

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */
  const feature = (id: string, icon: React.ReactNode, label: string, onClick: () => void) => (
    <button key={id} type="button" id={id} className="btn !justify-start !px-4 !py-3 !tracking-[0.14em]" onClick={onClick}>
      {icon}
      {label}
    </button>
  );

  return (
    <div className="fade-up mx-auto w-full max-w-3xl px-4 pb-24 pt-4 sm:px-6">
      <div className="card p-5 sm:p-10">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="display text-[1.05rem] leading-tight sm:text-[1.45rem]">KURO Downloader</h1>
            <span id="statistics" className="eyebrow border px-2.5 py-1" style={{ borderColor: "var(--line)" }}>
              Total: {stats.totalDownloads}
            </span>
          </div>
          <ThemeSwitch light={light} onChange={setLight} />
        </div>

        <a href="#/search" className="btn btn-block !py-3.5">
          <YouTubeIcon width={16} height={16} />
          Watch YouTube Videos
        </a>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {feature("historyBtn", <HistoryIcon />, "History", () => setModal("history"))}
          {feature("queueBtn", <QueueIcon />, `Queue${queue.length ? ` (${queue.length})` : ""}`, () => setModal("queue"))}
          {feature("settingsBtn", <SettingsIcon />, "Settings", () => setModal("settings"))}
          {feature("clearHistoryBtn", <TrashIcon />, "Clear History", clearHistory)}
          {feature("exportSettingsBtn", <ExportIcon />, "Export", exportSettings)}
          {feature("importSettingsBtn", <ImportIcon />, "Import", () => importRef.current?.click())}
        </div>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            importSettings(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <div className="my-6 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={"chip " + (preset === p.key ? "active" : "")}
              onClick={() => applyPresetKey(p.key, p.name)}
              data-preset={p.key}
            >
              {p.label}
            </button>
          ))}
        </div>

        <hr className="divider mb-6" />

        <form
          id="dlForm"
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            startDownload(url, settings);
          }}
          noValidate
        >
          {/* URL */}
          <Field label="Enter YouTube URL:" htmlFor="mediaUrl">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                ref={urlInput}
                id="mediaUrl"
                name="mediaUrl"
                type="text"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                required
                className="input flex-1"
                style={dragging ? { borderBottomColor: "var(--accent)", background: "var(--panel-3)" } : undefined}
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              />
              <select
                id="recentUrls"
                className="select sm:!w-48"
                value=""
                aria-label="Recent URLs"
                onChange={(e) => e.target.value && setUrl(e.target.value)}
              >
                <option value="">Recent URLs...</option>
                {recent.map((r) => (
                  <option key={r} value={r}>
                    {r.length > 60 ? r.slice(0, 57) + "…" : r}
                  </option>
                ))}
              </select>
            </div>
            {url.trim() && !validUrl && (
              <p className="mt-2 text-[0.74rem]" style={{ color: "var(--warn)" }}>
                Enter a full link starting with http:// or https://
              </p>
            )}
          </Field>

          {/* Dynamic content */}
          <div
            id="dynamic-content-wrapper"
            className="flex flex-col gap-6 overflow-hidden transition-all duration-500"
            style={{
              maxHeight: validUrl ? 8000 : 0,
              marginTop: validUrl ? 0 : "-1.5rem",
              opacity: validUrl ? 1 : 0,
              transform: validUrl ? "none" : "translateY(-10px)",
              pointerEvents: validUrl ? "auto" : "none",
              visibility: validUrl ? "visible" : "hidden",
            }}
          >
            {/* Preview */}
            <div id="preview-container" className="sub-card flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
              <div
                className="relative aspect-video w-full shrink-0 overflow-hidden sm:w-56"
                style={{ background: "var(--bg)" }}
              >
                {thumb ? (
                  <img
                    id="preview-thumbnail"
                    src={thumb}
                    alt="Video Thumbnail"
                    className="h-full w-full object-cover"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
                  />
                ) : (
                  <div className={"h-full w-full " + (metaState === "loading" ? "skeleton" : "")} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="preview-title" className="text-[1rem] font-medium leading-snug" style={{ color: "var(--head)" }}>
                  {metaState === "loading" && "Fetching..."}
                  {metaState === "error" && "Could not load media info"}
                  {meta?.title}
                </h3>
                <p id="preview-creator" className="mt-1 text-[0.8rem]" style={{ color: "var(--muted)" }}>
                  {metaState === "error" ? metaError : meta?.creator}
                </p>
                {metaState === "ready" && metaError && (
                  <p className="mt-2 text-[0.7rem]" style={{ color: "var(--warn)" }}>
                    Limited preview: {metaError}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    [<EyeIcon key="v" />, "Views", meta?.viewCount],
                    [<LikeIcon key="l" />, "Likes", meta?.likeCount],
                    [<DislikeIcon key="d" />, "Dislikes", meta?.dislikeCount],
                  ].map(([icon, label, val]) => (
                    <div
                      key={label as string}
                      className="flex items-center gap-2 border px-3 py-1.5 text-[0.72rem]"
                      style={{ borderColor: "var(--line)", background: "var(--panel)" }}
                    >
                      <span style={{ color: "var(--muted)" }}>{icon}</span>
                      <span className="eyebrow !tracking-[0.14em]">{label as string}</span>
                      <span style={{ color: "var(--head)" }}>
                        {meta ? formatNumber(val as number | null) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Config */}
            <div id="configuration-wrapper" className="flex flex-col gap-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <SelectField
                  id="downloadType"
                  label="Download Type:"
                  value={type}
                  onChange={(v) => update({ downloadType: v as Settings["downloadType"] })}
                  options={[
                    ["video", "Video"],
                    ["audio", "Audio"],
                    ["gif", "GIF (Animated Image)"],
                  ]}
                />
                {type === "video" && (
                  <SelectField
                    id="videoFormat"
                    label="Video Codec:"
                    value={settings.videoFormat}
                    onChange={(v) => update({ videoFormat: v })}
                    options={[
                      ["auto", "Auto (H.264 preferred - Best Compatibility)"],
                      ["avc", "H.264/AVC (Universal - iOS, Android, PC, Old PCs)"],
                      ["hevc", "H.265/HEVC (Modern - iOS 11+, Android 5+, PC)"],
                      ["vp9", "VP9 (Modern - Browsers, Android, Modern PCs)"],
                      ["av1", "AV1 (Cutting-Edge - Latest Browsers & Devices)"],
                    ]}
                  />
                )}
                {type === "audio" && (
                  <>
                    <div>
                      <SelectField
                        id="audioFormat"
                        label="Audio Format:"
                        value={settings.audioFormat}
                        onChange={(v) => update({ audioFormat: v })}
                        options={[
                          ["mp3", "MP3 (Best Compression)"],
                          ["m4a", "M4A (Good Quality)"],
                          ["opus", "Opus (Best Quality/Compression)"],
                          ["ogg", "OGG (Balanced Quality/Compression)"],
                          ["flac", "FLAC (Compressed Lossless)"],
                          ["wav", "WAV (Fully Lossless)"],
                        ]}
                      />
                      {settings.audioFormat === "wav" && (
                        <Warning>Warning: WAV format does not support embedded thumbnails.</Warning>
                      )}
                    </div>
                    <SelectField
                      id="audioBitrate"
                      label="Audio Bitrate:"
                      value={settings.audioBitrate}
                      onChange={(v) => update({ audioBitrate: v })}
                      options={[
                        ["0", "Best (VBR)"],
                        ["320", "320 kbps"],
                        ["256", "256 kbps"],
                        ["192", "192 kbps"],
                        ["128", "128 kbps"],
                        ["96", "96 kbps"],
                        ["64", "64 kbps"],
                      ]}
                    />
                  </>
                )}
                {type === "video" && (
                  <SelectField
                    id="advRemuxVideo"
                    label="Video format:"
                    value={settings.advRemuxVideo}
                    onChange={(v) => update({ advRemuxVideo: v })}
                    options={[
                      ["", "Original (No Change)"],
                      ["mp4", "MP4"],
                      ["mkv", "MKV"],
                      ["webm", "WebM"],
                      ["mov", "MOV"],
                      ["avi", "AVI"],
                      ["flv", "FLV"],
                    ]}
                  />
                )}
              </div>

              {type === "gif" && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <SelectField
                    id="gifFps"
                    label="GIF Frame Rate:"
                    value={settings.gifFps}
                    onChange={(v) => update({ gifFps: v })}
                    options={[
                      ["10", "10 FPS (Small file)"],
                      ["15", "15 FPS (Balanced)"],
                      ["20", "20 FPS (Smooth)"],
                      ["24", "24 FPS (Film-like)"],
                      ["30", "30 FPS (Full motion)"],
                    ]}
                  />
                  <SelectField
                    id="gifWidth"
                    label="GIF Width:"
                    value={settings.gifWidth}
                    onChange={(v) => update({ gifWidth: v })}
                    options={[
                      ["0", "Original Size"],
                      ["320", "320px (Tiny)"],
                      ["480", "480px (Small)"],
                      ["640", "640px (Medium)"],
                      ["720", "720px (Large)"],
                      ["1080", "1080px (Very Large file!)"],
                    ]}
                  />
                  <div className="sm:col-span-2">
                    <Warning>
                      ⚠️ GIF files can be very large. Lower FPS and smaller width = smaller file size. Videos longer
                      than 60s will be truncated.
                    </Warning>
                  </div>
                </div>
              )}

              {type === "video" && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <SelectField
                    id="resolution"
                    label="Resolution:"
                    value={settings.resolution}
                    onChange={(v) => update({ resolution: v })}
                    options={[
                      ["2160", "4K (2160p)"],
                      ["1440", "2K (1440p)"],
                      ["1080", "Full HD (1080p)"],
                      ["720", "HD (720p)"],
                      ["480", "SD (480p)"],
                      ["360", "360p"],
                      ["240", "240p"],
                      ["144", "144p"],
                    ]}
                  />
                  <SelectField
                    id="highest_fps"
                    label="Highest FPS:"
                    value={settings.highestFps}
                    onChange={(v) => update({ highestFps: v })}
                    options={[
                      ["yes", "Yes"],
                      ["no", "No (limit to 30fps)"],
                    ]}
                  />
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <div style={{ opacity: drmActive ? 1 : 0.5, transition: "opacity .3s" }}>
                  <SelectField
                    id="drmSourcePreference"
                    label="DRM Link Source:"
                    value={settings.drmSourcePreference}
                    disabled={!drmActive}
                    onChange={(v) => update({ drmSourcePreference: v })}
                    options={[
                      ["auto", "Auto (Best Match)"],
                      ["youtube", "YouTube Music"],
                      ["soundcloud", "SoundCloud"],
                      ["bandcamp", "Bandcamp"],
                      ["mixcloud", "Mixcloud"],
                    ]}
                    note="Only used for Spotify, Apple Music, Deezer, and Amazon Music links. Auto checks YouTube Music first, then SoundCloud, then Bandcamp/Mixcloud."
                  />
                </div>
              </div>

              <ToggleRow
                id="enableClipping"
                label="Clip / Cut Media"
                checked={settings.enableClipping}
                onChange={(v) => update({ enableClipping: v })}
              />
              {settings.enableClipping && (
                <ClipEditor
                  settings={settings}
                  update={update}
                  duration={meta?.durationSeconds ?? null}
                  youtubeId={youtubeId}
                  isAudio={type === "audio"}
                />
              )}
            </div>
          </div>

          {highRes && (
            <Warning>
              Warning: 2K/4K MP4 files use modern codecs (AV1/VP9) which may not be supported by older devices or some
              video editors.
            </Warning>
          )}

          <div className="flex flex-col gap-2">
            <ToggleRow
              id="enablePlaylist"
              label="Enable Playlist Download"
              checked={settings.enablePlaylist}
              onChange={(v) => update({ enablePlaylist: v })}
            />
            <ToggleRow
              id="includeSubtitles"
              label="Include Subtitles/Captions (if available)"
              checked={settings.includeSubtitles}
              onChange={(v) => update({ includeSubtitles: v })}
            />
            <ToggleRow
              id="uploadToTerabox"
              label="Upload to AnonDrop & Get Link"
              checked={settings.uploadToAnondrop}
              onChange={(v) => update({ uploadToAnondrop: v })}
            >
              {settings.uploadToAnondrop && <Warning>This adds an extra upload step after the download finishes</Warning>}
            </ToggleRow>
          </div>

          {/* Advanced */}
          <details className="sub-card group">
            <summary className="flex items-center justify-between px-5 py-4">
              <span className="display text-[0.72rem]">Advanced Configuration</span>
              <ChevronIcon />
            </summary>
            <div className="flex flex-col gap-6 border-t px-5 py-6" style={{ borderColor: "var(--line)" }}>
              <div
                className="border-l-2 p-4"
                style={{ borderColor: "var(--warn)", background: "rgba(251,146,60,.07)" }}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span>⚠️</span>
                  <strong className="text-[0.85rem]" style={{ color: "var(--warn)" }}>
                    Advanced Users Only
                  </strong>
                </div>
                <p className="text-[0.78rem] leading-relaxed" style={{ opacity: 0.85 }}>
                  These settings override server defaults. Incorrect values can break downloads or cause unexpected
                  results. Only change these if you know what you're doing.
                </p>
              </div>

              <ToggleRow
                id="enableSponsorblock"
                label="Enable SponsorBlock"
                checked={settings.enableSponsorblock}
                onChange={(v) => update({ enableSponsorblock: v })}
              />
              {settings.enableSponsorblock && (
                <div className="grid gap-5 md:grid-cols-2">
                  {(
                    [
                      ["sponsorblockMark", "Mark Categories (Create Chapters):"],
                      ["sponsorblockRemove", "Remove Categories (Cut from Video):"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <span className="label">{label}</span>
                      <div className="flex flex-wrap gap-2" id={key + "Buttons"}>
                        {SB_CATEGORIES.map(([c, name]) => (
                          <button
                            key={c}
                            type="button"
                            data-category={c}
                            className={"chip " + (settings[key].includes(c) ? "active" : "")}
                            aria-pressed={settings[key].includes(c)}
                            onClick={() => toggleCategory(key, c)}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <AdvGroup title="📦 Metadata & Embedding">
                <ToggleRow id="advEmbedMetadata" label="Embed Metadata (title, artist, date)" checked={settings.advEmbedMetadata} onChange={(v) => update({ advEmbedMetadata: v })} />
                <ToggleRow id="advEmbedChapters" label="Embed Chapters" checked={settings.advEmbedChapters} onChange={(v) => update({ advEmbedChapters: v })} />
                <ToggleRow id="advEmbedThumbnail" label="Embed Thumbnail as Cover Art" checked={settings.advEmbedThumbnail} onChange={(v) => update({ advEmbedThumbnail: v })} />
                <ToggleRow id="advWriteInfoJson" label="Save .info.json Metadata File" checked={settings.advWriteInfoJson} onChange={(v) => update({ advWriteInfoJson: v })} />
                <ToggleRow id="advWriteDescription" label="Save .description File" checked={settings.advWriteDescription} onChange={(v) => update({ advWriteDescription: v })} />
                <ToggleRow id="advWriteThumbnail" label="Save Thumbnail as Separate File" checked={settings.advWriteThumbnail} onChange={(v) => update({ advWriteThumbnail: v })} />
              </AdvGroup>

              <AdvGroup title="🔄 Remux & Format">
                <SelectField
                  id="advMergeOutputFormat"
                  label="Merge Output Format:"
                  value={settings.advMergeOutputFormat}
                  onChange={(v) => update({ advMergeOutputFormat: v })}
                  options={[
                    ["", "Auto (default MP4)"],
                    ["mp4", "MP4"],
                    ["mkv", "MKV"],
                    ["webm", "WebM"],
                  ]}
                />
                <ToggleRow id="advPreferFreeFormats" label="Prefer Free/Open Formats (WebM, Opus)" checked={settings.advPreferFreeFormats} onChange={(v) => update({ advPreferFreeFormats: v })} />
                <ToggleRow id="advRestrictFilenames" label="Restrict Filenames (ASCII only, no spaces)" checked={settings.advRestrictFilenames} onChange={(v) => update({ advRestrictFilenames: v })} />
              </AdvGroup>

              <AdvGroup title="🔁 Retries & Reliability" grid>
                {(
                  [
                    ["advRetries", "Download Retries:"],
                    ["advFragmentRetries", "Fragment Retries:"],
                  ] as const
                ).map(([k, l]) => (
                  <SelectField
                    key={k}
                    id={k}
                    label={l}
                    value={settings[k]}
                    onChange={(v) => update({ [k]: v } as Partial<Settings>)}
                    options={[
                      ["3", "3"],
                      ["5", "5"],
                      ["10", "10 (default)"],
                      ["20", "20"],
                      ["infinite", "Infinite"],
                    ]}
                  />
                ))}
              </AdvGroup>

              <AdvGroup title="📂 Output">
                <Field
                  label="Output Filename Template:"
                  htmlFor="advOutputTemplate"
                  note={
                    <>
                      Uses yt-dlp template syntax. Leave blank for default.{" "}
                      <a href={LINKS.ytdlpOutput} target="_blank" rel="noopener noreferrer" className="underline">
                        Docs ↗
                      </a>
                    </>
                  }
                >
                  <input
                    id="advOutputTemplate"
                    className="input"
                    type="text"
                    value={settings.advOutputTemplate}
                    onChange={(e) => update({ advOutputTemplate: e.target.value })}
                    placeholder="%(uploader,channel,creator,artist|Unknown)s - %(title)s.%(ext)s"
                  />
                </Field>
                <ToggleRow id="advNoOverwrites" label="Don't Overwrite Existing Files" checked={settings.advNoOverwrites} onChange={(v) => update({ advNoOverwrites: v })} />
              </AdvGroup>

              <AdvGroup title="🧹 Post-Processing">
                <ToggleRow id="advEmbedSubs" label="Embed Subtitles into Video File" checked={settings.advEmbedSubs} onChange={(v) => update({ advEmbedSubs: v })} />
                <ToggleRow id="advKeepVideo" label="Keep Original Video After Post-Processing" checked={settings.advKeepVideo} onChange={(v) => update({ advKeepVideo: v })} />
                <Field
                  label="Format Sort Order:"
                  htmlFor="advFormatSort"
                  note={
                    <>
                      Custom format sorting. Leave blank for yt-dlp defaults.{" "}
                      <a href={LINKS.ytdlpSort} target="_blank" rel="noopener noreferrer" className="underline">
                        Docs ↗
                      </a>
                    </>
                  }
                >
                  <input
                    id="advFormatSort"
                    className="input"
                    type="text"
                    value={settings.advFormatSort}
                    onChange={(e) => update({ advFormatSort: e.target.value })}
                    placeholder="e.g. res:720,fps,codec:h264"
                  />
                </Field>
              </AdvGroup>
            </div>
          </details>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <a href={LINKS.kofi} target="_blank" rel="noopener noreferrer" className="btn btn-block">
              support me &gt;~&lt; (if you want :3)
            </a>
            <button type="submit" id="submitBtn" className="btn btn-primary btn-block !py-4" disabled={running}>
              {running ? "Downloading..." : "Start Download"}
            </button>
            <p className="text-center text-[0.72rem]" style={{ color: "var(--muted)" }}>
              Playlists with many videos may download slowly to avoid rate-limiting.
            </p>
          </div>
        </form>

        {/* Progress */}
        {showProgress && (
          <div id="progressWrap" className="fade-up mt-8 flex flex-col gap-3 border-t pt-8" style={{ borderColor: "var(--line)" }}>
            <div className="flex items-center justify-between text-[0.8rem]">
              <span id="statusText" className="display !text-[0.7rem]">
                {status}
              </span>
              <span style={{ color: "var(--head)" }} className="tabular-nums">
                {Math.round(percent)}%{playlistText}
              </span>
            </div>
            <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
              <div className="progress-fill" style={{ width: `${percent}%` }} />
            </div>
            <div className="flex justify-between text-[0.72rem]" style={{ color: "var(--muted)" }}>
              <span>{speed}</span>
              <span>{eta}</span>
            </div>
            {running && (
              <button type="button" id="cancelBtn" className="btn btn-danger btn-block" onClick={cancelDownload}>
                Cancel Download
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                id="copyLogBtn"
                className="icon-btn absolute right-2 top-2 z-10"
                title="Copy Log"
                aria-label="Copy log"
                onClick={copyLog}
                style={{ background: "var(--panel)" }}
              >
                <CopyIcon />
              </button>
              <div id="messageLog" ref={logRef} className="log" aria-live="off">
                {logs.length ? logs.join("\n") : "Waiting for server output…"}
              </div>
            </div>
            {fileHref && (
              <a id="downloadLink" href={fileHref} download className="btn btn-primary btn-block">
                Download File
              </a>
            )}
            {anondrop && (
              <a href={anondrop} target="_blank" rel="noopener noreferrer" className="btn btn-block">
                Open in AnonDrop
              </a>
            )}
          </div>
        )}

        {/* Footer links */}
        <hr className="divider mb-6 mt-10" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            ["Credits", "#/credits", <UserIcon key="c" />, false],
            ["About", "#/info", <InfoIcon key="i" />, false],
          ].map(([label, href, icon, ext]) => (
            <a
              key={label as string}
              href={href as string}
              {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="btn !justify-start !px-4 !tracking-[0.14em]"
            >
              {icon}
              <span>{label as string}</span>
            </a>
          ))}
        </div>

        <p className="mt-8 text-[0.72rem] leading-relaxed" style={{ color: "var(--muted)" }}>
          Use this YouTube downloader only for content you own or have permission to download, and follow YouTube's
          Terms of Service and applicable copyright rules.
        </p>
      </div>

      {/* Modals */}
      {modal === "history" && (
        <Modal title="Download History" onClose={() => setModal(null)}>
          {history.length === 0 ? (
            <p className="py-8 text-center text-[0.85rem]" style={{ color: "var(--muted)" }}>
              No downloads yet. Finished downloads will appear here.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {history.map((h, i) => (
                <div key={h.timestamp + "-" + i} className="sub-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  {h.metadata?.thumbnailUrl && (
                    <img
                      src={h.metadata.thumbnailUrl}
                      alt=""
                      className="aspect-video w-full object-cover sm:w-28"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[0.88rem]" style={{ color: "var(--head)" }}>
                      {h.metadata?.title || h.url}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[0.7rem]" style={{ color: "var(--muted)" }}>
                      <span style={{ color: h.success ? "var(--ok)" : "var(--err)" }}>
                        {h.success ? "● Success" : "● Failed"}
                      </span>
                      <span>{new Date(h.timestamp).toLocaleString()}</span>
                    </div>
                    {h.error && (
                      <div className="mt-1 text-[0.7rem]" style={{ color: "var(--err)" }}>
                        {h.error}
                      </div>
                    )}
                    {h.anondropLink && (
                      <a href={h.anondropLink} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[0.72rem] underline">
                        AnonDrop link
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        setUrl(h.url);
                        setModal(null);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Use URL
                    </button>
                    <button
                      className="icon-btn"
                      aria-label="Copy URL"
                      title="Copy URL"
                      onClick={() => navigator.clipboard.writeText(h.url).then(() => toast("URL copied.", "success", 1800))}
                    >
                      <CopyIcon />
                    </button>
                  </div>
                </div>
              ))}
              <button
                className="btn btn-danger btn-block mt-2"
                onClick={async () => {
                  await clearHistory();
                }}
              >
                Clear History
              </button>
            </div>
          )}
        </Modal>
      )}

      {modal === "queue" && (
        <Modal title={`Download Queue (${queue.length})`} onClose={() => setModal(null)}>
          <div className="flex flex-col gap-3">
            <button className="btn btn-block" onClick={addToQueue}>
              Add current URL to queue
            </button>
            {queue.length === 0 ? (
              <p className="py-6 text-center text-[0.85rem]" style={{ color: "var(--muted)" }}>
                The queue is empty. Enter a URL, choose your options and add it here.
              </p>
            ) : (
              <>
                {queue.map((q, i) => (
                  <div key={i} className="sub-card flex items-center gap-3 p-3">
                    <span className="eyebrow w-5">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[0.82rem]" style={{ color: "var(--head)" }}>
                        {q.url}
                      </div>
                      <div className="text-[0.68rem] uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                        {q.settings.downloadType}
                        {q.settings.downloadType === "video" ? ` · ${q.settings.resolution}p` : ""}
                        {q.settings.downloadType === "audio" ? ` · ${q.settings.audioFormat}` : ""}
                      </div>
                    </div>
                    <button
                      className="icon-btn"
                      aria-label="Remove from queue"
                      title="Remove"
                      onClick={() => setQueue((x) => x.filter((_, j) => j !== i))}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
                <button className="btn btn-primary btn-block" onClick={processQueue} disabled={running}>
                  Process Queue
                </button>
                <button
                  className="btn btn-danger btn-block"
                  onClick={async () => {
                    if (await confirm("Clear the entire queue?", { title: "Clear Queue", confirmText: "Clear", danger: true })) {
                      setQueue([]);
                    }
                  }}
                >
                  Clear Queue
                </button>
              </>
            )}
          </div>
        </Modal>
      )}

      {modal === "settings" && (
        <SettingsModal
          onClose={() => setModal(null)}
          settings={settings}
          onSaveDefaults={() => {
            write(PREFS_KEY, settings);
            toast("Preferences saved!", "success");
          }}
          onReset={async () => {
            if (await confirm("Reset all preferences to default?", { title: "Reset Preferences", confirmText: "Reset", danger: true })) {
              localStorage.removeItem(PREFS_KEY);
              localStorage.removeItem("formatPreset");
              setPreset(null);
              setSettings(DEFAULT_SETTINGS);
              toast("Preferences reset.", "success");
            }
          }}
          onClearRecent={async () => {
            if (await confirm("Clear all saved recent URLs?", { title: "Clear Recent URLs", confirmText: "Clear", danger: true })) {
              setRecent([]);
              write(RECENT_KEY, []);
              toast("Recent URLs cleared.", "success");
            }
          }}
          onExport={exportSettings}
          onImport={() => importRef.current?.click()}
        />
      )}
    </div>
  );
}

function AdvGroup({ title, children, grid }: { title: string; children: React.ReactNode; grid?: boolean }) {
  return (
    <div className="border-t pt-5" style={{ borderColor: "var(--line)" }}>
      <span className="display mb-4 block !text-[0.68rem]">{title}</span>
      <div className={grid ? "grid gap-5 sm:grid-cols-2" : "flex flex-col gap-3"}>{children}</div>
    </div>
  );
}

function SettingsModal({
  onClose,
  onSaveDefaults,
  onReset,
  onClearRecent,
  onExport,
  onImport,
}: {
  onClose: () => void;
  settings: Settings;
  onSaveDefaults: () => void;
  onReset: () => void;
  onClearRecent: () => void;
  onExport: () => void;
  onImport: () => void;
}) {
  const { toast } = useUI();
  const [autoProcess, setAutoProcess] = useState(() => readFlag("autoProcessQueue"));
  const [autoSave, setAutoSave] = useState(() => readFlag("autoSavePreferences"));
  const [saveRecent, setSaveRecent] = useState(() => readFlag("saveRecentUrls", true));
  const [api, setApi] = useState(getApiBase());
  const [testing, setTesting] = useState(false);

  const testApi = async () => {
    setApiBase(api);
    setTesting(true);
    try {
      const res = await fetch(apiUrl("/get-metadata"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaUrl: "" }),
      });
      const type = res.headers.get("content-type") || "";
      if (type.includes("json")) toast("API server responded.", "success");
      else toast(`No downloader API at this address (HTTP ${res.status}).`, "error");
    } catch {
      toast("Could not reach the API server (network or CORS error).", "error");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <ToggleRow id="s-auto" label="Auto-process Queue on Load" checked={autoProcess} onChange={(v) => { setAutoProcess(v); writeFlag("autoProcessQueue", v); }} />
        <ToggleRow id="s-save" label="Auto-save Preferences" checked={autoSave} onChange={(v) => { setAutoSave(v); writeFlag("autoSavePreferences", v); }} />
        <ToggleRow id="s-recent" label="Save Recent URLs" checked={saveRecent} onChange={(v) => { setSaveRecent(v); writeFlag("saveRecentUrls", v); }} />

        <div className="sub-card mt-2 p-4">
          <Field
            label="API Server"
            htmlFor="apiBase"
            note="Address of the yt-dlp server that handles metadata and downloads. Leave empty to use this site's own server."
          >
            <div className="flex gap-2">
              <input
                id="apiBase"
                className="input"
                placeholder="https://your-server.example"
                value={api}
                onChange={(e) => setApi(e.target.value)}
                spellCheck={false}
              />
              <button className="btn btn-sm" onClick={testApi} disabled={testing}>
                {testing ? "…" : "Save & Test"}
              </button>
            </div>
          </Field>
        </div>

        <button className="btn btn-danger btn-block" onClick={onClearRecent}>Clear Recent URLs</button>
        <button className="btn btn-block" onClick={onSaveDefaults}>Save Current Settings as Default</button>
        <button className="btn btn-block" onClick={onReset}>Reset to Defaults</button>
        <hr className="divider my-2" />
        <div className="grid grid-cols-2 gap-2">
          <button className="btn" onClick={onExport}><ExportIcon /> Export All</button>
          <button className="btn" onClick={onImport}><ImportIcon /> Import</button>
        </div>
        <hr className="divider my-2" />
        <div className="text-center text-[0.78rem]" style={{ color: "var(--muted)" }}>
          <p className="eyebrow mb-2">Keyboard Shortcuts</p>
          <p>Ctrl/Cmd + Enter: Start Download</p>
          <p>Ctrl/Cmd + K: Focus URL Input</p>
          <p>Ctrl/Cmd + H: View History</p>
          <p>Ctrl/Cmd + Q: View Queue</p>
          <p>Escape: Cancel Download</p>
        </div>
      </div>
    </Modal>
  );
}

