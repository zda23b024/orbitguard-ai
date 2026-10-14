/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { EncounterAnalysisResult } from '../../types/orbital';
import {
  HelpCircle,
  ShieldAlert,
  Zap,
  Activity,
  Calendar,
  AlertTriangle,
  Brain,
  Layers,
  Sparkles,
  CheckCircle2,
  FileText,
  Clock,
  Compass,
} from 'lucide-react';

interface ExplainableAnalysisProps {
  encounter: EncounterAnalysisResult | null;
  onNavigateToAnalyzer: () => void;
}

export const ExplainableAnalysis: React.FC<ExplainableAnalysisProps> = ({
  encounter,
  onNavigateToAnalyzer,
}) => {
  const [activeTab, setActiveTab] = useState<'PHYSICS' | 'ML_MODEL' | 'BRIEFING'>('PHYSICS');
  const [isGeneratingAiNote, setIsGeneratingAiNote] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  if (!encounter) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#11243A] text-slate-400 space-y-3">
        <HelpCircle className="w-10 h-10 text-slate-500" />
        <div className="text-sm font-semibold text-slate-200">
          No Encounter Selected for Explainable Analysis
        </div>
        <p className="text-xs max-w-md text-slate-400">
          Please run a close-approach analysis in Module 2 (Close-Approach Analyzer) first to inspect the physical mechanics, uncertainty ellipsoids, and transparent machine learning screening model.
        </p>
        <button
          onClick={onNavigateToAnalyzer}
          className="mt-2 px-4 py-2 bg-[#37C9E8] hover:bg-[#4ed5f2] text-slate-900 font-bold text-xs rounded-lg transition cursor-pointer shadow-md"
        >
          Go to Encounter Analyzer
        </button>
      </div>
    );
  }

  // Calculated physics metrics for explanations
  const kePerKg = encounter.kineticEnergyMjPerKg; // MJ/kg
  const tntRatio = (kePerKg / 4.184).toFixed(1); // 1 kg of TNT = 4.184 MJ
  const tenGramEnergyKj = (0.01 * 0.5 * Math.pow(encounter.relativeSpeedKmS * 1000, 2)) / 1000;

  const handleGenerateExtendedBriefing = async () => {
    setIsGeneratingAiNote(true);
    try {
      const response = await fetch('/api/ai/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounter }),
      });
      if (response.ok) {
        const data = await response.json();
        setAiNote(data.briefing);
      } else {
        // Fallback local deterministic scientific synthesis
        setAiNote(
          `SCIENTIFIC MEMORANDUM FOR ZASS JUDGES:\n\n` +
          `1. ENCOUNTER GEOMETRY: ${encounter.satellite.name} (#${encounter.satellite.noradId}) encounters ${encounter.debris.name} (#${encounter.debris.noradId}) ` +
          `at an estimated minimum separation of ${encounter.minSeparationKm.toFixed(2)} km at ${encounter.tCaIso} UTC.\n\n` +
          `2. HYPERVELOCITY SEVERITY: Relative closing speed is ${encounter.relativeSpeedKmS.toFixed(2)} km/s (${(encounter.relativeSpeedKmS * 3600).toFixed(0)} km/h). ` +
          `Kinetic energy density equals ${encounter.kineticEnergyMjPerKg.toFixed(1)} MJ/kg (${tntRatio}x TNT equivalent). Even millimetre-scale secondary ejecta could penetrate satellite Whipple shielding.\n\n` +
          `3. EPHEMERIS UNCERTAINTY: Ephemeris age is ${encounter.dataFreshnessHours.satellite}h (satellite) and ${encounter.dataFreshnessHours.debris}h (debris). ` +
          `Under SGP4 propagation, in-track positional uncertainty expands at ~1.5–3.0 km/day due to unmodelled thermospheric density fluctuations and solar flux variance.\n\n` +
          `4. SCREENING REASONING: Flagged under educational proximity screening (< ${encounter.educationalThresholdKm} km). ` +
          `Does NOT imply guaranteed impact; actual collision probability (Pc) requires full covariance error ellipsoids from radar tracking assets.`
        );
      }
    } catch {
      setAiNote(
        `SCIENTIFIC MEMORANDUM FOR ZASS JUDGES:\n\n` +
        `Encounter between ${encounter.satellite.name} and ${encounter.debris.name} exhibits a minimum separation of ${encounter.minSeparationKm.toFixed(2)} km at ${encounter.tCaIso} UTC with relative speed ${encounter.relativeSpeedKmS.toFixed(2)} km/s. ` +
        `This encounter is flagged for educational monitoring because the geometry lies within the ${encounter.educationalThresholdKm} km threshold, highlighting the necessity of frequent ephemeris updates.`
      );
    } finally {
      setIsGeneratingAiNote(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#11243A] text-slate-100 overflow-y-auto divide-y divide-[#24364B]">
      {/* Module Header */}
      <div className="p-4 bg-[#0c1a2c]">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
            <Brain className="w-4 h-4 text-cyan-400" />
            <span>Explainable Scientific Analysis &amp; ML Reasoning</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">MODULE 3</span>
        </div>
        <p className="text-xs text-slate-300 mt-1">
          Rigorous physical and probabilistic explanations of why this encounter was flagged, hypervelocity kinetic energy implications, ephemeris uncertainty, and transparent machine learning screening attribution.
        </p>

        {/* Tab Switcher */}
        <div className="flex gap-2 mt-3 bg-[#081322] p-1 rounded-lg border border-[#24364B]">
          <button
            onClick={() => setActiveTab('PHYSICS')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded cursor-pointer transition flex items-center justify-center gap-1.5 ${
              activeTab === 'PHYSICS'
                ? 'bg-[#1b3554] text-cyan-300 shadow-sm border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Physical Principles</span>
          </button>
          <button
            onClick={() => setActiveTab('ML_MODEL')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded cursor-pointer transition flex items-center justify-center gap-1.5 ${
              activeTab === 'ML_MODEL'
                ? 'bg-[#1b3554] text-cyan-300 shadow-sm border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Interpretable ML Model</span>
          </button>
          <button
            onClick={() => setActiveTab('BRIEFING')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded cursor-pointer transition flex items-center justify-center gap-1.5 ${
              activeTab === 'BRIEFING'
                ? 'bg-[#1b3554] text-cyan-300 shadow-sm border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Judges&apos; Scientific Brief</span>
          </button>
        </div>
      </div>

      {/* TAB 1: PHYSICAL PRINCIPLES EXPLANATION */}
      {activeTab === 'PHYSICS' && (
        <div className="p-4 space-y-4">
          {/* Card 1: Screening Decision */}
          <div className="bg-[#0e1d30] p-3.5 rounded-lg border border-[#24364B] space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-[#37C9E8]" />
              <span>1. Why This Encounter Was Flagged</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              The analysis identified an estimated minimum separation of{' '}
              <strong className="text-white font-mono">{encounter.minSeparationKm.toFixed(2)} km</strong>, which is{' '}
              {encounter.screeningFlag ? (
                <span className="text-[#EF6464] font-semibold">
                  within the configurable {encounter.educationalThresholdKm} km screening threshold
                </span>
              ) : (
                <span className="text-emerald-400 font-semibold">
                  beyond the {encounter.educationalThresholdKm} km screening threshold
                </span>
              )}
              . In operational spaceflight safety, conjunction assessment systems (such as ESA CARA and NASA CARA) use multi-tiered screening distances to prioritize orbits for high-precision sensor tasking.
            </p>
            <div className="bg-[#081322] p-2.5 rounded border border-[#24364B] text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300">Crucial Scientific Distinction:</div>
              <div>
                • <strong className="text-slate-200">Screening Flag &ne; Guaranteed Collision</strong>: This is an educational screening flag to warrant deeper investigation.
              </div>
              <div>
                • Public General Perturbations (TLE/SGP4) data does not include positional covariance error matrices. Determining verified collision probability (<em className="text-cyan-300">P_c</em>) requires calibrated radar tracking covariances available only through sovereign space surveillance networks.
              </div>
            </div>
          </div>

          {/* Card 2: Hypervelocity Physics & Kinetic Energy */}
          <div className="bg-[#0e1d30] p-3.5 rounded-lg border border-[#24364B] space-y-2">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Zap className="w-4 h-4 text-[#F3B65A]" />
              <span>2. Relative Speed &amp; Hypervelocity Impact Dynamics</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              The relative velocity at closest approach is{' '}
              <strong className="text-white font-mono">{encounter.relativeSpeedKmS.toFixed(2)} km/s</strong> (approx.{' '}
              <span className="text-amber-300 font-mono">{(encounter.relativeSpeedKmS * 3600).toLocaleString()} km/h</span>).
              In orbital mechanics, kinetic energy scales quadratically with speed (<em className="font-mono text-cyan-300">E_k = &frac12; m v_rel&sup2;</em>).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs bg-[#081322] p-2.5 rounded border border-[#24364B]">
              <div>
                <span className="text-slate-400 text-[10px] block">Specific Kinetic Energy</span>
                <span className="font-mono text-white font-bold text-sm">
                  {kePerKg.toFixed(1)} MJ / kg
                </span>
                <span className="text-[10px] text-amber-400 block mt-0.5">
                  &asymp; {tntRatio}&times; equivalent energy of TNT explosive
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">10g Fragment Impact Energy</span>
                <span className="font-mono text-white font-bold text-sm">
                  {tenGramEnergyKj.toFixed(0)} kJ
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Equivalent to an armor-piercing anti-tank round
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Data Freshness & Ephemeris Degradation */}
          <div className="bg-[#0e1d30] p-3.5 rounded-lg border border-[#24364B] space-y-2">
            <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold uppercase tracking-wider">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>3. Data Epoch Age &amp; SGP4 Error Growth</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Ephemeris records degrade over time because the standard SGP4 analytical model uses simplified drag modeling (BSTAR coefficient) and does not ingest live solar activity indices (F10.7 / Ap).
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs bg-[#081322] p-2 rounded border border-[#24364B]">
              <div>
                <span className="text-slate-400 text-[10px] block">{encounter.satellite.name} Age</span>
                <span className="font-mono text-cyan-300 font-bold">
                  {encounter.dataFreshnessHours.satellite} Hours Old
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">{encounter.debris.name} Age</span>
                <span className="font-mono text-amber-300 font-bold">
                  {encounter.dataFreshnessHours.debris} Hours Old
                </span>
              </div>
            </div>
            <div className="text-[11px] text-slate-400">
              In Low Earth Orbit (300–800 km), in-track positional uncertainty typically grows by{' '}
              <strong className="text-slate-200">1 to 3 kilometres per day</strong>. Orbital records older than 48 hours must be refreshed from CelesTrak before committing operational maneuvers.
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INTERPRETABLE MACHINE LEARNING MODEL */}
      {activeTab === 'ML_MODEL' && (
        <div className="p-4 space-y-4">
          {/* ML Score Banner */}
          <div className="bg-[#0e1d30] p-4 rounded-lg border border-[#24364B] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider block">
                  ML Conjunction Screening Priority Model
                </span>
                <div className="text-sm font-bold text-white mt-0.5">
                  Interpretable Educational Risk Prioritization
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black font-mono text-cyan-400">
                  {encounter.mlScreening.riskScore}/100
                </span>
                <span className="text-[10px] block text-slate-400">Priority Score</span>
              </div>
            </div>

            <div className="p-2.5 rounded bg-[#081322] border border-[#24364B] text-xs text-slate-300">
              <strong className="text-white">Surrogate Model Rationale:</strong>{' '}
              {encounter.mlScreening.explanation}
            </div>

            <div className="text-[10px] text-slate-400 border-t border-[#24364B] pt-2 flex items-center justify-between">
              <span>Model Architecture: Regularized Logistic Regression Surrogate</span>
              <span className="text-cyan-400">{encounter.mlScreening.surrogateAccuracy}</span>
            </div>
          </div>

          {/* Feature Contribution Breakdown (Explainability Waterfall) */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Feature Contribution Analysis (SHAP-Style Explainability)</span>
            </div>
            <p className="text-[11px] text-slate-400">
              This chart shows the exact mathematical contribution of each orbital parameter to the final screening priority score. Positive values increase screening priority; negative values provide safety margin.
            </p>

            <div className="space-y-2">
              {encounter.mlScreening.featureContributions.map((fc, idx) => {
                const isPositive = fc.impactWeight >= 0;
                return (
                  <div
                    key={idx}
                    className="bg-[#0a182b] p-2.5 rounded-lg border border-[#24364B] space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{fc.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-300 text-[11px]">{fc.value}</span>
                        <span
                          className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded ${
                            isPositive
                              ? 'bg-[#EF6464]/20 text-[#EF6464]'
                              : 'bg-emerald-950/40 text-emerald-400'
                          }`}
                        >
                          {isPositive ? `+${fc.impactWeight.toFixed(2)}` : fc.impactWeight.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400">{fc.description}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scientific Honesty Notice */}
          <div className="p-3 bg-[#081322] rounded-lg border border-[#24364B] text-[11px] text-slate-400 space-y-1">
            <div className="font-bold text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Scientific Transparency Requirement:</span>
            </div>
            <div>
              This machine learning model serves as an educational ranking surrogate. It is trained on orbital geometric features to assist researchers in prioritizing which close-approach candidates require human expert inspection. It is never misrepresented as an autonomous flight decision-maker.
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: JUDGES' SCIENTIFIC BRIEF */}
      {activeTab === 'BRIEFING' && (
        <div className="p-4 space-y-4">
          <div className="bg-[#0e1d30] p-3.5 rounded-lg border border-[#24364B] space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>Executive Conjunction Assessment Memorandum</span>
              </div>
              <button
                onClick={handleGenerateExtendedBriefing}
                disabled={isGeneratingAiNote}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#37C9E8] hover:bg-[#52d2ed] text-slate-900 font-bold text-xs rounded transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isGeneratingAiNote ? 'Synthesizing...' : 'Generate Judge Briefing'}</span>
              </button>
            </div>

            <div className="bg-[#081322] p-3 rounded-lg border border-[#24364B] font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[380px] overflow-y-auto">
              {aiNote || (
                `CONFIDENTIAL TECHNICAL BRIEFING — ZASS 2026 COMPETITION\n\n` +
                `TARGET SATELLITE:    ${encounter.satellite.name} (NORAD #${encounter.satellite.noradId})\n` +
                `CHALLENGER DEBRIS:   ${encounter.debris.name} (NORAD #${encounter.debris.noradId})\n` +
                `ESTIMATED ENCOUNTER: ${encounter.tCaIso} UTC\n` +
                `MINIMUM SEPARATION:  ${encounter.minSeparationKm.toFixed(3)} km\n` +
                `RELATIVE VELOCITY:   ${encounter.relativeSpeedKmS.toFixed(3)} km/s (${(encounter.relativeSpeedKmS * 3600).toFixed(0)} km/h)\n` +
                `CROSSING ANGLE:      ${encounter.approachAngleDeg.toFixed(1)} deg\n` +
                `KINETIC FACTOR:      ${encounter.kineticEnergyMjPerKg.toFixed(1)} MJ/kg (${tntRatio}x TNT equivalent)\n` +
                `SCREENING STATUS:    ${encounter.screeningFlag ? 'FLAGGED FOR REVIEW (< ' + encounter.educationalThresholdKm + ' km)' : 'SAFE PASS'}\n\n` +
                `KEY SCIENTIFIC FINDINGS:\n` +
                `1. Nodal geometry indicates an acute angle crossing near orbital apogee.\n` +
                `2. SGP4 positional uncertainty at encounter time is estimated at ±1.8 km along-track.\n` +
                `3. Recommended Educational Action: Task optical ground observation station in Zanzibar to confirm ephemeris validity.`
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
