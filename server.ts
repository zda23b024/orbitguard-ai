/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  CATALOGUED_ORBITAL_OBJECTS,
  fetchOrbitalObjects,
  getDataStatus,
} from './src/services/celestrakService';
import {
  analyzeCloseApproach,
  propagateObject,
  runScientificValidationSuite,
} from './src/services/orbitalEngine';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

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
app.get('/api/objects', async (_req: Request, res: Response) => {
  try {
    const objects = await fetchOrbitalObjects();
    res.json(objects);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve orbital catalog', details: err?.message });
  }
});

// 3. Single Object
app.get('/api/objects/:norad_id', async (req: Request, res: Response) => {
  try {
    const noradId = Number(req.params.norad_id);
    const objects = await fetchOrbitalObjects();
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
    const objects = await fetchOrbitalObjects();

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

    const objects = await fetchOrbitalObjects();
    const sat = objects.find((o) => o.id === String(satelliteId));
    const deb = objects.find((o) => o.id === String(debrisId));

    if (!sat || !deb) {
      res.status(400).json({
        error: 'Invalid satellite or debris identifier provided.',
      });
      return;
    }

    const startDate = startTime ? new Date(startTime) : new Date();
    const result = analyzeCloseApproach(sat, deb, startDate, timeWindowHours, thresholdKm);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to compute encounter analysis', details: err?.message });
  }
});

// 6. Data Status
app.get('/api/data/status', (_req: Request, res: Response) => {
  const status = getDataStatus();
  res.json(status);
});

// 7. Automated Scientific Validation Tests
app.get('/api/validation/run', (_req: Request, res: Response) => {
  const summary = runScientificValidationSuite();
  res.json(summary);
});

// 8. Gemini AI Briefing Endpoint
app.post('/api/ai/briefing', async (req: Request, res: Response) => {
  try {
    const { encounter } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      res.status(200).json({
        briefing:
          `SCIENTIFIC CONJUNCTION BRIEFING FOR ZASS JUDGES (PHYSICS ENGINE SYNTHESIS):\n\n` +
          `Primary Encounter: ${encounter.satellite.name} (#${encounter.satellite.noradId}) vs ${encounter.debris.name} (#${encounter.debris.noradId})\n` +
          `Epoch of Closest Approach: ${encounter.tCaIso} UTC\n` +
          `Minimum Euclidean Separation: ${encounter.minSeparationKm.toFixed(3)} km\n` +
          `Relative Closing Velocity: ${encounter.relativeSpeedKmS.toFixed(3)} km/s (${(encounter.relativeSpeedKmS * 3600).toFixed(0)} km/h)\n` +
          `Kinetic Energy Factor: ${encounter.kineticEnergyMjPerKg.toFixed(1)} MJ/kg\n\n` +
          `Analytical Assessment: Geometry exhibits high closing velocity crossing in LEO. Screening priority score of ${encounter.mlScreening.riskScore}/100 ` +
          `reflects elevated proximity within the ${encounter.educationalThresholdKm} km buffer.`,
      });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are the lead orbital mechanics scientist presenting OrbitGuard AI to the judges of the Zanzibar Astronomy and Space Society (ZASS) Space Science Innovation Competition 2026.
Generate a concise, scientifically rigorous, 3-paragraph executive conjunction assessment memorandum for this encounter:
- Satellite: ${encounter.satellite.name} (NORAD #${encounter.satellite.noradId}, Class: ${encounter.satellite.orbitClass})
- Debris: ${encounter.debris.name} (NORAD #${encounter.debris.noradId}, Class: ${encounter.debris.classification})
- Estimated Time of Closest Approach: ${encounter.tCaIso} UTC
- Minimum Separation: ${encounter.minSeparationKm} km (Screening threshold: ${encounter.educationalThresholdKm} km)
- Relative Velocity: ${encounter.relativeSpeedKmS} km/s
- Kinetic Energy Density: ${encounter.kineticEnergyMjPerKg} MJ/kg
- Screening ML Risk Score: ${encounter.mlScreening.riskScore}/100 (${encounter.mlScreening.riskTier})

Address:
1. Encounter Geometry & Kinetic severity (compare with hypervelocity impact energy).
2. Ephemeris uncertainty & SGP4 error growth (atmospheric drag in LEO).
3. Educational takeaways for ZASS emerging researchers and space sustainability in East Africa.
Maintain a professional, scientifically honest tone without exaggerating collision certainty.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    res.json({ briefing: response.text });
  } catch (err: any) {
    res.status(200).json({
      briefing:
        `SCIENTIFIC ASSESSMENT MEMORANDUM (LOCAL ENGINE):\n\n` +
        `The analyzed encounter demonstrates a ${req.body?.encounter?.minSeparationKm?.toFixed(2)} km approach between ${req.body?.encounter?.satellite?.name} and ${req.body?.encounter?.debris?.name}. ` +
        `Relative closing velocity of ${req.body?.encounter?.relativeSpeedKmS?.toFixed(2)} km/s highlights the severe kinetic consequences of hypervelocity orbital encounters in Low Earth Orbit.`,
    });
  }
});

// Vite Development Middleware vs Production Static Serve
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

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
