import { useEffect, useState, type ReactNode } from "react";
import udLogo from "../assets/ud.png";
import {
  CloseIcon,
  CoffeeIcon,
  DiscordIcon,
  GitHubIcon,
  HomeIcon,
  InfoIcon,
  MenuIcon,
  SearchIcon,
  UserIcon,
  YouTubeIcon,
} from "./Icons";

export const LINKS = {
  discord: "",
  github: "",
  kofi: "",
  ytdlpSites: "https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md",
  ytdlpOutput: "https://github.com/yt-dlp/yt-dlp#output-template",
  ytdlpSort: "https://github.com/yt-dlp/yt-dlp#sorting-formats",
};

/* ---------- Theme ---------- */
export function useTheme() {
  const [light, setLight] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "light" : false; // charcoal by default
  });
  useEffect(() => {
    document.documentElement.classList.toggle("light", light);
    document.documentElement.classList.toggle("dark", !light);
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", light ? "#efeff1" : "#09090b");
  }, [light]);
  const set = (v: boolean) => {
    setLight(v);
    localStorage.setItem("theme", v ? "light" : "dark");
  };
  return { light, set };
}

/* ---------- Sidebar (matches the original "Menu" drawer) ---------- */
export function Sidebar({ path }: { path: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const item = (href: string, icon: ReactNode, label: string) => (
    <a
      href={href}
      className="group flex items-center gap-4 border px-4 py-3.5 text-[0.78rem] uppercase tracking-[0.18em] no-underline transition-all duration-300 hover:translate-x-1"
      style={{
        borderColor: "var(--line)",
        color: "var(--text)",
        background: "var(--panel-2)",
      }}
    >
      <span style={{ color: "var(--muted)" }} className="transition-colors group-hover:text-[var(--head)]">
        {icon}
      </span>
      <span className="transition-colors group-hover:text-[var(--head)]">{label}</span>
    </a>
  );

  return (
    <>
      <button
        className="icon-btn fixed left-4 top-4 z-40 !h-10 !w-10 backdrop-blur"
        style={{ background: "color-mix(in srgb, var(--panel) 80%, transparent)" }}
        onClick={() => setOpen(true)}
        title="Open menu"
        aria-label="Open menu"
        aria-expanded={open}
      >
        <MenuIcon />
      </button>

      <div
        className="fixed inset-0 z-50 transition-opacity duration-300"
        style={{
          background: "rgba(0,0,0,.65)",
          backdropFilter: "blur(4px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={() => setOpen(false)}
      />
      <aside
        className="fixed bottom-0 left-0 top-0 z-[60] w-[min(86vw,19rem)] border-r transition-transform duration-500"
        style={{
          background: "var(--panel)",
          borderColor: "var(--line)",
          transform: open ? "translateX(0)" : "translateX(-102%)",
          transitionTimingFunction: "cubic-bezier(.2,.7,.2,1)",
          boxShadow: open ? "30px 0 80px -20px var(--shadow)" : "none",
        }}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b px-5 py-5" style={{ borderColor: "var(--line)" }}>
          <h2 className="display text-[0.78rem]">Menu</h2>
          <button className="icon-btn" onClick={() => setOpen(false)} title="Close menu" aria-label="Close menu" tabIndex={open ? 0 : -1}>
            <CloseIcon />
          </button>
        </div>
        <nav className="flex flex-col gap-2 p-5" tabIndex={open ? 0 : -1}>
          {item("#/", <HomeIcon />, "Back to Home")}
          {item("#/", <YouTubeIcon />, "KURO Downloader")}
          {item("#/credits", <UserIcon />, "Credits")}
          {item("#/info", <InfoIcon />, "About")}
        </nav>
      </aside>
    </>
  );
}

/* ---------- Left social rail + right "scroll" cue (from the reference) ---------- */
export function SideRails() {
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    const on = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setAtBottom(max > 0 && window.scrollY > max - 40);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, []);

  const social = (href: string, label: string, icon: ReactNode) => (
    <a
      key={label}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="transition-all duration-300 hover:-translate-y-0.5 hover:text-[var(--head)]"
      style={{ color: "var(--muted)" }}
    >
      {icon}
    </a>
  );

  return (
    <>
      <div className="fixed bottom-8 left-6 z-30 hidden flex-col gap-4 xl:flex">
        <span className="eyebrow" title="Discord username: 2rc3">2rc3</span>
      </div>
      <button
        className="eyebrow fixed bottom-8 right-6 z-30 hidden items-center gap-3 bg-transparent transition-colors hover:text-[var(--head)] xl:flex"
        style={{ border: 0, cursor: "pointer", flexDirection: "column" }}
        onClick={() =>
          window.scrollTo({ top: atBottom ? 0 : document.documentElement.scrollHeight, behavior: "smooth" })
        }
        aria-label={atBottom ? "Scroll to top" : "Scroll to bottom"}
      >
        <span className="vertical-text">{atBottom ? "Top" : "Scroll"}</span>
        <span className="block h-10 w-px" style={{ background: "var(--line-strong)" }} />
      </button>
    </>
  );
}

export function Brand({ small }: { small?: boolean }) {
  return (
    <a href="#/" className="inline-flex items-center gap-3 no-underline" aria-label="KURO home">
      <img
        src={udLogo}
        alt="KURO Logo"
        width={small ? 32 : 44}
        height={small ? 32 : 44}
        className="block"
        style={{ filter: "grayscale(1) brightness(1.9) contrast(1.1)", borderRadius: 2 }}
      />
    </a>
  );
}

export function ThemeSwitch({ light, onChange }: { light: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="eyebrow" id="themeLabel">
        {light ? "Light" : "Dark"}
      </span>
      <span className="toggle">
        <input
          type="checkbox"
          id="themeToggle"
          checked={light}
          onChange={(e) => onChange(e.target.checked)}
          aria-label="Toggle light theme"
        />
        <span className="track" />
      </span>
    </div>
  );
}

