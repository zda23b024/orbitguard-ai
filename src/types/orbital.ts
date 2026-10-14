/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ObjectClassification = 'PAYLOAD' | 'DEBRIS' | 'ROCKET BODY' | 'UNKNOWN';

export interface OrbitalObject {
  id: string; // NORAD ID as string
  noradId: number;
  name: string;
  classification: ObjectClassification;
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
  source: string;
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
  impactWeight: number; // positive increases risk, negative decreases
  description: string;
}

export interface MLScreeningAssessment {
  riskScore: number; // 0-100
  riskTier: 'CRITICAL_REVIEW' | 'MODERATE_MONITOR' | 'ROUTINE_PASS';
  featureContributions: FeatureContribution[];
  explanation: string;
  surrogateAccuracy: string;
}

export interface EncounterAnalysisResult {
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
  mlScreening: MLScreeningAssessment;
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
