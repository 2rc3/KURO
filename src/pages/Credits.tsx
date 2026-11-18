import { DiscordIcon, GlobeIcon } from "../components/Icons";

export default function Credits() {
  return (
    <div className="fade-up mx-auto flex w-full max-w-xl flex-col px-4 pb-24 pt-4 sm:px-6">
      <a href="#/" className="btn btn-sm mb-8 self-start">
        ← Back to Downloader
      </a>

      <div className="card flex flex-col items-center p-8 text-center sm:p-12">
        <p className="eyebrow mb-6">Credits</p>
        <div
          aria-label="k38a7 profile"
          className="flex h-28 w-28 items-center justify-center rounded-full display text-2xl"
          style={{ border: "1px solid var(--line-strong)", color: "var(--head)", background: "var(--panel-2)" }}
        >
          k38a7
        </div>
        <h1 className="display mt-6 text-[1.5rem]">k38a7</h1>
        <p className="mt-2 text-[0.82rem] uppercase tracking-[0.16em]" style={{ color: "var(--text)" }}>
          Creator &amp; Developer
        </p>
        <p className="mt-6 text-[0.9rem]" style={{ color: "var(--muted)" }}>
          KURO Downloader
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <a href="https://www.tiktok.com/@k38a7" target="_blank" rel="noopener noreferrer" className="btn flex-1">
            <GlobeIcon /> TikTok @k38a7
          </a>
          <div className="btn flex-1" title="Discord username: 2rc3">
            <DiscordIcon width={16} height={16} /> Discord: 2rc3
          </div>
        </div>
      </div>
    </div>
  );
}
