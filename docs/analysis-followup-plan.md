# RepoBricks Analysis Follow-Up Plan

## Takeaway

The analysis is directionally right: RepoBricks has a solid analyzer, deterministic layout, and a usable 3D shell, but the city needs stronger semantic personality. The best next step is to make the existing world communicate code meaning at a glance before adding larger product systems.

## Accepted For This Pass

These items are high-impact, low-risk, and build directly on the current manifest and renderer:

1. Expand language coverage so more real repositories get meaningful colors.
2. Distinguish `.ts` from `.tsx` and `.js` from `.jsx` visually.
3. Add nested-folder height influence so deep architecture becomes spatially visible.
4. Add roof profiles based on file role: entry points, tests, config, style/docs/media, data, utilities, and general source.
5. Add scaffolding around TODO/FIXME-heavy files as an immediate technical-debt signal.
6. Add visual accents for symbol-heavy files.
7. Animate dependency flow pulses so imports feel alive without changing layout.
8. Make studs slightly more pronounced so the brick metaphor reads from overview and street view.

## Second Pass Shipped

The next practical items from the analysis are now included:

1. Search and fly-to navigation for large repos.
2. Lightweight minimap with district outlines, road lines, file dots, and selected-item marker.
3. Connector roads only between districts that actually share repo-local imports.
4. Stronger Playwright coverage for search, minimap visibility, and real scene pixels.

## Deferred Follow-Ups

These are good ideas, but they need separate design or data-model work:

1. Minimap camera heading and frustum.
2. Dark/neon theme toggle with emissive materials.
3. AI file summaries in the inspector.
4. glTF scene export.
5. Branch/repo comparison and code-review diff overlays.
6. Git history time-lapse.
7. Progressive district streaming for repositories beyond the current render cap.
8. Code-smell damage system for circular dependencies, god files, and deep nesting.

## Visual Experiments To Validate Later

The toy-table direction is promising, but should be tested after the semantic layer is stronger:

1. Wood or playmat ground surface.
2. Brick seam normal maps or bevels on building faces.
3. Decorative construction elements such as a slow crane.
4. Stronger material themes for plastic reflections.

## Acceptance Criteria

- The demo manifest renders a visibly richer city without changing the public manifest contract.
- Unit tests, lint, build, and Playwright smoke tests pass.
- The app remains deterministic: the same fixture produces the same layout positions.
- The new visuals do not require network access or external assets.
