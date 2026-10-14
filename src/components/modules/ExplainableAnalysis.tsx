/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { EncounterAnalysisResult, formatObjectIdentifier } from '../../types/orbital';
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
  const [activeTab, setActiveTab] = useState<'PHYSICS' | 'SCREENING' | 'BRIEFING'>('PHYSICS');
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingSource, setBriefingSource] = useState<'gemini' | 'deterministic' | 'local' | null>(null);
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);

  useEffect(() => {
    setBriefing(null);
    setBriefingSource(null);
  }, [encounter?.calculatedAtIso]);

  if (!encounter) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#11243A] text-slate-400 space-y-3">
        <HelpCircle className="w-10 h-10 text-slate-500" />
        <div className="text-sm font-semibold text-slate-200">
          No Encounter Selected for Explainable Analysis
        </div>
        <p className="text-xs max-w-md text-slate-400">
          Run a close-approach analysis in Module 2 first to inspect the calculated separation, relative speed, and educational screening details.
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
  const buildLocalSummary = () =>
      `SCIENTIFIC SCREENING SUMMARY\n\n` +
      `OBJECTS: ${encounter.satellite.name} (${formatObjectIdentifier(encounter.satellite)}) and ${encounter.debris.name} (${formatObjectIdentifier(encounter.debris)})\n` +
      `${encounter.satellite.isSynthetic || encounter.debris.isSynthetic ? 'SCENARIO: Synthetic controlled-orbit demonstration; not an observed conjunction or real-world warning.\n' : ''}` +
      `ELEMENT EPOCHS: ${encounter.satellite.epoch} UTC; ${encounter.debris.epoch} UTC\n` +
      `ESTIMATED CLOSEST APPROACH: ${encounter.tCaIso} UTC\n` +
      `ESTIMATED SEPARATION: ${encounter.minSeparationKm.toFixed(3)} km\n` +
      `RELATIVE SPEED: ${encounter.relativeSpeedKmS.toFixed(3)} km/s\n` +
      `EDUCATIONAL SCREEN: ${encounter.educationalThresholdKm} km; ${encounter.screeningFlag ? 'estimated separation is within the screen' : 'estimated separation is outside the screen'}\n\n` +
      `LIMITATIONS: Values are propagated from the listed public orbital elements. Their ages are ${encounter.dataFreshnessHours.satellite} h and ${encounter.dataFreshnessHours.debris} h at calculation time. This application does not calculate uncertainty or collision probability; the priority index is an uncalibrated educational heuristic.`;

  const handleGenerateBriefing = async () => {
    setIsGeneratingBriefing(true);
    try {
      const response = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          satelliteId: encounter.satellite.id,
          debrisId: encounter.debris.id,
          startTime: encounter.startTimeIso,
          timeWindowHours: encounter.timeWindowHours,
          thresholdKm: encounter.educationalThresholdKm,
        }),
      });
      if (!response.ok) throw new Error(`Explanation request failed (${response.status}).`);
      const result = await response.json() as { summary: string; explanation: string; source: 'gemini' | 'deterministic' };
      setBriefing(`${result.summary}\n\nEXPLANATION (${result.source === 'gemini' ? 'Gemini language only' : 'deterministic fallback'})\n${result.explanation}`);
      setBriefingSource(result.source);
    } catch {
      setBriefing(`${buildLocalSummary()}\n\nEXPLANATION (local fallback)\nThe closest point and relative speed are computed from propagated states in the selected window. The configured threshold is educational only; the application does not quantify uncertainty or provide operational guidance.`);
      setBriefingSource('local');
    } finally {
      setIsGeneratingBriefing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#11243A] text-slate-100 overflow-y-auto divide-y divide-[#24364B]">
      {/* Module Header */}
      <div className="p-4 bg-[#0c1a2c]">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
            <Brain className="w-4 h-4 text-cyan-400" />
            <span>Explainable Scientific Analysis</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">MODULE 3</span>
        </div>
        <p className="text-xs text-slate-300 mt-1">
          Physical explanation of the estimated encounter, screening threshold, element age, and data limitations.
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
            onClick={() => setActiveTab('SCREENING')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded cursor-pointer transition flex items-center justify-center gap-1.5 ${
              activeTab === 'SCREENING'
                ? 'bg-[#1b3554] text-cyan-300 shadow-sm border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Screening Details</span>
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
              <span>1. Screening Result and Interpretation</span>
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
              This user-configured threshold is an educational screen, not an operational flight-safety threshold.
            </p>
            <div className="bg-[#081322] p-2.5 rounded border border-[#24364B] text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300">Crucial Scientific Distinction:</div>
              <div>
                • <strong className="text-slate-200">Screening Flag &ne; Guaranteed Collision</strong>: This is an educational screening flag to warrant deeper investigation.
              </div>
              <div>
                • The public orbital elements used in this calculation do not provide positional covariance. This application therefore cannot calculate collision probability (<em className="text-cyan-300">P_c</em>).
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
                  &asymp; {tntRatio}&times; the specific energy of TNT (energy comparison only)
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Interpretation</span>
                <span className="text-[11px] text-slate-300 block mt-0.5">Energy per unit mass does not predict damage without object mass, shape, material, and impact geometry.</span>
              </div>
            </div>
          </div>

          {/* Card 3: Data Freshness & Ephemeris Degradation */}
          <div className="bg-[#0e1d30] p-3.5 rounded-lg border border-[#24364B] space-y-2">
            <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold uppercase tracking-wider">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>3. Data Epoch Age &amp; Uncertainty Limits</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              The propagation uses public orbital elements and SGP4. This prototype does not calculate covariance or a position-error bound from element age.
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
              An older epoch means a longer extrapolation interval. This prototype does not calculate an uncertainty bound; do not use it to make operational maneuver decisions.
            </div>
          </div>
        </div>
      )}

          {/* TAB 2: EDUCATIONAL SCREENING HEURISTIC */}
      {activeTab === 'SCREENING' && (
        <div className="p-4 space-y-4">
          {/* Educational heuristic score */}
          <div className="bg-[#0e1d30] p-4 rounded-lg border border-[#24364B] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider block">
                  Educational Screening Index
                </span>
                <div className="text-sm font-bold text-white mt-0.5">
                  Uncalibrated heuristic priority score; not a collision probability
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black font-mono text-cyan-400">
                  {encounter.educationalScreening.priorityIndex}/100
                </span>
                <span className="text-[10px] block text-slate-400">Priority Score</span>
              </div>
            </div>

            <div className="p-2.5 rounded bg-[#081322] border border-[#24364B] text-xs text-slate-300">
              <strong className="text-white">Screening rationale:</strong>{' '}
              {encounter.educationalScreening.explanation}
            </div>

            <div className="text-[10px] text-slate-400 border-t border-[#24364B] pt-2 flex items-center justify-between">
              <span>Hand-weighted physics and data-age rules</span>
              <span className="text-cyan-400">Uncalibrated heuristic</span>
            </div>
          </div>

          {/* Feature Contribution Breakdown (Explainability Waterfall) */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Rule contribution breakdown</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Contributions show how the documented heuristic changes its ranking. They are not trained feature attributions or collision probabilities.
            </p>

            <div className="space-y-2">
              {encounter.educationalScreening.featureContributions.map((fc, idx) => {
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
              This manually weighted educational index is not trained or calibrated against conjunction outcomes. Use the measured separation and element ages directly; this index does not estimate collision probability.
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
                <span>Scientific Screening Summary</span>
                {briefingSource && <span className="ml-2 text-[9px] text-slate-400">{briefingSource === 'gemini' ? 'Gemini wording · measurements computed by SGP4' : 'Deterministic wording'}</span>}
              </div>
              <button
                onClick={handleGenerateBriefing}
                disabled={isGeneratingBriefing}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#37C9E8] hover:bg-[#52d2ed] text-slate-900 font-bold text-xs rounded transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isGeneratingBriefing ? 'Preparing…' : 'Generate Summary'}</span>
              </button>
            </div>

            <div className="bg-[#081322] p-3 rounded-lg border border-[#24364B] font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[380px] overflow-y-auto">
              {briefing || (
                `SCIENTIFIC SCREENING SUMMARY — ZASS 2026\n\n` +
                `TARGET SATELLITE:    ${encounter.satellite.name} (${formatObjectIdentifier(encounter.satellite)})\n` +
                `CHALLENGER DEBRIS:   ${encounter.debris.name} (${formatObjectIdentifier(encounter.debris)})\n` +
                `ESTIMATED ENCOUNTER: ${encounter.tCaIso} UTC\n` +
                `MINIMUM SEPARATION:  ${encounter.minSeparationKm.toFixed(3)} km\n` +
                `RELATIVE VELOCITY:   ${encounter.relativeSpeedKmS.toFixed(3)} km/s (${(encounter.relativeSpeedKmS * 3600).toFixed(0)} km/h)\n` +
                `CROSSING ANGLE:      ${encounter.approachAngleDeg.toFixed(1)} deg\n` +
                `KINETIC ENERGY PER MASS: ${encounter.kineticEnergyMjPerKg.toFixed(1)} MJ/kg\n` +
                `SCREENING STATUS:    ${encounter.screeningFlag ? 'WITHIN EDUCATIONAL THRESHOLD (< ' + encounter.educationalThresholdKm + ' km)' : 'ABOVE EDUCATIONAL THRESHOLD'}\n\n` +
                `Element epochs: ${encounter.satellite.epoch} and ${encounter.debris.epoch}. This analysis does not calculate collision probability; public orbital elements do not provide covariance in this application.`
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
