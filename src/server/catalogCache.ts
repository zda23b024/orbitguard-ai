import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { OrbitalObject } from '../types/orbital';
import type { DataStatus } from '../services/celestrakService';

let lastSerialized = '';

function getCachePath(): string {
  const cacheDirectory = process.env.ORBITGUARD_CACHE_DIR?.trim() || path.join(tmpdir(), 'orbitguard-ai');
  return path.join(cacheDirectory, 'celestrak-catalog-cache.json');
}

export async function loadCatalogCache(): Promise<{ objects: OrbitalObject[]; status: Partial<DataStatus> } | null> {
  try {
    const contents = await readFile(getCachePath(), 'utf8');
    const parsed = JSON.parse(contents) as { objects?: unknown; status?: unknown };
    if (!Array.isArray(parsed.objects) || !parsed.status || typeof parsed.status !== 'object') return null;
    lastSerialized = contents;
    return { objects: parsed.objects as OrbitalObject[], status: parsed.status as Partial<DataStatus> };
  } catch {
    return null;
  }
}

export async function loadVerifiedProviderSnapshot(): Promise<{ objects: OrbitalObject[]; status: Partial<DataStatus> } | null> {
  try {
    const snapshotDir = path.resolve(process.cwd(), 'data', 'snapshots');
    const files = (await readdir(snapshotDir)).filter((name) => /^celestrak-gp-.*\.json$/i.test(name)).sort().reverse();
    for (const file of files) {
      const snapshot = JSON.parse(await readFile(path.join(snapshotDir, file), 'utf8')) as {
        schema?: string;
        capturedAtIso?: string;
        counts?: { acceptedPayloadRecords?: number; acceptedDebrisAndRocketBodyRecords?: number; totalRecords?: number };
        groups?: Record<string, {
          source?: string;
          sourceUrl?: string;
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
          bundledRecordCount?: number;
          oldestElementEpochIso?: string;
          newestElementEpochIso?: string;
        }>;
        objects?: OrbitalObject[];
        propagationAtCapture?: { valid?: number; invalid?: number };
      };
      if (snapshot.schema !== 'orbitguard-celestrak-gp-snapshot-v1'
        || !snapshot.capturedAtIso
        || !Array.isArray(snapshot.objects)
        || (snapshot.propagationAtCapture?.valid || 0) !== snapshot.objects.length
        || (snapshot.propagationAtCapture?.invalid || 0) !== 0) continue;
      const objects = snapshot.objects.filter((object) => object.dataMode === 'historical'
        && Number.isInteger(object.noradId) && object.noradId > 0
        && Number.isFinite(Date.parse(object.epoch))
        && Boolean(object.downloadedAtIso) && Boolean(object.source) && Boolean(object.dataGroup)
        && Boolean(object.omm && typeof object.omm === 'object'));
      const payloadCount = objects.filter((object) => object.classification === 'PAYLOAD').length;
      const debrisCount = objects.filter((object) => object.classification === 'DEBRIS' || object.classification === 'ROCKET BODY').length;
      const satelliteGroup = snapshot.groups?.active;
      if (payloadCount !== 1 || !objects.some((object) => object.classification === 'PAYLOAD' && object.noradId === 40697 && object.source.includes('CATNR=40697'))
        || satelliteGroup?.sourceUrl !== 'https://celestrak.org/NORAD/elements/gp.php?CATNR=40697&FORMAT=JSON'
        || satelliteGroup.httpStatus !== 200
        || satelliteGroup.acceptedRecordCount !== 1
        || !debrisCount
        || payloadCount + debrisCount !== objects.length
        || objects.length !== snapshot.counts?.totalRecords
        || payloadCount !== snapshot.counts?.acceptedPayloadRecords
        || debrisCount !== snapshot.counts?.acceptedDebrisAndRocketBodyRecords) continue;
      const groups = Object.fromEntries(Object.entries(snapshot.groups || {}).map(([key, group]) => [key, {
        source: group.source || `CelesTrak GP ${key}`,
        sourceUrl: group.sourceUrl || '',
        state: 'historical' as const,
        recordCount: group.bundledRecordCount || 0,
        downloadTimestampIso: group.downloadTimestampIso || '',
        oldestEpochIso: group.oldestElementEpochIso || '',
        newestEpochIso: group.newestElementEpochIso || '',
        lastAttemptIso: group.lastAttemptIso || group.downloadTimestampIso || snapshot.capturedAtIso,
        retryAfterIso: group.retryAfterIso || '',
        providerRefusalUntilIso: group.providerRefusalUntilIso || '',
        httpStatus: group.httpStatus,
        responseContentType: group.responseContentType,
        responseBodyType: group.responseBodyType,
        rawRecordCount: group.rawRecordCount,
        parsedRecordCount: group.parsedRecordCount,
        acceptedRecordCount: group.acceptedRecordCount,
        rejectedRecordCount: group.rejectedRecordCount,
        rejectionReasons: group.rejectionReasons,
      }]));
      return { objects, status: { lastFetchedIso: snapshot.capturedAtIso, lastAttemptIso: snapshot.capturedAtIso, groups } as Partial<DataStatus> };
    }
    return null;
  } catch {
    return null;
  }
}

export async function persistCatalogCache(objects: OrbitalObject[], status: DataStatus): Promise<void> {
  const contents = JSON.stringify({ objects, status });
  if (contents === lastSerialized) return;
  const filePath = getCachePath();
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(tempPath, contents, 'utf8');
    await rename(tempPath, filePath);
    lastSerialized = contents;
  } catch (error) {
    console.warn('Could not persist the public orbital catalog cache.', error instanceof Error ? error.message : 'unknown error');
  }
}
