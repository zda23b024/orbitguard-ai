import { OrbitalObject } from '../types/orbital';

export const SYNTHETIC_SCENARIO_START = '2024-03-20T12:00:00.000Z';
export const SYNTHETIC_SCENARIO_WINDOW_HOURS = 24;
export const SYNTHETIC_SCENARIO_THRESHOLD_KM = 15;

// These are intentionally invented teaching inputs. They have no catalog identity and do not copy a real object's elements.
const SYNTHETIC_BASELINE = {
  eccentricity: 0.0001142,
  inclinationDeg: 98.5702,
  raanDeg: 165.2314,
  argPerigeeDeg: 72.418,
  meanAnomalyDeg: 287.7215,
  meanMotionRevDay: 14.30819,
};

/** Builds an isolated, clearly synthetic OMM pair that follows the ordinary SGP4 and encounter-analysis paths. */
export function createSyntheticEducationalPair(): [OrbitalObject, OrbitalObject] {
  const makeObject = (
    id: string,
    engineObjectId: number,
    name: string,
    classification: 'PAYLOAD' | 'DEBRIS',
    meanMotionRevDay: number,
    meanAnomalyDeg: number,
    inclinationDeg: number,
  ): OrbitalObject => {
    const omm: Record<string, unknown> = {
      // satellite.js requires a distinct numeric OMM key; these 0/1 values are internal synthetic IDs, not NORAD IDs.
      NORAD_CAT_ID: engineObjectId,
      OBJECT_ID: 'SYNTHETIC-EDUCATIONAL-ONLY',
      OBJECT_NAME: name,
      EPOCH: SYNTHETIC_SCENARIO_START,
      MEAN_MOTION: meanMotionRevDay,
      ECCENTRICITY: SYNTHETIC_BASELINE.eccentricity,
      INCLINATION: inclinationDeg,
      RA_OF_ASC_NODE: SYNTHETIC_BASELINE.raanDeg,
      ARG_OF_PERICENTER: SYNTHETIC_BASELINE.argPerigeeDeg,
      MEAN_ANOMALY: meanAnomalyDeg,
      BSTAR: 0,
      MEAN_MOTION_DOT: 0,
      MEAN_MOTION_DDOT: 0,
    };
    const mu = 398600.4418;
    const meanMotionRadSec = (meanMotionRevDay * 2 * Math.PI) / 86400;
    const semiMajorAxisKm = Math.cbrt(mu / (meanMotionRadSec * meanMotionRadSec));
    const perigeeKm = semiMajorAxisKm * (1 - SYNTHETIC_BASELINE.eccentricity) - 6378.137;
    const apogeeKm = semiMajorAxisKm * (1 + SYNTHETIC_BASELINE.eccentricity) - 6378.137;

    return {
      id,
      noradId: 0,
      isSynthetic: true,
      dataMode: 'synthetic',
      name,
      classification,
      intlDes: 'SYNTHETIC · NO CATALOG ID',
      epoch: SYNTHETIC_SCENARIO_START,
      epochYear: 2024,
      epochDay: 80.5,
      inclinationDeg,
      eccentricity: SYNTHETIC_BASELINE.eccentricity,
      raanDeg: SYNTHETIC_BASELINE.raanDeg,
      argPerigeeDeg: SYNTHETIC_BASELINE.argPerigeeDeg,
      meanAnomalyDeg,
      meanMotionRevDay,
      bstarDrag: 0,
      periodMinutes: 1440 / meanMotionRevDay,
      perigeeKm,
      apogeeKm,
      orbitClass: perigeeKm > 35000 ? 'GEO' : perigeeKm > 2000 ? 'MEO' : 'LEO',
      tleLine1: '',
      tleLine2: '',
      omm,
      source: 'SYNTHETIC EDUCATIONAL SCENARIO · controlled OMM inputs; not catalog data',
    };
  };

  return [
    makeObject(
      'SYNTHETIC-PAYLOAD',
      0,
      'SYNTHETIC TARGET (EDUCATIONAL)',
      'PAYLOAD',
      SYNTHETIC_BASELINE.meanMotionRevDay,
      SYNTHETIC_BASELINE.meanAnomalyDeg,
      SYNTHETIC_BASELINE.inclinationDeg,
    ),
    makeObject(
      'SYNTHETIC-DEBRIS',
      1,
      'SYNTHETIC DEBRIS (EDUCATIONAL)',
      'DEBRIS',
      SYNTHETIC_BASELINE.meanMotionRevDay + 0.02,
      SYNTHETIC_BASELINE.meanAnomalyDeg - 3.6,
      SYNTHETIC_BASELINE.inclinationDeg + 0.1,
    ),
  ];
}
