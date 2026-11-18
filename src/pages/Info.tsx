export default function Info() {
  return (
    <div className="fade-up mx-auto w-full max-w-3xl px-4 pb-24 pt-4 sm:px-6">
      <div className="card p-6 sm:p-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="display text-[1.4rem]">About</h1>
          <a href="#/" className="btn btn-sm">Back to Downloader</a>
        </div>
        <p className="leading-relaxed">
          A simple YouTube-only downloader interface powered by yt-dlp on the server. Paste a YouTube video or
          playlist URL, choose your preferred format and quality, and the configured backend will process the
          download.
        </p>
        <h2 className="display mb-4 mt-10 text-[0.85rem]">Supported platform</h2>
        <div className="sub-card px-4 py-3 text-[0.82rem]">YouTube</div>
        <p className="mt-6 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          Only download content you own or have permission to use. Respect copyright and YouTube's Terms of Service.
        </p>
      </div>
    </div>
  );
}
