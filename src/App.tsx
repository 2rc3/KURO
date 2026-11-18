import { useEffect } from "react";
import { Brand, Sidebar, SideRails, useTheme } from "./components/Chrome";
import { UIProvider } from "./components/ui";
import { useRoute } from "./lib/router";
import Credits from "./pages/Credits";
import Downloader from "./pages/Downloader";
import Info from "./pages/Info";

const NAV: [string, string][] = [
  ["/", "Downloader"],
  ["/credits", "Credits"],
  ["/info", "Info"],
];

export default function App() {
  const route = useRoute();
  const { light, set } = useTheme();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route.path]);

  let page;
  switch (route.path) {
    case "/credits":
      page = <Credits />;
      break;
    case "/info":
      page = <Info />;
      break;
    default: {
      const u = route.params.get("url") ?? "";
      const res = route.params.get("res") ?? undefined;
      page = <Downloader key={u + res} light={light} setLight={set} initialUrl={u} initialResolution={res} />;
    }
  }

  return (
    <UIProvider>
      <Sidebar path={route.path} />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 pl-16 sm:px-6 sm:pl-20">
        <Brand />
        <nav className="flex items-center gap-4 sm:gap-8" aria-label="Primary">
          {NAV.map(([p, label]) => {
            const active = route.path === p;
            return (
              <a
                key={p}
                href={"#" + p}
                aria-current={active ? "page" : undefined}
                className={
                  "eyebrow relative no-underline transition-colors duration-300 hover:text-[var(--head)] " +
                  (p === "/credits" || p === "/info" ? "hidden sm:inline " : "")
                }
                style={{ color: active ? "var(--head)" : undefined }}
              >
                {label}
                <span
                  className="absolute -bottom-1.5 left-0 h-px bg-[var(--head)] transition-all duration-300"
                  style={{ width: active ? "100%" : 0 }}
                />
              </a>
            );
          })}
        </nav>
      </header>
      <main>{page}</main>
      <SideRails />
    </UIProvider>
  );
}
