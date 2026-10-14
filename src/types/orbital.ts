/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ObjectClassification = 'PAYLOAD' | 'DEBRIS' | 'ROCKET BODY' | 'UNKNOWN';

export interface OrbitalObject {
  id: string; // Catalog ID as string; synthetic scenarios use explicit SYNTHETIC IDs.
  noradId: number;
  /** Synthetic teaching objects have no real NORAD/catalog identity. */
  isSynthetic?: boolean;
  /** Time this source record was retrieved by OrbitGuard (separate from element epoch). */
  downloadedAtIso?: string;
  /** Capture time of the local historical snapshot containing this source record. */
  snapshotCapturedAtIso?: string;
  /** Provenance mode prevents historical/synthetic objects from masquerading as current GP. */
  dataMode?: 'current' | 'historical' | 'synthetic';
  /** CelesTrak GP group key for per-group cache and cooldown accounting. */
  dataGroup?: string;
  name: string;
  classification: ObjectClassification;
  /** Exact provider OBJECT_TYPE when supplied; classification is the app's normalized category. */
  providerClassification?: string;
  intlDes: string;
  epoch: string; // ISO string
  epochYear: number;
  epochDay: number;
  inclinationDeg: number;
  eccentricity: number;
  raanDeg: number; // Right Ascension of Ascending Node
  argPerigeeDeg: number;
  meanAnomalyDeg: number;
  meanMotionRevDay: number;
  bstarDrag: number;
  periodMinutes: number;
  perigeeKm: number;
  apogeeKm: number;
  orbitClass: 'LEO' | 'MEO' | 'GEO' | 'HEO';
  tleLine1: string;
  tleLine2: string;
  /** Original CelesTrak GP/OMM JSON record when the source is not TLE text. */
  omm?: Record<string, unknown>;
  source: string;
}

export function formatObjectIdentifier(object: OrbitalObject): string {
  return object.isSynthetic ? 'SYNTHETIC · NO NORAD ID' : `NORAD #${object.noradId}`;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface GeodeticCoords {
  latitude: number; // degrees -90 to +90
  longitude: number; // degrees -180 to +180
  altitudeKm: number; // km
}

export interface PropagatedState {
  timeMs: number;
  timeIso: string;
  positionEci: Vector3D; // km
  velocityEci: Vector3D; // km/s
  speedKmS: number;
  geodetic: GeodeticCoords;
  valid: boolean;
  error?: string;
}

export interface DistancePoint {
  timestampMs: number;
  timeIso: string;
  timeRelativeMin: number;
  distanceKm: number;
  relSpeedKmS: number;
}

export interface FeatureContribution {
  feature: string;
  label: string;
  value: string;
  impactWeight: number; // positive raises screening priority, negative lowers it
  description: string;
}

export interface EducationalPriorityAssessment {
  priorityIndex: number; // uncalibrated 0-100 heuristic index
  priorityTier: 'HIGH_REVIEW' | 'MODERATE_MONITOR' | 'ROUTINE_SCREEN';
  featureContributions: FeatureContribution[];
  explanation: string;
}

export interface EncounterAnalysisResult {
  calculationStatus: 'COMPLETED_ESTIMATE';
  satellite: OrbitalObject;
  debris: OrbitalObject;
  startTimeIso: string;
  endTimeIso: string;
  timeWindowHours: number;
  tCaIso: string; // Time of Closest Approach
  tCaTimestampMs: number;
  minSeparationKm: number;
  relativeSpeedKmS: number;
  satellitePositionEci: Vector3D;
  debrisPositionEci: Vector3D;
  satelliteVelocityEci: Vector3D;
  debrisVelocityEci: Vector3D;
  approachAngleDeg: number;
  kineticEnergyMjPerKg: number;
  educationalThresholdKm: number;
  screeningFlag: boolean;
  distanceProfile: DistancePoint[];
  dataFreshnessHours: {
    satellite: number;
    debris: number;
  };
  educationalScreening: EducationalPriorityAssessment;
  calculatedAtIso: string;
}

export interface ValidationTestItem {
  id: string;
  category: 'SGP4' | 'COORDINATES' | 'ENCOUNTER_LOGIC' | 'DATA_INTEGRITY';
  name: string;
  description: string;
  expected: string;
  actual: string;
  tolerance: string;
  passed: boolean;
  durationMs: number;
}

export interface ValidationSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  runAt: string;
  tests: ValidationTestItem[];
}
