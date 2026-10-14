import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { analyzeCloseApproach, propagateObject, calculateSeparationKm, runScientificValidationSuite } from '../src/services/orbitalEngine.ts';
import { createSyntheticEducationalPair, SYNTHETIC_SCENARIO_START, SYNTHETIC_SCENARIO_WINDOW_HOURS, SYNTHETIC_SCENARIO_THRESHOLD_KM } from '../src/services/syntheticScenario.ts';

// Local-only verification: each server boots with an empty temporary cache and
// an outbound fetch trap. No provider or language-model request is permitted.
const snapshot = JSON.parse(await readFile('data/snapshots/celestrak-gp-20261014T183324Z.json', 'utf8'));
const sat = snapshot.objects.find((o: any) => o.noradId === 40697);
const debris = snapshot.objects.find((o: any) => o.noradId === 31946);
const start = new Date('2026-10-14T18:31:56.000Z');
const result = analyzeCloseApproach(sat, debris, start, 24, 25);
const distance = (ms: number) => calculateSeparationKm(propagateObject(sat, new Date(ms)).positionEci, propagateObject(debris, new Date(ms)).positionEci);
let best = { ms: start.getTime(), km: Infinity };
for (let ms = start.getTime(); ms <= start.getTime() + 86400000; ms += 1000) {
  const km = distance(ms);
  if (km < best.km) best = { ms, km };
}
const coarseBest = best.ms;
for (let ms = coarseBest - 1000; ms <= coarseBest + 1000; ms++) {
  const km = distance(ms);
  if (km < best.km) best = { ms, km };
}
console.log('Numerical comparison', { reportedKm: result.minSeparationKm, fineKm: best.km, reportedTime: result.tCaIso, fineTime: new Date(best.ms).toISOString() });
assert.ok(Math.abs(result.minSeparationKm - best.km) < 0.0005, 'reported separation agrees with fine sampling to displayed rounding');
assert.ok(Math.abs(result.tCaTimestampMs - best.ms) <= 2, 'closest time agrees within 2 milliseconds');
assert.equal(result.distanceProfile.length, 91);
assert.equal(result.endTimeIso, '2026-10-15T18:31:56.000Z');
for (const object of snapshot.objects) {
  assert.equal(object.isSynthetic || false, false);
  assert.equal(object.noradId, Number(object.omm.NORAD_CAT_ID));
  assert.equal(object.epoch, new Date(`${object.omm.EPOCH}Z`).toISOString());
  assert.equal(object.downloadedAtIso, snapshot.groups[object.dataGroup].downloadTimestampIso);
  assert.ok(propagateObject(object, new Date(snapshot.capturedAtIso)).valid);
}
const validation = runScientificValidationSuite();
assert.equal(validation.failed, 0);
const synthetic = createSyntheticEducationalPair();
const syntheticResult = analyzeCloseApproach(synthetic[0], synthetic[1], new Date(SYNTHETIC_SCENARIO_START), SYNTHETIC_SCENARIO_WINDOW_HOURS, SYNTHETIC_SCENARIO_THRESHOLD_KM);
assert.ok(syntheticResult.screeningFlag && syntheticResult.satellite.isSynthetic && syntheticResult.debris.isSynthetic);
console.log(JSON.stringify({ scientific: `${validation.passed}/${validation.total}`, propagated: snapshot.objects.length, epochs: [sat.epoch, debris.epoch], downloaded: [sat.downloadedAtIso, debris.downloadedAtIso], window: [result.startTimeIso, result.endTimeIso], reported: { km: result.minSeparationKm, speedKmS: result.relativeSpeedKmS, tCa: result.tCaIso }, fineSampling: { km: best.km, tCa: new Date(best.ms).toISOString(), differenceMetres: Math.abs(best.km - result.minSeparationKm) * 1000 }, synthetic: { km: syntheticResult.minSeparationKm, tCa: syntheticResult.tCaIso } }, null, 2));

const port = 3107;
const base = `http://127.0.0.1:${port}`;
const request = async (route: string, body?: unknown) => {
  const response = await fetch(base + route, { signal: AbortSignal.timeout(5000), ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  assert.ok(response.ok, `${route}: ${response.status}`);
  return response;
};
for (let boot = 1; boot <= 2; boot++) {
  const emptyCache = await mkdtemp(path.join(tmpdir(), 'orbitguard-offline-verification-'));
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', "globalThis.fetch=async()=>{console.error('OUTBOUND REQUEST BLOCKED');throw new Error('Network disabled during verification');};await import('./server.ts');"], {
    env: { ...process.env, TMP: emptyCache, TEMP: emptyCache, NODE_ENV: 'production', PORT: String(port), ORBITGUARD_OFFLINE_MODE: 'true', ORBITGUARD_DISABLE_GEMINI: 'true' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (data) => { output += data; });
  child.stderr.on('data', (data) => { output += data; });
  const deadline = setTimeout(() => child.kill(), 20000);
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Server startup timeout: ${output}`)), 10000);
      child.stdout.on('data', () => { if (output.includes('server ready')) { clearTimeout(timer); resolve(); } });
      child.once('error', reject);
      child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${output}`)); });
    });
    const catalog = await (await request('/api/objects')).json();
    assert.equal(catalog.length, 2676);
    assert.ok(catalog.every((o: any) => o.dataMode === 'historical'));
    const status = await (await request('/api/data/status')).json();
    assert.equal(status.provenanceMode, 'historical');
    const body = { satelliteId: sat.id, debrisId: debris.id, startTime: start.toISOString(), timeWindowHours: 24, thresholdKm: 25 };
    const apiResult = await (await request('/api/encounters/analyze', body)).json();
    assert.equal(apiResult.minSeparationKm, result.minSeparationKm);
    assert.equal(apiResult.tCaIso, result.tCaIso);
    const explanation = await (await request('/api/ai/explain', body)).json();
    assert.equal(explanation.source, 'deterministic');
    assert.ok(explanation.summary.includes(`${result.minSeparationKm.toFixed(3)} km`));
    assert.match(explanation.summary, /historical/);
    const syntheticExplanation = await (await request('/api/ai/explain', { satelliteId: synthetic[0].id, debrisId: synthetic[1].id, startTime: SYNTHETIC_SCENARIO_START, timeWindowHours: SYNTHETIC_SCENARIO_WINDOW_HOURS, thresholdKm: SYNTHETIC_SCENARIO_THRESHOLD_KM })).json();
    assert.equal(syntheticExplanation.source, 'deterministic');
    assert.match(syntheticExplanation.summary, /synthetic/);
    assert.equal((await (await request('/api/validation')).json()).failed, 0);
    const html = await (await request('/')).text();
    const asset = html.match(/src="([^"]+\/assets\/[^\"]+|\/assets\/[^\"]+)"/)?.[1];
    assert.ok(asset, 'production HTML references built JavaScript');
    await request(asset);
    assert.ok(!output.includes('OUTBOUND REQUEST BLOCKED'), output);
    console.log(`PASS production boot ${boot}: empty temp cache, 2676 historical objects, encounter, deterministic real/synthetic explanations, validation, HTML and JS; zero outbound fetch attempts`);
  } finally {
    clearTimeout(deadline);
    if (child.exitCode === null) {
      const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
      child.kill();
      await exited;
    }
  }
}
