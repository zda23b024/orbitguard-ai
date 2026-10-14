/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { EncounterAnalysisResult, OrbitalObject } from '../../types/orbital';
import { analyzeCloseApproach } from '../../services/orbitalEngine';
import { EncounterChart } from './EncounterChart';
import {
  AlertTriangle,
  Play,
  RotateCcw,
  Sliders,
  Clock,
  Compass,
  ArrowRight,
  ShieldAlert,
  Info,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';

interface EncounterAnalyzerProps {
  objects: OrbitalObject[];
  selectedSatellite: OrbitalObject | null;
  selectedDebris: OrbitalObject | null;
  onSelectSatellite: (sat: OrbitalObject | null) => void;
  onSelectDebris: (deb: OrbitalObject | null) => void;
  encounterResult: EncounterAnalysisResult | null;
  onEncounterCalculated: (result: EncounterAnalysisResult) => void;
  onJumpToTime: (date: Date) => void;
  onSwitchToExplainable: () => void;
  simTime: Date;
}

export const EncounterAnalyzer: React.FC<EncounterAnalyzerProps> = ({
  objects,
  selectedSatellite,
  selectedDebris,
  onSelectSatellite,
  onSelectDebris,
  encounterResult,
  onEncounterCalculated,
  onJumpToTime,
  onSwitchToExplainable,
  simTime,
}) => {
  const [timeWindowHours, setTimeWindowHours] = useState<number>(24);
  const [thresholdKm, setThresholdKm] = useState<number>(25);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  const satellites = objects.filter((o) => o.classification === 'PAYLOAD');
  const debrisList = objects.filter((o) => o.classification !== 'PAYLOAD');

  // Pre-configured scientific demonstration scenarios for competition demo
  const DEMO_SCENARIOS = [
    {
      title: 'Sentinel-2A vs Cosmos 2251 Debris',
      satNorad: 40697,
      debNorad: 34454,
      desc: 'Sun-synchronous Earth observation payload intersecting high-inclination collision fragment shell.',
    },
    {
      title: 'Landsat 9 vs Fengyun 1C Debris',
      satNorad: 49260,
      debNorad: 30799,
      desc: 'LEO 705 km science mission crossing the 2007 ASAT debris cloud.',
    },
    {
      title: 'ISS (Zarya) vs CZ-4B Debris',
      satNorad: 25544,
      debNorad: 45119,
      desc: 'Human-occupied space station orbital screening analysis against discarded upper stage fragment.',
    },
  ];

  const handleApplyScenario = (satNorad: number, debNorad: number) => {
    const s = satellites.find((sat) => sat.noradId === satNorad) || null;
    const d = debrisList.find((deb) => deb.noradId === debNorad) || null;
    onSelectSatellite(s);
    onSelectDebris(d);
  };

  const handleExecuteAnalysis = () => {
    if (!selectedSatellite || !selectedDebris) return;

    setIsCalculating(true);
    // Allow UI state to update then run SGP4 computation
    setTimeout(() => {
      try {
        const result = analyzeCloseApproach(
          selectedSatellite,
          selectedDebris,
          simTime,
          timeWindowHours,
          thresholdKm
        );
        onEncounterCalculated(result);
      } catch (err) {
        console.error('Encounter computation failed', err);
      } finally {
        setIsCalculating(false);
      }
    }, 50);
  };

  return (
    <div className="flex flex-col h-full bg-[#11243A] text-slate-100 overflow-y-auto divide-y divide-[#24364B]">
      {/* Top Header */}
      <div className="p-4 bg-[#0c1a2c]">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-cyan-400 font-semibold">
            Close-Approach SGP4 Encounter Analyzer
          </div>
          <span className="font-mono text-[10px] text-slate-400">MODULE 2</span>
        </div>
        <p className="text-xs text-slate-300 mt-1">
          Perform rigorous SGP4 propagation and numerical refinement to identify minimum 3D separation, encounter epoch, and relative velocity.
        </p>
      </div>

      {/* Quick Scientific Scenarios (Judges' Demo Helpers) */}
      <div className="p-3 bg-[#0e1d30] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Curated Competition Demo Scenarios</span>
          </span>
          <span className="text-[10px] text-slate-400">Quick-Load Pairings</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {DEMO_SCENARIOS.map((scen, idx) => (
            <button
              key={idx}
              onClick={() => handleApplyScenario(scen.satNorad, scen.debNorad)}
              className="text-left p-2 rounded-lg bg-[#11243A] hover:bg-[#18314e] border border-[#24364B] hover:border-cyan-400/50 transition cursor-pointer flex flex-col justify-between"
            >
              <div className="font-semibold text-xs text-slate-100 truncate">
                {scen.title}
              </div>
              <div className="text-[10px] text-slate-400 line-clamp-2 mt-1">
                {scen.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Target Selection & Analysis Controls */}
      <div className="p-4 space-y-4 bg-[#11243A]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Satellite Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#6DA8FF] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#6DA8FF]" />
              <span>Target Operational Satellite</span>
            </label>
            <select
              value={selectedSatellite?.id || ''}
              onChange={(e) => {
                const s = satellites.find((sat) => sat.id === e.target.value) || null;
                onSelectSatellite(s);
              }}
              className="w-full bg-[#081322] border border-[#24364B] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-400"
            >
              <option value="">Select Satellite...</option>
              {satellites.map((sat) => (
                <option key={sat.id} value={sat.id}>
                  {sat.name} (#{sat.noradId} - {sat.orbitClass})
                </option>
              ))}
            </select>
          </div>

          {/* Debris Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#F3B65A] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#F3B65A]" />
              <span>Target Space Debris / Fragment</span>
            </label>
            <select
              value={selectedDebris?.id || ''}
              onChange={(e) => {
                const d = debrisList.find((deb) => deb.id === e.target.value) || null;
                onSelectDebris(d);
              }}
              className="w-full bg-[#081322] border border-[#24364B] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-400"
            >
              <option value="">Select Debris Object...</option>
              {debrisList.map((deb) => (
                <option key={deb.id} value={deb.id}>
                  {deb.name} (#{deb.noradId} - {deb.classification})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sliders: Time Window & Screening Distance Threshold */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#0a182b] p-3 rounded-lg border border-[#24364B]">
          {/* Time Window */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Analysis Time Window</span>
              <span className="font-mono text-cyan-400 font-bold">{timeWindowHours} Hours</span>
            </div>
            <div className="flex gap-2">
              {[12, 24, 48, 72].map((hrs) => (
                <button
                  key={hrs}
                  onClick={() => setTimeWindowHours(hrs)}
                  className={`flex-1 py-1 text-xs rounded border transition cursor-pointer ${
                    timeWindowHours === hrs
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                      : 'bg-[#081322] border-[#24364B] text-slate-400 hover:text-white'
                  }`}
                >
                  {hrs}h
                </button>
              ))}
            </div>
            <div className="text-[10px] text-slate-400">
              Coarse step: 75s (~{Math.round((timeWindowHours * 3600) / 75)} evaluation nodes)
            </div>
          </div>

          {/* Educational Threshold */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Educational Screening Threshold</span>
              <span className="font-mono text-[#EF6464] font-bold">{thresholdKm} km</span>
            </div>
            <input
              type="range"
              min={5}
              max={75}
              step={5}
              value={thresholdKm}
              onChange={(e) => setThresholdKm(Number(e.target.value))}
              className="w-full accent-[#EF6464] cursor-pointer"
            />
            <div className="text-[10px] text-slate-400">
              Screening flag triggers if estimated separation d_min &le; {thresholdKm} km
            </div>
          </div>
        </div>

        {/* Run Analysis Button */}
        <button
          onClick={handleExecuteAnalysis}
          disabled={!selectedSatellite || !selectedDebris || isCalculating}
          className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer ${
            !selectedSatellite || !selectedDebris
              ? 'bg-[#1b2b3d] text-slate-500 cursor-not-allowed border border-[#24364B]'
              : isCalculating
              ? 'bg-[#37C9E8]/50 text-slate-900 cursor-wait'
              : 'bg-[#37C9E8] hover:bg-[#4ed5f2] text-slate-900 shadow-cyan-900/40'
          }`}
        >
          {isCalculating ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              <span>Propagating Orbital Ephemeris & Numerical Refinement...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Execute SGP4 Close-Approach Analysis</span>
            </>
          )}
        </button>
      </div>

      {/* Calculated Results Section */}
      {encounterResult && (
        <div className="p-4 space-y-4 bg-[#0a182b]">
          {/* Encounter Status Banner */}
          <div
            className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
              encounterResult.screeningFlag
                ? 'bg-[#EF6464]/15 border-[#EF6464]/60 text-slate-100'
                : 'bg-emerald-950/30 border-emerald-600/40 text-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ShieldAlert
                className={`w-5 h-5 flex-shrink-0 ${
                  encounterResult.screeningFlag ? 'text-[#EF6464]' : 'text-emerald-400'
                }`}
              />
              <div>
                <div className="text-xs font-bold uppercase tracking-wider">
                  {encounterResult.screeningFlag
                    ? 'Screening Flag: Close Proximity Encounter Identified'
                    : 'Screening Result: Minimum Separation Exceeds Threshold'}
                </div>
                <div className="text-[11px] text-slate-300">
                  {encounterResult.screeningFlag
                    ? `Estimated minimum separation of ${encounterResult.minSeparationKm.toFixed(2)} km is within the ${encounterResult.educationalThresholdKm} km screening threshold.`
                    : `Estimated minimum separation of ${encounterResult.minSeparationKm.toFixed(2)} km maintains safe distance (> ${encounterResult.educationalThresholdKm} km).`}
                </div>
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <span
                className={`text-[10px] font-mono font-bold px-2 py-1 rounded ${
                  encounterResult.screeningFlag
                    ? 'bg-[#EF6464] text-slate-900'
                    : 'bg-emerald-500 text-slate-900'
                }`}
              >
                {encounterResult.screeningFlag ? 'FLAGGED' : 'CLEAR'}
              </span>
            </div>
          </div>

          {/* Primary Quantitative Scientific Measurements */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-[#11243A] p-2.5 rounded-lg border border-[#24364B]">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Min Separation (d_min)
              </span>
              <span className="text-lg font-bold font-mono text-cyan-300">
                {encounterResult.minSeparationKm.toFixed(2)} km
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Refined sub-step norm
              </span>
            </div>

            <div className="bg-[#11243A] p-2.5 rounded-lg border border-[#24364B]">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Relative Speed (v_rel)
              </span>
              <span className="text-lg font-bold font-mono text-amber-300">
                {encounterResult.relativeSpeedKmS.toFixed(2)} km/s
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {(encounterResult.relativeSpeedKmS * 3600).toFixed(0)} km/h
              </span>
            </div>

            <div className="bg-[#11243A] p-2.5 rounded-lg border border-[#24364B]">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Time of Closest Approach
              </span>
              <span className="text-xs font-bold font-mono text-white block mt-1">
                {encounterResult.tCaIso.replace('T', ' ').slice(0, 19)}
              </span>
              <span className="text-[10px] text-slate-400 block">UTC Standard</span>
            </div>

            <div className="bg-[#11243A] p-2.5 rounded-lg border border-[#24364B]">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Approach Geometry Angle
              </span>
              <span className="text-lg font-bold font-mono text-slate-200">
                {encounterResult.approachAngleDeg.toFixed(1)}°
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Velocity vector crossing
              </span>
            </div>
          </div>

          {/* Interactive Distance-vs-Time Graph */}
          <div className="p-3 bg-[#11243A] rounded-lg border border-[#24364B]">
            <EncounterChart
              encounter={encounterResult}
              onSelectTime={(date) => onJumpToTime(date)}
            />
          </div>

          {/* Synchronization with 3D Globe & Navigation to Module 3 */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              onClick={() => onJumpToTime(new Date(encounterResult.tCaTimestampMs))}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1a3350] hover:bg-[#23456c] border border-[#24364B] text-cyan-300 text-xs font-semibold cursor-pointer transition"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Jump 3D Globe to Encounter Epoch (t_CA)</span>
            </button>

            <button
              onClick={onSwitchToExplainable}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#37C9E8] hover:bg-[#52d6f2] text-slate-900 font-bold text-xs shadow-md cursor-pointer transition ml-auto"
            >
              <span>Explain Physical &amp; ML Reasoning</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Empty State / Helpful Guidance */}
      {!encounterResult && (
        <div className="p-8 text-center text-slate-400 space-y-2">
          <Info className="w-8 h-8 text-slate-500 mx-auto" />
          <div className="text-xs font-medium text-slate-300">
            No encounter calculated yet
          </div>
          <p className="text-[11px] max-w-sm mx-auto text-slate-400">
            Select a satellite and space debris candidate above (or click a Curated Demo Scenario) and click &ldquo;Execute SGP4 Close-Approach Analysis&rdquo; to compute the encounter geometry.
          </p>
        </div>
      )}
    </div>
  );
};
