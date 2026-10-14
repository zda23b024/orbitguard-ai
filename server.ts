/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  fetchOrbitalObjects,
  fetchSatellitePayloadSubset,
  getCachedOrbitalObjects,
  getDataStatus,
  setConfiguredRefusalCooldown,
  setHistoricalDemoMode,
  restoreCatalogCache,
} from './src/services/celestrakService';
import {
  analyzeCloseApproach,
  propagateObject,
  runScientificValidationSuite,
} from './src/services/orbitalEngine';
import { loadCatalogCache, loadVerifiedProviderSnapshot, persistCatalogCache } from './src/server/catalogCache';
import { createSyntheticEducationalPair } from './src/services/syntheticScenario';
import { formatObjectIdentifier } from './src/types/orbital';

dotenv.config();
setConfiguredRefusalCooldown(process.env.ORBITGUARD_CELESTRAK_REFUSAL_UNTIL);
setHistoricalDemoMode(process.env.ORBITGUARD_OFFLINE_MODE === 'true');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '32kb' }));

async function getCatalog(refreshAll = false) {
  const objects = refreshAll ? await fetchOrbitalObjects() : getCachedOrbitalObjects();
  // Offline presentation is a view only; never overwrite the saved provider cache with the intentionally empty demo catalog.
  if (process.env.ORBITGUARD_OFFLINE_MODE !== 'true') await persistCatalogCache(objects, getDataStatus());
  return objects;
}

// 1. Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'OrbitGuard AI Scientific Engine',
    competition: 'ZASS Space Science Innovation Competition 2026',
    timestamp: new Date().toISOString(),
  });
});

// 2. Objects Catalog
app.get('/api/objects', async (req: Request, res: Response) => {
  try {
    let objects: Awaited<ReturnType<typeof fetchOrbitalObjects>>;
    if (req.query.refresh === 'satellite') {
      objects = await fetchSatellitePayloadSubset();
      if (process.env.ORBITGUARD_OFFLINE_MODE !== 'true') await persistCatalogCache(objects, getDataStatus());
    } else {
      objects = await getCatalog(req.query.refresh === 'true');
    }
    res.json(objects);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve orbital catalog', details: err?.message });
  }
});

// 3. Single Object
app.get('/api/objects/:norad_id', async (req: Request, res: Response) => {
  try {
    const noradId = Number(req.params.norad_id);
    if (!Number.isInteger(noradId) || noradId <= 0) {
      res.status(400).json({ error: 'NORAD identifier must be a positive integer.' });
      return;
    }
    const objects = await getCatalog();
    const found = objects.find((o) => o.noradId === noradId);
    if (!found) {
      res.status(404).json({ error: `Object #${noradId} not found in catalog` });
      return;
    }
    res.json(found);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// 4. Object Positions at Timestamp
app.get('/api/positions', async (req: Request, res: Response) => {
  try {
    const timeParam = req.query.timestamp as string | undefined;
    const date = timeParam ? new Date(timeParam) : new Date();
    if (!Number.isFinite(date.getTime())) {
      res.status(400).json({ error: 'timestamp must be a valid ISO date.' });
      return;
    }
    const objects = await getCatalog();

    const positions = objects.map((obj) => {
      const prop = propagateObject(obj, date);
      return {
        noradId: obj.noradId,
        name: obj.name,
        classification: obj.classification,
        positionEci: prop.positionEci,
        velocityEci: prop.velocityEci,
        speedKmS: prop.speedKmS,
        geodetic: prop.geodetic,
        valid: prop.valid,
      };
    });

    res.json({ timestamp: date.toISOString(), count: positions.length, positions });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// 5. Close Approach Analysis
app.post('/api/encounters/analyze', async (req: Request, res: Response) => {
  try {
    const {
      satelliteId,
      debrisId,
      startTime,
      timeWindowHours = 24,
      thresholdKm = 25,
    } = req.body;

    const objects = await getCatalog();
    const sat = objects.find((o) => o.id === String(satelliteId));
    const deb = objects.find((o) => o.id === String(debrisId));

    if (!sat || !deb) {
      res.status(400).json({
        error: 'Invalid satellite or debris identifier provided.',
      });
      return;
    }

    if (sat.classification !== 'PAYLOAD' || (deb.classification !== 'DEBRIS' && deb.classification !== 'ROCKET BODY')) {
      res.status(400).json({ error: 'Choose a payload satellite and a debris or rocket-body object.' });
      return;
    }
    if (sat.dataMode !== deb.dataMode || sat.isSynthetic || deb.isSynthetic) {
      res.status(400).json({ error: 'Choose satellite and debris records from the same catalog mode. Synthetic objects must be analyzed in their dedicated educational scenario.' });
      return;
    }

    const startDate = startTime ? new Date(startTime) : new Date();
    if (!Number.isFinite(startDate.getTime())) {
      res.status(400).json({ error: 'startTime must be a valid ISO date.' });
      return;
    }
    if (!Number.isFinite(timeWindowHours) || timeWindowHours <= 0 || timeWindowHours > 168 || !Number.isFinite(thresholdKm) || thresholdKm <= 0) {
      res.status(400).json({ error: 'timeWindowHours must be in (0, 168] and thresholdKm must be positive.' });
      return;
    }
    const result = analyzeCloseApproach(sat, deb, startDate, timeWindowHours, thresholdKm);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to compute encounter analysis', details: err?.message });
  }
});

// Optional language-only explanation. The server recomputes the analysis from object IDs.
app.post('/api/ai/explain', async (req: Request, res: Response) => {
  try {
    const { satelliteId, debrisId, startTime, timeWindowHours = 24, thresholdKm = 25 } = req.body;
    const objects = [...await getCatalog(), ...createSyntheticEducationalPair()];
    const sat = objects.find((o) => o.id === String(satelliteId));
    const deb = objects.find((o) => o.id === String(debrisId));
    const startDate = new Date(startTime);
    if (!sat || sat.classification !== 'PAYLOAD' || !deb || !['DEBRIS', 'ROCKET BODY'].includes(deb.classification)) {
      res.status(400).json({ error: 'Choose a catalog payload and debris or rocket-body object.' });
      return;
    }
    if ((sat.isSynthetic || deb.isSynthetic) && !(sat.isSynthetic && deb.isSynthetic)) {
      res.status(400).json({ error: 'Synthetic explanations require the complete synthetic educational pair.' });
      return;
    }
    if (!sat.isSynthetic && sat.dataMode !== deb.dataMode) {
      res.status(400).json({ error: 'Choose satellite and debris records from the same catalog mode.' });
      return;
    }
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(timeWindowHours) || timeWindowHours <= 0 || timeWindowHours > 168 || !Number.isFinite(thresholdKm) || thresholdKm <= 0) {
      res.status(400).json({ error: 'Provide a valid startTime, timeWindowHours in (0, 168], and positive thresholdKm.' });
      return;
    }

    const analysis = analyzeCloseApproach(sat, deb, startDate, timeWindowHours, thresholdKm);
    const historicalSnapshot = !sat.isSynthetic && sat.dataMode === 'historical';
    const snapshotCapturedAt = sat.snapshotCapturedAtIso || deb.snapshotCapturedAtIso;
    const summary = [
      'SCIENTIFIC SCREENING SUMMARY',
      `OBJECTS: ${sat.name} (${formatObjectIdentifier(sat)}) and ${deb.name} (${formatObjectIdentifier(deb)})`,
      `ELEMENT EPOCHS: ${sat.epoch}; ${deb.epoch}`,
      ...(historicalSnapshot ? [`DATA MODE: verified historical provider snapshot${snapshotCapturedAt ? ` captured ${snapshotCapturedAt}` : ''}; not current orbital data.`] : []),
      ...((sat.isSynthetic || deb.isSynthetic) ? ['SCENARIO: synthetic controlled-orbit demonstration; not an observed conjunction or a real-world warning.'] : []),
      `ESTIMATED CLOSEST APPROACH: ${analysis.tCaIso} UTC`,
      `ESTIMATED SEPARATION: ${analysis.minSeparationKm.toFixed(3)} km`,
      `RELATIVE SPEED: ${analysis.relativeSpeedKmS.toFixed(3)} km/s`,
      `EDUCATIONAL SCREEN: ${analysis.educationalThresholdKm} km; ${analysis.screeningFlag ? 'estimated separation is within the screen' : 'estimated separation is above the screen'}`,
      `LIMITATIONS: Element ages at calculation time are ${analysis.dataFreshnessHours.satellite} h and ${analysis.dataFreshnessHours.debris} h. The application does not calculate positional uncertainty or collision probability, and does not recommend maneuvers.`,
    ].join('\n');

    const deterministicExplanation = `${sat.isSynthetic || deb.isSynthetic ? 'This is a synthetic controlled-orbit demonstration, not an observed conjunction. ' : historicalSnapshot ? `This analysis uses a verified historical provider snapshot${snapshotCapturedAt ? ` captured ${snapshotCapturedAt}` : ''}; it is not current orbital data. ` : ''}The time and minimum distance identify the closest point found within the selected search window. Relative speed is calculated from the two propagated velocity vectors. The configured distance is an educational screen; the application does not quantify uncertainty or make an operational safety decision.`;
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (process.env.ORBITGUARD_DISABLE_GEMINI === 'true' || !apiKey) {
      res.json({ summary, explanation: deterministicExplanation, source: 'deterministic' });
      return;
    }

    try {
      const client = new GoogleGenAI({ apiKey });
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 12_000);
      let response;
      try {
        response = await client.models.generateContent({
          model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
          contents: JSON.stringify({
            estimatedSeparationKm: analysis.minSeparationKm,
            relativeSpeedKmS: analysis.relativeSpeedKmS,
            thresholdKm: analysis.educationalThresholdKm,
            withinEducationalScreen: analysis.screeningFlag,
            syntheticScenario: Boolean(sat.isSynthetic || deb.isSynthetic),
            inputEpochs: [sat.epoch, deb.epoch],
          }),
          config: {
            systemInstruction: 'Explain in two short sentences what the supplied orbital-screening measurements mean for an educational audience. Do not restate numbers or dates. If syntheticScenario is true, clearly state that the scenario uses controlled synthetic orbital elements and is not an observed conjunction. Do not claim or estimate collision probability, collision likelihood, safety, risk, or a need for a maneuver. Do not invent any measurement, uncertainty, data source, or model result. Explain that a configured threshold is only an educational screen and these estimates are not operational guidance.',
            temperature: 0.1,
            maxOutputTokens: 120,
            abortSignal: abort.signal,
          },
        });
      } finally {
        clearTimeout(timeout);
      }
      const explanation = response.text?.trim() || '';
      const disallowed = /\d|probab|chance|odds|likelihood|collis|maneuver|safe|risk|danger|threat|avoid|predict|guarantee|certain|priority|score|hazard|warning|urgent|critical|recommend|decision|reliab|accurac|confiden|uncertain|overlap|intersect|impact/i;
      if (!explanation || explanation.length > 600 || disallowed.test(explanation) || /https?:\/\//i.test(explanation)) {
        res.json({ summary, explanation: deterministicExplanation, source: 'deterministic' });
        return;
      }
      res.json({ summary, explanation, source: 'gemini' });
    } catch (error) {
      console.warn('Gemini explanation unavailable; returning deterministic explanation.');
      res.json({ summary, explanation: deterministicExplanation, source: 'deterministic' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Could not compute a verified explanation from the supplied catalog objects.' });
  }
});

// 6. Data Status
app.get('/api/data/status', (_req: Request, res: Response) => {
  const status = getDataStatus();
  res.json(status);
});

// 7. Automated Scientific Validation Tests
app.get(['/api/validation', '/api/validation/run'], (_req: Request, res: Response) => {
  const summary = runScientificValidationSuite();
  res.json(summary);
});

// Vite Development Middleware vs Production Static Serve
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const cachedCatalog = await loadCatalogCache();
  if (process.env.ORBITGUARD_OFFLINE_MODE === 'true') {
    if (cachedCatalog) restoreCatalogCache([], cachedCatalog.status);
    const snapshot = await loadVerifiedProviderSnapshot();
    if (snapshot) restoreCatalogCache(snapshot.objects, snapshot.status);
  } else if (cachedCatalog) {
    restoreCatalogCache(cachedCatalog.objects, cachedCatalog.status);
  }

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OrbitGuard AI server ready on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting OrbitGuard AI server:', err);
  process.exit(1);
});
