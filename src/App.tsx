/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  EncounterAnalysisResult,
  OrbitalObject,
} from './types/orbital';
import {
  CATALOGUED_ORBITAL_OBJECTS,
  DataStatus,
  fetchOrbitalObjects,
  getDataStatus,
} from './services/celestrakService';
import { analyzeCloseApproach } from './services/orbitalEngine';
import { EarthViewer } from './components/earth3d/EarthViewer';
import { OrbitalMonitor } from './components/modules/OrbitalMonitor';
import { EncounterAnalyzer } from './components/modules/EncounterAnalyzer';
import { ExplainableAnalysis } from './components/modules/ExplainableAnalysis';
import { ScientificValidationModal } from './components/modules/ScientificValidationModal';
import { CompetitionDemoGuide } from './components/modules/CompetitionDemoGuide';
import {
  Globe,
  Crosshair,
  Brain,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Clock,
  Layers,
  ChevronRight,
  Database,
  ExternalLink,
  Award,
  Maximize2,
  Menu,
  X,
} from 'lucide-react';

export default function App() {
  const [objects, setObjects] = useState<OrbitalObject[]>(CATALOGUED_ORBITAL_OBJECTS);
  const [dataStatus, setDataStatus] = useState<DataStatus>(getDataStatus());
  const [isRefreshingData, setIsRefreshingData] = useState<boolean>(false);

  // Active module navigation
  const [activeModule, setActiveModule] = useState<'monitor' | 'analyzer' | 'explain'>('monitor');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Interactive selection state shared across all modules
  const [selectedObject, setSelectedObject] = useState<OrbitalObject | null>(() => {
    return CATALOGUED_ORBITAL_OBJECTS.find((o) => o.noradId === 40697) || null; // Sentinel-2A
  });

  const [selectedSatellite, setSelectedSatellite] = useState<OrbitalObject | null>(() => {
    return CATALOGUED_ORBITAL_OBJECTS.find((o) => o.noradId === 40697) || null; // Sentinel-2A
  });

  const [selectedDebris, setSelectedDebris] = useState<OrbitalObject | null>(() => {
    return CATALOGUED_ORBITAL_OBJECTS.find((o) => o.noradId === 34454) || null; // Cosmos 2251 Debris
  });

  const [encounterResult, setEncounterResult] = useState<EncounterAnalysisResult | null>(() => {
    // Pre-calculate canonical demo encounter on initial load so the entire suite is populated
    const sat = CATALOGUED_ORBITAL_OBJECTS.find((o) => o.noradId === 40697);
    const deb = CATALOGUED_ORBITAL_OBJECTS.find((o) => o.noradId === 34454);
    if (sat && deb) {
      return analyzeCloseApproach(sat, deb, new Date(), 24, 25);
    }
    return null;
  });

  // Simulation timeline state
  const [simTime, setSimTime] = useState<Date>(new Date());
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState<number>(60);

  // Modals
  const [isValidationOpen, setIsValidationOpen] = useState<boolean>(false);
  const [isDemoGuideOpen, setIsDemoGuideOpen] = useState<boolean>(false);

  // Load live CelesTrak catalog on mount
  useEffect(() => {
    let isMounted = true;
    fetchOrbitalObjects().then((fetched) => {
      if (isMounted && fetched.length > 0) {
        setObjects(fetched);
        setDataStatus(getDataStatus());
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleManualDataRefresh = async () => {
    setIsRefreshingData(true);
    try {
      const fresh = await fetchOrbitalObjects();
      setObjects(fresh);
      setDataStatus(getDataStatus());
    } finally {
      setIsRefreshingData(false);
    }
  };

  const handleSwitchToAnalyzerWithObject = (obj: OrbitalObject) => {
    if (obj.classification === 'PAYLOAD') {
      setSelectedSatellite(obj);
    } else {
      setSelectedDebris(obj);
    }
    setActiveModule('analyzer');
  };

  const handleLoadPresetScenario = () => {
    const s = objects.find((o) => o.noradId === 40697) || null;
    const d = objects.find((o) => o.noradId === 34454) || null;
    setSelectedSatellite(s);
    setSelectedDebris(d);
    if (s && d) {
      const res = analyzeCloseApproach(s, d, simTime, 24, 25);
      setEncounterResult(res);
    }
  };

  const flaggedCount = encounterResult && encounterResult.screeningFlag ? 1 : 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#081322] text-[#F1F5F9] font-sans">
      {/* LEFT NAVIGATION SIDEBAR */}
      <aside
        className={`flex flex-col bg-[#11243A] border-r border-[#24364B] transition-all duration-300 z-30 ${
          isSidebarOpen ? 'w-64 min-w-[16rem]' : 'w-16 min-w-[4rem]'
        }`}
      >
        {/* Brand Header */}
        <div className="p-3.5 border-b border-[#24364B] flex items-center justify-between bg-[#0c1a2c]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#37C9E8] to-[#6DA8FF] flex items-center justify-center flex-shrink-0 shadow-md">
              <Globe className="w-4 h-4 text-slate-950 font-bold" />
            </div>
            {isSidebarOpen && (
              <div className="min-w-0">
                <div className="text-sm font-black tracking-tight text-white leading-tight">
                  OrbitGuard <span className="text-[#37C9E8]">AI</span>
                </div>
                <div className="text-[10px] text-cyan-400 font-mono tracking-wide truncate">
                  ZASS Competition 2026
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1a3350] cursor-pointer transition"
            title={isSidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
          >
            {isSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Modules */}
        <div className="p-2 space-y-1">
          <div className={`px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider ${!isSidebarOpen && 'sr-only'}`}>
            Scientific Modules
          </div>

          {/* Module 1 */}
          <button
            onClick={() => setActiveModule('monitor')}
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeModule === 'monitor'
                ? 'bg-[#37C9E8] text-slate-950 shadow-md shadow-cyan-950/30'
                : 'text-slate-300 hover:bg-[#19324f] hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4 flex-shrink-0" />
            {isSidebarOpen && (
              <div className="flex-1 text-left flex items-center justify-between">
                <span>Orbital Monitor</span>
                <span className="text-[10px] font-mono opacity-80">M1</span>
              </div>
            )}
          </button>

          {/* Module 2 */}
          <button
            onClick={() => setActiveModule('analyzer')}
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeModule === 'analyzer'
                ? 'bg-[#37C9E8] text-slate-950 shadow-md shadow-cyan-950/30'
                : 'text-slate-300 hover:bg-[#19324f] hover:text-white'
            }`}
          >
            <Crosshair className="w-4 h-4 flex-shrink-0" />
            {isSidebarOpen && (
              <div className="flex-1 text-left flex items-center justify-between">
                <span>Encounter Analyzer</span>
                <span className="text-[10px] font-mono opacity-80">M2</span>
              </div>
            )}
          </button>

          {/* Module 3 */}
          <button
            onClick={() => setActiveModule('explain')}
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeModule === 'explain'
                ? 'bg-[#37C9E8] text-slate-950 shadow-md shadow-cyan-950/30'
                : 'text-slate-300 hover:bg-[#19324f] hover:text-white'
            }`}
          >
            <Brain className="w-4 h-4 flex-shrink-0" />
            {isSidebarOpen && (
              <div className="flex-1 text-left flex items-center justify-between">
                <span>Explainable Analysis</span>
                <span className="text-[10px] font-mono opacity-80">M3</span>
              </div>
            )}
          </button>
        </div>

        {/* Competition Action Buttons */}
        <div className="p-2 border-t border-[#24364B] space-y-1.5 mt-2">
          {isSidebarOpen && (
            <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Judge Evaluation Tools
            </div>
          )}

          {/* Demo Guide Launcher */}
          <button
            onClick={() => setIsDemoGuideOpen(true)}
            className="w-full flex items-center gap-2.5 p-2 rounded-lg bg-gradient-to-r from-purple-950/50 to-indigo-950/50 hover:from-purple-900/60 hover:to-indigo-900/60 border border-purple-500/30 text-purple-200 text-xs font-semibold cursor-pointer transition"
            title="3-Minute Competition Demo Walkthrough"
          >
            <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0" />
            {isSidebarOpen && <span>3-Min Pitch Guide</span>}
          </button>

          {/* Automated Test Suite Launcher */}
          <button
            onClick={() => setIsValidationOpen(true)}
            className="w-full flex items-center gap-2.5 p-2 rounded-lg bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-500/30 text-emerald-200 text-xs font-semibold cursor-pointer transition"
            title="Automated Scientific Validation Suite"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            {isSidebarOpen && <span>Run Validation Suite</span>}
          </button>
        </div>

        {/* CelesTrak Data Attribution & Freshness (Bottom of Sidebar) */}
        <div className="mt-auto p-3 border-t border-[#24364B] bg-[#0c1a2c] text-[11px] text-slate-400 space-y-1.5">
          {isSidebarOpen ? (
            <>
              <div className="flex items-center justify-between text-slate-300 font-semibold text-xs">
                <span className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-cyan-400" />
                  <span>CelesTrak GP Data</span>
                </span>
                <button
                  onClick={handleManualDataRefresh}
                  disabled={isRefreshingData}
                  className="p-1 rounded hover:bg-[#1a3350] text-slate-400 hover:text-cyan-400 cursor-pointer"
                  title="Refresh CelesTrak Ephemeris"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingData ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="text-[10px] space-y-0.5 text-slate-400 font-mono">
                <div>Objects: {dataStatus.totalObjects} ({dataStatus.payloadsCount} Sat / {dataStatus.debrisCount} Deb)</div>
                <div>Cached: {dataStatus.lastFetchedIso.slice(11, 16)} UTC</div>
                <div>Status: <span className="text-emerald-400 font-semibold">{dataStatus.isStale ? 'Stale' : 'Live Verified'}</span></div>
              </div>

              <div className="text-[9px] text-slate-500 leading-tight border-t border-[#24364B] pt-1">
                SGP4 engine adheres to Vallado standard; positions propagated dynamically.
              </div>
            </>
          ) : (
            <div className="flex justify-center">
              <Database className="w-4 h-4 text-cyan-400" />
            </div>
          )}
        </div>
      </aside>

      {/* MAIN VIEWPORT & SPLIT INTERFACE */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#081322]">
        {/* Top Mission Control Header */}
        <header className="h-14 border-b border-[#24364B] bg-[#0c1a2c] flex items-center justify-between px-4 z-20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400">MISSION CONTROL</span>
              <span className="text-slate-600">/</span>
              <span className="text-cyan-400 font-bold uppercase">
                {activeModule === 'monitor'
                  ? 'Module 1: Orbital Monitor'
                  : activeModule === 'analyzer'
                  ? 'Module 2: Encounter Analyzer'
                  : 'Module 3: Explainable Analysis'}
              </span>
            </div>

            {encounterResult && (
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                  encounterResult.screeningFlag
                    ? 'bg-[#EF6464]/20 border-[#EF6464]/50 text-[#EF6464]'
                    : 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300'
                }`}
              >
                {encounterResult.screeningFlag
                  ? `SCREENING FLAG: ${encounterResult.minSeparationKm.toFixed(1)} km`
                  : `NOMINAL BUFFER: ${encounterResult.minSeparationKm.toFixed(1)} km`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* UTC Clock */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg bg-[#11243A] border border-[#24364B] text-xs font-mono text-cyan-300">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{simTime.toISOString().slice(11, 19)} UTC</span>
            </div>

            {/* Quick Demo Walkthrough Button */}
            <button
              onClick={() => setIsDemoGuideOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden md:inline">ZASS 3-Min Pitch Walkthrough</span>
              <span className="md:hidden">Pitch</span>
            </button>

            {/* Validation Modal Trigger */}
            <button
              onClick={() => setIsValidationOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#19324f] hover:bg-[#23456c] border border-[#24364B] text-slate-200 text-xs font-semibold transition cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Validation Suite</span>
            </button>
          </div>
        </header>

        {/* Dynamic Split Body: 3D Earth on Left/Center, Active Module Panel on Right */}
        <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-3.5rem)] overflow-hidden">
          {/* 3D Earth Globe Viewport */}
          <div
            className={`h-1/2 lg:h-full relative overflow-hidden transition-all duration-300 ${
              activeModule === 'monitor' ? 'lg:flex-[1.2]' : 'lg:flex-[0.9]'
            }`}
          >
            <EarthViewer
              objects={objects}
              selectedObject={selectedObject}
              onSelectObject={(obj) => {
                setSelectedObject(obj);
                if (obj) {
                  if (obj.classification === 'PAYLOAD') {
                    setSelectedSatellite(obj);
                  } else {
                    setSelectedDebris(obj);
                  }
                }
              }}
              encounterResult={encounterResult}
              simTime={simTime}
              onSimTimeChange={setSimTime}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
              simSpeedMultiplier={simSpeedMultiplier}
              onSpeedMultiplierChange={setSimSpeedMultiplier}
              activeModule={activeModule}
            />
          </div>

          {/* Contextual Active Module Panel */}
          <div
            className={`h-1/2 lg:h-full border-t lg:border-t-0 lg:border-l border-[#24364B] overflow-hidden flex flex-col bg-[#11243A] transition-all duration-300 ${
              activeModule === 'monitor' ? 'lg:flex-[0.8] lg:max-w-md' : 'lg:flex-[1.1]'
            }`}
          >
            {activeModule === 'monitor' && (
              <OrbitalMonitor
                objects={objects}
                selectedObject={selectedObject}
                onSelectObject={setSelectedObject}
                simTime={simTime}
                onSwitchToAnalyzerWithObject={handleSwitchToAnalyzerWithObject}
                flaggedEncountersCount={flaggedCount}
              />
            )}

            {activeModule === 'analyzer' && (
              <EncounterAnalyzer
                objects={objects}
                selectedSatellite={selectedSatellite}
                selectedDebris={selectedDebris}
                onSelectSatellite={setSelectedSatellite}
                onSelectDebris={setSelectedDebris}
                encounterResult={encounterResult}
                onEncounterCalculated={setEncounterResult}
                onJumpToTime={(dt) => setSimTime(dt)}
                onSwitchToExplainable={() => setActiveModule('explain')}
                simTime={simTime}
              />
            )}

            {activeModule === 'explain' && (
              <ExplainableAnalysis
                encounter={encounterResult}
                onNavigateToAnalyzer={() => setActiveModule('analyzer')}
              />
            )}
          </div>
        </div>
      </main>

      {/* MODAL 1: Scientific Validation Suite */}
      <ScientificValidationModal
        isOpen={isValidationOpen}
        onClose={() => setIsValidationOpen(false)}
      />

      {/* MODAL 2: 3-Minute Competition Demo Walkthrough Guide */}
      <CompetitionDemoGuide
        isOpen={isDemoGuideOpen}
        onClose={() => setIsDemoGuideOpen(false)}
        onNavigateModule={(mod) => setActiveModule(mod)}
        onOpenValidation={() => setIsValidationOpen(true)}
        onLoadPresetScenario={handleLoadPresetScenario}
      />
    </div>
  );
}
