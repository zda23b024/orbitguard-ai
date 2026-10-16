/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { OrbitalObject } from '../types/orbital';

export interface DataStatus {
  source: string;
  sourceUrl: string;
  lastFetchedIso: string;
  lastAttemptIso: string;
  cacheExpiresIso: string;
  retryAfterIso: string;
  providerRefusalUntilIso: string;
  totalObjects: number;
  payloadsCount: number;
  debrisCount: number;
  unknownCount: number;
  usesHistoricalDebris: boolean;
  isStale: boolean;
  isFallback: boolean;
  lastError?: string;
  satelliteFeed: FeedStatus;
  debrisFeed: FeedStatus;
  provenanceMode: 'current' | 'historical';
  liveAccessDisabled: boolean;
  groups: Record<string, GroupStatus>;
}

export interface FeedStatus {
  state: 'current' | 'cached' | 'historical' | 'unavailable';
  source: string;
  sourceUrl: string;
  recordCount: number;
  downloadTimestampIso: string;
  oldestEpochIso: string;
  newestEpochIso: string;
  httpStatus?: number;
  responseDetail?: string;
  lastError?: string;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
}

export interface GroupStatus extends FeedStatus {
  lastAttemptIso: string;
  retryAfterIso: string;
  providerRefusalUntilIso: string;
  responseContentType?: string;
  responseBodyType?: 'JSON array' | 'JSON object' | 'plain text' | 'empty';
  rawRecordCount?: number;
  parsedRecordCount?: number;
  acceptedRecordCount?: number;
  rejectedRecordCount?: number;
  rejectionReasons?: Record<string, number>;
}

function emptyFeed(state: FeedStatus['state'], source: string, sourceUrl: string): FeedStatus {
  return { state, source, sourceUrl, recordCount: 0, downloadTimestampIso: '', oldestEpochIso: '', newestEpochIso: '' };
}

function makeFeedStatus(objects: OrbitalObject[], source: string, sourceUrl: string, downloadTimestampIso: string, state: FeedStatus['state'] = 'current'): FeedStatus {
  const epochs = objects.map((o) => Date.parse(o.epoch)).filter(Number.isFinite).sort((a, b) => a - b);
  return { state, source, sourceUrl, recordCount: objects.length, downloadTimestampIso,
    oldestEpochIso: epochs.length ? new Date(epochs[0]).toISOString() : '',
    newestEpochIso: epochs.length ? new Date(epochs[epochs.length - 1]).toISOString() : '' };
}

function parseGpEpoch(value: unknown): Date {
  const epochText = String(value ?? '').trim();
  const includesTimezone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(epochText);
  return new Date(includesTimezone ? epochText : `${epochText}Z`);
}

function normalizeCachedEpoch(object: OrbitalObject): OrbitalObject {
  const rawEpoch = object.omm?.EPOCH;
  if (typeof rawEpoch !== 'string') return object;
  const epoch = parseGpEpoch(rawEpoch);
  if (!Number.isFinite(epoch.getTime())) return object;
  const epochYear = epoch.getUTCFullYear();
  return {
    ...object,
    epoch: epoch.toISOString(),
    epochYear,
    epochDay: (epoch.getTime() - Date.UTC(epochYear, 0, 0)) / 86400000,
  };
}

const HISTORICAL_UNAVAILABLE_REASON = 'Historical orbital snapshot unavailable: the bundled TLE checksums failed validation, and no archival retrieval date or verified source copy was retained.';

function historicalFeed(_kind: 'satellite' | 'debris', objects: OrbitalObject[]): FeedStatus {
  if (objects.length) {
    const downloadedAt = objects.map((object) => Date.parse(object.downloadedAtIso || '')).filter(Number.isFinite);
    const groupKeys = [...new Set(objects.map((object) => object.dataGroup).filter((key): key is string => Boolean(key)))];
    const sourceUrls = groupKeys.map((key) => groupStatuses[key]?.sourceUrl).filter((url): url is string => Boolean(url));
    const sources = [...new Set(objects.map((object) => object.source))];
    return {
      ...makeFeedStatus(objects, sources.join('; '), sourceUrls.join(' ; '), downloadedAt.length ? new Date(Math.max(...downloadedAt)).toISOString() : '', 'historical'),
      responseDetail: 'Records are from the verified local provider snapshot. They retain their original element epochs and download timestamps and must not be described as live.',
    };
  }
  return {
    ...makeFeedStatus(objects, 'No verified historical snapshot bundled', 'No verified archival source copy', '', 'unavailable'),
    responseDetail: HISTORICAL_UNAVAILABLE_REASON,
    lastError: HISTORICAL_UNAVAILABLE_REASON,
  };
}

const DEBRIS_GROUPS = [
  { group: 'cosmos-2251-debris', source: 'CelesTrak COSMOS 2251 Debris group' },
  { group: 'iridium-33-debris', source: 'CelesTrak IRIDIUM 33 Debris group' },
  { group: 'fengyun-1c-debris', source: 'CelesTrak Chinese ASAT Test Debris group' },
];
// Keep the legacy internal key so a persisted active-feed cooldown is honored,
// while the next permitted retrieval uses a much smaller documented CATNR query.
const SATELLITE_QUERY_KEY = 'active';
const ALL_GROUPS = [SATELLITE_QUERY_KEY, ...DEBRIS_GROUPS.map(({ group }) => group)];
const LEGACY_GROUP_ALIASES: Record<string, string> = {
  'COSMOS-2251-DEB': 'cosmos-2251-debris',
  'IRIDIUM-33-DEB': 'iridium-33-debris',
  'FENGYUN-1C-DEB': 'fengyun-1c-debris',
};
const SATELLITE_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=40697&FORMAT=JSON';
function groupUrl(group: string): string { return `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=JSON`; }
function groupSource(group: string): string { return group === SATELLITE_QUERY_KEY || group === 'active' ? 'CelesTrak GP CATNR=40697 (Sentinel-2A payload)' : DEBRIS_GROUPS.find((item) => item.group === group)?.source || `CelesTrak GP GROUP=${group}`; }
function groupUrlFor(group: string): string { return group === SATELLITE_QUERY_KEY || group === 'active' ? SATELLITE_URL : groupUrl(group); }
function emptyGroupStatus(group: string): GroupStatus {
  return { ...emptyFeed('unavailable', groupSource(group), groupUrlFor(group)), lastAttemptIso: '', retryAfterIso: '', providerRefusalUntilIso: '' };
}

const SAFE_DIAGNOSTIC_HEADERS = ['content-type', 'date', 'cache-control', 'expires', 'retry-after', 'server', 'via', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset'];
const MAX_DIAGNOSTIC_BODY_CHARS = 2000;

function diagnosticBody(body?: string): string | undefined {
  if (!body) return undefined;
  return body.length > MAX_DIAGNOSTIC_BODY_CHARS ? `${body.slice(0, MAX_DIAGNOSTIC_BODY_CHARS)}… [truncated]` : body;
}

function sanitizeFeedDiagnostics<T extends FeedStatus>(feed: T): T {
  const successfulData = feed.httpStatus === 200 && feed.recordCount > 0;
  return {
    ...feed,
    responseBody: successfulData ? undefined : diagnosticBody(feed.responseBody),
    responseDetail: diagnosticBody(feed.responseDetail),
  };
}

function refusalCooldownUntil(headers: Record<string, string>, failedAtMs: number): number {
  const minimumUntil = failedAtMs + CACHE_TTL_MS;
  const retryAfter = headers['retry-after'];
  if (!retryAfter) return minimumUntil;
  const seconds = Number(retryAfter);
  const providerUntil = Number.isFinite(seconds) && seconds >= 0
    ? failedAtMs + seconds * 1000
    : Date.parse(retryAfter);
  return Number.isFinite(providerUntil) ? Math.max(minimumUntil, providerUntil) : minimumUntil;
}

async function getGpResponse(url: string, signal: AbortSignal): Promise<{ data: unknown; status: number; body: string; headers: Record<string, string>; contentType: string; bodyType: GroupStatus['responseBodyType'] }> {
  const response = await gpFetch(url, { signal, headers: { Accept: 'application/json' } });
  const body = await response.text();
  const contentType = response.headers.get('content-type') || '';
  const headers = Object.fromEntries(SAFE_DIAGNOSTIC_HEADERS.flatMap((name) => { const value = response.headers.get(name); return value ? [[name, value]] : []; }));
  if (!response.ok) throw Object.assign(new Error(`CelesTrak HTTP ${response.status}`), { httpStatus: response.status, responseBody: body, responseHeaders: headers, responseContentType: contentType, responseBodyType: !body.trim() ? 'empty' : 'plain text', url });
  let data: unknown;
  let bodyType: GroupStatus['responseBodyType'];
  try {
    if (!body.trim()) throw new Error('empty response');
    data = JSON.parse(body);
    bodyType = Array.isArray(data) ? 'JSON array' : 'JSON object';
  } catch {
    if (!body.trim()) bodyType = 'empty';
    const detail = body.startsWith('Invalid query:') ? 'provider reported an invalid GP query' : 'response was not valid JSON';
    if (!body.trim()) throw Object.assign(new Error(`CelesTrak HTTP ${response.status}: empty response body`), { httpStatus: response.status, responseBody: body, responseHeaders: headers, responseContentType: contentType, responseBodyType: 'empty', url });
    throw Object.assign(new Error(`CelesTrak HTTP ${response.status}: ${detail}`), { httpStatus: response.status, responseBody: body, responseHeaders: headers, responseContentType: contentType, responseBodyType: bodyType || 'plain text', url });
  }
  return { data, status: response.status, body, headers, contentType, bodyType };
}

export interface GpParseResult { records: OrbitalObject[]; parsedRecordCount: number; rejectionReasons: Record<string, number> }

function isGpRecordObject(data: unknown): data is Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  return ['NORAD_CAT_ID', 'EPOCH', 'MEAN_MOTION', 'OBJECT_ID'].some((key) => key in data);
}

function gpRawRecords(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  return isGpRecordObject(data) ? [data] : [];
}

export function parseGpRecords(data: unknown, downloadTimestampIso: string, label: string, groupKey: string): GpParseResult {
  const result: OrbitalObject[] = [];
  const rejectionReasons: Record<string, number> = {};
  const rawRecords = gpRawRecords(data);
  if (!rawRecords.length) return { records: result, parsedRecordCount: 0, rejectionReasons: {} };
  const reject = (reason: string) => { rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1; };
  for (const raw of rawRecords) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { reject('record-not-object'); continue; }
    const item = raw as Record<string, any>;
    const norad = Number(item.NORAD_CAT_ID);
    const epoch = parseGpEpoch(item.EPOCH);
    const inc = Number(item.INCLINATION), ecc = Number(item.ECCENTRICITY), mm = Number(item.MEAN_MOTION);
    const raan = Number(item.RA_OF_ASC_NODE), argPerigee = Number(item.ARG_OF_PERICENTER), meanAnomaly = Number(item.MEAN_ANOMALY);
    if (!Number.isInteger(norad) || norad <= 0) { reject('invalid-norad-id'); continue; }
    if (item.EPOCH == null || !String(item.EPOCH).trim() || !Number.isFinite(epoch.getTime())) { reject('invalid-epoch'); continue; }
    if (![inc, ecc, mm, raan, argPerigee, meanAnomaly].every(Number.isFinite) || inc < 0 || inc > 180 || ecc < 0 || ecc >= 1 || mm <= 0 || raan < 0 || raan >= 360 || argPerigee < 0 || argPerigee >= 360 || meanAnomaly < 0 || meanAnomaly >= 360) { reject('invalid-required-orbital-elements'); continue; }
    const type = String(item.OBJECT_TYPE ?? '').trim().toUpperCase();
    const name = String(item.OBJECT_NAME || `OBJECT ${norad}`);
    const classText = `${type} ${name}`.toUpperCase();
    const classification: OrbitalObject['classification'] = /PAYLOAD/.test(type) || /\bPAYLOAD\b/.test(name) ? 'PAYLOAD'
      : /ROCKET[ _-]?BODY|\bR\/B\b/.test(type) || /\bR\/B\b|ROCKET[ _-]?BODY/.test(classText) ? 'ROCKET BODY'
      : /DEBRIS|FRAGMENT|\bDEB\b/.test(classText) ? 'DEBRIS' : groupKey === SATELLITE_QUERY_KEY || groupKey === 'active' ? 'PAYLOAD' : 'UNKNOWN';
    const mu = 398600.4418, nRadS = mm * 2 * Math.PI / 86400, a = Math.cbrt(mu / (nRadS * nRadS));
    const perigee = a * (1 - ecc) - 6378.137, apogee = a * (1 + ecc) - 6378.137;
    const obj: OrbitalObject = {
      id: String(norad), noradId: norad, name, classification, providerClassification: String(item.OBJECT_TYPE || ''), intlDes: item.OBJECT_ID || 'UNKNOWN',
      epoch: epoch.toISOString(), epochYear: epoch.getUTCFullYear(), epochDay: (epoch.getTime() - Date.UTC(epoch.getUTCFullYear(), 0, 0)) / 86400000,
      inclinationDeg: inc, eccentricity: ecc, raanDeg: raan, argPerigeeDeg: argPerigee, meanAnomalyDeg: meanAnomaly,
      meanMotionRevDay: mm, bstarDrag: Number(item.BSTAR ?? 0), periodMinutes: Number((1440 / mm).toFixed(1)),
      perigeeKm: Number(Math.max(100, perigee).toFixed(1)), apogeeKm: Number(Math.max(100, apogee).toFixed(1)),
      orbitClass: (perigee > 35000 ? 'GEO' : perigee > 2000 ? 'MEO' : 'LEO'), tleLine1: item.TLE_LINE1 || '', tleLine2: item.TLE_LINE2 || '',
      omm: { ...item, MEAN_MOTION_DOT: Number(item.MEAN_MOTION_DOT ?? 0), MEAN_MOTION_DDOT: Number(item.MEAN_MOTION_DDOT ?? 0), BSTAR: Number(item.BSTAR ?? 0) },
      source: label, dataMode: 'current', dataGroup: groupKey, downloadedAtIso: downloadTimestampIso,
    };
    result.push(obj);
  }
  return { records: result, parsedRecordCount: result.length, rejectionReasons };
}

// In-memory cache for live fetched data
let cachedObjects: OrbitalObject[] = [];
let satelliteObjects: OrbitalObject[] = [];
let debrisObjects: OrbitalObject[] = [];
let lastFetchTimeMs = 0;
let lastSuccessfulFetchTimeMs = 0;
let retryAfterMs = 0;
let providerRefusalUntilMs = 0;
let inFlightCatalogFetch: Promise<OrbitalObject[]> | null = null;
let historicalDemoMode = false;
let lastFetchError: string | undefined;
let satelliteFeed: FeedStatus = emptyFeed('unavailable', groupSource(SATELLITE_QUERY_KEY), SATELLITE_URL);
let debrisFeed: FeedStatus = emptyFeed('unavailable', 'CelesTrak catalogued debris GP groups', 'https://celestrak.org/NORAD/elements/gp.php');
let groupStatuses: Record<string, GroupStatus> = Object.fromEntries(ALL_GROUPS.map((group) => [group, emptyGroupStatus(group)]));
let gpFetch: typeof fetch = (...args) => fetch(...args);
const CACHE_TTL_MS = 2 * 3600 * 1000; // 2 hours as recommended by CelesTrak

export function setGpFetchForTesting(fetcher?: typeof fetch): void {
  gpFetch = fetcher || ((...args) => fetch(...args));
}

export function setConfiguredRefusalCooldown(untilIso?: string): void {
  const until = Date.parse(untilIso || '');
  if (Number.isFinite(until) && until > Date.now()) providerRefusalUntilMs = Math.max(providerRefusalUntilMs, until);
}

export function resetCatalogStateForTesting(): void {
  cachedObjects = [];
  satelliteObjects = []; debrisObjects = [];
  lastFetchTimeMs = 0; lastSuccessfulFetchTimeMs = 0; retryAfterMs = 0; providerRefusalUntilMs = 0;
  historicalDemoMode = false; lastFetchError = undefined; inFlightCatalogFetch = null;
  satelliteFeed = emptyFeed('unavailable', groupSource(SATELLITE_QUERY_KEY), SATELLITE_URL);
  debrisFeed = emptyFeed('unavailable', 'CelesTrak catalogued debris GP groups', 'https://celestrak.org/NORAD/elements/gp.php');
  groupStatuses = Object.fromEntries(ALL_GROUPS.map((group) => [group, emptyGroupStatus(group)]));
  setGpFetchForTesting();
}

export function setHistoricalDemoMode(enabled: boolean): void {
  historicalDemoMode = enabled;
  if (enabled) {
    cachedObjects = [];
    satelliteObjects = [];
    debrisObjects = [];
    lastFetchTimeMs = 0;
    lastSuccessfulFetchTimeMs = 0;
    if (!lastFetchError) lastFetchError = 'Live provider access disabled by ORBITGUARD_OFFLINE_MODE.';
    satelliteFeed = historicalFeed('satellite', cachedObjects.filter((o) => o.classification === 'PAYLOAD'));
    debrisFeed = historicalFeed('debris', cachedObjects.filter((o) => ['DEBRIS', 'ROCKET BODY'].includes(o.classification)));
  }
}

export function restoreCatalogCache(objects: OrbitalObject[], status: Partial<DataStatus>): void {
  if (!Array.isArray(objects)) return;
  const restoredGroups = status.groups
    ? Object.fromEntries(Object.entries(status.groups).map(([key, group]) => {
        const sanitized = sanitizeFeedDiagnostics(group);
        const attemptedAt = Date.parse(sanitized.lastAttemptIso || '');
        const savedRetryAt = Date.parse(sanitized.retryAfterIso || '');
        const updateWindowEndsAt = sanitized.lastError && Number.isFinite(attemptedAt) ? attemptedAt + CACHE_TTL_MS : 0;
        return [key, updateWindowEndsAt > savedRetryAt
          ? { ...sanitized, retryAfterIso: new Date(updateWindowEndsAt).toISOString() }
          : sanitized];
      }))
    : undefined;
  const successfulTime = Date.parse(status.lastFetchedIso || '');
  const attemptTime = Date.parse(status.lastAttemptIso || '');
  const retryTime = Date.parse(status.retryAfterIso || '');
  const refusalTime = Date.parse(status.providerRefusalUntilIso || '');
  lastFetchTimeMs = Number.isFinite(attemptTime) ? attemptTime : 0;
  if (Number.isFinite(retryTime)) retryAfterMs = Math.max(retryAfterMs, retryTime);
  if (Number.isFinite(refusalTime)) providerRefusalUntilMs = Math.max(providerRefusalUntilMs, refusalTime);
  if (historicalDemoMode || (objects.length > 0 && objects.every(object => object.dataMode === 'historical'))) {
    // Preserve the live-provider cooldown across offline demonstrations without loading live records into the demo catalog.
    if (status.lastError && status.lastError !== 'Live provider access disabled by ORBITGUARD_OFFLINE_MODE.') lastFetchError = status.lastError;
    if (restoredGroups) {
      for (const [key, restored] of Object.entries(restoredGroups)) {
        const existing = groupStatuses[key];
        const restoredAttempt = Date.parse(restored.lastAttemptIso || restored.downloadTimestampIso || '');
        const existingAttempt = Date.parse(existing?.lastAttemptIso || existing?.downloadTimestampIso || '');
        if (!existing || !Number.isFinite(existingAttempt) || (Number.isFinite(restoredAttempt) && restoredAttempt >= existingAttempt)) groupStatuses[key] = restored;
      }
      for (const [legacy, current] of Object.entries(LEGACY_GROUP_ALIASES)) {
        const prior = restoredGroups[legacy];
        if (prior) groupStatuses[current] = { ...prior, source: groupSource(current), sourceUrl: groupUrlFor(current) };
      }
    }
    const snapshotObjects = objects.map(normalizeCachedEpoch).filter((object) => object.dataMode === 'historical'
      && Boolean(object.source) && Boolean(object.dataGroup) && Boolean(object.downloadedAtIso)
      && Number.isInteger(object.noradId) && object.noradId > 0 && Number.isFinite(Date.parse(object.epoch))
      && Boolean(object.omm && typeof object.omm === 'object'));
    if (objects.length || !cachedObjects.length) cachedObjects = snapshotObjects;
    satelliteObjects = cachedObjects.filter((object) => object.classification === 'PAYLOAD');
    debrisObjects = cachedObjects.filter((object) => object.classification === 'DEBRIS' || object.classification === 'ROCKET BODY');
    if (objects.length || !lastSuccessfulFetchTimeMs) {
      const capturedAt = Date.parse(status.lastFetchedIso || '');
      const attemptedAt = Date.parse(status.lastAttemptIso || '');
      lastSuccessfulFetchTimeMs = Number.isFinite(capturedAt) ? capturedAt : 0;
      lastFetchTimeMs = Number.isFinite(attemptedAt) ? attemptedAt : lastSuccessfulFetchTimeMs;
    }
    satelliteFeed = historicalFeed('satellite', satelliteObjects);
    debrisFeed = historicalFeed('debris', debrisObjects);
    refreshRetryAfterFromGroups();
    return;
  }
  // Old bundled/legacy historical records failed TLE checksum checks and have no retained archive retrieval date.
  // Only restore records with explicit current-feed provenance; never relabel questionable cache entries as history.
  const currentRecords = objects.map(normalizeCachedEpoch).filter((object) => object.dataMode === 'current'
    && Boolean(object.dataGroup)
    && Boolean(object.downloadedAtIso)
    && Number.isInteger(object.noradId)
    && Number.isFinite(Date.parse(object.epoch)));
  cachedObjects = currentRecords.map((object) => object.dataGroup && LEGACY_GROUP_ALIASES[object.dataGroup]
    ? { ...object, dataGroup: LEGACY_GROUP_ALIASES[object.dataGroup] }
    : object);
  if (currentRecords.length !== objects.length) {
    lastFetchError = 'Ignored legacy historical cache entries because their element-source integrity could not be verified.';
  }
  satelliteObjects = cachedObjects.filter((o) => o.dataMode === 'current' && (o.dataGroup === SATELLITE_QUERY_KEY || o.dataGroup === 'active') && o.classification === 'PAYLOAD');
  debrisObjects = cachedObjects.filter((o) => o.dataMode === 'current' && o.dataGroup !== SATELLITE_QUERY_KEY && o.dataGroup !== 'active' && ['DEBRIS', 'ROCKET BODY'].includes(o.classification));
  lastSuccessfulFetchTimeMs = Number.isFinite(successfulTime) ? successfulTime : 0;
  lastFetchTimeMs = Number.isFinite(attemptTime) ? attemptTime : lastSuccessfulFetchTimeMs;
  if (Number.isFinite(refusalTime)) providerRefusalUntilMs = Math.max(providerRefusalUntilMs, refusalTime);
  lastFetchError = status.lastError;
  if (status.satelliteFeed) satelliteFeed = sanitizeFeedDiagnostics(status.satelliteFeed);
  if (status.debrisFeed) debrisFeed = sanitizeFeedDiagnostics(status.debrisFeed);
  if (restoredGroups) {
    groupStatuses = { ...groupStatuses, ...restoredGroups };
    for (const [legacy, current] of Object.entries(LEGACY_GROUP_ALIASES)) {
      const prior = restoredGroups[legacy];
      if (prior) groupStatuses[current] = { ...prior, source: groupSource(current), sourceUrl: groupUrlFor(current) };
    }
  }
  refreshRetryAfterFromGroups();
}

function refreshRetryAfterFromGroups(): void {
  const pendingRetries = ALL_GROUPS
    .map((group) => Date.parse(groupStatuses[group]?.retryAfterIso || ''))
    .filter((time) => Number.isFinite(time) && time > Date.now());
  retryAfterMs = pendingRetries.length ? Math.min(...pendingRetries) : 0;
}

export function fetchOrbitalObjects(forceRefresh = false): Promise<OrbitalObject[]> {
  if (inFlightCatalogFetch) return inFlightCatalogFetch;
  // forceRefresh is retained for API compatibility, but never overrides provider group cache/cooldown rules.
  inFlightCatalogFetch = fetchOrbitalObjectsOnce().finally(() => {
    inFlightCatalogFetch = null;
  });
  return inFlightCatalogFetch;
}

export function fetchSatellitePayloadSubset(): Promise<OrbitalObject[]> {
  if (inFlightCatalogFetch) return inFlightCatalogFetch;
  inFlightCatalogFetch = fetchOrbitalObjectsOnce([SATELLITE_QUERY_KEY]).finally(() => {
    inFlightCatalogFetch = null;
  });
  return inFlightCatalogFetch;
}

export function getCachedOrbitalObjects(): OrbitalObject[] {
  return cachedObjects.filter((object) => object.dataMode === 'current' || object.dataMode === 'historical');
}

async function fetchOrbitalObjectsOnce(groupsToRefresh: string[] = ALL_GROUPS): Promise<OrbitalObject[]> {
  const now = Date.now();
  if (historicalDemoMode) return cachedObjects;
  if (now < providerRefusalUntilMs) return cachedObjects;
  lastFetchTimeMs = now;
  for (const group of groupsToRefresh) {
      const prior = groupStatuses[group] || emptyGroupStatus(group);
      const fetchedAt = Date.parse(prior.downloadTimestampIso || '');
      const refusalUntil = Date.parse(prior.providerRefusalUntilIso || '');
      const retryAt = Date.parse(prior.retryAfterIso || '');
      if (now < refusalUntil || (Number.isFinite(fetchedAt) && now - fetchedAt < CACHE_TTL_MS) || (Number.isFinite(retryAt) && now < retryAt)) continue;

      groupStatuses[group] = { ...prior, lastAttemptIso: new Date().toISOString() };
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60_000);
      try {
        const response = await getGpResponse(groupUrlFor(group), controller.signal);
        const downloadedAt = new Date().toISOString();
        const parsed = parseGpRecords(response.data, downloadedAt, groupSource(group), group);
        const candidates = parsed.records;
        const rawRecords = gpRawRecords(response.data);
      const validObjects = group === SATELLITE_QUERY_KEY
          ? candidates.filter((object) => object.classification === 'PAYLOAD')
          : candidates.filter((object) => object.classification === 'DEBRIS' || object.classification === 'ROCKET BODY');
        const rejectionReasons = { ...parsed.rejectionReasons };
        if (!Array.isArray(response.data) && !rawRecords.length) rejectionReasons['top-level-not-array'] = 1;
        for (const candidate of candidates) {
          const expected = group === SATELLITE_QUERY_KEY ? candidate.classification === 'PAYLOAD' : candidate.classification === 'DEBRIS' || candidate.classification === 'ROCKET BODY';
          if (!expected) {
            const reason = candidate.classification === 'UNKNOWN' ? 'unrecognized-object-classification' : `classification-${candidate.classification.toLowerCase().replaceAll(' ', '-')}-outside-feed`;
            rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
          }
        }
        const diagnostics = {
          responseContentType: response.contentType,
          responseBodyType: response.bodyType,
          rawRecordCount: rawRecords.length,
          parsedRecordCount: parsed.parsedRecordCount,
          acceptedRecordCount: validObjects.length,
          rejectedRecordCount: rawRecords.length - validObjects.length,
          rejectionReasons,
        };
        if (!validObjects.length) {
          const providerCount = rawRecords.length;
          const detail = !Array.isArray(response.data) && !rawRecords.length
            ? `HTTP ${response.status} returned JSON with top-level type ${response.data === null ? 'null' : typeof response.data}, not an OMM record array.`
            : `HTTP ${response.status} returned ${providerCount} OMM entries; ${parsed.parsedRecordCount} passed element validation and ${validObjects.length} matched this feed's object class.`;
          groupStatuses[group] = {
            ...emptyGroupStatus(group), lastAttemptIso: downloadedAt, downloadTimestampIso: downloadedAt,
            retryAfterIso: new Date(Date.parse(downloadedAt) + CACHE_TTL_MS).toISOString(),
            state: 'unavailable', httpStatus: response.status, lastError: detail,
            responseBody: diagnosticBody(response.body), responseDetail: diagnosticBody(response.body) || detail, responseHeaders: response.headers,
            ...diagnostics,
          };
          lastFetchError = `${group}: ${detail}`;
          cachedObjects = cachedObjects.filter((object) => object.dataMode === 'current' && object.dataGroup !== group);
          continue;
        }
        cachedObjects = [...cachedObjects.filter((object) => object.dataMode === 'current' && object.dataGroup !== group), ...validObjects];
        const feed = makeFeedStatus(validObjects, groupSource(group), groupUrlFor(group), downloadedAt);
        groupStatuses[group] = { ...feed, lastAttemptIso: groupStatuses[group].lastAttemptIso, retryAfterIso: new Date(Date.parse(downloadedAt) + CACHE_TTL_MS).toISOString(), providerRefusalUntilIso: '', httpStatus: response.status, responseHeaders: response.headers, ...diagnostics };
        if (lastFetchError?.startsWith(`${group}:`)) lastFetchError = undefined;
      } catch (error) {
        const details = error as Error & { httpStatus?: number; responseBody?: string; responseHeaders?: Record<string, string>; responseContentType?: string; responseBodyType?: GroupStatus['responseBodyType'] };
        const failedAt = new Date().toISOString();
        const refused = details.httpStatus === 403 || details.httpStatus === 404;
        const until = refused ? new Date(refusalCooldownUntil(details.responseHeaders || {}, Date.now())).toISOString() : '';
        // A timeout may occur after CelesTrak has already served the request. Respect its one-download-per-update rule.
        const retry = refused ? until : new Date(Date.now() + CACHE_TTL_MS).toISOString();
        const body = diagnosticBody(details.responseBody);
        groupStatuses[group] = { ...prior, source: groupSource(group), sourceUrl: groupUrlFor(group), lastAttemptIso: failedAt, retryAfterIso: retry, providerRefusalUntilIso: until, state: prior.recordCount ? 'cached' : 'unavailable', httpStatus: details.httpStatus, responseBody: body, responseDetail: body || details.message, responseHeaders: details.responseHeaders, responseContentType: details.responseContentType, responseBodyType: details.responseBodyType, lastError: details.message };
        lastFetchError = `${group}: ${details.message}`;
        console.warn(`CelesTrak ${group} request failed (${details.httpStatus ?? 'network error'}); preserving response in the feed status.`);
        if (refused) {
          providerRefusalUntilMs = Date.parse(until);
          retryAfterMs = providerRefusalUntilMs;
          for (const key of ALL_GROUPS) {
            if (key === group) continue;
            const current = groupStatuses[key] || emptyGroupStatus(key);
            groupStatuses[key] = { ...current, providerRefusalUntilIso: until, retryAfterIso: until };
          }
        }
        // Stop after any provider/network error; never issue more GP requests in the same refresh cycle.
        break;
      } finally {
        clearTimeout(timeoutId);
      }
  }

  satelliteObjects = cachedObjects.filter((object) => object.dataMode === 'current' && (object.dataGroup === SATELLITE_QUERY_KEY || object.dataGroup === 'active') && object.classification === 'PAYLOAD');
  debrisObjects = cachedObjects.filter((object) => object.dataMode === 'current' && object.dataGroup !== SATELLITE_QUERY_KEY && object.dataGroup !== 'active');
  const activeStatus = groupStatuses[SATELLITE_QUERY_KEY] || emptyGroupStatus(SATELLITE_QUERY_KEY);
  satelliteFeed = { ...activeStatus, state: satelliteObjects.length ? activeStatus.state : 'unavailable' };
  const debrisStatuses = DEBRIS_GROUPS.map(({ group }) => groupStatuses[group] || emptyGroupStatus(group));
  const debrisEpochObjects = debrisObjects;
  const debrisEpochs = debrisEpochObjects.map((object) => Date.parse(object.epoch)).filter(Number.isFinite).sort((a, b) => a - b);
  const debrisTimes = debrisStatuses.map((status) => Date.parse(status.downloadTimestampIso)).filter(Number.isFinite);
  const loadedDebrisGroups = debrisStatuses.filter((status) => status.recordCount > 0);
  const allDebrisFresh = debrisStatuses.every((status) => status.state === 'current' && Date.now() - Date.parse(status.downloadTimestampIso) < CACHE_TTL_MS);
  debrisFeed = {
    state: allDebrisFresh && loadedDebrisGroups.length === DEBRIS_GROUPS.length ? 'current' : loadedDebrisGroups.length ? 'cached' : 'unavailable',
    source: `CelesTrak GP groups: ${loadedDebrisGroups.map((status) => status.source.replace('CelesTrak ', '')).join(', ')}`,
    sourceUrl: debrisStatuses.map((status) => status.sourceUrl).join(' ; '),
    recordCount: debrisObjects.length,
    downloadTimestampIso: debrisTimes.length ? new Date(Math.max(...debrisTimes)).toISOString() : '',
    oldestEpochIso: debrisEpochs.length ? new Date(debrisEpochs[0]).toISOString() : '',
    newestEpochIso: debrisEpochs.length ? new Date(debrisEpochs[debrisEpochs.length - 1]).toISOString() : '',
    httpStatus: [...debrisStatuses].reverse().find((status) => status.httpStatus)?.httpStatus,
    responseDetail: [...debrisStatuses].reverse().find((status) => status.responseDetail)?.responseDetail,
    responseBody: [...debrisStatuses].reverse().find((status) => status.responseBody)?.responseBody,
    responseHeaders: [...debrisStatuses].reverse().find((status) => status.responseHeaders)?.responseHeaders,
    lastError: debrisStatuses.find((status) => status.lastError)?.lastError,
  };
  lastFetchTimeMs = Date.now();
  const downloadedTimes = ALL_GROUPS.map((group) => Date.parse(groupStatuses[group]?.downloadTimestampIso || '')).filter(Number.isFinite);
  lastSuccessfulFetchTimeMs = downloadedTimes.length ? Math.max(...downloadedTimes) : 0;
  const retryTimes = ALL_GROUPS.map((group) => Date.parse(groupStatuses[group]?.retryAfterIso || '')).filter((time) => Number.isFinite(time) && time > Date.now());
  retryAfterMs = retryTimes.length ? Math.min(...retryTimes) : 0;
  const allFeedsFresh = ALL_GROUPS.every((group) => groupStatuses[group]?.state === 'current' && Date.now() - Date.parse(groupStatuses[group].downloadTimestampIso) < CACHE_TTL_MS);
  const allCategoriesAvailable = satelliteObjects.length > 0 && debrisObjects.length > 0;
  const hasGroupError = ALL_GROUPS.some((group) => Boolean(groupStatuses[group]?.lastError));
  if (allFeedsFresh || (allCategoriesAvailable && !hasGroupError)) lastFetchError = undefined;
  else if (!lastFetchError) lastFetchError = `Current catalog is incomplete: ${satelliteObjects.length} payloads and ${debrisObjects.length} catalogued debris/rocket bodies.`;
  if (!satelliteObjects.length && !debrisObjects.length) {
    cachedObjects = [];
    return cachedObjects;
  }
  return cachedObjects.filter((object) => object.dataMode === 'current');
}

export function getDataStatus(): DataStatus {
  const isStale = lastSuccessfulFetchTimeMs === 0 || Date.now() - lastSuccessfulFetchTimeMs > CACHE_TTL_MS;
  const payloadsCount = cachedObjects.filter((o) => o.classification === 'PAYLOAD').length;
  const debrisCount = cachedObjects.filter((o) => o.classification === 'DEBRIS' || o.classification === 'ROCKET BODY').length;
  const unknownCount = cachedObjects.filter((o) => o.classification === 'UNKNOWN').length;
  const historical = historicalDemoMode || (cachedObjects.length > 0 && cachedObjects.every((o) => o.dataMode === 'historical'));
  const staleFeed = (feed: FeedStatus): FeedStatus => feed.state === 'current' && Date.now() - Date.parse(feed.downloadTimestampIso) > CACHE_TTL_MS ? { ...feed, state: 'cached' } : feed;
  const persistedGroups = Object.fromEntries(ALL_GROUPS.map((group) => {
    const status = groupStatuses[group] || emptyGroupStatus(group);
    const age = Date.now() - Date.parse(status.downloadTimestampIso || '');
    const withRetry = !status.retryAfterIso && Number.isFinite(Date.parse(status.downloadTimestampIso || ''))
      ? { ...status, retryAfterIso: new Date(Date.parse(status.downloadTimestampIso) + CACHE_TTL_MS).toISOString() }
      : status;
    if (status.state === 'current' && status.recordCount === 0) return [group, { ...withRetry, state: 'unavailable' as const }];
    if (status.state === 'current' && age > CACHE_TTL_MS) return [group, { ...withRetry, state: 'cached' as const }];
    return [group, withRetry];
  }));
  // Rebuild displayed feed counts and epoch bounds from the retained, normalized OMM records.
  // Older cache summaries may have been computed in a local timezone before timezone-less GP
  // epochs were correctly interpreted as UTC; the raw OMM EPOCH is authoritative.
  for (const [group, status] of Object.entries(persistedGroups)) {
    const groupObjects = cachedObjects.filter((object) => object.dataGroup === group
      && (historical ? object.dataMode === 'historical' : object.dataMode === 'current'));
    const epochs = groupObjects.map((object) => Date.parse(object.epoch)).filter(Number.isFinite).sort((a, b) => a - b);
    const downloads = groupObjects.map((object) => Date.parse(object.downloadedAtIso || '')).filter(Number.isFinite).sort((a, b) => a - b);
    persistedGroups[group] = {
      ...status,
      state: groupObjects.length ? status.state : historical && status.state === 'historical' ? 'historical' : 'unavailable',
      recordCount: groupObjects.length,
      downloadTimestampIso: downloads.length ? new Date(downloads[downloads.length - 1]).toISOString() : '',
      oldestEpochIso: epochs.length ? new Date(epochs[0]).toISOString() : '',
      newestEpochIso: epochs.length ? new Date(epochs[epochs.length - 1]).toISOString() : '',
    };
  }
  const activeStatus = persistedGroups[SATELLITE_QUERY_KEY] || emptyGroupStatus(SATELLITE_QUERY_KEY);
  const currentDebrisGroups = DEBRIS_GROUPS.map(({ group }) => persistedGroups[group]);
  const debrisEpochs = debrisObjects.map((object) => Date.parse(object.epoch)).filter(Number.isFinite).sort((a, b) => a - b);
  const debrisGroupTimestamps = currentDebrisGroups.map((status) => Date.parse(status.downloadTimestampIso || '')).filter(Number.isFinite);
  const debrisAvailableGroups = currentDebrisGroups.filter((status) => status.recordCount > 0);
  const satelliteEpochs = satelliteObjects.map((object) => Date.parse(object.epoch)).filter(Number.isFinite).sort((a, b) => a - b);
  const persistedSatellite: FeedStatus = {
    ...activeStatus,
    state: satelliteObjects.length ? activeStatus.state : historical ? 'historical' : 'unavailable',
    recordCount: satelliteObjects.length,
    downloadTimestampIso: satelliteObjects.length ? activeStatus.downloadTimestampIso : '',
    oldestEpochIso: satelliteEpochs.length ? new Date(satelliteEpochs[0]).toISOString() : '',
    newestEpochIso: satelliteEpochs.length ? new Date(satelliteEpochs[satelliteEpochs.length - 1]).toISOString() : '',
  };
  const persistedDebris: FeedStatus = {
    state: currentDebrisGroups.every((status) => status.state === 'current') && debrisAvailableGroups.length === DEBRIS_GROUPS.length ? 'current' : debrisAvailableGroups.length ? 'cached' : historical ? 'historical' : 'unavailable',
    source: `CelesTrak GP groups: ${debrisAvailableGroups.map((status) => status.source.replace('CelesTrak ', '')).join(', ')}`,
    sourceUrl: currentDebrisGroups.map((status) => status.sourceUrl).join(' ; '), recordCount: debrisObjects.length,
    downloadTimestampIso: debrisGroupTimestamps.length ? new Date(Math.max(...debrisGroupTimestamps)).toISOString() : '',
    oldestEpochIso: debrisEpochs.length ? new Date(debrisEpochs[0]).toISOString() : '',
    newestEpochIso: debrisEpochs.length ? new Date(debrisEpochs[debrisEpochs.length - 1]).toISOString() : '',
    httpStatus: [...currentDebrisGroups].reverse().find((status) => status.httpStatus)?.httpStatus,
    responseDetail: [...currentDebrisGroups].reverse().find((status) => status.responseDetail)?.responseDetail,
    responseBody: [...currentDebrisGroups].reverse().find((status) => status.responseBody)?.responseBody,
    responseHeaders: [...currentDebrisGroups].reverse().find((status) => status.responseHeaders)?.responseHeaders,
    lastError: currentDebrisGroups.find((status) => status.lastError)?.lastError,
  };

  return {
    source: 'CelesTrak General Perturbations (GP) Orbit Data Service',
    sourceUrl: 'https://celestrak.org/NORAD/elements/',
    lastFetchedIso: lastSuccessfulFetchTimeMs ? new Date(lastSuccessfulFetchTimeMs).toISOString() : '',
    lastAttemptIso: lastFetchTimeMs ? new Date(lastFetchTimeMs).toISOString() : '',
    cacheExpiresIso: lastSuccessfulFetchTimeMs ? new Date(lastSuccessfulFetchTimeMs + CACHE_TTL_MS).toISOString() : '',
    retryAfterIso: retryAfterMs > Date.now() ? new Date(retryAfterMs).toISOString() : '',
    providerRefusalUntilIso: providerRefusalUntilMs > Date.now() ? new Date(providerRefusalUntilMs).toISOString() : '',
    totalObjects: cachedObjects.length,
    payloadsCount,
    debrisCount,
    unknownCount,
    usesHistoricalDebris: debrisObjects.length === 0 && debrisFeed.state === 'historical',
    isStale,
    isFallback: historical || !satelliteObjects.length,
    lastError: lastFetchError,
    satelliteFeed: historical ? { ...historicalFeed('satellite', satelliteObjects), httpStatus: persistedSatellite.httpStatus, responseDetail: historicalFeed('satellite', satelliteObjects).responseDetail || persistedSatellite.responseDetail, responseBody: persistedSatellite.responseBody, responseHeaders: persistedSatellite.responseHeaders, lastError: persistedSatellite.lastError } : staleFeed(persistedSatellite),
    debrisFeed: historical ? { ...historicalFeed('debris', debrisObjects), httpStatus: persistedDebris.httpStatus, responseDetail: historicalFeed('debris', debrisObjects).responseDetail || persistedDebris.responseDetail, responseBody: persistedDebris.responseBody, responseHeaders: persistedDebris.responseHeaders, lastError: persistedDebris.lastError } : staleFeed(persistedDebris),
    provenanceMode: historical ? 'historical' : 'current',
    liveAccessDisabled: historicalDemoMode,
    groups: persistedGroups,
  };
}
