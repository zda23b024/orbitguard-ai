import assert from 'node:assert/strict';
import { parseGpRecords, resetCatalogStateForTesting, setGpFetchForTesting, fetchOrbitalObjects, fetchSatellitePayloadSubset, getDataStatus, restoreCatalogCache } from '../src/services/celestrakService.ts';

const base = {
  OBJECT_ID: '1997-051T', OBJECT_NAME: 'IRIDIUM 33 DEB', EPOCH: '2026-09-14T18:12:22.000Z',
  NORAD_CAT_ID: 33850, MEAN_MOTION: 14.4, ECCENTRICITY: 0.001, INCLINATION: 86.4,
  RA_OF_ASC_NODE: 10, ARG_OF_PERICENTER: 20, MEAN_ANOMALY: 30,
  OBJECT_TYPE: 'DEBRIS',
};
const fixture = [
  base,
  { ...base, NORAD_CAT_ID: 33851, OBJECT_NAME: 'COSMOS 2251 DEB', OBJECT_TYPE: undefined, BSTAR: undefined },
  { ...base, NORAD_CAT_ID: 33852, OBJECT_NAME: 'IRIDIUM 33 R/B', OBJECT_TYPE: 'ROCKET BODY' },
  { ...base, NORAD_CAT_ID: 33853, OBJECT_NAME: 'IRIDIUM 33', OBJECT_TYPE: 'PAYLOAD' },
  { ...base, NORAD_CAT_ID: 0 },
  { ...base, NORAD_CAT_ID: 33854, EPOCH: 'not-an-epoch' },
  { ...base, NORAD_CAT_ID: 33855, MEAN_MOTION: 0 },
  'not-an-object',
];
const parsed = parseGpRecords(fixture, '2026-10-14T14:00:00.000Z', 'fixture', 'iridium-33-debris');
assert.equal(fixture.length, 8, 'raw fixture count');
assert.equal(parsed.parsedRecordCount, 4, 'valid OMM elements parsed before category filtering');
assert.equal(parsed.records[1].classification, 'DEBRIS', 'DEB abbreviation and missing OBJECT_TYPE classify as debris');
assert.equal(parsed.records[1].omm?.OBJECT_TYPE, undefined, 'raw provider record remains intact');
assert.equal(parsed.records[1].providerClassification, '', 'provider object type remains distinct from normalized class');
assert.equal(parsed.records[1].bstarDrag, 0, 'optional BSTAR defaults only when missing');
assert.equal(parsed.records[2].classification, 'ROCKET BODY', 'rocket body preserved as separate class');
assert.equal(parsed.records[0].epoch, '2026-09-14T18:12:22.000Z', 'element epoch preserved');
assert.deepEqual(parsed.rejectionReasons, {
  'invalid-norad-id': 1,
  'invalid-epoch': 1,
  'invalid-required-orbital-elements': 1,
  'record-not-object': 1,
});
const activePayload = parseGpRecords(
  [{ ...base, NORAD_CAT_ID: 33856, OBJECT_NAME: 'STARLINK-TEST', OBJECT_TYPE: undefined }],
  '2026-10-14T14:00:00.000Z',
  'fixture',
  'active'
);
assert.equal(activePayload.records[0].classification, 'PAYLOAD', 'a documented single-CATNR payload query classifies the requested object as payload');
const utcOmmEpoch = parseGpRecords(
  [{ ...base, NORAD_CAT_ID: 33857, EPOCH: '2026-09-14T18:12:22.000000' }],
  '2026-10-14T14:00:00.000Z',
  'fixture',
  'iridium-33-debris'
);
assert.equal(utcOmmEpoch.records[0].epoch, '2026-09-14T18:12:22.000Z', 'timezone-less GP OMM epochs are UTC, independent of server timezone');
const singleJsonObject = parseGpRecords(base, '2026-10-14T14:00:00.000Z', 'fixture', 'iridium-33-debris');
assert.equal(singleJsonObject.records.length, 1, 'a single-record GP JSON object is parsed as one OMM record');
assert.equal(singleJsonObject.records[0].noradId, base.NORAD_CAT_ID, 'single-object responses preserve NORAD ID');
console.log(JSON.stringify({ rawRecords: fixture.length, parsedRecords: parsed.parsedRecordCount, rejectedByParser: fixture.length - parsed.parsedRecordCount, rejectionReasons: parsed.rejectionReasons, classifications: parsed.records.map(({ classification, providerClassification }) => ({ classification, providerClassification })) }, null, 2));

resetCatalogStateForTesting();
let requested: string[] = [];
const mockFetch: typeof fetch = async (input) => {
  const url = String(input);
  requested.push(url);
  const catnr = new URL(url).searchParams.get('CATNR');
  const records = catnr === '40697' ? [{ ...base, OBJECT_NAME: 'SENTINEL-2A', OBJECT_TYPE: undefined, NORAD_CAT_ID: 40697 }] : [base];
  return new Response(JSON.stringify(records), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
};
setGpFetchForTesting(mockFetch);
await fetchOrbitalObjects();
const status = getDataStatus();
assert.equal(requested.length, 4, 'one local mocked request per configured group');
assert.equal(status.groups['cosmos-2251-debris'].oldestEpochIso, new Date(base.EPOCH).toISOString(), 'feed epoch ranges are recomputed from normalized OMM records');
assert.equal(status.groups['cosmos-2251-debris'].recordCount, 1, 'displayed group count matches retained records');
assert(requested.some((url) => url === 'https://celestrak.org/NORAD/elements/gp.php?CATNR=40697&FORMAT=JSON'), 'satellite feed uses the documented single-object CATNR query');
for (const group of Object.keys(status.groups)) {
  assert.equal(status.groups[group].httpStatus, 200);
  assert.equal(status.groups[group].responseContentType, 'application/json; charset=utf-8');
  assert.equal(status.groups[group].responseBodyType, 'JSON array');
  assert.equal(status.groups[group].rawRecordCount, 1);
  assert.equal(status.groups[group].parsedRecordCount, 1);
  assert.equal(status.groups[group].acceptedRecordCount, 1);
  assert.equal(status.groups[group].rejectedRecordCount, 0);
}
assert.equal(status.groups.active.responseBody, undefined, 'successful provider bodies are not retained in status');
console.log(JSON.stringify({ mockedFeeds: Object.fromEntries(Object.entries(status.groups).map(([key, value]) => [key, { url: value.sourceUrl, httpStatus: value.httpStatus, contentType: value.responseContentType, bodyType: value.responseBodyType, raw: value.rawRecordCount, parsed: value.parsedRecordCount, accepted: value.acceptedRecordCount, rejected: value.rejectedRecordCount, rejectionReasons: value.rejectionReasons }])) }, null, 2));

resetCatalogStateForTesting();
requested = [];
setGpFetchForTesting(mockFetch);
const baseGroups = getDataStatus().groups;
const attemptedAt = new Date().toISOString();
const blockedUntil = new Date(Date.now() + 2 * 60 * 60 * 1000 + 60_000).toISOString();
restoreCatalogCache([], { groups: { ...baseGroups, active: { ...baseGroups.active, lastAttemptIso: attemptedAt, retryAfterIso: blockedUntil, lastError: 'persisted provider cooldown fixture' } } });
await fetchSatellitePayloadSubset();
assert.equal(requested.length, 0, 'targeted satellite retrieval makes no provider call while persisted cooldown is active');
console.log(JSON.stringify({ persistedCooldownMock: { providerCalls: requested.length, retryAfterIso: blockedUntil } }, null, 2));

resetCatalogStateForTesting();
requested = [];
setGpFetchForTesting(mockFetch);
const targeted = await fetchSatellitePayloadSubset();
assert.equal(requested.length, 1, 'targeted satellite retrieval makes exactly one provider request');
assert.equal(new URL(requested[0]).searchParams.get('CATNR'), '40697', 'targeted retrieval requests only Sentinel-2A');
assert.equal(targeted.length, 1, 'targeted retrieval returns the single requested payload record');
assert.equal(getDataStatus().debrisFeed.recordCount, 0, 'targeted retrieval does not replace or request debris records');
console.log(JSON.stringify({ satelliteOnlyMock: { requestCount: requested.length, url: requested[0], acceptedPayloads: targeted.length } }, null, 2));

resetCatalogStateForTesting();
requested = [];
setGpFetchForTesting(async (input) => {
  requested.push(String(input));
  return new Response(JSON.stringify({ ...base, OBJECT_NAME: 'SENTINEL-2A', OBJECT_TYPE: undefined, NORAD_CAT_ID: 40697 }), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
});
const singleObjectTarget = await fetchSatellitePayloadSubset();
const singleObjectDiagnostics = getDataStatus().groups.active;
assert.equal(requested.length, 1, 'single-object body fixture makes one targeted request');
assert.equal(singleObjectTarget.length, 1, 'single-object GP response accepts its payload');
assert.equal(singleObjectDiagnostics.responseBodyType, 'JSON object');
assert.equal(singleObjectDiagnostics.rawRecordCount, 1);
assert.equal(singleObjectDiagnostics.parsedRecordCount, 1);
assert.equal(singleObjectDiagnostics.acceptedRecordCount, 1);
assert.equal(singleObjectDiagnostics.rejectedRecordCount, 0);
console.log(JSON.stringify({ singleObjectBodyMock: { bodyType: singleObjectDiagnostics.responseBodyType, raw: singleObjectDiagnostics.rawRecordCount, parsed: singleObjectDiagnostics.parsedRecordCount, accepted: singleObjectDiagnostics.acceptedRecordCount, rejected: singleObjectDiagnostics.rejectedRecordCount } }, null, 2));

resetCatalogStateForTesting();
setGpFetchForTesting(async () => new Response('CelesTrak diagnostic fixture: forbidden', {
  status: 403,
  headers: { 'content-type': 'text/plain; charset=utf-8', 'retry-after': '3600' },
}));
await fetchSatellitePayloadSubset();
const refusalDiagnostics = getDataStatus().groups.active;
assert.equal(refusalDiagnostics.sourceUrl, 'https://celestrak.org/NORAD/elements/gp.php?CATNR=40697&FORMAT=JSON', 'failed targeted requests retain the actual requested URL, not the legacy active-group URL');
assert.equal(refusalDiagnostics.httpStatus, 403);
assert.equal(refusalDiagnostics.responseContentType, 'text/plain; charset=utf-8');
assert.equal(refusalDiagnostics.responseBodyType, 'plain text');
assert.equal(refusalDiagnostics.responseBody, 'CelesTrak diagnostic fixture: forbidden');
assert.equal(refusalDiagnostics.responseHeaders?.['retry-after'], '3600');
console.log(JSON.stringify({ failedRequestDiagnosticsMock: { url: refusalDiagnostics.sourceUrl, httpStatus: refusalDiagnostics.httpStatus, bodyType: refusalDiagnostics.responseBodyType, body: refusalDiagnostics.responseBody, retryAfterHeader: refusalDiagnostics.responseHeaders?.['retry-after'], retryAfterIso: refusalDiagnostics.retryAfterIso } }, null, 2));
