# Final integration evidence — 2026-10-14

Overall status: **BLOCKED on fresh Chrome interface verification**. The browser-control inventory returned no browsers, and opening Chrome returned `Browser is not available: chrome`. Earlier browser evidence in VALIDATION_REPORT.md describes an earlier version and is not a fresh pass for this revision.

## Numerical correction

The prior 1-second golden-section tolerance produced 14.205 km at 2026-10-14T22:01:54.421Z. A separate 1-second grid across the full 24-hour window, followed by millisecond sampling around its minimum, found 14.203313339070492 km at 2026-10-14T22:01:54.188Z. The previous result differed by approximately 1.687 metres and did not support its displayed three-decimal rounding.

The existing refinement now uses a 1-millisecond tolerance and integer-millisecond timestamps. It returns **14.203 km**, **1.016 km/s**, and **2026-10-14T22:01:54.189Z**. The refined timestamp is within 1 ms of the fine grid, and the displayed separation differs by 0.313 m from the fine-grid value, within rounding. This is numerical agreement using the same SGP4 implementation, not independent validation of physical orbital accuracy.

The result uses Sentinel-2A #40697 and FENGYUN 1C debris #31946, over **2026-10-14T18:31:56.000Z through 2026-10-15T18:31:56.000Z**, with a 25 km educational threshold and 91 chart samples. It is an estimated close approach derived from orbital elements, not a confirmed conjunction, collision, or operational warning. The result banner now says this explicitly.

| Record | Element epoch UTC | Source download UTC |
|---|---|---|
| Sentinel-2A #40697 | 2026-10-14T07:19:59.143Z | 2026-10-14T18:24:33.915Z |
| FENGYUN 1C debris #31946 | 2026-10-13T10:52:36.430Z | 2026-10-14T16:24:25.054Z |

Snapshot capture: 2026-10-14T18:33:24.548Z. All 2,676 records retain matching OMM identities, UTC epochs and source download timestamps; all propagate at capture. Element age in the application is measured at calculation wall-clock time, distinct from age at the historical analysis start (approximately 11.2 h and 31.7 h).

## Local integration checks

Final revision: **PASS** TypeScript (`tsc --noEmit`), **PASS** production build (`vite build`), **PASS** offline integration script, and **PASS** `git diff --check`. The build reports a non-fatal 500 kB chunk advisory for the Three.js viewer (575.70 kB minified, 143.77 kB gzip).

`node --import tsx scripts/verify-offline-integration.ts` checks:

- 8/8 scientific validations and propagation of all 2,676 snapshot records.
- Fine-sampling numerical comparison, window endpoints and 91 chart samples.
- Two production server boots, each with a separate empty temporary cache: 2,676 objects reload as historical from the bundled snapshot.
- Real encounter API and deterministic explanation, including corrected separation and historical provenance.
- Synthetic scenario: 9.611 km at 2024-03-20T23:51:55.428Z, retained synthetic classification and deterministic explanation.
- Production HTML and its built JavaScript asset served successfully.
- External fetch trap records zero outbound attempts. Every local HTTP call has a 5-second timeout; each server has a 20-second lifetime limit and is stopped after the test.

Conventional Node.js hosting uses the source, installed runtime dependencies, generated dist directory, and bundled data/snapshots JSON, with offline and deterministic-explanation environment settings. It does not depend on a persisted temporary cache. Nothing was deployed.

Fresh Chrome checks remain required for object selection, WebGL visualization, result display, chart interaction, closest-time navigation, and both explanation workflows. Deployment readiness cannot be fully signed off until these pass.
