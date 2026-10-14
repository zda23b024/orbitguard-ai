# OrbitGuard AI

OrbitGuard AI is a three-module educational prototype for inspecting public orbital elements, estimating satellite/debris close approaches, and explaining the resulting screening measurements. It is not an operational collision warning system.

## Run locally

Requirements: Node.js 22–24 (matching `package.json`) and npm.

```powershell
npm install --legacy-peer-deps
npm run dev
```

Open `http://localhost:3000`. `npm run lint` performs the TypeScript check and `npm run build` creates the production client. The server serves the built client when `NODE_ENV=production`.

For a repeatable offline demonstration, set `ORBITGUARD_OFFLINE_MODE=true` before starting the server. This disables CelesTrak requests. The verified snapshot in `data/snapshots/` loads as historical data with its original epochs and retrieval timestamps; it is never presented as live. The isolated synthetic scenario also remains available. The former bundled records failed TLE integrity checks and are not loaded. To keep explanations deterministic and local, also set `ORBITGUARD_DISABLE_GEMINI=true`. For example, in PowerShell:

```powershell
$env:ORBITGUARD_OFFLINE_MODE = "true"
$env:ORBITGUARD_DISABLE_GEMINI = "true"
npm run dev
```

## Deploy to Render (offline competition mode)

For any conventional Node.js host, run from the project root and include `server.ts`, `src/`, `data/snapshots/celestrak-gp-20261014T183324Z.json`, `package.json`, `package-lock.json`, and the generated `dist/` in the deployment artifact. Install dependencies with `npm ci --include=dev --legacy-peer-deps`, run `npm run lint` and `npm run build`, then set `NODE_ENV=production`, `ORBITGUARD_OFFLINE_MODE=true`, and `ORBITGUARD_DISABLE_GEMINI=true` and run `npm start`. The server honors `PORT`. A static-only host is insufficient because the API requires Node.js. The bundled snapshot is the durable historical source; the operating-system temporary cache is optional and must not be relied upon for deployment. Include newly created files in the source release before deploying.

`node --import tsx scripts/verify-offline-integration.ts` verifies the real and synthetic calculations and starts/stops two production servers on port 3107 with separate empty temporary caches and outbound fetches disabled. Build first. This check does not replace Chrome/WebGL testing. See [Final integration evidence](docs/FINAL_INTEGRATION.md) for current verification status.

Create a **Web Service** from this repository using the **Node** runtime. Set:

- **Build command:** `npm run render-build`
- **Start command:** `npm run render-start`
- **Health check path:** `/api/health`
- **Environment:** `ORBITGUARD_OFFLINE_MODE=true`, `ORBITGUARD_DISABLE_GEMINI=true`

Render supplies `PORT`; the Express server binds to `0.0.0.0` and serves the built frontend and API in production. Do not set `GEMINI_API_KEY` for this offline deployment. No CelesTrak requests are made while offline mode is enabled. The historical snapshot is loaded from `data/snapshots/` if that file is included in the deployed source; the synthetic educational demonstration works without it.

For live mode on Render, attach a persistent disk mounted at `/var/data` and set `ORBITGUARD_CACHE_DIR=/var/data`. The catalog and provider cooldown cache otherwise lives in the OS temporary directory and may be lost on restart or redeploy. Initial page loads never trigger provider requests; use the refresh control only when the saved cache is eligible. Do not enable live mode for the competition deployment unless you have configured durable storage and are ready to use CelesTrak data.

To create the service, connect the Git repository in the Render dashboard, choose **New → Web Service**, select **Node**, enter the commands and variables above, and create the service. This repository has no Render blueprint, so creating cloud resources remains an account-owner action. Render account access and any applicable plan/billing selection are required. Do not enable live data for this deployment.

Live CelesTrak retrieval is enabled only when `ORBITGUARD_OFFLINE_MODE` is not `true`. A controlled documented `CATNR=40697` query retrieved one current payload (Sentinel-2A) alongside the 2,675 accepted objects from three CelesTrak debris groups. This is a small, verified subset, not a complete satellite or debris catalog. The app keeps each feed's download time and element epochs visible, and labels feeds cached when they pass the provider's update interval. A verified pair produced a calculated screening result, but it is not an independently confirmed real-world conjunction. The full request, record, analysis, and browser evidence is in [the validation report](docs/VALIDATION_REPORT.md).

## Modules

1. **Orbital Monitor:** Three.js globe, object list, public-element epoch, and estimated SGP4 positions.
2. **Close-Approach Analyzer:** Selects objects, samples a UTC interval, refines sampled local minima, and charts the same propagated interval.
3. **Explainable Analysis:** Describes separation, relative speed, threshold, element ages, and limitations. Its optional priority score is a hand-weighted, uncalibrated educational heuristic, not a probability or trained model.

Current mode uses only accepted CelesTrak payload records and the separately retrieved catalogued-debris groups; it never merges historical or synthetic objects. Historical mode loads the verified snapshot as-of `2026-10-14T18:33:24.548Z` with a historical label. Synthetic mode uses isolated fictional OMM inputs that pass through the existing SGP4 and encounter engines. See [Competition Demo](docs/COMPETITION_DEMO.md) for exact steps and [Scientific Method](docs/SCIENTIFIC_METHOD.md) for limitations.

See [Architecture](docs/ARCHITECTURE.md), [Scientific Method](docs/SCIENTIFIC_METHOD.md), [Validation Report](docs/VALIDATION_REPORT.md), and [Competition Demo](docs/COMPETITION_DEMO.md).

An optional server-side Gemini explanation is enabled by `GEMINI_API_KEY`. It only adds constrained prose to measurements recomputed by the server; without a key, or when `ORBITGUARD_DISABLE_GEMINI=true`, a deterministic explanation is returned. Gemini is not required for the app's core workflows.
