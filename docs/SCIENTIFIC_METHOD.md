# Scientific Method and Limits

## Data and propagation

Orbital elements are two-line element records or equivalent CelesTrak GP JSON fields. The element epoch is distinct from the application download time. `satellite.js` SGP4 propagation returns estimated position in kilometres and velocity in kilometres per second in TEME. These are model-estimated states, not GPS observations.

CelesTrak GP JSON uses OMM field names, which satellite.js supports through `json2satrec`. See [CelesTrak GP data formats](https://celestrak.org/NORAD/documentation/gp-data-formats.php) and the [Vallado SGP4 reference paper and verification vectors](https://celestrak.org/publications/AIAA/2006-6753/AIAA-2006-6753-Rev3.pdf).

The verified live subset uses documented `CATNR=40697` OMM JSON for Sentinel-2A and the `cosmos-2251-debris`, `iridium-33-debris`, and `fengyun-1c-debris` GP groups. It contains one payload and 2,675 debris records, not a complete satellite or debris catalog. Each accepted object preserves the raw OMM, provider source and classification, NORAD ID, element epoch, and download time. Different download times do not by themselves make records incompatible; an analysis propagates both objects over a common UTC interval and reports their element ages. Group caching and refusal cooldowns remain in force. Offline mode makes no provider requests.

The former bundled 15-record historical set was removed because its TLE checksums and archival provenance could not be verified. The current local historical snapshot was exported from verified CelesTrak GP responses and checked for source, NORAD ID, original OMM, element epoch, download time, and successful SGP4 propagation. It loads only in offline mode and is always labeled historical. A separately labeled synthetic teaching pair also remains available offline. Its controlled OMM elements have no catalog identity and are not derived from a real object; the ordinary SGP4 and encounter-analysis code computes its outputs at runtime.

## Coordinate frames

For Earth rendering, position is rotated from TEME to an approximate Earth-fixed frame using Greenwich Mean Sidereal Time evaluated at the same UTC simulation date. This simple GMST rotation omits polar motion, UT1–UTC corrections, and higher-accuracy Earth orientation parameters. It is suitable for an educational visualization, not precision geodesy. Earth is held Earth-fixed; the selected UTC timestamp drives both propagation and rotation.

## Close approach

The engine samples synchronized SGP4 states every 30 seconds, retains interval endpoints, identifies sampled local minima, and refines each bracket with golden-section search to one-millisecond time tolerance. Times are rounded to integer milliseconds before the final propagation. This numerical tolerance supports the three-decimal distance display; it does not imply metre-level physical accuracy. It reports the smallest sampled/refined separation and relative velocity at its estimated time. A finite grid can still miss a very narrow minimum or invalid intervals; this is a screening estimate, not an operational conjunction solution. The public orbital elements used here provide no covariance, so collision probability cannot be derived.

## Screening language

The distance threshold is an educational configurable screen. The optional 0–100 index is a manually weighted heuristic, uncalibrated against outcomes. It is not a trained AI model, risk probability, or autonomous decision. A threshold flag means only that the estimated separation is within the selected screen.
