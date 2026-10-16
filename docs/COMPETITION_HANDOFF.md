# Competition handoff — 16 October 2026

Exactly two dashboards: **Orbital Explorer** and **Close-Approach Analysis**. The analysis dashboard contains the two scenario choices, one separation chart, results, and the embedded **Explain with AI** experience. The viewer draws only the selected pair, using SGP4 samples, cyan satellite and orange debris paths. Playback approaches the computed minimum and pauses there. Focus, reset, play/pause, rotation, and zoom remain available.

## Data and scientific scope

The original snapshot and orbital engine are unchanged. The bundled CelesTrak snapshot contains Sentinel-2A #40697 and 2,675 debris records; the displayed real pair uses FENGYUN 1C debris #31946. Snapshot capture: 2026-10-14T18:33:24.548Z. Epochs: 2026-10-14T07:19:59.143Z and 2026-10-13T10:52:36.430Z. Downloads: 2026-10-14T18:24:33.915Z and 2026-10-14T16:24:25.054Z.

The real analysis window remains 2026-10-14T18:31:56Z through 2026-10-15T18:31:56Z. Recomputed minimum: **14.203 km**, relative speed **1.016 km/s**, closest time **2026-10-14T22:01:54.189Z**. The existing controlled synthetic pair produces **9.611 km**, **0.014 km/s**, at **2024-03-20T23:51:55.428Z**. No displayed result is hardcoded. No covariance, collision probability, or operational warning is provided.

## Verification

- Clean npm ci with npm 11.21.0: passed.
- TypeScript and production build: passed.
- Existing scientific suite: 8/8 passed; all 2,676 stored records propagated.
- Real and synthetic calculation/API consistency: passed.
- Empty-cache production startup with offline mode enabled and disabled, bundled snapshot endpoint, invalid requests, deterministic explanations, production HTML and JavaScript: passed with no outbound provider requests.
- Configured secret scan of source and built assets: no matches; .env is not tracked.
- Google model metadata request confirmed models/gemini-3.8-flash. Actual generation returned HTTP 503; deterministic fallback returned matching results. Successful AI generation is **not verified**.
- Browser automation had no available in-app or Chrome browser. Visual rendering, mobile layout, pointer controls, and every visible button have **not** been browser-verified in this session.
- Non-fatal build advisory: the lazy-loaded Three.js chunk is approximately 577 kB minified.

## Local run

From the project directory in PowerShell:

```powershell
npx --yes --package=npm@11.21.0 npm ci --include=dev --include=optional
npm run lint
npm run build
$env:NODE_ENV='production'
$env:ORBITGUARD_OFFLINE_MODE='true'
$env:ORBITGUARD_DISABLE_GEMINI='false'
npm start
```

Open http://localhost:3000. Keep the existing key in the server-side .env only. Set ORBITGUARD_DISABLE_GEMINI=true for a fully deterministic presentation. No CelesTrak request is needed.

## Three-minute presentation

**0:00–0:35 — Orbital Explorer.** “OrbitGuard AI makes invisible space hazards visible. These are modeled positions of Sentinel-2A and a cataloged debris fragment from a historical CelesTrak snapshot. Cyan and orange paths are calculated with SGP4. They are not live measurements.” Rotate Earth and point to the epochs and source.

**0:35–1:15 — Analyze Close Approach.** Click the prominent action. “The engine propagates both objects through the same historical day and searches for their closest modeled separation.” Watch playback pause, use Focus on Encounter, and show 14.203 km and 1.016 km/s. Point to the single time-distance chart.

**1:15–1:45 — Educational Simulation.** Select Educational Simulation. “These two objects are invented teaching inputs, clearly labeled simulation. The same physics engine computes 9.611 km; this is not a real conjunction.” Show the updated chart and time.

**1:45–2:25 — Explain with AI.** Click the button. “Physics computes the measurements. Gemini only explains verified results. If the AI service is unavailable, the application explicitly labels its built-in scientific explanation.” Show student and technical explanation levels inside the same dashboard.

**2:25–3:00 — Evidence and limits.** Open Scientific checks. “All eight checks pass, including SGP4 reference-vector and numerical checks. A close approach does not automatically imply collision. Without orbital uncertainty, this prototype cannot calculate collision probability or advise maneuvers. The bundled data lets our demonstration work without a satellite feed.”

## Manual browser checklist before approval

At desktop size and 390px mobile width: confirm only two navigation items; Earth and two paths render; no horizontal overflow; rotate and zoom; use both scenario choices, focus, reset, play/pause, speed controls, chart time selection, and Explain with AI; toggle student/technical explanations and provenance; run scientific checks and close the modal. Reload the page and repeat the real scenario. Disable network after initial load and confirm the synthetic scenario and local explanations remain usable. Check console for errors. Confirm no key appears in browser responses or assets.

## Render deployment — only after approval

No push or deployment was performed. After review, commit the changes and push main. Keep Render build command **npm run render-build**, start command **npm run render-start**, and health path **/api/health**. Use Node 24.11.0 and npm 11.21.0. Set ORBITGUARD_OFFLINE_MODE=true, ORBITGUARD_DISABLE_GEMINI=false, GEMINI_MODEL=gemini-3.8-flash, and the key as a Render secret. Keep the committed data/snapshots file in the release. Use ORBITGUARD_DISABLE_GEMINI=true if deterministic wording is preferred. Verify health, both scenarios, and explanation provenance after deployment.

## Changed files

App.tsx, index.css and index.html: focused navigation, responsive layout and branding. EncounterAnalyzer.tsx: two choices, results, one chart and embedded AI entry. ExplainableAnalysis.tsx: student/technical explanations, timeout and result matching. EncounterChart.tsx: timestamp-based spacing and correct minimum marker. EarthViewer.tsx: pair paths, focus, playback pause, reset and texture fallback. ViewerBoundary.tsx: isolated viewer failure. demoScenario.ts: fixed historical input time. server.ts and celestrakService.ts: stable snapshot endpoint, result metadata and historical restart fallback. verify-offline-integration.ts: expanded production/error checks. README.md and this handoff: operating instructions.
