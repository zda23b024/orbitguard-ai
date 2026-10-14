import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { OrbitalObject } from '../src/types/orbital.ts';
import { propagateObject } from '../src/services/orbitalEngine.ts';

type CachedCatalog = {
  objects: OrbitalObject[];
  status: {
    groups?: Record<string, {
      source?: string;
      sourceUrl?: string;
      state?: string;
      httpStatus?: number;
      downloadTimestampIso?: string;
      lastAttemptIso?: string;
      retryAfterIso?: string;
      providerRefusalUntilIso?: string;
      responseContentType?: string;
      responseBodyType?: string;
      rawRecordCount?: number;
      parsedRecordCount?: number;
      acceptedRecordCount?: number;
      rejectedRecordCount?: number;
      rejectionReasons?: Record<string, number>;
    }>;
  };
};

const cachePath = path.join(tmpdir(), 'orbitguard-ai', 'celestrak-catalog-cache.json');
const cache = JSON.parse(await readFile(cachePath, 'utf8')) as CachedCatalog;
const sourceEpochIso = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const hasTimezone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(raw);
  const epoch = new Date(hasTimezone ? raw : `${raw}Z`);
  return Number.isFinite(epoch.getTime()) ? epoch.toISOString() : '';
};
const records = cache.objects.filter((object) => object.dataMode === 'current'
  && Number.isInteger(object.noradId)
  && Number.isFinite(Date.parse(object.epoch))
  && Boolean(object.downloadedAtIso)
  && Boolean(object.source)
  && object.omm && typeof object.omm === 'object'
  && Number(object.omm.NORAD_CAT_ID) === object.noradId
  && sourceEpochIso(object.omm.EPOCH) === new Date(object.epoch).toISOString()
  && object.dataGroup && cache.status.groups?.[object.dataGroup]?.source === object.source
  && cache.status.groups?.[object.dataGroup]?.downloadTimestampIso === object.downloadedAtIso);
const payloads = records.filter((object) => object.classification === 'PAYLOAD');
const debris = records.filter((object) => object.classification === 'DEBRIS' || object.classification === 'ROCKET BODY');
const satelliteFeed = cache.status.groups?.active;
const requestedPayload = payloads.filter((object) => object.noradId === 40697 && object.source.includes('CATNR=40697'));
const debrisGroupKeys = ['cosmos-2251-debris', 'iridium-33-debris', 'fengyun-1c-debris'];
const debrisFeedsVerified = debrisGroupKeys.every((key) => {
  const groupObjects = debris.filter((object) => object.dataGroup === key);
  const status = cache.status.groups?.[key];
  return groupObjects.length > 0 && status?.httpStatus === 200 && status.acceptedRecordCount === groupObjects.length;
});

if (payloads.length !== 1
  || requestedPayload.length !== 1
  || satelliteFeed?.sourceUrl !== 'https://celestrak.org/NORAD/elements/gp.php?CATNR=40697&FORMAT=JSON'
  || satelliteFeed.httpStatus !== 200
  || satelliteFeed.acceptedRecordCount !== 1
  || !debris.length || !debrisFeedsVerified) {
  throw new Error('A verified Sentinel-2A CATNR response and accepted CelesTrak debris records are required before exporting a provider snapshot.');
}

const capturedAtIso = new Date().toISOString();
const epochMs = records.map((object) => Date.parse(object.epoch)).sort((a, b) => a - b);
const ageStats = (items: OrbitalObject[]) => {
  const ages = items.map((object) => Math.max(0, (Date.parse(capturedAtIso) - Date.parse(object.epoch)) / 3600000)).sort((a, b) => a - b);
  return ages.length ? {
    recordCount: ages.length,
    minHours: Number(ages[0].toFixed(1)),
    medianHours: Number(ages[Math.floor(ages.length / 2)].toFixed(1)),
    maxHours: Number(ages.at(-1)!.toFixed(1)),
    within24Hours: ages.filter((age) => age <= 24).length,
    within48Hours: ages.filter((age) => age <= 48).length,
    within7Days: ages.filter((age) => age <= 168).length,
  } : { recordCount: 0, minHours: null, medianHours: null, maxHours: null, within24Hours: 0, within48Hours: 0, within7Days: 0 };
};
const groups = Object.fromEntries(Object.entries(cache.status.groups || {}).map(([key, status]) => {
  const groupRecords = records.filter((object) => object.dataGroup === key);
  const groupEpochs = groupRecords.map((object) => Date.parse(object.epoch)).sort((a, b) => a - b);
  return [key, {
    source: status.source,
    sourceUrl: status.sourceUrl,
    stateAtCapture: status.state,
    httpStatus: status.httpStatus,
    downloadTimestampIso: status.downloadTimestampIso,
    lastAttemptIso: status.lastAttemptIso,
    retryAfterIso: status.retryAfterIso,
    providerRefusalUntilIso: status.providerRefusalUntilIso,
    responseContentType: status.responseContentType,
    responseBodyType: status.responseBodyType,
    rawRecordCount: status.rawRecordCount,
    parsedRecordCount: status.parsedRecordCount,
    acceptedRecordCount: status.acceptedRecordCount,
    rejectedRecordCount: status.rejectedRecordCount,
    rejectionReasons: status.rejectionReasons,
    bundledRecordCount: groupRecords.length,
    oldestElementEpochIso: groupEpochs.length ? new Date(groupEpochs[0]).toISOString() : '',
    newestElementEpochIso: groupEpochs.length ? new Date(groupEpochs.at(-1)!).toISOString() : '',
  }];
}));

const historicalObjects = records.map((object) => ({ ...object, dataMode: 'historical' as const, snapshotCapturedAtIso: capturedAtIso }));
const propagation = historicalObjects.reduce((result, object) => {
  if (propagateObject(object, new Date(capturedAtIso)).valid) result.valid++;
  else result.invalid++;
  return result;
}, { valid: 0, invalid: 0 });

const snapshot = {
  schema: 'orbitguard-celestrak-gp-snapshot-v1',
  label: 'Historical snapshot of verified CelesTrak GP elements',
  capturedAtIso,
  statusAtCapture: 'Current provider response records retained locally; this bundle is historical when used later and must not be represented as live.',
  sourcePolicy: 'Public CelesTrak GP JSON response. Original OMM element epochs and per-feed retrieval timestamps are retained in every record.',
  counts: { acceptedPayloadRecords: payloads.length, acceptedDebrisAndRocketBodyRecords: debris.length, totalRecords: records.length },
  elementEpochRangeUtc: epochMs.length ? { oldest: new Date(epochMs[0]).toISOString(), newest: new Date(epochMs.at(-1)!).toISOString() } : null,
  epochAgeAtCaptureHours: { payload: ageStats(payloads), debrisAndRocketBody: ageStats(debris) },
  propagationAtCapture: { timestampIso: capturedAtIso, ...propagation },
  groups,
  objects: historicalObjects,
};

if (propagation.invalid > 0) throw new Error(`Refusing snapshot export: ${propagation.invalid} records failed SGP4 at capture time.`);

const outputDir = path.resolve('data/snapshots');
await mkdir(outputDir, { recursive: true });
const timestamp = capturedAtIso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const outputPath = path.join(outputDir, `celestrak-gp-${timestamp}.json`);
await writeFile(outputPath, `${JSON.stringify(snapshot)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, capturedAtIso, counts: snapshot.counts, elementEpochRangeUtc: snapshot.elementEpochRangeUtc, propagationAtCapture: snapshot.propagationAtCapture }, null, 2));
