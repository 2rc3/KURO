export type DownloadType = "video" | "audio" | "gif";

export interface Settings {
  downloadType: DownloadType;
  videoFormat: string;
  audioFormat: string;
  audioBitrate: string;
  advRemuxVideo: string;
  resolution: string;
  highestFps: string;
  gifFps: string;
  gifWidth: string;
  drmSourcePreference: string;
  includeSubtitles: boolean;
  enableSponsorblock: boolean;
  sponsorblockMark: string[];
  sponsorblockRemove: string[];
  enablePlaylist: boolean;
  uploadToAnondrop: boolean;
  enableClipping: boolean;
  clipStartTime: string;
  clipEndTime: string;
  clipUseMilliseconds: boolean;
  enablePortraitMode: boolean;
  advEmbedMetadata: boolean;
  advEmbedChapters: boolean;
  advEmbedThumbnail: boolean;
  advWriteInfoJson: boolean;
  advWriteDescription: boolean;
  advWriteThumbnail: boolean;
  advMergeOutputFormat: string;
  advPreferFreeFormats: boolean;
  advRestrictFilenames: boolean;
  advRetries: string;
  advFragmentRetries: string;
  advOutputTemplate: string;
  advNoOverwrites: boolean;
  advEmbedSubs: boolean;
  advKeepVideo: boolean;
  advFormatSort: string;
}

export const DEFAULT_SETTINGS: Settings = {
  downloadType: "video",
  videoFormat: "auto",
  audioFormat: "mp3",
  audioBitrate: "0",
  advRemuxVideo: "",
  resolution: "1080",
  highestFps: "yes",
  gifFps: "15",
  gifWidth: "480",
  drmSourcePreference: "auto",
  includeSubtitles: false,
  enableSponsorblock: false,
  sponsorblockMark: ["sponsor", "intro", "outro", "selfpromo", "filler", "interaction", "music_offtopic"],
  sponsorblockRemove: ["sponsor", "intro", "outro", "selfpromo", "preview", "interaction", "music_offtopic"],
  enablePlaylist: false,
  uploadToAnondrop: false,
  enableClipping: false,
  clipStartTime: "",
  clipEndTime: "",
  clipUseMilliseconds: false,
  enablePortraitMode: false,
  advEmbedMetadata: true,
  advEmbedChapters: true,
  advEmbedThumbnail: true,
  advWriteInfoJson: false,
  advWriteDescription: false,
  advWriteThumbnail: false,
  advMergeOutputFormat: "",
  advPreferFreeFormats: false,
  advRestrictFilenames: false,
  advRetries: "10",
  advFragmentRetries: "10",
  advOutputTemplate: "",
  advNoOverwrites: false,
  advEmbedSubs: false,
  advKeepVideo: false,
  advFormatSort: "",
};

export type PresetKey = "best" | "balanced" | "fast" | "audio";

export const PRESETS: { key: PresetKey; label: string; name: string }[] = [
  { key: "best", label: ">~< Best Quality", name: "Best Quality" },
  { key: "balanced", label: ":3 Balanced", name: "Balanced" },
  { key: "fast", label: ">:3 Fast Download", name: "Fast Download" },
  { key: "audio", label: ">_< Audio Only", name: "Audio Only" },
];

export function applyPreset(s: Settings, p: PresetKey): Settings {
  switch (p) {
    case "best":
      return { ...s, downloadType: "video", resolution: "2160", highestFps: "yes", includeSubtitles: true };
    case "balanced":
      return { ...s, downloadType: "video", resolution: "1080", highestFps: "no" };
    case "fast":
      return { ...s, downloadType: "video", resolution: "720", highestFps: "no" };
    case "audio":
      return { ...s, downloadType: "audio", audioFormat: "mp3" };
  }
}

export const SB_CATEGORIES: [string, string][] = [
  ["sponsor", "Sponsor"],
  ["intro", "Intro"],
  ["outro", "Outro"],
  ["selfpromo", "Self-Promo"],
  ["preview", "Preview"],
  ["filler", "Filler"],
  ["interaction", "Interaction"],
  ["music_offtopic", "Off-Topic"],
];

/** Hosts that need a "DRM link source" lookup (same list the original describes). */
export function isDrmHost(url: string): boolean {
  try {
    const h = new URL(url.trim()).hostname.toLowerCase();
    return /(^|\.)(spotify\.com|music\.apple\.com|deezer\.com|music\.amazon\.[a-z.]+)$/.test(h);
  } catch {
    return false;
  }
}

/** Builds the exact request body the yt-dlp server expects at POST /download. */
export function buildPayload(url: string, s: Settings) {
  const t = s.downloadType;
  const clip = s.enableClipping;
  return {
    mediaUrl: url,
    format: t === "audio" ? s.audioFormat : t === "gif" ? "gif" : s.videoFormat,
    resolution: s.resolution,
    highest_fps: s.highestFps,
    drmSourcePreference: t === "audio" ? s.drmSourcePreference : "auto",
    includeSubtitles: s.includeSubtitles,
    noSponsorblock: !s.enableSponsorblock,
    sponsorblockMark: s.sponsorblockMark,
    sponsorblockRemove: s.sponsorblockRemove,
    enablePlaylist: s.enablePlaylist,
    uploadToTerabox: s.uploadToAnondrop,
    enableClipping: clip,
    clipStartTime: clip ? s.clipStartTime || null : null,
    clipEndTime: clip ? s.clipEndTime || null : null,
    enablePortraitMode: clip ? s.enablePortraitMode : false,
    gifFps: t === "gif" ? parseInt(s.gifFps, 10) : null,
    gifWidth: t === "gif" ? parseInt(s.gifWidth, 10) : null,
    advEmbedMetadata: s.advEmbedMetadata,
    advEmbedChapters: s.advEmbedChapters,
    advEmbedThumbnail: s.advEmbedThumbnail,
    advWriteInfoJson: s.advWriteInfoJson,
    advWriteDescription: s.advWriteDescription,
    advWriteThumbnail: s.advWriteThumbnail,
    advRemuxVideo: s.advRemuxVideo,
    advMergeOutputFormat: s.advMergeOutputFormat,
    advPreferFreeFormats: s.advPreferFreeFormats,
    advRestrictFilenames: s.advRestrictFilenames,
    advRetries: s.advRetries,
    advFragmentRetries: s.advFragmentRetries,
    advOutputTemplate: s.advOutputTemplate.trim(),
    advNoOverwrites: s.advNoOverwrites,
    advEmbedSubs: s.advEmbedSubs,
    advKeepVideo: s.advKeepVideo,
    advFormatSort: s.advFormatSort.trim(),
    audioBitrate: s.audioBitrate,
  };
}
