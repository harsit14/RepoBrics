"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Box, Clock3, Footprints, Github, HelpCircle, Layers3, Loader2, Moon, Network, Pause, Plane, Play, RotateCcw, Search, SkipBack, SkipForward, SlidersHorizontal } from "lucide-react";
import { demoManifest } from "@/lib/demoManifest";
import { composeManifestFromArtifacts } from "@/lib/worldArtifacts";
import { Inspector } from "@/components/Inspector";
import { useWorldStore } from "@/store/useWorldStore";
import type { AnalysisJob, Building, HistoryFrame, Selection, Vec3, WorldChunk, WorldChunkRef, WorldIndex, WorldManifest } from "@/types/world";

const DEFAULT_REPO = "https://github.com/vercel/swr";
const INITIAL_CHUNK_COUNT = 4;
const ACTIVE_CHUNK_COUNT = 14;
const CHUNK_FETCH_BATCH = 4;
const STREAM_RENDERED_FILE_LIMIT = 10_000;

type StreamSession = {
  jobId: string;
  index: WorldIndex;
  chunkArtifactIds: string[];
  historyArtifactIds: string[];
};

const WorldCanvas = dynamic(() => import("@/components/WorldCanvas").then((mod) => mod.WorldCanvas), {
  ssr: false,
  loading: () => <div className="h-full min-h-[58vh] w-full bg-[#e9eef6] md:min-h-0" />
});

export function RepoBricksApp() {
  const [repoUrl, setRepoUrl] = useState("");
  const [manifest, setManifest] = useState<WorldManifest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileSearch, setFileSearch] = useState("");
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);
  const [includeHistory, setIncludeHistory] = useState(false);
  const [streamSession, setStreamSession] = useState<StreamSession | null>(null);
  const [worldChunks, setWorldChunks] = useState<WorldChunk[]>([]);
  const [streamMessage, setStreamMessage] = useState<string | null>(null);
  const [historyFrames, setHistoryFrames] = useState<HistoryFrame[]>([]);
  const [activeHistoryFrameId, setActiveHistoryFrameId] = useState<string | null>(null);
  const [historyPlaying, setHistoryPlaying] = useState(false);
  const requestedChunkIds = useRef(new Set<string>());
  const selection = useWorldStore((state) => state.selection);
  const setSelection = useWorldStore((state) => state.setSelection);
  const showDependencies = useWorldStore((state) => state.showDependencies);
  const colorByLanguage = useWorldStore((state) => state.colorByLanguage);
  const highlightComplexity = useWorldStore((state) => state.highlightComplexity);
  const viewMode = useWorldStore((state) => state.viewMode);
  const sceneTheme = useWorldStore((state) => state.sceneTheme);
  const helpOpen = useWorldStore((state) => state.helpOpen);
  const viewportAnchor = useWorldStore((state) => state.viewportAnchor);
  const historyFocusPaths = useWorldStore((state) => state.historyFocusPaths);
  const setShowDependencies = useWorldStore((state) => state.setShowDependencies);
  const setColorByLanguage = useWorldStore((state) => state.setColorByLanguage);
  const setHighlightComplexity = useWorldStore((state) => state.setHighlightComplexity);
  const setViewMode = useWorldStore((state) => state.setViewMode);
  const setSceneTheme = useWorldStore((state) => state.setSceneTheme);
  const setHelpOpen = useWorldStore((state) => state.setHelpOpen);
  const setHistoryFocusPaths = useWorldStore((state) => state.setHistoryFocusPaths);
  const resetView = useWorldStore((state) => state.resetView);
  const setPressedKey = useWorldStore((state) => state.setPressedKey);
  const clearPressedKeys = useWorldStore((state) => state.clearPressedKeys);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("demo")) {
      setManifest(demoManifest);
      setRepoUrl(demoManifest.repo.url);
      setFileSearch("");
      setStreamSession(null);
      setWorldChunks([]);
      setHistoryFrames([]);
      setActiveHistoryFrameId(null);
      setHistoryFocusPaths([]);
    }
    if (params.get("theme") === "neon") {
      setSceneTheme("neon");
    }
  }, [setHistoryFocusPaths, setSceneTheme]);

  const chunkAnchor = useMemo(
    () => ({
      x: Math.round(viewportAnchor.x / 8) * 8,
      y: 0,
      z: Math.round(viewportAnchor.z / 8) * 8
    }),
    [viewportAnchor.x, viewportAnchor.z]
  );

  const activeChunkRefs = useMemo(() => {
    if (!streamSession) {
      return [];
    }
    return prioritizeChunkRefs(streamSession.index, chunkAnchor, historyFocusPaths).slice(0, ACTIVE_CHUNK_COUNT);
  }, [chunkAnchor, historyFocusPaths, streamSession]);

  const activeChunkIds = useMemo(() => new Set(activeChunkRefs.map((chunk) => chunk.id)), [activeChunkRefs]);

  useEffect(() => {
    if (!streamSession) {
      return;
    }

    const visibleChunks = worldChunks.filter((chunk) => activeChunkIds.has(chunk.id));
    if (visibleChunks.length === 0) {
      return;
    }

    setManifest(composeManifestFromArtifacts(streamSession.index, visibleChunks));
  }, [activeChunkIds, streamSession, worldChunks]);

  useEffect(() => {
    if (!streamSession) {
      return;
    }

    const loadedIds = new Set(worldChunks.map((chunk) => chunk.id));
    const missing = activeChunkRefs
      .filter((chunk) => !loadedIds.has(chunk.id) && !requestedChunkIds.current.has(chunk.id))
      .slice(0, CHUNK_FETCH_BATCH);

    if (missing.length === 0) {
      setStreamMessage(streamStatus(streamSession.index, worldChunks, activeChunkIds.size));
      return;
    }

    for (const chunk of missing) {
      requestedChunkIds.current.add(chunk.id);
    }
    setStreamMessage(`Loading ${missing.length} nearby sector${missing.length === 1 ? "" : "s"}`);

    let cancelled = false;
    Promise.all(missing.map((chunk) => fetchArtifact<WorldChunk>(streamSession.jobId, chunk.artifactId)))
      .then((nextChunks) => {
        if (cancelled) {
          return;
        }
        setWorldChunks((current) => mergeChunks(current, nextChunks));
      })
      .catch((error) => {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : "RepoBricks could not stream a world chunk.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeChunkIds, activeChunkRefs, streamSession, worldChunks]);

  useEffect(() => {
    if (!historyPlaying || historyFrames.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveHistoryFrameId((current) => {
        const index = Math.max(0, historyFrames.findIndex((frame) => frame.id === current));
        return historyFrames[(index + 1) % historyFrames.length]?.id ?? null;
      });
    }, 1150);

    return () => window.clearInterval(timer);
  }, [historyFrames, historyPlaying]);

  const activeHistoryFrame = useMemo(
    () => historyFrames.find((frame) => frame.id === activeHistoryFrameId) ?? null,
    [activeHistoryFrameId, historyFrames]
  );

  useEffect(() => {
    setHistoryFocusPaths(activeHistoryFrame ? changedPathsForFrame(activeHistoryFrame) : []);
  }, [activeHistoryFrame, setHistoryFocusPaths]);

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

  const searchResults = useMemo(() => {
    const query = fileSearch.trim().toLowerCase();
    if (!manifest || query.length === 0) {
      return [];
    }

    return manifest.buildings
      .filter((building) => {
        const path = building.path.toLowerCase();
        const name = building.name.toLowerCase();
        const language = building.language.toLowerCase();
        return path.includes(query) || name.includes(query) || language.includes(query);
      })
      .sort((a, b) => searchScore(a, query) - searchScore(b, query) || a.path.localeCompare(b.path))
      .slice(0, 8);
  }, [fileSearch, manifest]);

  function focusSelection(nextSelection: NonNullable<Selection>) {
    setSelection(nextSelection);
    setViewMode("overview");
  }

  function focusBuilding(building: Building) {
    focusSelection({ kind: "building", id: building.id });
    setFileSearch("");
  }

  async function analyzeRepo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = repoUrl.trim() || DEFAULT_REPO;
    setRepoUrl(target);
    setError(null);
    setIsLoading(true);
    setAnalysisStatus("Queued");
    setSelection(null);
    setFileSearch("");
    setManifest(null);
    setStreamSession(null);
    setWorldChunks([]);
    setStreamMessage(null);
    setHistoryFrames([]);
    setActiveHistoryFrameId(null);
    setHistoryPlaying(false);
    setHistoryFocusPaths([]);
    requestedChunkIds.current.clear();

    try {
      const job = await runAnalysisJob(target, includeHistory, setAnalysisStatus);
      if (!job.artifacts) {
        throw new Error("RepoBricks finished the job without artifact references.");
      }

      setAnalysisStatus("Loading world index");
      const index = await fetchArtifact<WorldIndex>(job.id, job.artifacts.index);
      const session = {
        jobId: job.id,
        index,
        chunkArtifactIds: job.artifacts.chunks,
        historyArtifactIds: job.artifacts.historyFrames
      };
      setStreamSession(session);

      const initialRefs = prioritizeChunkRefs(index, index.bounds.center, []).slice(0, INITIAL_CHUNK_COUNT);
      for (const chunk of initialRefs) {
        requestedChunkIds.current.add(chunk.id);
      }
      setAnalysisStatus(`Loading ${initialRefs.length} sector${initialRefs.length === 1 ? "" : "s"}`);
      const initialChunks = await Promise.all(initialRefs.map((chunk) => fetchArtifact<WorldChunk>(job.id, chunk.artifactId)));
      setWorldChunks(initialChunks);
      setManifest(composeManifestFromArtifacts(index, initialChunks));

      if (job.artifacts.historyFrames.length > 0) {
        setAnalysisStatus("Loading timeline");
        const frames = await Promise.all(job.artifacts.historyFrames.map((artifactId) => fetchArtifact<HistoryFrame>(job.id, artifactId)));
        const orderedFrames = frames.sort((a, b) => a.sequence - b.sequence);
        setHistoryFrames(orderedFrames);
        setActiveHistoryFrameId(orderedFrames.at(-1)?.id ?? null);
      }

      setStreamMessage(streamStatus(index, initialChunks, Math.min(index.chunks.length, ACTIVE_CHUNK_COUNT)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "RepoBricks could not analyze this repository.");
    } finally {
      setIsLoading(false);
      setAnalysisStatus(null);
    }
  }

  async function runAnalysisJob(repoUrl: string, historyEnabled: boolean, onStatus: (status: string) => void): Promise<AnalysisJob> {
    const createResponse = await fetch("/api/analyze/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repoUrl,
        includeHistory: historyEnabled,
        maxHistoryFrames: historyEnabled ? 60 : undefined,
        maxRenderedFiles: STREAM_RENDERED_FILE_LIMIT
      })
    });
    const createPayload = await createResponse.json();
    if (!createResponse.ok) {
      throw new Error(createPayload.error ?? "RepoBricks could not start this analysis job.");
    }

    let job = createPayload as AnalysisJob;
    onStatus(statusLabel(job));

    for (let attempt = 0; attempt < 240; attempt += 1) {
      if (job.status === "succeeded") {
        return job;
      }

      if (job.status === "failed") {
        throw new Error(job.error ?? "RepoBricks could not analyze this repository.");
      }

      await sleep(750);
      const jobResponse = await fetch(`/api/analyze/jobs/${encodeURIComponent(job.id)}`);
      const jobPayload = await jobResponse.json();
      if (!jobResponse.ok) {
        throw new Error(jobPayload.error ?? "RepoBricks lost track of this analysis job.");
      }
      job = jobPayload as AnalysisJob;
      onStatus(statusLabel(job));
    }

    throw new Error("RepoBricks analysis timed out. Try a smaller repository or run the analyzer worker.");
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-50 text-slate-950" data-scene-theme={sceneTheme}>
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
              <span className="hidden sm:inline">{isLoading ? analysisStatus ?? "Analyzing" : "Analyze"}</span>
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
            <button
              className={`icon-button ${includeHistory ? "icon-button-active" : ""}`}
              onClick={() => setIncludeHistory(!includeHistory)}
              title="Git history"
              aria-label="Toggle git history capture"
              aria-pressed={includeHistory}
              disabled={isLoading}
              type="button"
            >
              <Clock3 size={17} aria-hidden="true" />
            </button>
            <button
              className={`icon-button ${sceneTheme === "neon" ? "icon-button-active" : ""}`}
              onClick={() => setSceneTheme(sceneTheme === "neon" ? "day" : "neon")}
              title="Neon theme"
              aria-label="Toggle neon theme"
              aria-pressed={sceneTheme === "neon"}
              type="button"
            >
              <Moon size={17} aria-hidden="true" />
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

          {manifest ? (
            <>
              <WorldSearch query={fileSearch} results={searchResults} onQueryChange={setFileSearch} onSelect={focusBuilding} />
              <WorldMinimap manifest={manifest} selection={selection} onSelect={focusSelection} />
            </>
          ) : null}

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

          {streamSession ? (
            <StreamHud index={streamSession.index} loadedCount={worldChunks.length} activeCount={activeChunkIds.size} message={streamMessage} />
          ) : null}

          {historyFrames.length > 0 ? (
            <HistoryTimeline
              frames={historyFrames}
              activeFrame={activeHistoryFrame}
              playing={historyPlaying}
              onSelect={(frame) => setActiveHistoryFrameId(frame.id)}
              onPlayToggle={() => setHistoryPlaying((value) => !value)}
              onStep={(direction) => setActiveHistoryFrameId((current) => stepFrame(historyFrames, current, direction)?.id ?? null)}
            />
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
                {streamSession ? <span>{worldChunks.length}/{streamSession.index.chunks.length} sectors cached</span> : null}
                {isLoading && analysisStatus ? <span>{analysisStatus}</span> : null}
              </>
            ) : isLoading && analysisStatus ? (
              <span>{analysisStatus}</span>
            ) : null}
          </div>
        </div>

        <Inspector manifest={manifest} selection={selection} />
      </section>
    </main>
  );
}

function WorldSearch({
  query,
  results,
  onQueryChange,
  onSelect
}: {
  query: string;
  results: Building[];
  onQueryChange: (value: string) => void;
  onSelect: (building: Building) => void;
}) {
  return (
    <div className="absolute left-3 right-3 top-3 z-10 sm:right-auto sm:w-80">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} aria-hidden="true" />
        <input
          className="h-9 w-full rounded-md border border-slate-200 bg-white/95 pl-9 pr-3 text-sm text-slate-950 shadow-sm outline-none backdrop-blur placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Find file"
          aria-label="Search files"
        />
      </div>
      {query.trim().length > 0 ? (
        <div className="mt-2 max-h-72 overflow-auto rounded-md border border-slate-200 bg-white/96 p-1 shadow-panel backdrop-blur">
          {results.length === 0 ? <p className="px-3 py-2 text-sm text-slate-500">No matches</p> : null}
          {results.map((building) => (
            <button
              key={building.id}
              className="flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm transition hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
              onClick={() => onSelect(building)}
              type="button"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-950">{building.name}</span>
                <span className="block truncate text-xs text-slate-500">{building.path}</span>
              </span>
              <span className="shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: building.color }}>
                {languageInitials(building.language)}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function WorldMinimap({
  manifest,
  selection,
  onSelect
}: {
  manifest: WorldManifest;
  selection: Selection;
  onSelect: (selection: NonNullable<Selection>) => void;
}) {
  const map = useMemo(() => minimapProjection(manifest), [manifest]);
  const selectedPoint = useMemo(() => selectionPoint(manifest, selection, map.project), [manifest, map.project, selection]);

  function handlePointer(event: React.MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const local = {
      x: ((event.clientX - rect.left) / rect.width) * map.width,
      y: ((event.clientY - rect.top) / rect.height) * map.height
    };
    const world = map.unproject(local);
    const nearest = nearestMapSelection(manifest, world);
    if (nearest) {
      onSelect(nearest);
    }
  }

  return (
    <div className="absolute left-3 top-[4.25rem] z-10 w-32 rounded-lg border border-slate-200 bg-white/92 p-2 shadow-panel backdrop-blur sm:left-auto sm:right-3 sm:top-3 sm:w-44">
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <span>Map</span>
        <span>{manifest.stats.districts}</span>
      </div>
      <svg
        className="h-auto w-full cursor-crosshair overflow-visible rounded border border-slate-200 bg-slate-50"
        viewBox={`0 0 ${map.width} ${map.height}`}
        role="button"
        aria-label="Repository minimap"
        tabIndex={0}
        onClick={handlePointer}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (selection) {
              onSelect(selection);
            } else if (manifest.districts[0]) {
              onSelect({ kind: "district", id: manifest.districts[0].id });
            }
          }
        }}
      >
        {manifest.roads.map((road) => (
          <polyline
            key={road.id}
            fill="none"
            points={road.points.map((point) => `${map.project(point).x},${map.project(point).y}`).join(" ")}
            stroke={road.kind === "connector" ? "#64748b" : "#94a3b8"}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={road.kind === "connector" ? 1.8 : 1.2}
            opacity={road.kind === "connector" ? 0.85 : 0.6}
          />
        ))}
        {manifest.districts.map((district) => {
          const topLeft = map.project({
            x: district.position.x - district.dimensions.width / 2,
            y: 0,
            z: district.position.z - district.dimensions.depth / 2
          });
          const bottomRight = map.project({
            x: district.position.x + district.dimensions.width / 2,
            y: 0,
            z: district.position.z + district.dimensions.depth / 2
          });
          const selected = selection?.kind === "district" && selection.id === district.id;
          return (
            <rect
              key={district.id}
              x={Math.min(topLeft.x, bottomRight.x)}
              y={Math.min(topLeft.y, bottomRight.y)}
              width={Math.abs(bottomRight.x - topLeft.x)}
              height={Math.abs(bottomRight.y - topLeft.y)}
              rx={1.8}
              fill={miniTint(district.color)}
              stroke={selected ? "#0f172a" : district.color}
              strokeWidth={selected ? 2.2 : 1.1}
              opacity={0.88}
            />
          );
        })}
        {manifest.buildings.map((building) => {
          const point = map.project(building.position);
          const selected = selection?.kind === "building" && selection.id === building.id;
          return <circle key={building.id} cx={point.x} cy={point.y} r={selected ? 2.8 : 1.7} fill={building.color} stroke={selected ? "#0f172a" : "#ffffff"} strokeWidth={selected ? 1.2 : 0.6} />;
        })}
        {selectedPoint ? <circle cx={selectedPoint.x} cy={selectedPoint.y} r={4.5} fill="none" stroke="#0ea5e9" strokeWidth={1.6} /> : null}
      </svg>
    </div>
  );
}

function StreamHud({ index, loadedCount, activeCount, message }: { index: WorldIndex; loadedCount: number; activeCount: number; message: string | null }) {
  return (
    <div className="absolute right-3 top-[8.75rem] z-10 w-44 rounded-lg border border-slate-200 bg-white/92 p-2 text-xs text-slate-600 shadow-panel backdrop-blur sm:top-[10.5rem]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-950">Streaming</span>
        <span>{loadedCount}/{index.chunks.length}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${index.chunks.length === 0 ? 0 : Math.round((loadedCount / index.chunks.length) * 100)}%` }} />
      </div>
      <p className="mt-2 leading-4">{message ?? `${activeCount} sectors active near camera`}</p>
    </div>
  );
}

function HistoryTimeline({
  frames,
  activeFrame,
  playing,
  onSelect,
  onPlayToggle,
  onStep
}: {
  frames: HistoryFrame[];
  activeFrame: HistoryFrame | null;
  playing: boolean;
  onSelect: (frame: HistoryFrame) => void;
  onPlayToggle: () => void;
  onStep: (direction: -1 | 1) => void;
}) {
  const activeIndex = Math.max(0, frames.findIndex((frame) => frame.id === activeFrame?.id));
  const frame = activeFrame ?? frames[activeIndex] ?? frames[0];

  if (!frame) {
    return null;
  }

  return (
    <div className="absolute bottom-16 left-3 right-3 z-10 rounded-lg border border-slate-200 bg-white/94 p-3 text-xs text-slate-600 shadow-panel backdrop-blur md:right-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex shrink-0 items-center gap-1">
          <button className="icon-button h-8 w-8" onClick={() => onStep(-1)} aria-label="Previous history frame" type="button">
            <SkipBack size={15} aria-hidden="true" />
          </button>
          <button className="icon-button h-8 w-8" onClick={onPlayToggle} aria-label={playing ? "Pause git history timeline" : "Play git history timeline"} type="button">
            {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
          </button>
          <button className="icon-button h-8 w-8" onClick={() => onStep(1)} aria-label="Next history frame" type="button">
            <SkipForward size={15} aria-hidden="true" />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-3">
            <p className="truncate font-semibold text-slate-950">
              {frame.commit.shortSha} · {frame.commit.message}
            </p>
            <span className="shrink-0 text-slate-500">{activeIndex + 1}/{frames.length}</span>
          </div>
          <input
            className="w-full accent-sky-600"
            type="range"
            min={0}
            max={frames.length - 1}
            value={activeIndex}
            aria-label="Git history timeline"
            onChange={(event) => onSelect(frames[Number(event.target.value)])}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TimelineStat label="Added" value={frame.summary.added} color="bg-emerald-500" />
            <TimelineStat label="Modified" value={frame.summary.modified} color="bg-sky-500" />
            <TimelineStat label="Deleted" value={frame.summary.deleted} color="bg-rose-500" />
            <TimelineStat label="Renamed" value={frame.summary.renamed} color="bg-amber-500" />
            <span className="truncate text-slate-500">{new Date(frame.commit.authoredAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="hidden w-52 shrink-0 md:block">
          <p className="truncate font-medium text-slate-950">{frame.changes[0]?.path ?? "No file changes"}</p>
          <p className="mt-1 truncate text-slate-500">
            {frame.summary.total.toLocaleString()} touched file{frame.summary.total === 1 ? "" : "s"}
            {frame.summary.truncated ? " · truncated" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

function TimelineStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span>{label}</span>
      <span className="font-semibold text-slate-950">{value}</span>
    </span>
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

const MINIMAP_WIDTH = 160;
const MINIMAP_HEIGHT = 108;
const MINIMAP_PADDING = 9;

function searchScore(building: Building, query: string): number {
  const name = building.name.toLowerCase();
  const path = building.path.toLowerCase();
  const language = building.language.toLowerCase();

  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (path.startsWith(query)) return 2;
  if (path.includes(`/${query}`)) return 3;
  if (path.includes(query)) return 4;
  if (language.includes(query)) return 5;
  return 6;
}

function languageInitials(language: string): string {
  const words = language.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "?";
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function minimapProjection(manifest: WorldManifest): {
  width: number;
  height: number;
  project: (point: Vec3) => { x: number; y: number };
  unproject: (point: { x: number; y: number }) => Vec3;
} {
  const districtPoints = manifest.districts.flatMap((district) => {
    const halfWidth = district.dimensions.width / 2;
    const halfDepth = district.dimensions.depth / 2;
    return [
      { x: district.position.x - halfWidth, y: 0, z: district.position.z - halfDepth },
      { x: district.position.x + halfWidth, y: 0, z: district.position.z + halfDepth }
    ];
  });
  const points = [...districtPoints, ...manifest.roads.flatMap((road) => road.points)];
  if (points.length === 0) {
    return {
      width: MINIMAP_WIDTH,
      height: MINIMAP_HEIGHT,
      project: () => ({ x: MINIMAP_WIDTH / 2, y: MINIMAP_HEIGHT / 2 }),
      unproject: () => ({ x: 0, y: 0, z: 0 })
    };
  }

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minZ = Math.min(...points.map((point) => point.z));
  const maxZ = Math.max(...points.map((point) => point.z));
  const spanX = Math.max(maxX - minX, 1);
  const spanZ = Math.max(maxZ - minZ, 1);
  const scale = Math.min((MINIMAP_WIDTH - MINIMAP_PADDING * 2) / spanX, (MINIMAP_HEIGHT - MINIMAP_PADDING * 2) / spanZ);
  const offsetX = (MINIMAP_WIDTH - spanX * scale) / 2;
  const offsetY = (MINIMAP_HEIGHT - spanZ * scale) / 2;

  return {
    width: MINIMAP_WIDTH,
    height: MINIMAP_HEIGHT,
    project: (point) => ({
      x: offsetX + (point.x - minX) * scale,
      y: offsetY + (point.z - minZ) * scale
    }),
    unproject: (point) => ({
      x: minX + (point.x - offsetX) / scale,
      y: 0,
      z: minZ + (point.y - offsetY) / scale
    })
  };
}

function selectionPoint(manifest: WorldManifest, selection: Selection, project: (point: Vec3) => { x: number; y: number }) {
  if (!selection) {
    return null;
  }

  if (selection.kind === "building") {
    const building = manifest.buildings.find((item) => item.id === selection.id);
    return building ? project(building.position) : null;
  }
  if (selection.kind === "district") {
    const district = manifest.districts.find((item) => item.id === selection.id);
    return district ? project(district.position) : null;
  }
  if (selection.kind === "landmark") {
    const landmark = manifest.landmarks.find((item) => item.id === selection.id);
    return landmark ? project(landmark.position) : null;
  }
  if (selection.kind === "road") {
    const road = manifest.roads.find((item) => item.id === selection.id);
    return road ? project(road.points[Math.floor(road.points.length / 2)] ?? road.points[0]) : null;
  }

  const connection = manifest.connections.find((item) => item.id === selection.id);
  const from = manifest.buildings.find((building) => building.id === connection?.from);
  const to = manifest.buildings.find((building) => building.id === connection?.to);
  if (!from || !to) {
    return null;
  }
  return project({ x: (from.position.x + to.position.x) / 2, y: 0, z: (from.position.z + to.position.z) / 2 });
}

function nearestMapSelection(manifest: WorldManifest, world: Vec3): NonNullable<Selection> | null {
  const candidates: Array<{ selection: NonNullable<Selection>; position: Vec3; bias: number }> = [
    ...manifest.buildings.map((building) => ({
      selection: { kind: "building" as const, id: building.id },
      position: building.position,
      bias: 0
    })),
    ...manifest.districts.map((district) => ({
      selection: { kind: "district" as const, id: district.id },
      position: district.position,
      bias: Math.max(district.dimensions.width, district.dimensions.depth) * 0.14
    }))
  ];

  return (
    candidates
      .map((candidate) => ({
        ...candidate,
        distance: Math.hypot(candidate.position.x - world.x, candidate.position.z - world.z) - candidate.bias
      }))
      .sort((a, b) => a.distance - b.distance)[0]?.selection ?? null
  );
}

function miniTint(hex: string): string {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean, 16);
  const red = Math.min(255, Math.round(((value >> 16) & 255) + (255 - ((value >> 16) & 255)) * 0.72));
  const green = Math.min(255, Math.round(((value >> 8) & 255) + (255 - ((value >> 8) & 255)) * 0.72));
  const blue = Math.min(255, Math.round((value & 255) + (255 - (value & 255)) * 0.72));
  return `#${[red, green, blue].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}

async function fetchArtifact<T>(jobId: string, artifactId: string): Promise<T> {
  const response = await fetch(`/api/analyze/jobs/${encodeURIComponent(jobId)}/artifacts/${encodeURIComponent(artifactId)}`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "RepoBricks could not load an analysis artifact.");
  }
  return payload as T;
}

function prioritizeChunkRefs(index: WorldIndex, anchor: Vec3, focusPaths: string[]): WorldChunkRef[] {
  const focusDistricts = new Set(focusPaths.map(districtIdForPath));
  return [...index.chunks].sort((a, b) => {
    const aFocused = a.districtIds.some((districtId) => focusDistricts.has(districtId));
    const bFocused = b.districtIds.some((districtId) => focusDistricts.has(districtId));
    if (aFocused !== bFocused) {
      return aFocused ? -1 : 1;
    }
    return distanceToBounds(anchor, a.bounds) - distanceToBounds(anchor, b.bounds) || a.id.localeCompare(b.id);
  });
}

function mergeChunks(current: WorldChunk[], next: WorldChunk[]): WorldChunk[] {
  const byId = new Map(current.map((chunk) => [chunk.id, chunk]));
  for (const chunk of next) {
    byId.set(chunk.id, chunk);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function streamStatus(index: WorldIndex, chunks: WorldChunk[], activeCount: number): string {
  if (chunks.length >= index.chunks.length) {
    return "All sectors cached";
  }
  return `${activeCount} active near camera · ${chunks.length} cached`;
}

function changedPathsForFrame(frame: HistoryFrame): string[] {
  return [...new Set(frame.changes.flatMap((change) => [change.path, change.previousPath].filter((path): path is string => Boolean(path))))];
}

function stepFrame(frames: HistoryFrame[], currentId: string | null, direction: -1 | 1): HistoryFrame | null {
  if (frames.length === 0) {
    return null;
  }
  const currentIndex = Math.max(0, frames.findIndex((frame) => frame.id === currentId));
  const nextIndex = (currentIndex + direction + frames.length) % frames.length;
  return frames[nextIndex] ?? frames[0];
}

function districtIdForPath(filePath: string): string {
  return filePath.includes("/") ? filePath.split("/")[0] : "root";
}

function distanceToBounds(point: Vec3, bounds: WorldIndex["bounds"]): number {
  const dx = point.x < bounds.min.x ? bounds.min.x - point.x : point.x > bounds.max.x ? point.x - bounds.max.x : 0;
  const dz = point.z < bounds.min.z ? bounds.min.z - point.z : point.z > bounds.max.z ? point.z - bounds.max.z : 0;
  return Math.hypot(dx, dz);
}

function statusLabel(job: AnalysisJob): string {
  const percent = Math.max(0, Math.min(100, Math.round(job.progress * 100)));
  switch (job.stage) {
    case "queued":
      return "Queued";
    case "cloning":
      return `Cloning ${percent}%`;
    case "analyzing":
      return `Analyzing ${percent}%`;
    case "chunking":
      return `Chunking ${percent}%`;
    case "history":
      return `History ${percent}%`;
    case "complete":
      return "Complete";
    case "failed":
      return "Failed";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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
