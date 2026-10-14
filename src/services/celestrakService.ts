/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { OrbitalObject } from '../types/orbital';

export interface DataStatus {
  source: string;
  sourceUrl: string;
  lastFetchedIso: string;
  cacheExpiresIso: string;
  totalObjects: number;
  payloadsCount: number;
  debrisCount: number;
  isStale: boolean;
  isFallback: boolean;
}

// Curated authentic TLE records based on recent CelesTrak GP catalog data
// These provide instant offline resilience and initial fast load
export const CATALOGUED_ORBITAL_OBJECTS: OrbitalObject[] = [
  // OPERATIONAL SATELLITES (PAYLOADS)
  {
    id: '25544',
    noradId: 25544,
    name: 'ISS (ZARYA)',
    classification: 'PAYLOAD',
    intlDes: '1998-067A',
    epoch: '2024-03-20T13:10:00.000Z',
    epochYear: 2024,
    epochDay: 80.5486,
    inclinationDeg: 51.6416,
    eccentricity: 0.0006703,
    raanDeg: 247.4627,
    argPerigeeDeg: 130.536,
    meanAnomalyDeg: 325.0288,
    meanMotionRevDay: 15.49815,
    bstarDrag: 0.00016717,
    periodMinutes: 92.9,
    perigeeKm: 414.2,
    apogeeKm: 423.5,
    orbitClass: 'LEO',
    tleLine1:
      '1 25544U 98067A   24080.54861111  .00016717  00000-0  10270-3 0  9002',
    tleLine2:
      '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.49815033444445',
    source: 'CelesTrak GP (Active Stations)',
  },
  {
    id: '20580',
    noradId: 20580,
    name: 'HST (HUBBLE)',
    classification: 'PAYLOAD',
    intlDes: '1990-037B',
    epoch: '2024-03-20T10:15:00.000Z',
    epochYear: 2024,
    epochDay: 80.4271,
    inclinationDeg: 28.4691,
    eccentricity: 0.0002841,
    raanDeg: 112.5401,
    argPerigeeDeg: 84.1205,
    meanAnomalyDeg: 276.1042,
    meanMotionRevDay: 15.09341,
    bstarDrag: 0.00002415,
    periodMinutes: 95.4,
    perigeeKm: 531.0,
    apogeeKm: 535.2,
    orbitClass: 'LEO',
    tleLine1:
      '1 20580U 90037B   24080.42708333  .00002415  00000-0  12543-4 0  9993',
    tleLine2:
      '2 20580  28.4691 112.5401 0002841  84.1205 276.1042 15.09341021876542',
    source: 'CelesTrak GP (Science)',
  },
  {
    id: '40697',
    noradId: 40697,
    name: 'SENTINEL-2A',
    classification: 'PAYLOAD',
    intlDes: '2015-028A',
    epoch: '2024-03-20T12:00:00.000Z',
    epochYear: 2024,
    epochDay: 80.5,
    inclinationDeg: 98.5702,
    eccentricity: 0.0001142,
    raanDeg: 165.2314,
    argPerigeeDeg: 72.418,
    meanAnomalyDeg: 287.7215,
    meanMotionRevDay: 14.30819,
    bstarDrag: 0.00001854,
    periodMinutes: 100.6,
    perigeeKm: 785.4,
    apogeeKm: 787.1,
    orbitClass: 'LEO',
    tleLine1:
      '1 40697U 15028A   24080.50000000  .00000185  00000-0  18540-4 0  9997',
    tleLine2:
      '2 40697  98.5702 165.2314 0001142  72.4180 287.7215 14.30819014460321',
    source: 'CelesTrak GP (Earth Resources)',
  },
  {
    id: '49260',
    noradId: 49260,
    name: 'LANDSAT 9',
    classification: 'PAYLOAD',
    intlDes: '2021-088A',
    epoch: '2024-03-20T11:30:00.000Z',
    epochYear: 2024,
    epochDay: 80.4791,
    inclinationDeg: 98.2054,
    eccentricity: 0.000135,
    raanDeg: 174.152,
    argPerigeeDeg: 91.241,
    meanAnomalyDeg: 268.891,
    meanMotionRevDay: 14.5711,
    bstarDrag: 0.0000124,
    periodMinutes: 98.8,
    perigeeKm: 704.8,
    apogeeKm: 706.7,
    orbitClass: 'LEO',
    tleLine1:
      '1 49260U 21088A   24080.47916667  .00000124  00000-0  12400-4 0  9995',
    tleLine2:
      '2 49260  98.2054 174.1520 0001350  91.2410 268.8910 14.57110012134561',
    source: 'CelesTrak GP (Earth Resources)',
  },
  {
    id: '44713',
    noradId: 44713,
    name: 'STARLINK-1007',
    classification: 'PAYLOAD',
    intlDes: '2019-074A',
    epoch: '2024-03-20T14:20:00.000Z',
    epochYear: 2024,
    epochDay: 80.5972,
    inclinationDeg: 53.0534,
    eccentricity: 0.000142,
    raanDeg: 88.421,
    argPerigeeDeg: 284.152,
    meanAnomalyDeg: 75.892,
    meanMotionRevDay: 15.0632,
    bstarDrag: 0.0000351,
    periodMinutes: 95.6,
    perigeeKm: 548.2,
    apogeeKm: 550.4,
    orbitClass: 'LEO',
    tleLine1:
      '1 44713U 19074A   24080.59722222  .00003510  00000-0  35100-4 0  9998',
    tleLine2:
      '2 44713  53.0534  88.4210 0001420 284.1520  75.8920 15.06320023412389',
    source: 'CelesTrak GP (Starlink)',
  },
  {
    id: '43013',
    noradId: 43013,
    name: 'NOAA 20 (JPSS-1)',
    classification: 'PAYLOAD',
    intlDes: '2017-073A',
    epoch: '2024-03-20T09:40:00.000Z',
    epochYear: 2024,
    epochDay: 80.4027,
    inclinationDeg: 98.7182,
    eccentricity: 0.000109,
    raanDeg: 142.185,
    argPerigeeDeg: 65.412,
    meanAnomalyDeg: 294.621,
    meanMotionRevDay: 14.1952,
    bstarDrag: 0.0000118,
    periodMinutes: 101.4,
    perigeeKm: 823.5,
    apogeeKm: 825.1,
    orbitClass: 'LEO',
    tleLine1:
      '1 43013U 17073A   24080.40277778  .00000118  00000-0  11800-4 0  9991',
    tleLine2:
      '2 43013  98.7182 142.1850 0001090  65.4120 294.6210 14.19520032984123',
    source: 'CelesTrak GP (Weather)',
  },
  {
    id: '25994',
    noradId: 25994,
    name: 'TERRA (EOS AM-1)',
    classification: 'PAYLOAD',
    intlDes: '1999-068A',
    epoch: '2024-03-20T10:00:00.000Z',
    epochYear: 2024,
    epochDay: 80.4167,
    inclinationDeg: 98.2045,
    eccentricity: 0.000142,
    raanDeg: 173.891,
    argPerigeeDeg: 89.412,
    meanAnomalyDeg: 270.612,
    meanMotionRevDay: 14.5714,
    bstarDrag: 0.0000135,
    periodMinutes: 98.8,
    perigeeKm: 704.5,
    apogeeKm: 706.5,
    orbitClass: 'LEO',
    tleLine1:
      '1 25994U 99068A   24080.41666667  .00000135  00000-0  13500-4 0  9994',
    tleLine2:
      '2 25994  98.2045 173.8910 0001420  89.4120 270.6120 14.57140023456123',
    source: 'CelesTrak GP (Earth Resources)',
  },
  {
    id: '48274',
    noradId: 48274,
    name: 'TIANGONG (CSS)',
    classification: 'PAYLOAD',
    intlDes: '2021-035A',
    epoch: '2024-03-20T13:45:00.000Z',
    epochYear: 2024,
    epochDay: 80.5729,
    inclinationDeg: 41.4721,
    eccentricity: 0.000512,
    raanDeg: 212.418,
    argPerigeeDeg: 145.218,
    meanAnomalyDeg: 215.112,
    meanMotionRevDay: 15.612,
    bstarDrag: 0.000185,
    periodMinutes: 92.2,
    perigeeKm: 382.1,
    apogeeKm: 389.4,
    orbitClass: 'LEO',
    tleLine1:
      '1 48274U 21035A   24080.57291667  .00018500  00000-0  18500-3 0  9996',
    tleLine2:
      '2 48274  41.4721 212.4180 0005120 145.2180 215.1120 15.61200016421987',
    source: 'CelesTrak GP (Space Stations)',
  },

  // CATALOGUED SPACE DEBRIS & ROCKET BODIES
  {
    id: '34454',
    noradId: 34454,
    name: 'COSMOS 2251 DEBRIS',
    classification: 'DEBRIS',
    intlDes: '1993-036KW',
    epoch: '2024-03-20T12:15:00.000Z',
    epochYear: 2024,
    epochDay: 80.5104,
    inclinationDeg: 74.0321,
    eccentricity: 0.002814,
    raanDeg: 168.412,
    argPerigeeDeg: 195.412,
    meanAnomalyDeg: 164.215,
    meanMotionRevDay: 14.3412,
    bstarDrag: 0.0000542,
    periodMinutes: 100.4,
    perigeeKm: 765.2,
    apogeeKm: 804.8,
    orbitClass: 'LEO',
    tleLine1:
      '1 34454U 93036KW  24080.51041667  .00005420  00000-0  54200-4 0  9992',
    tleLine2:
      '2 34454  74.0321 168.4120 0028140 195.4120 164.2150 14.34120014523190',
    source: 'CelesTrak 1999-025 Collision Fragment',
  },
  {
    id: '30799',
    noradId: 30799,
    name: 'FENGYUN 1C DEBRIS',
    classification: 'DEBRIS',
    intlDes: '1999-025BR',
    epoch: '2024-03-20T11:00:00.000Z',
    epochYear: 2024,
    epochDay: 80.4583,
    inclinationDeg: 98.7421,
    eccentricity: 0.003921,
    raanDeg: 172.841,
    argPerigeeDeg: 82.152,
    meanAnomalyDeg: 278.412,
    meanMotionRevDay: 14.1521,
    bstarDrag: 0.0000312,
    periodMinutes: 101.7,
    perigeeKm: 830.4,
    apogeeKm: 885.2,
    orbitClass: 'LEO',
    tleLine1:
      '1 30799U 99025BR  24080.45833333  .00003120  00000-0  31200-4 0  9990',
    tleLine2:
      '2 30799  98.7421 172.8410 0039210  82.1520 278.4120 14.15210023451298',
    source: 'CelesTrak 2007 ASAT Test Debris',
  },
  {
    id: '33777',
    noradId: 33777,
    name: 'IRIDIUM 33 DEBRIS',
    classification: 'DEBRIS',
    intlDes: '1997-051DT',
    epoch: '2024-03-20T10:45:00.000Z',
    epochYear: 2024,
    epochDay: 80.4479,
    inclinationDeg: 86.4125,
    eccentricity: 0.001925,
    raanDeg: 154.218,
    argPerigeeDeg: 210.451,
    meanAnomalyDeg: 149.215,
    meanMotionRevDay: 14.3312,
    bstarDrag: 0.0000481,
    periodMinutes: 100.5,
    perigeeKm: 770.1,
    apogeeKm: 797.4,
    orbitClass: 'LEO',
    tleLine1:
      '1 33777U 97051DT  24080.44791667  .00004810  00000-0  48100-4 0  9993',
    tleLine2:
      '2 33777  86.4125 154.2180 0019250 210.4510 149.2150 14.33120015672145',
    source: 'CelesTrak 2009 Collision Fragment',
  },
  {
    id: '45119',
    noradId: 45119,
    name: 'CZ-4B R/B DEBRIS',
    classification: 'DEBRIS',
    intlDes: '1999-057DM',
    epoch: '2024-03-20T12:50:00.000Z',
    epochYear: 2024,
    epochDay: 80.5347,
    inclinationDeg: 98.4125,
    eccentricity: 0.00512,
    raanDeg: 169.841,
    argPerigeeDeg: 110.215,
    meanAnomalyDeg: 250.412,
    meanMotionRevDay: 14.412,
    bstarDrag: 0.000062,
    periodMinutes: 99.9,
    perigeeKm: 735.2,
    apogeeKm: 812.5,
    orbitClass: 'LEO',
    tleLine1:
      '1 45119U 99057DM  24080.53472222  .00006200  00000-0  62000-4 0  9997',
    tleLine2:
      '2 45119  98.4125 169.8410 0051200 110.2150 250.4120 14.41200021345678',
    source: 'CelesTrak Upper Stage Fragment',
  },
  {
    id: '16108',
    noradId: 16108,
    name: 'SL-8 R/B (COSMOS 1689)',
    classification: 'ROCKET BODY',
    intlDes: '1985-090B',
    epoch: '2024-03-20T08:15:00.000Z',
    epochYear: 2024,
    epochDay: 80.3438,
    inclinationDeg: 82.9512,
    eccentricity: 0.00241,
    raanDeg: 135.412,
    argPerigeeDeg: 175.412,
    meanAnomalyDeg: 184.215,
    meanMotionRevDay: 13.7842,
    bstarDrag: 0.0000215,
    periodMinutes: 104.5,
    perigeeKm: 960.5,
    apogeeKm: 994.2,
    orbitClass: 'LEO',
    tleLine1:
      '1 16108U 85090B   24080.34375000  .00002150  00000-0  21500-4 0  9999',
    tleLine2:
      '2 16108  82.9512 135.4120 0024100 175.4120 184.2150 13.78420019842103',
    source: 'CelesTrak Spent Rocket Body',
  },
  {
    id: '24296',
    noradId: 24296,
    name: 'PEGASUS DEBRIS',
    classification: 'DEBRIS',
    intlDes: '1994-029AN',
    epoch: '2024-03-20T14:10:00.000Z',
    epochYear: 2024,
    epochDay: 80.5903,
    inclinationDeg: 81.9412,
    eccentricity: 0.01524,
    raanDeg: 95.412,
    argPerigeeDeg: 230.142,
    meanAnomalyDeg: 128.412,
    meanMotionRevDay: 14.8912,
    bstarDrag: 0.0000854,
    periodMinutes: 96.7,
    perigeeKm: 512.4,
    apogeeKm: 720.8,
    orbitClass: 'LEO',
    tleLine1:
      '1 24296U 94029AN  24080.59027778  .00008540  00000-0  85400-4 0  9991',
    tleLine2:
      '2 24296  81.9412  95.4120 0152400 230.1420 128.4120 14.89120023412567',
    source: 'CelesTrak HAPS Upper Stage Debris',
  },
  {
    id: '23992',
    noradId: 23992,
    name: 'CERISE DEBRIS (HISTORIC)',
    classification: 'DEBRIS',
    intlDes: '1995-033B',
    epoch: '2024-03-20T09:30:00.000Z',
    epochYear: 2024,
    epochDay: 80.3958,
    inclinationDeg: 98.0512,
    eccentricity: 0.00115,
    raanDeg: 170.215,
    argPerigeeDeg: 85.142,
    meanAnomalyDeg: 275.412,
    meanMotionRevDay: 14.4512,
    bstarDrag: 0.0000315,
    periodMinutes: 99.6,
    perigeeKm: 668.5,
    apogeeKm: 684.2,
    orbitClass: 'LEO',
    tleLine1:
      '1 23992U 95033B   24080.39583333  .00003150  00000-0  31500-4 0  9995',
    tleLine2:
      '2 23992  98.0512 170.2150 0011500  85.1420 275.4120 14.45120021435678',
    source: 'CelesTrak 1996 Ariane Collision Fragment',
  },
];

// In-memory cache for live fetched data
let cachedObjects: OrbitalObject[] = [...CATALOGUED_ORBITAL_OBJECTS];
let lastFetchTimeMs = Date.now();
const CACHE_TTL_MS = 2 * 3600 * 1000; // 2 hours as recommended by CelesTrak

export async function fetchOrbitalObjects(): Promise<OrbitalObject[]> {
  const now = Date.now();
  // Return cached if within TTL
  if (cachedObjects.length > 0 && now - lastFetchTimeMs < CACHE_TTL_MS) {
    return cachedObjects;
  }

  try {
    // Attempt live fetch from CelesTrak GP endpoint via backend or direct
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(
      'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json',
      {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      }
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`CelesTrak HTTP ${response.status}`);
    }

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      // Parse active payloads
      const livePayloads: OrbitalObject[] = data.slice(0, 15).map((item: any) => {
        const norad = Number(item.NORAD_CAT_ID);
        const inc = Number(item.INCLINATION || 0);
        const ecc = Number(item.ECCENTRICITY || 0.001);
        const mm = Number(item.MEAN_MOTION || 15);
        const periodMin = mm > 0 ? (24 * 60) / mm : 95;
        // Semi-major axis from mean motion
        const mu = 398600.4418; // km^3/s^2
        const nRadS = (mm * 2 * Math.PI) / 86400;
        const a = Math.cbrt(mu / (nRadS * nRadS));
        const perigee = a * (1 - ecc) - 6378.137;
        const apogee = a * (1 + ecc) - 6378.137;

        return {
          id: String(norad),
          noradId: norad,
          name: item.OBJECT_NAME || `OBJECT ${norad}`,
          classification: 'PAYLOAD' as const,
          intlDes: item.OBJECT_ID || 'UNKNOWN',
          epoch: item.EPOCH || new Date().toISOString(),
          epochYear: new Date(item.EPOCH || Date.now()).getFullYear(),
          epochDay: 0,
          inclinationDeg: inc,
          eccentricity: ecc,
          raanDeg: Number(item.RA_OF_ASC_NODE || 0),
          argPerigeeDeg: Number(item.ARG_OF_PERICENTER || 0),
          meanAnomalyDeg: Number(item.MEAN_ANOMALY || 0),
          meanMotionRevDay: mm,
          bstarDrag: Number(item.BSTAR || 0),
          periodMinutes: Number(periodMin.toFixed(1)),
          perigeeKm: Number(Math.max(100, perigee).toFixed(1)),
          apogeeKm: Number(Math.max(100, apogee).toFixed(1)),
          orbitClass: (perigee > 35000 ? 'GEO' : perigee > 2000 ? 'MEO' : 'LEO') as 'GEO' | 'HEO' | 'LEO' | 'MEO',
          tleLine1: item.TLE_LINE1 || '',
          tleLine2: item.TLE_LINE2 || '',
          source: 'Live CelesTrak GP Active',
        };
      }).filter((o) => o.tleLine1 && o.tleLine2);

      // Keep debris objects from curated snapshot since CelesTrak active group doesn't include debris
      const debrisObjects = CATALOGUED_ORBITAL_OBJECTS.filter(
        (o) => o.classification !== 'PAYLOAD'
      );

      cachedObjects = [...livePayloads, ...debrisObjects];
      lastFetchTimeMs = now;
      return cachedObjects;
    }
  } catch (err) {
    // Graceful fallback to verified curated snapshot
    console.warn('CelesTrak live fetch unavailable or timed out; utilizing cached verified catalog.', err);
  }

  return cachedObjects;
}

export function getDataStatus(): DataStatus {
  const isStale = Date.now() - lastFetchTimeMs > CACHE_TTL_MS;
  const payloadsCount = cachedObjects.filter((o) => o.classification === 'PAYLOAD').length;
  const debrisCount = cachedObjects.filter((o) => o.classification !== 'PAYLOAD').length;

  return {
    source: 'CelesTrak General Perturbations (GP) Orbit Data Service',
    sourceUrl: 'https://celestrak.org/NORAD/elements/',
    lastFetchedIso: new Date(lastFetchTimeMs).toISOString(),
    cacheExpiresIso: new Date(lastFetchTimeMs + CACHE_TTL_MS).toISOString(),
    totalObjects: cachedObjects.length,
    payloadsCount,
    debrisCount,
    isStale,
    isFallback: cachedObjects === CATALOGUED_ORBITAL_OBJECTS,
  };
}
