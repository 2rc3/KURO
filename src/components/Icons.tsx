import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

const stroke = (p: P) => ({
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

const fill = (p: P) => ({ width: 16, height: 16, viewBox: "0 0 24 24", fill: "currentColor", ...p });

export const HistoryIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
export const QueueIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M3.75 12h16.5M3.75 6.75h16.5M3.75 17.25h16.5" />
  </svg>
);
export const SettingsIcon = (p: P) => (
  <svg {...stroke(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
  </svg>
);
export const TrashIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m5 5v6m4-6v6" />
  </svg>
);
export const ExportIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 10.5L12 15m0 0l4.5-4.5M12 15V3" />
  </svg>
);
export const ImportIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M21 8.25v2.25a2.25 2.25 0 01-2.25 2.25H16.5m-9 0H5.25A2.25 2.25 0 013 10.5V8.25M7.5 13.5L12 9m0 0l4.5 4.5M12 9v12" />
  </svg>
);
export const CloseIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const MenuIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </svg>
);
export const HomeIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />
  </svg>
);
export const SearchIcon = (p: P) => (
  <svg {...stroke(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);
export const CopyIcon = (p: P) => (
  <svg {...stroke(p)}>
    <rect x="9" y="9" width="11" height="11" rx="1" />
    <path d="M5 15V5a1 1 0 011-1h10" />
  </svg>
);
export const ChevronIcon = (p: P) => (
  <svg {...stroke(p)} className={"chev transition-transform duration-300 " + (p.className ?? "")}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const EyeIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
export const LikeIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
  </svg>
);
export const DislikeIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
  </svg>
);
export const ScissorsIcon = (p: P) => (
  <svg {...stroke(p)}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
  </svg>
);
export const ShareIcon = (p: P) => (
  <svg {...stroke(p)}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
  </svg>
);
export const DownloadIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 20h16" />
  </svg>
);
export const ExternalIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
  </svg>
);
export const UserIcon = (p: P) => (
  <svg {...stroke(p)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0116 0" />
  </svg>
);
export const GlobeIcon = (p: P) => (
  <svg {...stroke(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
  </svg>
);
export const InfoIcon = (p: P) => (
  <svg {...stroke(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
export const PlayIcon = (p: P) => (
  <svg {...fill(p)}>
    <path d="M8 5v14l11-7z" />
  </svg>
);
export const PauseIcon = (p: P) => (
  <svg {...fill(p)}>
    <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
  </svg>
);
export const YouTubeIcon = (p: P) => (
  <svg {...fill({ width: 24, height: 24, ...p })}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);
export const DiscordIcon = (p: P) => (
  <svg {...fill({ width: 24, height: 24, ...p })}>
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4464.8245-.618 1.2525a17.2963 17.2963 0 00-4.6418 0 12.6363 12.6363 0 00-.618-1.2525.0741.0741 0 00-.0785-.0371 19.7913 19.7913 0 00-4.8851 1.5152.0691.0691 0 00-.0321.0231C.0553 10.3338-.2141 15.2845.2344 19.9813a.0741.0741 0 00.0691.0541c1.821.3753 3.63 1.0426 5.2917 1.8021a.0741.0741 0 00.088-.0141c.4218-.4723.7706-.9917.9705-1.5418a.0741.0741 0 00-.0141-.0821c-.504-.338-.9917-.7005-1.4423-1.082a.0741.0741 0 01-.0141-.0541c.0231-.0141.0461-.0281.0691-.0421.1969-.1121.3857-.231.5665-.35a.0741.0741 0 01.0821 0c3.8573 2.2538 8.4553 2.2538 12.3126 0a.0741.0741 0 01.0821 0c.1808.119.3696.238.5665.35a.0741.0741 0 01.0691.0421.0741.0741 0 01-.0141.0541c-.4506.3815-.9383.744-1.4423 1.082a.0741.0741 0 00-.0141.0821c.1999.5501.5487 1.0695.9705 1.5418a.0741.0741 0 00.088.0141c1.6617-.7595 3.4707-1.4268 5.2917-1.8021a.0741.0741 0 00.0691-.0541c.522-4.9405.0741-9.9234-2.0011-15.6115a.0691.0691 0 00-.0321-.0231zM8.021 14.833c-1.3869 0-2.521-1.2525-2.521-2.7937s1.1341-2.7937 2.521-2.7937c1.3868 0 2.5209 1.2525 2.5209 2.7937.0001 1.5412-1.1341 2.7937-2.5209 2.7937zm7.4066 0c-1.3869 0-2.521-1.2525-2.521-2.7937s1.1341-2.7937 2.521-2.7937c1.3868 0 2.5209 1.2525 2.5209 2.7937s-1.134 2.7937-2.5209 2.7937z" />
  </svg>
);
export const GitHubIcon = (p: P) => (
  <svg {...stroke({ width: 24, height: 24, strokeWidth: 2, ...p })}>
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);
export const CoffeeIcon = (p: P) => (
  <svg {...stroke({ width: 24, height: 24, ...p })}>
    <path d="M17 8h1a4 4 0 010 8h-1M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" />
  </svg>
);
