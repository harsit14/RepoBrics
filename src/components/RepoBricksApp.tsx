"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Box, Footprints, Github, HelpCircle, Layers3, Loader2, Network, Plane, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { demoManifest } from "@/lib/demoManifest";
import { Inspector } from "@/components/Inspector";
import { useWorldStore } from "@/store/useWorldStore";
import type { WorldManifest } from "@/types/world";

const DEFAULT_REPO = "https://github.com/vercel/swr";
const WorldCanvas = dynamic(() => import("@/components/WorldCanvas").then((mod) => mod.WorldCanvas), {
  ssr: false,
  loading: () => <div className="h-full min-h-[58vh] w-full bg-[#e9eef6] md:min-h-0" />
});

export function RepoBricksApp() {
  const [repoUrl, setRepoUrl] = useState("");
  const [manifest, setManifest] = useState<WorldManifest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selection = useWorldStore((state) => state.selection);
  const setSelection = useWorldStore((state) => state.setSelection);
  const showDependencies = useWorldStore((state) => state.showDependencies);
  const colorByLanguage = useWorldStore((state) => state.colorByLanguage);
  const highlightComplexity = useWorldStore((state) => state.highlightComplexity);
  const viewMode = useWorldStore((state) => state.viewMode);
  const helpOpen = useWorldStore((state) => state.helpOpen);
  const setShowDependencies = useWorldStore((state) => state.setShowDependencies);
  const setColorByLanguage = useWorldStore((state) => state.setColorByLanguage);
  const setHighlightComplexity = useWorldStore((state) => state.setHighlightComplexity);
  const setViewMode = useWorldStore((state) => state.setViewMode);
  const setHelpOpen = useWorldStore((state) => state.setHelpOpen);
  const resetView = useWorldStore((state) => state.resetView);
  const setPressedKey = useWorldStore((state) => state.setPressedKey);
  const clearPressedKeys = useWorldStore((state) => state.clearPressedKeys);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("demo")) {
      setManifest(demoManifest);
      setRepoUrl(demoManifest.repo.url);
    }
  }, []);

  useEffect(() => {
    if (viewMode === "overview") {
      clearPressedKeys();
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) {
        return;
      }
      const key = normalizeKey(event.key);
      if (NAVIGATION_KEYS.has(key)) {
        event.preventDefault();
        setPressedKey(key, true);
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      const key = normalizeKey(event.key);
      if (NAVIGATION_KEYS.has(key)) {
        event.preventDefault();
        setPressedKey(key, false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      clearPressedKeys();
    };
  }, [clearPressedKeys, setPressedKey, viewMode]);

  const selectedLabel = useMemo(() => {
    if (!selection || !manifest) {
      return "Nothing selected";
    }
    const source =
      manifest.buildings.find((item) => item.id === selection.id) ??
      manifest.landmarks.find((item) => item.id === selection.id) ??
      manifest.districts.find((item) => item.id === selection.id) ??
      manifest.connections.find((item) => item.id === selection.id) ??
      manifest.roads.find((item) => item.id === selection.id);

    if (!source) {
      return "Nothing selected";
    }

    if ("path" in source) {
      return source.path;
    }
    if ("fromPath" in source) {
      return `${source.fromPath} -> ${source.toPath}`;
    }
    return source.name;
  }, [manifest, selection]);

  async function analyzeRepo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = repoUrl.trim() || DEFAULT_REPO;
    setRepoUrl(target);
    setError(null);
    setIsLoading(true);
    setSelection(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: target })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "RepoBricks could not analyze this repository.");
      }
      setManifest(payload as WorldManifest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "RepoBricks could not analyze this repository.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-50 text-slate-950">
      <header className="z-20 border-b border-slate-200 bg-white/92 px-3 py-3 shadow-sm backdrop-blur md:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white shadow-sm">
              <Box size={21} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-normal text-slate-950">RepoBricks</h1>
              <p className="truncate text-xs text-slate-500">{manifest ? manifest.repo.fullName : "Brick architecture map"}</p>
            </div>
          </div>

          <form className="flex min-w-0 flex-1 gap-2" onSubmit={analyzeRepo}>
            <div className="relative min-w-0 flex-1">
              <Github className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} aria-hidden="true" />
              <input
                className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                placeholder={DEFAULT_REPO}
                aria-label="GitHub repository URL"
              />
            </div>
            <button
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? <Loader2 className="animate-spin" size={17} aria-hidden="true" /> : <Search size={17} aria-hidden="true" />}
              <span className="hidden sm:inline">{isLoading ? "Analyzing" : "Analyze"}</span>
            </button>
          </form>

          <div className="flex items-center gap-2">
            <button
              className={`icon-button ${viewMode === "street" ? "icon-button-active" : ""}`}
              onClick={() => setViewMode(viewMode === "street" ? "overview" : "street")}
              title="Street view"
              aria-label="Toggle street view"
              aria-pressed={viewMode === "street"}
              type="button"
            >
              <Footprints size={17} aria-hidden="true" />
            </button>
            <button
              className={`icon-button ${viewMode === "fly" ? "icon-button-active" : ""}`}
              onClick={() => setViewMode(viewMode === "fly" ? "overview" : "fly")}
              title="Fly mode"
              aria-label="Toggle fly mode"
              aria-pressed={viewMode === "fly"}
              type="button"
            >
              <Plane size={17} aria-hidden="true" />
            </button>
            <button
              className={`icon-button ${showDependencies ? "icon-button-active" : ""}`}
              onClick={() => setShowDependencies(!showDependencies)}
              title="Dependencies"
              aria-label="Toggle dependency connections"
              aria-pressed={showDependencies}
              type="button"
            >
              <Network size={17} aria-hidden="true" />
            </button>
            <button
              className={`icon-button ${colorByLanguage ? "icon-button-active" : ""}`}
              onClick={() => setColorByLanguage(!colorByLanguage)}
              title="Language colors"
              aria-label="Toggle language colors"
              aria-pressed={colorByLanguage}
              type="button"
            >
              <Layers3 size={17} aria-hidden="true" />
            </button>
            <button
              className={`icon-button ${highlightComplexity ? "icon-button-active" : ""}`}
              onClick={() => setHighlightComplexity(!highlightComplexity)}
              title="Complexity"
              aria-label="Toggle complexity highlights"
              aria-pressed={highlightComplexity}
              type="button"
            >
              <SlidersHorizontal size={17} aria-hidden="true" />
            </button>

            <span className="mx-0.5 h-6 w-px bg-slate-200" aria-hidden="true" />

            <button
              className="icon-button"
              onClick={() => resetView()}
              title="Reset view"
              aria-label="Reset camera to overview"
              type="button"
            >
              <RotateCcw size={17} aria-hidden="true" />
            </button>
            <button
              className={`icon-button ${helpOpen ? "icon-button-active" : ""}`}
              onClick={() => setHelpOpen(!helpOpen)}
              title="Controls help"
              aria-label="Toggle controls help"
              aria-pressed={helpOpen}
              type="button"
            >
              <HelpCircle size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <section className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="relative min-h-[58vh] flex-1 md:min-h-0">
          <WorldCanvas manifest={manifest} isLoading={isLoading} />

          {!manifest && !isLoading ? (
            <div className="pointer-events-none absolute inset-x-4 top-5 mx-auto max-w-md rounded-lg border border-slate-200 bg-white/94 p-4 text-sm text-slate-600 shadow-panel backdrop-blur">
              <div className="flex items-start gap-3">
                <Box className="mt-0.5 text-red-600" size={20} aria-hidden="true" />
                <div>
                  <p className="font-medium text-slate-950">No world loaded</p>
                  <p className="mt-1 leading-5">Use the repo bar above to generate a brick model.</p>
                </div>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="absolute left-4 right-4 top-5 mx-auto max-w-xl rounded-lg border border-red-200 bg-white p-4 text-sm text-red-700 shadow-panel">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
                <p>{error}</p>
              </div>
            </div>
          ) : null}

          {helpOpen ? <ControlsHelp viewMode={viewMode} onClose={() => setHelpOpen(false)} /> : null}

          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white/92 px-3 py-2 text-xs text-slate-600 shadow-sm backdrop-blur md:right-auto">
            <span className="font-medium text-slate-900">{selectedLabel}</span>
            {manifest ? (
              <>
                <span>{manifest.stats.buildings} buildings</span>
                <span>{manifest.stats.roads} roads</span>
                <span>{manifest.stats.connections} links</span>
                <span>{manifest.stats.landmarks} landmarks</span>
                <span>{viewMode === "street" ? "Street View" : viewMode === "fly" ? "Fly Mode" : "Overview"}</span>
              </>
            ) : null}
          </div>
        </div>

        <Inspector manifest={manifest} selection={selection} />
      </section>
    </main>
  );
}

function ControlsHelp({ viewMode, onClose }: { viewMode: "overview" | "street" | "fly"; onClose: () => void }) {
  const rows =
    viewMode === "street"
      ? [
          ["Move", "W A S D"],
          ["Look", "Drag · Q E"],
          ["Dolly", "Scroll"],
          ["Sprint", "Shift"]
        ]
      : viewMode === "fly"
        ? [
            ["Move", "W A S D"],
            ["Up · Down", "Space · F"],
            ["Look", "Drag · ← →"],
            ["Dolly", "Scroll"],
            ["Boost", "Shift"]
          ]
        : [
            ["Orbit", "Drag"],
            ["Pan", "Right-drag"],
            ["Zoom", "Scroll"],
            ["Focus", "Click a brick"]
          ];

  return (
    <div className="absolute right-4 top-5 w-60 rounded-lg border border-slate-200 bg-white/95 p-3 text-xs text-slate-600 shadow-panel backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-950">
          {viewMode === "street" ? "Street controls" : viewMode === "fly" ? "Fly controls" : "Overview controls"}
        </p>
        <button onClick={onClose} className="text-base leading-none text-slate-400 hover:text-slate-700" aria-label="Close controls help" type="button">
          ×
        </button>
      </div>
      <dl className="space-y-1.5">
        {rows.map(([label, keys]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">{label}</dt>
            <dd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-medium text-slate-700">{keys}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const NAVIGATION_KEYS = new Set([
  "w",
  "a",
  "s",
  "d",
  "r",
  "f",
  "c",
  " ",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "q",
  "e",
  "+",
  "-",
  "=",
  "shift"
]);

function normalizeKey(key: string): string {
  return key.toLowerCase();
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
}
