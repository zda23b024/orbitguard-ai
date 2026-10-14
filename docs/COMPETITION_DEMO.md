# Competition Demonstration Guide

Revision note: the earlier 14.205 km result quoted below has been corrected to **14.203 km** at **2026-10-14T22:01:54.189Z** after tightening numerical refinement. See [Final integration evidence](FINAL_INTEGRATION.md) for current results and the outstanding fresh Chrome verification.

OrbitGuard AI is an educational SGP4 screening prototype. It is not an operational collision warning or avoidance system. A calculated close approach is an estimate from public orbital elements; it is not an independently confirmed real-world conjunction.

## Recommended offline startup

The repeatable competition demonstration uses the verified local historical snapshot and deterministic explanations. From the repository directory in PowerShell:

```powershell
$env:ORBITGUARD_OFFLINE_MODE = 'true'
$env:ORBITGUARD_DISABLE_GEMINI = 'true'
npm run dev
```

Open <http://localhost:3000>. Offline mode disables CelesTrak requests. The app loads `data/snapshots/celestrak-gp-20261014T183324Z.json` as a historical snapshot captured at `2026-10-14T18:33:24.548Z`. It contains 1 verified payload and 2,675 verified debris objects, with their original OMM records, sources, NORAD IDs, element epochs, and download times. The interface marks both feeds **HISTORICAL** and says the records are not current. It also keeps the synthetic scenario available.

The app does not fetch provider data on startup, when changing modules, or during analysis. The provenance refresh control is an explicit provider action; do not use it during the offline demonstration.

## Historical provider snapshot walkthrough

1. Open **Orbital Monitor**. Confirm the sidebar says **Current mode: DISABLED by offline mode**, **Historical analysis: AVAILABLE**, and **Satellite feed: HISTORICAL · 1 / Debris feed: HISTORICAL · 2675**. The snapshot capture time, feed download times, and element-epoch ranges should be visible.
2. Open **Encounter Analyzer**. Select **SENTINEL-2A (NORAD #40697)** and **FENGYUN 1C DEB (NORAD #31946)**. Both objects come from the verified CelesTrak snapshot.
3. Use a 24-hour window and the 25 km educational screening threshold. Click **Execute SGP4 Close-Approach Analysis**. For a start near the snapshot capture time, expect a minimum separation near **14.2 km**, relative speed near **1.02 km/s**, and closest approach near **2026-10-14 22:01:54 UTC**. The start time affects the precise values; the app calculates them from the preserved OMM elements.
4. Confirm the distance chart and closest-approach marker appear. Click **Jump to t_CA** and verify the globe clock moves to the reported time.
5. Open **Explainable Analysis** → **Judges' Scientific Brief** → **Generate Summary**. The generated deterministic text must identify the result as a verified **historical** snapshot and say it is **not current orbital data**. It reports element ages and says the application does not calculate collision probability.
6. Return to **Orbital Monitor** to see the snapshot objects propagated on the 3D Earth. Drag the globe to rotate and use the mouse wheel to zoom.

The 14.2 km result is a pairwise SGP4 screening estimate from real provider elements. It is not an independently confirmed conjunction and does not establish collision probability or operational risk.

## Verified current-data subset

The controlled provider test retrieved one payload using CelesTrak's documented `CATNR=40697` query and retained 2,675 records from the three configured debris groups. These records are a verified subset, not a complete satellite or debris catalog. During the browser verification, the payload feed was marked current and the older debris feeds were marked cached. The UI exposed each feed's source, download time, and element epochs.

If a local deployment still has those current-feed records in its cache and its data-status panel permits current-data analysis, the same pair can be selected and analyzed. The verified 24-hour run returned **14.205 km**, **1.016 km/s**, and `2026-10-14T22:01:54.421Z` for a start at `2026-10-14T18:31:56Z`, with a 25 km threshold and 91 chart points. The UI showed the rounded values **14.20 km** and **1.02 km/s**, allowed closest-time navigation, and opened deterministic Explainable Analysis.

The selected elements were approximately **11.2 hours** and **31.7 hours** old at calculation time. Their downloads occurred at different times, but both element epochs were within 48 hours of the common analysis window. Different download timestamps alone do not make the records incompatible. A later restart in offline mode loads the saved records only as historical; never describe that snapshot as live.

## Synthetic educational walkthrough

1. In **Encounter Analyzer**, choose **SYNTHETIC EDUCATIONAL CLOSE APPROACH**.
2. Confirm the start is `2024-03-20 12:00 UTC`, the window is 24 hours, and the threshold is 15 km. Click **Execute SGP4 Close-Approach Analysis**.
3. The controlled synthetic elements produce approximately **9.61 km** minimum separation, **0.014 km/s** relative speed, and closest approach at **2024-03-20 23:51:55 UTC**. The calculated chart and `Jump to t_CA` control should appear.
4. Open **Explainable Analysis** and verify the synthetic disclaimer remains visible. The elements are fictional teaching inputs, not catalog records or an observed conjunction.

The synthetic pair uses two authored OMM records with epoch `2024-03-20T12:00:00Z`, eccentricity `0.0001142`, RAAN `165.2314°`, argument of perigee `72.418°`, zero BSTAR, and zero mean-motion derivatives. The payload input uses mean motion `14.30819 rev/day`, inclination `98.5702°`, and mean anomaly `287.7215°`. The debris input changes mean motion by `+0.02 rev/day`, inclination by `+0.1°`, and mean anomaly by `-3.6°`. The result is computed by the existing SGP4 and encounter-analysis engine; it is not hardcoded.

## Data retrieval and timeout notes

The prior `GROUP=active` request ended at the application's 15-second abort without an HTTP status or response body. That proves the client timeout fired, but does not reveal whether the underlying cause was response size, network latency, provider delay, or parsing. After the stored cooldown elapsed, the application made one small documented GP JSON request for `CATNR=40697`; CelesTrak returned HTTP 200 in about 3.8 seconds, and one payload passed validation. This does not prove what caused the earlier large-request timeout.

CelesTrak's [Usage Policy](https://celestrak.org/usage-policy.php) limits downloads to the provider's update cadence and asks users to stop after non-200 responses. The documented GP `CATNR` query is described in [GP Data Formats](https://celestrak.org/NORAD/documentation/gp-data-formats.php). Respect the saved cooldown and `Retry-After`; do not force refreshes or repeat a rejected request.

The previous embedded 15-record bundle remains removed because its TLE checksums and archival provenance could not be verified. The replacement snapshot was exported only after every included record passed source checks and SGP4 propagation.

## Scientific limits

SGP4 propagates the supplied mean elements. This prototype does not estimate orbital covariance or positional uncertainty, calculate calibrated collision probability, or recommend maneuvers. A configurable distance threshold is an educational screening criterion only. Earth-fixed placement uses a simplified sidereal rotation. Never present an educational flag as a collision prediction or operational warning.
