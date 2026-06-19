# RepoBricks Project Plan

## Summary

Build RepoBricks, a TypeScript fullstack web app that turns a public GitHub repository into an explorable brick-style 3D architecture map.

The MVP optimizes for usefulness over spectacle: paste a GitHub repo URL, analyze the repo, generate a deterministic brick-world manifest, render it in the browser, and let users inspect folders, files, languages, dependencies, and special landmarks.

RepoBricks should stay distinct from Agentopolis by focusing on semantic code comprehension through a brick-building metaphor. Git history playback should support architectural understanding rather than becoming a pixel-city live-agent clone.

## Key Decisions

- Product shape: web app first.
- Stack: TypeScript fullstack.
- Framework: Next.js App Router, React, React Three Fiber.
- Rendering: Three.js via React Three Fiber.
- Backend: Next.js Node runtime route handlers.
- MVP repo support: public GitHub repos only.
- MVP analysis: file tree, languages, LOC/size, simple imports, special landmarks.
- Deferred: private repos, accounts, persistence, sharing, AI Q&A, and the visible timeline player.
- Branding: use brick, block, or model language; do not use LEGO branding publicly.

## Implementation Checklist

1. Scaffold the Next.js TypeScript app with Tailwind, React Three Fiber, Drei, Three.js, Zustand, lucide-react, Vitest, and Playwright.
2. Define the `WorldManifest` contract shared by backend analysis and frontend rendering.
3. Add `POST /api/analyze` with GitHub URL validation, shallow clone, temp cache usage, and error mapping.
4. Build the local repo analyzer: tracked files, language detection, metrics, simple import extraction, local import resolution, and landmark detection.
5. Generate deterministic layout: district baseplates, file buildings, named roads, dependency connectors, and landmark structures.
6. Build the main app UI: repo bar, full-screen 3D canvas, overview/street-view controls, toggles, status strip, and inspector panel.
7. Add fixture-based unit tests and Playwright smoke tests that avoid GitHub network by default.
8. Document setup, scripts, architecture, MVP limits, and future work in `README.md`.

## Current Follow-Up Pass

See `docs/analysis-followup-plan.md` for the analysis-driven roadmap. The active pass focuses on semantic visual upgrades: broader language coverage, depth-aware building height, role-specific roofs, TODO scaffolding, symbol accents, animated dependency pulses, and more visible studs.

The second follow-up pass adds navigation and signal cleanup: file search with click-to-focus, a lightweight minimap, and connector roads generated only from cross-district repo-local imports.

The third visual pass adds a neon scene theme, app-shell theme styling, deterministic prop buildings, and animated decorative cranes around the generated city.

The fourth infrastructure pass adds async analysis jobs, streamable world artifacts, optional git history frame artifacts, and the Railway/Supabase production architecture plan.

The fifth streaming pass adds viewport-prioritized chunk loading, partial-manifest rendering from active chunks, camera-following chunk prefetch, and a visible git history timeline with changed-file highlighting.

The sixth deployment pass adds a Supabase-backed queue and artifact store, a Railway worker entrypoint, worker Dockerfile, Supabase migration, production env template, and a production dependency audit fix for the Next/PostCSS release line.

## Public Interfaces

- `POST /api/analyze`
  - Input: `{ "repoUrl": "https://github.com/owner/repo" }`
  - Output: `WorldManifest`
  - Errors: `400` invalid URL, `404` unavailable repo, `413` repo too large, `500` analysis failure

- `POST /api/analyze/jobs`
  - Input: `{ "repoUrl": "https://github.com/owner/repo", "includeHistory": true, "maxHistoryFrames": 60 }`
  - Output: `AnalysisJob`
  - Follow-up reads: `GET /api/analyze/jobs/{jobId}` and `GET /api/analyze/jobs/{jobId}/artifacts/{artifactId}`

- `WorldManifest`
  - Stable JSON contract between backend analysis and frontend renderer.
  - Versioned with `version: "1.0"` so future AI, history, and sharing features can evolve safely.

- `WorldIndex`, `WorldChunk`, and `HistoryFrame`
  - Stable artifact contracts for large-repo streaming and git history time-lapse.
  - Stored behind the job API locally; intended for Supabase/R2-compatible object storage in production.

## Test Plan

- Use Vitest for analysis and API behavior.
- Use Playwright for user flows and canvas smoke checks.
- Use deterministic fixtures so CI does not require GitHub network access.
- Verify before MVP completion:
  - app builds successfully
  - no TypeScript errors
  - one fixture repo produces stable layout positions
  - one real public repo can be analyzed locally
  - canvas is nonblank and visible on desktop and mobile
  - street view responds to keyboard walking and zoom controls

## Assumptions

- No Agentopolis code is copied; it is competitive reference only.
- Public GitHub repo support is enough for MVP.
- AI summaries and natural-language repo Q&A are Phase 2.
- Git history time-lapse data extraction and visible timeline playback are now in scope.
- Hosted analysis should run in a Railway Node worker because repo cloning and temp files are required.
