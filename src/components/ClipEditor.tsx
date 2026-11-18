import { useCallback, useEffect, useRef, useState } from "react";
import { formatClock, parseClock } from "../lib/api";
import type { Settings } from "../lib/settings";
import { ScissorsIcon, PlayIcon, PauseIcon } from "./Icons";
import { Field, ToggleRow } from "./ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<any> | null = null;
function loadYouTubeApi(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.onerror = () => {
      ytApiPromise = null;
      reject(new Error("Could not load the YouTube player."));
    };
    document.head.appendChild(s);
  });
  return ytApiPromise;
}

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  duration: number | null;
  youtubeId: string | null;
  isAudio: boolean;
}

const PATTERN = "([0-9]{1,2}:)?[0-9]{1,2}:[0-9]{2}([.][0-9]{1,3})?";

export default function ClipEditor({ settings, update, duration, youtubeId, isAudio }: Props) {
  const ms = settings.clipUseMilliseconds;
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<any>(null);
  const stopTimer = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [playerDuration, setPlayerDuration] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const mediaLen = duration ?? playerDuration;
  const start = parseClock(settings.clipStartTime);
  const end = parseClock(settings.clipEndTime);
  const startInvalid = settings.clipStartTime.trim() !== "" && start === null;
  const endInvalid = settings.clipEndTime.trim() !== "" && end === null;
  const rangeInvalid = start !== null && end !== null && end <= start;

  const effStart = start ?? 0;
  const effEnd = end ?? mediaLen ?? null;
  const clipLen = effEnd !== null ? Math.max(0, effEnd - effStart) : null;

  // Destroy the player when the video changes / component unmounts.
  const destroyPlayer = useCallback(() => {
    if (stopTimer.current) window.clearInterval(stopTimer.current);
    stopTimer.current = null;
    try {
      player.current?.destroy?.();
    } catch {
      /* ignore */
    }
    player.current = null;
    setReady(false);
    setPlaying(false);
    setCurrent(0);
    setPlayerDuration(null);
    if (host.current) host.current.innerHTML = "";
  }, []);

  useEffect(() => {
    destroyPlayer();
    setStatus(null);
  }, [youtubeId, destroyPlayer]);
  useEffect(() => destroyPlayer, [destroyPlayer]);

  // Poll the player for the current time.
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      try {
        setCurrent(player.current?.getCurrentTime?.() ?? 0);
        const d = player.current?.getDuration?.();
        if (d) setPlayerDuration(d);
      } catch {
        /* ignore */
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [ready]);

  const loadPreview = async () => {
    if (!youtubeId || !host.current) return;
    setLoading(true);
    setStatus(null);
    try {
      const YT = await loadYouTubeApi();
      destroyPlayer();
      const mount = document.createElement("div");
      host.current.appendChild(mount);
      player.current = new YT.Player(mount, {
        videoId: youtubeId,
        width: "100%",
        height: "100%",
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, origin: window.location.origin },
        events: {
          onReady: () => {
            setReady(true);
            setLoading(false);
            const d = player.current?.getDuration?.();
            if (d) setPlayerDuration(d);
          },
          onStateChange: (e: any) => setPlaying(e.data === 1),
          onError: () => {
            setStatus("This video cannot be embedded. You can still type exact times below.");
            setLoading(false);
          },
        },
      });
    } catch (e) {
      setStatus((e as Error).message);
      setLoading(false);
    }
  };

  const togglePlay = () => {
    if (!ready) return;
    playing ? player.current.pauseVideo() : player.current.playVideo();
  };

  const jumpToStart = () => {
    if (!ready) return;
    player.current.seekTo(effStart, true);
  };

  const previewClip = () => {
    if (!ready) return;
    if (rangeInvalid || startInvalid || endInvalid) return;
    if (stopTimer.current) window.clearInterval(stopTimer.current);
    player.current.seekTo(effStart, true);
    player.current.playVideo();
    if (effEnd !== null) {
      stopTimer.current = window.setInterval(() => {
        const t = player.current?.getCurrentTime?.() ?? 0;
        if (t >= effEnd) {
          player.current.pauseVideo();
          if (stopTimer.current) window.clearInterval(stopTimer.current);
          stopTimer.current = null;
        }
      }, 120);
    }
  };

  const setFromPlayer = (which: "start" | "end") => {
    if (!ready) return;
    const t = player.current?.getCurrentTime?.() ?? 0;
    const val = formatClock(t, ms);
    update(which === "start" ? { clipStartTime: val } : { clipEndTime: val });
  };

  const reset = () => update({ clipStartTime: "", clipEndTime: "" });

  // Sliders (percent of media length)
  const pct = (sec: number | null) => (mediaLen ? Math.min(100, Math.max(0, (sec! / mediaLen) * 100)) : 0);
  const fromPct = (p: number) => (p / 100) * (mediaLen ?? 0);
  const startPct = pct(effStart);
  const endPct = end === null ? 100 : pct(end);

  const onStartSlider = (p: number) => {
    const sec = Math.min(fromPct(p), (effEnd ?? mediaLen ?? 0) - 0.1);
    update({ clipStartTime: sec <= 0 ? "" : formatClock(Math.max(0, sec), ms) });
  };
  const onEndSlider = (p: number) => {
    if (p >= 99.99) return update({ clipEndTime: "" });
    const sec = Math.max(fromPct(p), effStart + 0.1);
    update({ clipEndTime: formatClock(sec, ms) });
  };

  const noPlayerReason = !youtubeId
    ? "Live preview is available for YouTube links. For other sites, type exact times below."
    : null;

  const timeInput = (
    id: string,
    value: string,
    invalid: boolean,
    placeholder: string,
    onChange: (v: string) => void,
  ) => (
    <input
      id={id}
      type="text"
      className="input"
      value={value}
      placeholder={placeholder}
      pattern={PATTERN}
      inputMode="numeric"
      autoComplete="off"
      aria-invalid={invalid}
      style={invalid ? { borderBottomColor: "var(--err)" } : undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  );

  return (
    <div className="sub-card fade-up flex flex-col gap-4 p-4 sm:p-5" id="clip-options-container">
      <div className="flex flex-wrap items-center gap-3">
        <h4 className="display flex items-center gap-2 !text-[0.78rem]">
          <ScissorsIcon /> Cut Range
        </h4>
        <span
          className="px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.2em]"
          style={{ background: "var(--accent)", color: "var(--accent-text)" }}
        >
          New
        </span>
      </div>
      <p className="text-[0.78rem]" style={{ color: "var(--muted)" }}>
        Hear the preview, drag the trim handles, or type exact times in one place.
      </p>

      <ToggleRow
        id="clipUseMilliseconds"
        label="Use milliseconds for more exact cuts"
        checked={ms}
        onChange={(v) => update({ clipUseMilliseconds: v })}
      />

      {/* Preview */}
      <div className="border p-4" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <span className="label !mb-1">Preview</span>
            <div className="text-[0.95rem] font-medium" style={{ color: "var(--head)" }}>
              Visual trim preview
            </div>
          </div>
          <span className="eyebrow border px-2 py-1" style={{ borderColor: "var(--line)" }}>
            {youtubeId ? "YouTube" : isAudio ? "Audio" : "Manual"}
          </span>
        </div>

        <div
          className="relative flex aspect-video w-full items-center justify-center overflow-hidden border"
          style={{ borderColor: "var(--line)", background: "var(--panel)" }}
        >
          <div ref={host} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full" />
          {!ready && (
            <div className="relative z-10 flex max-w-sm flex-col items-center gap-3 p-6 text-center">
              <strong className="text-[0.9rem]" style={{ color: "var(--head)" }}>
                {youtubeId ? "Load the cutter preview" : "Paste a YouTube link to preview"}
              </strong>
              <p className="text-[0.76rem]" style={{ color: "var(--muted)" }}>
                {status ?? noPlayerReason ?? "The video embeds right here so you can set cut points while it plays."}
              </p>
              {youtubeId && (
                <button type="button" className="btn btn-primary btn-sm" onClick={loadPreview} disabled={loading}>
                  {loading ? "Loading…" : "Prepare preview"}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-sm" onClick={togglePlay} disabled={!ready}>
            {playing ? <PauseIcon width={11} height={11} /> : <PlayIcon width={11} height={11} />}
            {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={previewClip}
            disabled={!ready || startInvalid || endInvalid || rangeInvalid}
          >
            Preview clip
          </button>
          <button type="button" className="btn btn-sm" onClick={jumpToStart} disabled={!ready}>
            Jump to start
          </button>
          <button type="button" className="btn btn-sm" onClick={reset}>
            Reset range
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            ["Current", formatClock(current, ms)],
            ["Clip Length", clipLen !== null && (start !== null || end !== null) ? formatClock(clipLen, ms) : "Full length"],
            ["Media Length", mediaLen ? formatClock(mediaLen) : "Unknown"],
          ].map(([k, v]) => (
            <div key={k} className="border px-3 py-2" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
              <span className="label !mb-0.5 !text-[0.55rem]">{k}</span>
              <strong className="block text-[0.82rem] tabular-nums" style={{ color: "var(--head)" }}>
                {v}
              </strong>
            </div>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div className="border p-4" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
        <span className="label !mb-1">Trim Sliders</span>
        <div className="mb-2 text-[0.9rem] font-medium" style={{ color: "var(--head)" }}>
          Drag to choose your {isAudio ? "audio" : "video"} clip
        </div>
        <div className="grid gap-x-6 sm:grid-cols-2">
          <div>
            <span className="label !mb-0 mt-2">Start Slider</span>
            <input
              type="range"
              className="slider"
              min={0}
              max={100}
              step={0.1}
              value={startPct}
              disabled={!mediaLen}
              onChange={(e) => onStartSlider(Number(e.target.value))}
              aria-label="Clip start"
            />
          </div>
          <div>
            <span className="label !mb-0 mt-2">End Slider</span>
            <input
              type="range"
              className="slider"
              min={0}
              max={100}
              step={0.1}
              value={endPct}
              disabled={!mediaLen}
              onChange={(e) => onEndSlider(Number(e.target.value))}
              aria-label="Clip end"
            />
          </div>
        </div>
        {!mediaLen && (
          <p className="text-[0.72rem]" style={{ color: "var(--muted)" }}>
            Sliders unlock once the media length is known (after the link info loads or the preview is prepared).
          </p>
        )}
      </div>

      {/* Time inputs */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border p-4" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <span className="label !mb-1">Start</span>
              <div className="text-[0.9rem] tabular-nums" style={{ color: "var(--head)" }}>
                {formatClock(effStart, ms)}
              </div>
            </div>
            <button type="button" className="btn btn-sm" disabled={!ready} onClick={() => setFromPlayer("start")}>
              Set from player
            </button>
          </div>
          <Field label="Start Time" htmlFor="clipStartTime">
            {timeInput("clipStartTime", settings.clipStartTime, startInvalid, ms ? "00:00:00.000" : "00:00:00", (v) =>
              update({ clipStartTime: v }),
            )}
          </Field>
          <p className="mt-2 text-[0.72rem]" style={{ color: "var(--muted)" }}>
            Type an exact time or drag the start slider above.
          </p>
        </div>
        <div className="border p-4" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <span className="label !mb-1">End</span>
              <div className="text-[0.9rem] tabular-nums" style={{ color: "var(--head)" }}>
                {end === null ? "Full length" : formatClock(end, ms)}
              </div>
            </div>
            <button type="button" className="btn btn-sm" disabled={!ready} onClick={() => setFromPlayer("end")}>
              Set from player
            </button>
          </div>
          <Field label="End Time" htmlFor="clipEndTime">
            {timeInput("clipEndTime", settings.clipEndTime, endInvalid || rangeInvalid, ms ? "00:01:00.000" : "00:01:00", (v) =>
              update({ clipEndTime: v }),
            )}
          </Field>
          <p className="mt-2 text-[0.72rem]" style={{ color: "var(--muted)" }}>
            Leave this blank to keep the full length, or drag the end slider.
          </p>
        </div>
      </div>

      {(startInvalid || endInvalid || rangeInvalid) && (
        <p className="text-[0.76rem]" style={{ color: "var(--err)" }} role="alert">
          {rangeInvalid ? "The end time must be after the start time." : "Use HH:MM:SS or MM:SS (add .mmm for milliseconds)."}
        </p>
      )}

      <p className="text-[0.74rem] leading-relaxed" style={{ color: "var(--muted)" }}>
        Format: HH:MM:SS or MM:SS. Turn on milliseconds if you need sub-second cuts. Leave the end time blank to use the
        full video or audio.
      </p>

      {!isAudio && (
        <ToggleRow
          id="enablePortraitMode"
          label={
            <span className="flex flex-wrap items-center gap-2">
              Portrait Mode (9:16 for Shorts/Reels/TikTok)
              <span
                className="px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.2em]"
                style={{ background: "var(--accent)", color: "var(--accent-text)" }}
              >
                Shorts
              </span>
            </span>
          }
          checked={settings.enablePortraitMode}
          onChange={(v) => update({ enablePortraitMode: v })}
        >
          <p className="mt-2 px-1 text-[0.74rem]" style={{ color: "var(--muted)" }}>
            Crops video to vertical 9:16 aspect ratio, centering on the middle of the frame.
          </p>
        </ToggleRow>
      )}
    </div>
  );
}
