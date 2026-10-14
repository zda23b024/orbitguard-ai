# Final Verification Report — 2026-10-14

## Live CelesTrak retrieval

Revision note: the results below record the earlier verification. [Final integration evidence](FINAL_INTEGRATION.md) supersedes its numerical precision and readiness conclusions: refined separation is now 14.203 km, and fresh Chrome testing is blocked by unavailable browser control.

After checking persisted feed retry/refusal timestamps, the backend made exactly one satellite request at `2026-10-14T18:24:30.143Z`, after the latest stored feed cooldown (`18:24:25.054Z`) plus a five-second margin. The request was the documented small GP JSON query:

`https://celestrak.org/NORAD/elements/gp.php?CATNR=40697&FORMAT=JSON`

CelesTrak returned **HTTP 200**, `application/json; charset=UTF-8`, with a JSON-array body. The request produced 1 raw record, 1 parsed record, 1 accepted payload, and 0 rejections. The OMM was downloaded at `2026-10-14T18:24:33.915Z`; `lastAttemptIso` to download time was about 3.77 seconds. The accepted record is Sentinel-2A, NORAD **40697**, classification **PAYLOAD**, source `CelesTrak GP CATNR=40697 (Sentinel-2A payload)`. Its original OMM epoch string is `2026-10-14T07:19:59.143296`; the UTC-normalized epoch is `2026-10-14T07:19:59.143Z`.

The separately downloaded debris responses remain distinct and retain their own CelesTrak source groups, counts, epochs, and download times:

| Feed / documented query | HTTP / type | Raw / parsed / accepted / rejected | Rejections | Accepted element epochs (UTC) | Downloaded (UTC) |
|---|---|---:|---|---|---|
| COSMOS 2251 debris / `GROUP=cosmos-2251-debris` | 200 / JSON array | 588 / 588 / 587 / 1 | 1 unrecognized classification | 2026-09-15 10:38:42.154 → 2026-10-14 07:59:22.155 | 2026-10-14 16:24:19.132 |
| IRIDIUM 33 debris / `GROUP=iridium-33-debris` | 200 / JSON array | 109 / 109 / 108 / 1 | 1 unrecognized classification | 2026-09-26 01:17:07.958 → 2026-10-14 07:32:19.155 | 2026-10-14 16:24:22.789 |
| FENGYUN 1C debris / `GROUP=fengyun-1c-debris` | 200 / JSON array | 1,981 / 1,981 / 1,980 / 1 | 1 unrecognized classification | 2026-09-15 10:33:30.787 → 2026-10-14 08:00:11.625 | 2026-10-14 16:24:25.054 |

All four responses used `application/json; charset=UTF-8`. The retained catalog has **1 payload and 2,675 debris records**. The aggregate accepted-object epoch range is `2026-09-15T10:33:30.787Z` through `2026-10-14T08:00:11.625Z`. Every retained object’s normalized UTC epoch matches its source OMM `EPOCH` and its original NORAD ID, source, group, and retrieval timestamp were preserved.

An old cached group summary contained timezone-shifted epoch bounds. The service now recomputes displayed per-feed counts and epoch ranges from the retained OMM-backed objects. The fixture suite checks this behavior. The earlier 15-second `GROUP=active` request at `2026-10-14T16:23:56.961Z` ended in the application’s local abort and yielded no HTTP status or response body. The later small CATNR request succeeded in about 3.77 seconds, but this cannot prove whether the earlier large request timed out because of response size, network latency, provider delay, or parsing. The underlying cause of that earlier timeout remains undetermined. The local request timeout is now 60 seconds. CelesTrak’s [Usage Policy](https://celestrak.org/usage-policy.php) and [GP Data Formats](https://celestrak.org/NORAD/documentation/gp-data-formats.php) support respecting the update cadence and using the documented GP query syntax.

## SGP4 propagation and real-data encounter

At `2026-10-14T18:25:11.635Z`, the current catalog returned **2,676/2,676 valid SGP4 positions**, with 0 invalid states. A later common-start screen at `2026-10-14T18:29:22.444Z` found 1,947 debris objects with element epochs no older than 48 hours; all 1,947 had valid SGP4 positions. The 80 nearest candidate debris objects by synchronized initial ECI separation were run through the existing 24-hour encounter engine.

For Sentinel-2A NORAD 40697 and FENGYUN 1C debris NORAD **31946** (source group `fengyun-1c-debris`):

- Debris element epoch: `2026-10-13T10:52:36.430Z`; debris download: `2026-10-14T16:24:25.054Z`.
- At the browser/API run start `2026-10-14T18:31:56.000Z`, the element ages were 11.2 hours (payload) and 31.7 hours (debris), within the selected 48-hour freshness screen.
- The actual backend analysis returned **14.205 km minimum separation**, **1.016 km/s relative speed**, closest approach at **`2026-10-14T22:01:54.421Z`**, a 25 km educational threshold flag, and 91 chart points.
- The deterministic explanation repeated the same values and epochs, reported both element ages, and stated that the application does not calculate positional uncertainty or collision probability.

This is a calculated pairwise SGP4 screening estimate from two genuine CelesTrak records. It is **not an independently confirmed real-world conjunction**, a collision prediction, or operational risk guidance. The candidate search tested 80 selected pairs rather than exhaustively minimizing across every catalog pair.

## Chrome workflow and Earth rendering

The app was tested in installed headless Chrome `154.0.8037.98` through its local debugging interface. The 3D Earth canvas rendered with WebGL at 714×846 in the monitor view; Earth, orbit curves, and satellite/debris markers were visible. Drag rotation and wheel zoom worked, and the 2,675 debris points remained interactive.

In current-data mode, Chrome loaded the live payload and debris cache, selected Sentinel-2A #40697 and debris #31946, ran the 24-hour calculation, displayed the distance chart and 25 km threshold, navigated to `t_CA`, and opened Explainable Analysis. Chrome showed the rounded result **14.20 km / 1.02 km/s / 22:01:54 UTC**. No browser runtime or console errors were observed.

In offline mode, Chrome loaded the historical snapshot, showed both feeds as **HISTORICAL**, calculated the same pair through SGP4, displayed its chart and closest-time navigation, and generated the historical deterministic brief. The brief says the snapshot is not current orbital data. The synthetic scenario was also rerun in Chrome: **9.61 km**, **0.01 km/s** displayed (approximately 0.014 km/s), and **2024-03-20 23:51:55 UTC** with a 15 km educational threshold. Its chart and navigation worked; the UI labeled the objects synthetic. No browser runtime errors were observed in either workflow.

## Verified offline snapshot

The provenance-checked export is `data/snapshots/celestrak-gp-20261014T183324Z.json`, captured at `2026-10-14T18:33:24.548Z`. It contains 1 payload and 2,675 debris records (2,676 total), preserves the original OMM and per-feed download timestamps, and records **2,676 valid / 0 invalid SGP4 propagations at capture**. Size: 3,023,352 bytes. SHA-256: `29aeddcdfa3c57272be53980805bddd8d80eb821b50e09393b72dbbae1b89615`.

With `ORBITGUARD_OFFLINE_MODE=true`, startup loaded all 2,676 snapshot records only as `historical`; status reported `liveAccessDisabled=true`. All 2,676 propagated successfully. A historical-mode encounter and deterministic explanation succeeded, and the provider attempt timestamps did not change during offline startup or reads. The snapshot is historical by definition and must not be presented as current after its capture.

## Automated checks

- `npm run lint` (TypeScript): **PASS**.
- `npm run build`: **PASS**. Vite built the 340.45 kB main JS bundle and 575.70 kB lazy Earth viewer bundle; it emitted its advisory that the Earth chunk exceeds 500 kB.
- `npx tsx scripts/celestrak-fixtures.ts`: **PASS**. Mocked checks cover parser counts and rejection reasons, UTC timezone-less epochs, payload/debris/rocket-body classification, documented CATNR target, single-object JSON, cooldown suppression, and mocked HTTP 403 body/header/actual-request-URL retention. Mocked results are not live provider evidence.
- `/api/validation` at `2026-10-14T18:37:28.625Z`: **PASS, 8/8** scientific checks, including published Vallado reference vectors.
- Deterministic explanation: **PASS** with `ORBITGUARD_DISABLE_GEMINI=true`; the tested response source was `deterministic`. No Gemini call was needed.
- Deployment: **NOT PERFORMED**. The local server was left in offline mode after snapshot verification.

## Remaining limits

The live satellite catalog is only the one queried payload; the debris catalog is limited to the three queried groups. The debris records were cached from a separate earlier retrieval than the satellite payload, and the interface correctly showed the debris feed as cached during the later browser run. The synthetic and historical demonstrations remain available without a provider call. SGP4 results from these elements lack covariance in this application, so no collision probability, uncertainty bound, maneuver recommendation, or operational warning is supported. The previously timed-out large `GROUP=active` request’s underlying delay cause remains unknown.
