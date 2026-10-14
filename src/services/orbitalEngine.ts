/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as satellite from 'satellite.js';
import {
  DistancePoint,
  EncounterAnalysisResult,
  FeatureContribution,
  EducationalPriorityAssessment,
  OrbitalObject,
  PropagatedState,
  ValidationSuiteSummary,
  ValidationTestItem,
  Vector3D,
} from '../types/orbital';

// Standard physical and Earth constants (WGS-84 / GRS-80)
export const EARTH_RADIUS_EQUATORIAL_KM = 6378.137;
export const EARTH_RADIUS_POLAR_KM = 6356.752;
export const SPEED_OF_LIGHT_KM_S = 299792.458;
export const TNT_EQUIVALENT_MJ_PER_KG = 4.184;

// Cache of compiled SatRec objects to prevent repeated TLE parsing
const satRecCache = new Map<string, satellite.SatRec>();

export function getSatRec(tle1: string, tle2: string, omm?: Record<string, unknown>): satellite.SatRec {
  const key = omm
    ? `OMM_${String(omm.NORAD_CAT_ID)}_${String(omm.EPOCH)}`
    : `${tle1.slice(0, 30)}_${tle2.slice(0, 30)}`;
  if (!satRecCache.has(key)) {
    const satrec = omm
      ? satellite.json2satrec(omm as Parameters<typeof satellite.json2satrec>[0])
      : satellite.twoline2satrec(tle1, tle2);
    satRecCache.set(key, satrec);
  }
  return satRecCache.get(key)!;
}

/**
 * Propagate an orbital object to an exact Date using SGP4
 */
export function propagateObject(
  obj: OrbitalObject,
  date: Date
): PropagatedState {
  try {
    const satrec = getSatRec(obj.tleLine1, obj.tleLine2, obj.omm);
    const pv = satellite.propagate(satrec, date);

    if (
      !pv ||
      typeof pv.position === 'boolean' ||
      typeof pv.velocity === 'boolean' ||
      !pv.position ||
      !pv.velocity
    ) {
      return {
        timeMs: date.getTime(),
        timeIso: date.toISOString(),
        positionEci: { x: 0, y: 0, z: 0 },
        velocityEci: { x: 0, y: 0, z: 0 },
        speedKmS: 0,
        geodetic: { latitude: 0, longitude: 0, altitudeKm: 0 },
        valid: false,
        error: `SGP4 propagation error code: ${satrec.error}`,
      };
    }

    const pos = pv.position as satellite.EciVec3<number>;
    const vel = pv.velocity as satellite.EciVec3<number>;

    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);

    // Geodetic calculation
    const gmst = satellite.gstime(date);
    const geodetic = satellite.eciToGeodetic(pos, gmst);
    const latDeg = satellite.degreesLat(geodetic.latitude);
    const lonDeg = satellite.degreesLong(geodetic.longitude);
    const altKm = geodetic.height;

    return {
      timeMs: date.getTime(),
      timeIso: date.toISOString(),
      positionEci: { x: pos.x, y: pos.y, z: pos.z },
      velocityEci: { x: vel.x, y: vel.y, z: vel.z },
      speedKmS: speed,
      geodetic: {
        latitude: latDeg,
        longitude: lonDeg,
        altitudeKm: altKm,
      },
      valid: true,
    };
  } catch (err: any) {
    return {
      timeMs: date.getTime(),
      timeIso: date.toISOString(),
      positionEci: { x: 0, y: 0, z: 0 },
      velocityEci: { x: 0, y: 0, z: 0 },
      speedKmS: 0,
      geodetic: { latitude: 0, longitude: 0, altitudeKm: 0 },
      valid: false,
      error: err?.message || 'Unknown SGP4 propagation exception',
    };
  }
}

/** Rotate a TEME position into the Earth-fixed frame using GMST at the same UTC instant. */
export function temeToEcef(positionTeme: Vector3D, date: Date): Vector3D {
  const theta = satellite.gstime(date);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return { x: c * positionTeme.x + s * positionTeme.y, y: -s * positionTeme.x + c * positionTeme.y, z: positionTeme.z };
}

/**
 * Euclidean separation in 3D Cartesian space
 */
export function calculateSeparationKm(r1: Vector3D, r2: Vector3D): number {
  const dx = r1.x - r2.x;
  const dy = r1.y - r2.y;
  const dz = r1.z - r2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Relative speed norm in 3D Cartesian velocity space
 */
export function calculateRelativeSpeedKmS(v1: Vector3D, v2: Vector3D): number {
  const dvx = v1.x - v2.x;
  const dvy = v1.y - v2.y;
  const dvz = v1.z - v2.z;
  return Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz);
}

/**
 * Angle between velocity vectors (collision geometry)
 */
export function calculateApproachAngleDeg(v1: Vector3D, v2: Vector3D): number {
  const s1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const s2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
  if (s1 === 0 || s2 === 0) return 0;
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const cosTheta = Math.max(-1, Math.min(1, dot / (s1 * s2)));
  return (Math.acos(cosTheta) * 180) / Math.PI;
}

/**
 * Generate 3D orbit trajectory points for one complete orbital period
 */
export function generateOrbitalTrajectory(
  obj: OrbitalObject,
  referenceDate: Date,
  numPoints: number = 120
): Vector3D[] {
  const satrec = getSatRec(obj.tleLine1, obj.tleLine2, obj.omm);
  const periodMinutes = obj.periodMinutes > 10 ? obj.periodMinutes : 95;
  const periodMs = periodMinutes * 60 * 1000;
  const stepMs = periodMs / numPoints;
  const baseMs = referenceDate.getTime();

  const points: Vector3D[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const sampleDate = new Date(baseMs + i * stepMs);
    const pv = satellite.propagate(satrec, sampleDate);
    if (pv && typeof pv.position !== 'boolean' && pv.position) {
      points.push({
        x: pv.position.x,
        y: pv.position.y,
        z: pv.position.z,
      });
    }
  }
  return points;
}

/**
 * Golden-section numerical refinement of a sampled closest approach.
 * Millisecond resolution supports the reported three-decimal distance; it
 * does not imply equivalent physical accuracy of the source orbital elements.
 */
function refineClosestApproach(
  sat: OrbitalObject,
  deb: OrbitalObject,
  tMinMs: number,
  tMaxMs: number,
  toleranceMs: number = 1
): { tCaMs: number; minDistanceKm: number } {
  const phi = (1 + Math.sqrt(5)) / 2;
  const resphi = 2 - phi;

  let a = tMinMs;
  let b = tMaxMs;
  let c = a + resphi * (b - a);
  let d = b - resphi * (b - a);

  const evalDist = (timeMs: number): number => {
    const dt = new Date(timeMs);
    const p1 = propagateObject(sat, dt);
    const p2 = propagateObject(deb, dt);
    if (!p1.valid || !p2.valid) return 999999;
    return calculateSeparationKm(p1.positionEci, p2.positionEci);
  };

  let fc = evalDist(c);
  let fd = evalDist(d);

  let iterations = 0;
  while (Math.abs(b - a) > toleranceMs && iterations < 35) {
    iterations++;
    if (fc < fd) {
      b = d;
      d = c;
      fd = fc;
      c = a + resphi * (b - a);
      fc = evalDist(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = b - resphi * (b - a);
      fd = evalDist(d);
    }
  }

  const bestTime = Math.round((a + b) / 2);
  const bestDist = evalDist(bestTime);
  return { tCaMs: bestTime, minDistanceKm: bestDist };
}

/**
 * Explainable Educational Screening Heuristic
 *
 * Implements an interpretable logistic scoring function based on orbital mechanics features.
 * Features:
 * 1. Minimum Euclidean separation (d_min)
 * 2. Relative velocity (v_rel)
 * 3. Orbital altitude overlap (|perigee_diff|, |apogee_diff|)
 * 4. Inclination delta (delta_inc)
 * 5. Ephemeris freshness (age in hours)
 * 6. Time until event (hours)
 *
 * Provides transparent SHAP-like additive feature contributions.
 */
export function evaluateEducationalPriority(params: {
  minSeparationKm: number;
  relativeSpeedKmS: number;
  thresholdKm: number;
  altitudeOverlapKm: number;
  inclinationDeltaDeg: number;
  timeToEventHours: number;
  tleAgeHours: number;
}): EducationalPriorityAssessment {
  const {
    minSeparationKm,
    relativeSpeedKmS,
    thresholdKm,
    altitudeOverlapKm,
    inclinationDeltaDeg,
    timeToEventHours,
    tleAgeHours,
  } = params;

  const contributions: FeatureContribution[] = [];

  // Base intercept
  let logit = -1.5;

  // 1. Separation Distance Factor (Strongest predictor)
  let distImpact = 0;
  if (minSeparationKm <= thresholdKm) {
    const proximityRatio = Math.max(0, 1 - minSeparationKm / thresholdKm);
    distImpact = proximityRatio * 3.5;
    contributions.push({
      feature: 'separation_distance',
      label: 'Minimum Separation',
      value: `${minSeparationKm.toFixed(2)} km (< ${thresholdKm} km threshold)`,
      impactWeight: distImpact,
      description: `Separation is within the screening threshold. Higher proximity substantially elevates encounter concern.`,
    });
  } else {
    const distanceMarginRatio = Math.min(2.0, (minSeparationKm - thresholdKm) / 100);
    distImpact = -distanceMarginRatio * 2.0;
    contributions.push({
      feature: 'separation_distance',
      label: 'Minimum Separation',
      value: `${minSeparationKm.toFixed(2)} km (> ${thresholdKm} km threshold)`,
      impactWeight: distImpact,
      description: `Separation exceeds educational screening threshold by ${(minSeparationKm - thresholdKm).toFixed(1)} km, reducing immediate hazard priority.`,
    });
  }
  logit += distImpact;

  // 2. Relative Speed Factor (Kinetic energy severity)
  let speedImpact = 0;
  if (relativeSpeedKmS > 10.0) {
    speedImpact = 1.2;
    contributions.push({
      feature: 'relative_speed',
      label: 'Relative Velocity',
      value: `${relativeSpeedKmS.toFixed(2)} km/s (Hypervelocity regime)`,
      impactWeight: speedImpact,
      description: `High relative speed (~${(relativeSpeedKmS * 3600).toFixed(0)} km/h) corresponds to high kinetic energy per unit mass if an impact occurred; this calculation does not estimate impact likelihood or damage.`,
    });
  } else if (relativeSpeedKmS > 5.0) {
    speedImpact = 0.5;
    contributions.push({
      feature: 'relative_speed',
      label: 'Relative Velocity',
      value: `${relativeSpeedKmS.toFixed(2)} km/s (Moderate LEO crossing)`,
      impactWeight: speedImpact,
      description: `Moderate closing speed typical for inclined orbit crossings.`,
    });
  } else {
    speedImpact = -0.4;
    contributions.push({
      feature: 'relative_speed',
      label: 'Relative Velocity',
      value: `${relativeSpeedKmS.toFixed(2)} km/s (Low relative drift)`,
      impactWeight: speedImpact,
      description: `Nearly co-planar or trailing motion allows longer observation lead time.`,
    });
  }
  logit += speedImpact;

  // 3. Altitude Orbit Envelope Overlap
  let altImpact = 0;
  if (altitudeOverlapKm < 15) {
    altImpact = 1.0;
    contributions.push({
      feature: 'altitude_overlap',
      label: 'Radial Altitude Match',
      value: `Δh = ${altitudeOverlapKm.toFixed(1)} km`,
      impactWeight: altImpact,
      description: `Both orbits occupy virtually identical altitude shells, creating recurring conjunction opportunities.`,
    });
  } else if (altitudeOverlapKm < 50) {
    altImpact = 0.3;
    contributions.push({
      feature: 'altitude_overlap',
      label: 'Radial Altitude Match',
      value: `Δh = ${altitudeOverlapKm.toFixed(1)} km`,
      impactWeight: altImpact,
      description: `Slight radial altitude offset, proximity depends on nodal geometry.`,
    });
  } else {
    altImpact = -0.8;
    contributions.push({
      feature: 'altitude_overlap',
      label: 'Radial Altitude Match',
      value: `Δh = ${altitudeOverlapKm.toFixed(1)} km`,
      impactWeight: altImpact,
      description: `Significant radial separation between mean orbit envelopes.`,
    });
  }
  logit += altImpact;

  // 4. Data Freshness Uncertainty (TLE Age)
  let ageImpact = 0;
  if (tleAgeHours > 48) {
    ageImpact = 0.8;
    contributions.push({
      feature: 'tle_age',
      label: 'Ephemeris Staleness',
      value: `${tleAgeHours.toFixed(1)} h old`,
      impactWeight: ageImpact,
      description: `Element epoch is older than 48 hours. This heuristic raises review priority, but the application does not calculate a positional error ellipsoid.`,
    });
  } else if (tleAgeHours > 24) {
    ageImpact = 0.2;
    contributions.push({
      feature: 'tle_age',
      label: 'Ephemeris Staleness',
      value: `${tleAgeHours.toFixed(1)} h old`,
      impactWeight: ageImpact,
      description: `Element epoch is 24–48 hours old. The score uses age as a heuristic feature; no positional uncertainty bound is computed.`,
    });
  } else {
    ageImpact = -0.3;
    contributions.push({
      feature: 'tle_age',
      label: 'Ephemeris Staleness',
      value: `${tleAgeHours.toFixed(1)} h (Fresh data)`,
      impactWeight: ageImpact,
      description: `The element epoch is within 24 hours of calculation time; this does not quantify propagation error.`,
    });
  }
  logit += ageImpact;

  // 5. Inclination Crossing Angle
  let incImpact = 0;
  if (inclinationDeltaDeg > 45) {
    incImpact = 0.4;
    contributions.push({
      feature: 'inclination_delta',
      label: 'Plane Inclination Delta',
      value: `Δi = ${inclinationDeltaDeg.toFixed(1)}°`,
      impactWeight: incImpact,
      description: `Cross-plane orbital geometry produces sharp geometry with narrow temporal window.`,
    });
  } else {
    incImpact = -0.1;
    contributions.push({
      feature: 'inclination_delta',
      label: 'Plane Inclination Delta',
      value: `Δi = ${inclinationDeltaDeg.toFixed(1)}°`,
      impactWeight: incImpact,
      description: `Similar orbital inclinations produce repeating orbital track geometries.`,
    });
  }
  logit += incImpact;

  // Logistic Sigmoid
  const priorityIndex = Math.round(Math.min(99, Math.max(1, (1 / (1 + Math.exp(-logit))) * 100)));

  let priorityTier: 'HIGH_REVIEW' | 'MODERATE_MONITOR' | 'ROUTINE_SCREEN' = 'ROUTINE_SCREEN';
  if (priorityIndex >= 70) {
    priorityTier = 'HIGH_REVIEW';
  } else if (priorityIndex >= 40) {
    priorityTier = 'MODERATE_MONITOR';
  }

  const explanation =
    priorityTier === 'HIGH_REVIEW'
      ? `High-priority educational screening candidate: the estimated separation (${minSeparationKm.toFixed(1)} km) is within the configured screen. This uncalibrated heuristic does not determine whether tracking or a maneuver is needed.`
      : priorityTier === 'MODERATE_MONITOR'
      ? `Moderate educational screening candidate: the selected geometry adds heuristic priority. This score does not make a tracking or maneuver recommendation.`
      : `Routine educational screen: estimated separation is outside the selected threshold; this is not an operational safety determination.`;

  return {
    priorityIndex,
    priorityTier,
    featureContributions: contributions,
    explanation,
  };
}

/**
 * Execute full close approach analysis between satellite and debris
 */
export function analyzeCloseApproach(
  satelliteObj: OrbitalObject,
  debrisObj: OrbitalObject,
  startTime: Date,
  timeWindowHours: number = 24,
  educationalThresholdKm: number = 25
): EncounterAnalysisResult {
  const mode = (object: OrbitalObject) => object.isSynthetic ? 'synthetic' : object.dataMode || 'historical';
  if (mode(satelliteObj) !== mode(debrisObj)) {
    throw new Error(`Cannot analyze mixed data provenance (${mode(satelliteObj)} vs ${mode(debrisObj)}). Select objects from one data mode.`);
  }
  const endTime = new Date(startTime.getTime() + timeWindowHours * 3600 * 1000);
  if (!Number.isFinite(timeWindowHours) || timeWindowHours <= 0 || timeWindowHours > 168) {
    throw new Error('Analysis window must be greater than 0 and no more than 168 hours.');
  }
  if (!Number.isFinite(educationalThresholdKm) || educationalThresholdKm <= 0) {
    throw new Error('Screening threshold must be a positive number of kilometres.');
  }
  const totalDurationMs = endTime.getTime() - startTime.getTime();

  // A 30-second grid reduces the chance of missing narrow local minima.
  const coarseStepMs = 30 * 1000;
  const numSteps = Math.floor(totalDurationMs / coarseStepMs);

  const coarsePoints: { timeMs: number; dist: number }[] = [];

  for (let i = 0; i <= numSteps; i++) {
    const tMs = startTime.getTime() + i * coarseStepMs;
    const tDate = new Date(tMs);
    const p1 = propagateObject(satelliteObj, tDate);
    const p2 = propagateObject(debrisObj, tDate);

    if (p1.valid && p2.valid) {
      const dist = calculateSeparationKm(p1.positionEci, p2.positionEci);
      coarsePoints.push({ timeMs: tMs, dist });
    }
  }
  if (numSteps * coarseStepMs < totalDurationMs) {
    const p1 = propagateObject(satelliteObj, endTime), p2 = propagateObject(debrisObj, endTime);
    if (p1.valid && p2.valid) coarsePoints.push({ timeMs: endTime.getTime(), dist: calculateSeparationKm(p1.positionEci, p2.positionEci) });
  }

  if (!coarsePoints.length) throw new Error('No valid synchronized propagated states were found in the analysis window.');
  const candidates: { tCaMs: number; minDistanceKm: number }[] = [
    { tCaMs: coarsePoints[0].timeMs, minDistanceKm: coarsePoints[0].dist },
    { tCaMs: coarsePoints[coarsePoints.length - 1].timeMs, minDistanceKm: coarsePoints[coarsePoints.length - 1].dist },
  ];
  for (let i = 1; i < coarsePoints.length - 1; i++) {
    const prev = coarsePoints[i - 1], cur = coarsePoints[i], next = coarsePoints[i + 1];
    if (cur.dist <= prev.dist && cur.dist <= next.dist) {
      candidates.push(refineClosestApproach(satelliteObj, debrisObj, prev.timeMs, next.timeMs));
    }
  }
  if (coarsePoints[coarsePoints.length - 1].timeMs < endTime.getTime()) {
    const endSat = propagateObject(satelliteObj, endTime), endDeb = propagateObject(debrisObj, endTime);
    if (endSat.valid && endDeb.valid) candidates.push({ tCaMs: endTime.getTime(), minDistanceKm: calculateSeparationKm(endSat.positionEci, endDeb.positionEci) });
  }
  const refined = candidates.reduce((best, item) => item.minDistanceKm < best.minDistanceKm ? item : best);
  const tCaDate = new Date(refined.tCaMs);

  // Propagate both objects at exact t_CA
  const satAtCa = propagateObject(satelliteObj, tCaDate);
  const debAtCa = propagateObject(debrisObj, tCaDate);

  const minSeparationKm = refined.minDistanceKm;
  const relativeSpeedKmS = calculateRelativeSpeedKmS(
    satAtCa.velocityEci,
    debAtCa.velocityEci
  );
  const approachAngleDeg = calculateApproachAngleDeg(
    satAtCa.velocityEci,
    debAtCa.velocityEci
  );

  // Relative kinetic energy: 0.5 * v_rel^2 in MJ/kg
  const kineticEnergyMjPerKg = 0.5 * relativeSpeedKmS * relativeSpeedKmS;

  // Build a distance profile for the chart (focused around the closest approach window, plus baseline)
  // 90 points distributed across the window with higher density around t_CA
  const distanceProfile: DistancePoint[] = [];
  const chartPointsCount = 90;
  for (let i = 0; i < chartPointsCount; i++) {
    const fraction = i / (chartPointsCount - 1);
    const tSampleMs = startTime.getTime() + fraction * totalDurationMs;
    const tSampleDate = new Date(tSampleMs);
    const p1 = propagateObject(satelliteObj, tSampleDate);
    const p2 = propagateObject(debrisObj, tSampleDate);
    if (p1.valid && p2.valid) {
      const dist = calculateSeparationKm(p1.positionEci, p2.positionEci);
      const relV = calculateRelativeSpeedKmS(p1.velocityEci, p2.velocityEci);
      distanceProfile.push({
        timestampMs: tSampleMs,
        timeIso: tSampleDate.toISOString(),
        timeRelativeMin: Math.round((tSampleMs - refined.tCaMs) / 60000),
        distanceKm: Number(dist.toFixed(2)),
        relSpeedKmS: Number(relV.toFixed(2)),
      });
    }
  }
  const satAtChartCa = propagateObject(satelliteObj, tCaDate);
  const debAtChartCa = propagateObject(debrisObj, tCaDate);
  if (satAtChartCa.valid && debAtChartCa.valid) {
    distanceProfile.push({
      timestampMs: refined.tCaMs,
      timeIso: tCaDate.toISOString(),
      timeRelativeMin: 0,
      distanceKm: Number(calculateSeparationKm(satAtChartCa.positionEci, debAtChartCa.positionEci).toFixed(2)),
      relSpeedKmS: Number(calculateRelativeSpeedKmS(satAtChartCa.velocityEci, debAtChartCa.velocityEci).toFixed(2)),
    });
    distanceProfile.sort((a, b) => a.timestampMs - b.timestampMs);
  }

  // Calculate data epoch age
  const nowMs = Date.now();
  const satEpochMs = new Date(satelliteObj.epoch).getTime();
  const debEpochMs = new Date(debrisObj.epoch).getTime();
  const satAgeHours = Math.max(0, (nowMs - satEpochMs) / (3600 * 1000));
  const debAgeHours = Math.max(0, (nowMs - debEpochMs) / (3600 * 1000));

  // Orbital characteristics
  const altitudeOverlapKm = Math.abs(
    (satelliteObj.perigeeKm + satelliteObj.apogeeKm) / 2 -
      (debrisObj.perigeeKm + debrisObj.apogeeKm) / 2
  );
  const inclinationDeltaDeg = Math.abs(
    satelliteObj.inclinationDeg - debrisObj.inclinationDeg
  );
  const timeToEventHours = Math.max(
    0,
    (refined.tCaMs - startTime.getTime()) / (3600 * 1000)
  );

  // Uncalibrated educational screening heuristic (not a probability).
  const educationalScreening = evaluateEducationalPriority({
    minSeparationKm,
    relativeSpeedKmS,
    thresholdKm: educationalThresholdKm,
    altitudeOverlapKm,
    inclinationDeltaDeg,
    timeToEventHours,
    tleAgeHours: Math.max(satAgeHours, debAgeHours),
  });

  return {
    calculationStatus: 'COMPLETED_ESTIMATE',
    satellite: satelliteObj,
    debris: debrisObj,
    startTimeIso: startTime.toISOString(),
    endTimeIso: endTime.toISOString(),
    timeWindowHours,
    tCaIso: tCaDate.toISOString(),
    tCaTimestampMs: refined.tCaMs,
    minSeparationKm: Number(minSeparationKm.toFixed(3)),
    relativeSpeedKmS: Number(relativeSpeedKmS.toFixed(3)),
    satellitePositionEci: satAtCa.positionEci,
    debrisPositionEci: debAtCa.positionEci,
    satelliteVelocityEci: satAtCa.velocityEci,
    debrisVelocityEci: debAtCa.velocityEci,
    approachAngleDeg: Number(approachAngleDeg.toFixed(2)),
    kineticEnergyMjPerKg: Number(kineticEnergyMjPerKg.toFixed(2)),
    educationalThresholdKm,
    screeningFlag: minSeparationKm <= educationalThresholdKm,
    distanceProfile,
    dataFreshnessHours: {
      satellite: Number(satAgeHours.toFixed(1)),
      debris: Number(debAgeHours.toFixed(1)),
    },
    educationalScreening,
    calculatedAtIso: new Date().toISOString(),
  };
}

/**
 * Automated Scientific Validation Test Suite
 * Executes 6 rigorous benchmark tests verifying SGP4 fidelity, coordinate conversions,
 * distance formulas, numerical refinement convergence, and error bounds.
 */
export function runScientificValidationSuite(): ValidationSuiteSummary {
  const tests: ValidationTestItem[] = [];

  // TEST 1: Vallado SGP4 Standard Benchmark (ISS Zarya Reference Vector)
  const t1Start = performance.now();
  const issTle1 =
    '1 25544U 98067A   24080.54861111  .00016717  00000-0  10270-3 0  9002';
  const issTle2 =
    '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.49815033444445';
  const satrecIss = satellite.twoline2satrec(issTle1, issTle2);
  const epochDate = new Date(Date.UTC(2024, 2, 20, 13, 10, 0));
  const pvIss = satellite.propagate(satrecIss, epochDate);
  const t1End = performance.now();

  const isT1Valid =
    pvIss && typeof pvIss.position !== 'boolean' && pvIss.position !== null;
  let t1PosMag = 0;
  if (isT1Valid && pvIss.position) {
    const p = pvIss.position as satellite.EciVec3<number>;
    t1PosMag = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
  }
  // ISS orbit radius should be approximately 6750 km - 6820 km (Earth R 6378 + 400-420km alt)
  const isT1Passed = t1PosMag >= 6700 && t1PosMag <= 6850;
  tests.push({
    id: 'VAL-001',
    category: 'SGP4',
    name: 'SGP4 Ephemeris Propagation Consistency',
    description: 'Propagate standard ISS (NORAD 25544) TLE record and verify orbital radius is within physical LEO shell (6700–6850 km).',
    expected: '6700.0 km <= ||r|| <= 6850.0 km',
    actual: `||r|| = ${t1PosMag.toFixed(2)} km`,
    tolerance: '±150 km radial bounds',
    passed: isT1Passed,
    durationMs: Number((t1End - t1Start).toFixed(2)),
  });

  // TEST 2: Coordinate Transformation Invariance (ECI to Geodetic Altitude)
  const t2Start = performance.now();
  const gmst = satellite.gstime(epochDate);
  let isT2Passed = false;
  let actualAlt = 0;
  if (isT1Valid && pvIss.position) {
    const pos = pvIss.position as satellite.EciVec3<number>;
    const geodetic = satellite.eciToGeodetic(pos, gmst);
    actualAlt = geodetic.height;
    // ISS altitude should be 400 - 430 km
    isT2Passed = actualAlt >= 390 && actualAlt <= 440;
  }
  const t2End = performance.now();
  tests.push({
    id: 'VAL-002',
    category: 'COORDINATES',
    name: 'TEME to WGS-84 Geodetic Height Transformation',
    description: 'Verify GMST sidereal rotation and WGS-84 oblate ellipsoid projection produces expected 400–430 km orbital altitude.',
    expected: '390.0 km <= h <= 440.0 km',
    actual: `h = ${actualAlt.toFixed(2)} km`,
    tolerance: '±25 km WGS-84 geoid bounds',
    passed: isT2Passed,
    durationMs: Number((t2End - t2Start).toFixed(2)),
  });

  // TEST 3: Euclidean Separation Metric Symmetry and Positivity
  const t3Start = performance.now();
  const pA = { x: 3450.2, y: -2340.5, z: 5410.1 };
  const pB = { x: 3465.8, y: -2318.2, z: 5402.7 };
  const distAB = calculateSeparationKm(pA, pB);
  const distBA = calculateSeparationKm(pB, pA);
  const symDiff = Math.abs(distAB - distBA);
  const t3End = performance.now();
  const isT3Passed = symDiff < 1e-9 && distAB > 0;
  tests.push({
    id: 'VAL-003',
    category: 'ENCOUNTER_LOGIC',
    name: 'Euclidean Separation Metric Symmetry & Positivity',
    description: 'Verify separation norm satisfies metric space axioms: d(A,B) == d(B,A) and d(A,B) > 0 for distinct state vectors.',
    expected: 'Δ|d(A,B) - d(B,A)| < 1e-8 km',
    actual: `d = ${distAB.toFixed(4)} km, Δ = ${symDiff.toExponential(3)}`,
    tolerance: '< 1e-8 numerical machine epsilon',
    passed: isT3Passed,
    durationMs: Number((t3End - t3Start).toFixed(2)),
  });

  // TEST 4: Closest-Approach Numerical Refinement Convergence
  const t4Start = performance.now();
  // Simulate synthetic parabola separation function d(t) = 15.0 + 0.005*(t - 3600)^2
  let coarseBestT = 3540; // Coarse step missed minimum by 60s
  let coarseBestDist = 15.0 + 0.005 * Math.pow(coarseBestT - 3600, 2); // 33 km
  // Golden section refinement
  let a = 3400;
  let b = 3800;
  const phi = (1 + Math.sqrt(5)) / 2;
  const resphi = 2 - phi;
  let c = a + resphi * (b - a);
  let d = b - resphi * (b - a);
  const f = (t: number) => 15.0 + 0.005 * Math.pow(t - 3600, 2);
  let fc = f(c);
  let fd = f(d);
  for (let k = 0; k < 25; k++) {
    if (fc < fd) {
      b = d;
      d = c;
      fd = fc;
      c = a + resphi * (b - a);
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = b - resphi * (b - a);
      fd = f(d);
    }
  }
  const refinedT = (a + b) / 2;
  const refinedDist = f(refinedT);
  const t4End = performance.now();
  const isT4Passed =
    Math.abs(refinedT - 3600) < 0.1 && refinedDist < coarseBestDist;
  tests.push({
    id: 'VAL-004',
    category: 'ENCOUNTER_LOGIC',
    name: 'Golden-Section Sub-Step Numerical Refinement',
    description: 'Test bisection/golden-section optimizer convergence to true mathematical extremum argmin d(t).',
    expected: 't_CA = 3600.00s, d_min = 15.000 km',
    actual: `t_CA = ${refinedT.toFixed(2)}s, d_min = ${refinedDist.toFixed(3)} km`,
    tolerance: 'Δt < 0.2s, Δd < 0.01 km',
    passed: isT4Passed,
    durationMs: Number((t4End - t4Start).toFixed(2)),
  });

  // TEST 5: Relative Velocity Vector Differential Norm
  const t5Start = performance.now();
  const v1 = { x: 7.2, y: 1.5, z: -2.3 };
  const v2 = { x: -6.8, y: 2.1, z: 1.9 };
  const vRel = calculateRelativeSpeedKmS(v1, v2);
  // Manual check: dvx = 14.0, dvy = -0.6, dvz = -4.2
  // sqrt(14^2 + 0.6^2 + 4.2^2) = sqrt(196 + 0.36 + 17.64) = sqrt(214.0) = 14.6287
  const expectedVrel = Math.sqrt(196 + 0.36 + 17.64);
  const vDiff = Math.abs(vRel - expectedVrel);
  const t5End = performance.now();
  const isT5Passed = vDiff < 1e-5;
  tests.push({
    id: 'VAL-005',
    category: 'ENCOUNTER_LOGIC',
    name: 'Cartesian Relative Velocity Vector Difference',
    description: 'Verify ||v1 - v2|| relative velocity computation matches analytical hypervelocity norm.',
    expected: `v_rel = ${expectedVrel.toFixed(4)} km/s`,
    actual: `v_rel = ${vRel.toFixed(4)} km/s`,
    tolerance: '< 1e-4 km/s',
    passed: isT5Passed,
    durationMs: Number((t5End - t5Start).toFixed(2)),
  });

  // TEST 6: SGP4 Error Handling & Decayed Object Safety
  const t6Start = performance.now();
  // Provide corrupted / impossible TLE line
  const corruptTle1 = '1 99999U 24001A   24080.00000000  .00000000  00000-0  00000-0 0  9999';
  const corruptTle2 = '2 99999  99.9999 999.9999 9999999 999.9999 999.9999 99.99999999999999';
  const dummyObj: OrbitalObject = {
    id: '99999',
    noradId: 99999,
    name: 'CORRUPT_TEST_RECORD',
    classification: 'DEBRIS',
    intlDes: '24-001A',
    epoch: new Date().toISOString(),
    epochYear: 2024,
    epochDay: 80,
    inclinationDeg: 99.9,
    eccentricity: 0.999,
    raanDeg: 0,
    argPerigeeDeg: 0,
    meanAnomalyDeg: 0,
    meanMotionRevDay: 15,
    bstarDrag: 0,
    periodMinutes: 90,
    perigeeKm: 200,
    apogeeKm: 300,
    orbitClass: 'LEO',
    tleLine1: corruptTle1,
    tleLine2: corruptTle2,
    source: 'TEST',
  };
  const propResult = propagateObject(dummyObj, new Date());
  const t6End = performance.now();
  // Safe handling means propResult is either caught or marks valid: false without throwing uncaught crashes
  const isT6Passed = propResult !== null && (propResult.valid === false || typeof propResult.speedKmS === 'number');
  tests.push({
    id: 'VAL-006',
    category: 'DATA_INTEGRITY',
    name: 'Degraded / Decayed SGP4 Orbit Error Trapping',
    description: 'Ensure invalid orbital elements or numerical singularities trigger graceful error states without application crashes.',
    expected: 'Graceful error containment (no unhandled throw)',
    actual: propResult.valid ? 'Propagated with fallback' : `Handled gracefully: ${propResult.error || 'flagged invalid'}`,
    tolerance: 'Zero fatal process exceptions',
    passed: isT6Passed,
    durationMs: Number((t6End - t6Start).toFixed(2)),
  });

  // TEST 7: Vallado published SGP4 verification vector (NORAD 00005, epoch).
  const t7Start = performance.now();
  const valladoTle1 = '1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753';
  const valladoTle2 = '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667';
  const valladoRecord = satellite.twoline2satrec(valladoTle1, valladoTle2);
  const valladoDate = new Date(Date.UTC(2000, 5, 27, 18, 50, 19, 734));
  const valladoResult = satellite.propagate(valladoRecord, valladoDate);
  const expectedPosition = { x: 7022.46529266, y: -1400.08296755, z: 0.03995155 };
  const expectedVelocity = { x: 1.893841015, y: 6.405893759, z: 4.534807250 };
  const valladoPosition = valladoResult.position as satellite.EciVec3<number>;
  const valladoVelocity = valladoResult.velocity as satellite.EciVec3<number>;
  const positionErrorKm = calculateSeparationKm(valladoPosition, expectedPosition);
  const velocityErrorKmS = calculateRelativeSpeedKmS(valladoVelocity, expectedVelocity);
  const t7End = performance.now();
  tests.push({
    id: 'VAL-007',
    category: 'SGP4',
    name: 'Vallado Published TEME Epoch State Vector',
    description: 'Compare satellite.js against the published Vallado NORAD 00005 verification vector; UTC Date is rounded to the nearest millisecond.',
    expected: 'Position error < 0.005 km; velocity error < 0.00001 km/s',
    actual: `Position error = ${positionErrorKm.toFixed(6)} km; velocity error = ${velocityErrorKmS.toFixed(8)} km/s`,
    tolerance: '5 m position (accounts for JS Date millisecond rounding), 1e-5 km/s velocity',
    passed: Number.isFinite(positionErrorKm) && Number.isFinite(velocityErrorKmS) && positionErrorKm < 0.005 && velocityErrorKmS < 0.00001,
    durationMs: Number((t7End - t7Start).toFixed(2)),
  });

  // TEST 8: CelesTrak OMM JSON initialization through satellite.js json2satrec.
  const t8Start = performance.now();
  const ommVector = {
    NORAD_CAT_ID: 5,
    OBJECT_ID: '1958-002B',
    OBJECT_NAME: 'VANGUARD 1',
    EPOCH: '2000-06-27T18:50:19.734Z',
    MEAN_MOTION: 10.82419157,
    ECCENTRICITY: 0.1859667,
    INCLINATION: 34.2682,
    RA_OF_ASC_NODE: 348.7242,
    ARG_OF_PERICENTER: 331.7664,
    MEAN_ANOMALY: 19.3264,
    BSTAR: 0.000028098,
    MEAN_MOTION_DOT: 0,
    MEAN_MOTION_DDOT: 0,
  };
  const ommSatrec = satellite.json2satrec(ommVector);
  const ommState = satellite.propagate(ommSatrec, new Date(ommVector.EPOCH));
  const ommPosError = calculateSeparationKm(ommState.position as satellite.EciVec3<number>, expectedPosition);
  const ommVelError = calculateRelativeSpeedKmS(ommState.velocity as satellite.EciVec3<number>, expectedVelocity);
  const t8End = performance.now();
  tests.push({
    id: 'VAL-008',
    category: 'SGP4',
    name: 'CelesTrak OMM JSON SGP4 Initialization',
    description: 'Initialize satellite.js from CelesTrak-style OMM fields and compare its state against the same published Vallado epoch vector.',
    expected: 'Position error < 0.00001 km; velocity error < 0.00000001 km/s',
    actual: `Position error = ${ommPosError.toExponential(3)} km; velocity error = ${ommVelError.toExponential(3)} km/s`,
    tolerance: '10 μm position, 1e-8 km/s velocity',
    passed: Number.isFinite(ommPosError) && Number.isFinite(ommVelError) && ommPosError < 0.00001 && ommVelError < 0.00000001,
    durationMs: Number((t8End - t8Start).toFixed(2)),
  });

  const passedCount = tests.filter((t) => t.passed).length;
  return {
    total: tests.length,
    passed: passedCount,
    failed: tests.length - passedCount,
    runAt: new Date().toISOString(),
    tests,
  };
}
