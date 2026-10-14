/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import {
  EncounterAnalysisResult,
  OrbitalObject,
} from './types/orbital';
import {
  DataStatus,
  getDataStatus,
} from './services/celestrakService';
import { createSyntheticEducationalPair, SYNTHETIC_SCENARIO_START } from './services/syntheticScenario';
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

const EarthViewer = lazy(() => import('./components/earth3d/EarthViewer').then((module) => ({ default: module.EarthViewer })));

async function loadCatalogFromApi(refresh?: 'all' | 'satellite'): Promise<{ objects: OrbitalObject[]; status: DataStatus }> {
  const refreshQuery = refresh === 'satellite' ? '?refresh=satellite' : refresh === 'all' ? '?refresh=true' : '';
  const objectsResponse = await fetch(`/api/objects${refreshQuery}`);
  if (!objectsResponse.ok) throw new Error(`Catalog request failed (${objectsResponse.status}).`);
  const objects = await objectsResponse.json() as OrbitalObject[];
  const statusResponse = await fetch('/api/data/status');
  if (!statusResponse.ok) throw new Error(`Data status request failed (${statusResponse.status}).`);
  const status = await statusResponse.json() as DataStatus;
  return { objects, status };
}

export default function App() {
  const [objects, setObjects] = useState<OrbitalObject[]>([]);
  const [catalogObjects, setCatalogObjects] = useState<OrbitalObject[]>([]);
  const [dataStatus, setDataStatus] = useState<DataStatus>(() => getDataStatus());
  const [isRefreshingData, setIsRefreshingData] = useState<boolean>(false);

  // Active module navigation
  const [activeModule, setActiveModule] = useState<'monitor' | 'analyzer' | 'explain'>('monitor');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Interactive selection state shared across all modules
  const [selectedObject, setSelectedObject] = useState<OrbitalObject | null>(null);

  const [selectedSatellite, setSelectedSatellite] = useState<OrbitalObject | null>(null);

  const [selectedDebris, setSelectedDebris] = useState<OrbitalObject | null>(null);

  const hasPayloadAndDebris = dataStatus.satelliteFeed.recordCount > 0 && dataStatus.debrisFeed.recordCount > 0;
  const bothFeedsCurrent = dataStatus.satelliteFeed.state === 'current' && dataStatus.debrisFeed.state === 'current';
  const historicalSnapshotLoaded = dataStatus.provenanceMode === 'historical'
    && dataStatus.satelliteFeed.recordCount > 0 && dataStatus.debrisFeed.recordCount > 0;

  const [encounterResult, setEncounterResult] = useState<EncounterAnalysisResult | null>(null);

  // Simulation timeline state
  const [simTime, setSimTime] = useState<Date>(() => new Date());
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState<number>(60);

  // Modals
  const [isValidationOpen, setIsValidationOpen] = useState<boolean>(false);
  const [isDemoGuideOpen, setIsDemoGuideOpen] = useState<boolean>(false);

  // Initial catalog reads are cache-only; provider calls happen through the explicit refresh control.
  useEffect(() => {
    let isMounted = true;
    loadCatalogFromApi().then(({ objects: fetched, status }) => {
      if (isMounted) {
        setObjects(fetched);
        setCatalogObjects(fetched);
        setDataStatus(status);
        setSimTime(status.provenanceMode === 'historical' && Number.isFinite(Date.parse(status.lastFetchedIso))
          ? new Date(status.lastFetchedIso)
          : new Date());
        setSelectedSatellite((current) => fetched.find((o) => o.id === current?.id) || fetched.find((o) => o.classification === 'PAYLOAD') || null);
        setSelectedDebris((current) => fetched.find((o) => o.id === current?.id) || fetched.find((o) => o.classification === 'DEBRIS' || o.classification === 'ROCKET BODY') || null);
        setSelectedObject((current) => fetched.find((o) => o.id === current?.id) || fetched[0] || null);
      }
    }).catch((error: unknown) => {
      if (isMounted) setDataStatus((current) => ({ ...current, lastError: error instanceof Error ? error.message : 'Unable to load catalog.' }));
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleManualDataRefresh = async () => {
    setIsRefreshingData(true);
    try {
      const refreshScope = dataStatus.debrisFeed.recordCount > 0 ? 'satellite' : 'all';
      const { objects: fresh, status } = await loadCatalogFromApi(refreshScope);
      setObjects(fresh);
      setCatalogObjects(fresh);
      setDataStatus(status);
      setSimTime(new Date());
      setEncounterResult(null);
      setSelectedSatellite((current) => fresh.find((o) => o.id === current?.id) || fresh.find((o) => o.classification === 'PAYLOAD') || null);
      setSelectedDebris((current) => fresh.find((o) => o.id === current?.id) || fresh.find((o) => o.classification === 'DEBRIS' || o.classification === 'ROCKET BODY') || null);
      setSelectedObject((current) => fresh.find((o) => o.id === current?.id) || fresh[0] || null);
    } catch (error) {
      setDataStatus((current) => ({ ...current, lastError: error instanceof Error ? error.message : 'Unable to refresh catalog.' }));
    } finally {
      setIsRefreshingData(false);
    }
  };

  const handleSwitchToAnalyzerWithObject = (obj: OrbitalObject) => {
    setEncounterResult(null);
    if (obj.classification === 'PAYLOAD') {
      setSelectedSatellite(obj);
    } else if (obj.classification === 'DEBRIS' || obj.classification === 'ROCKET BODY') {
      setSelectedDebris(obj);
    } else {
      return;
    }
    setActiveModule('analyzer');
  };

  const handleLoadSyntheticScenario = () => {
    const [syntheticSatellite, syntheticDebris] = createSyntheticEducationalPair();
    setObjects([syntheticSatellite, syntheticDebris]);
    setSelectedSatellite(syntheticSatellite);
    setSelectedDebris(syntheticDebris);
    setSelectedObject(syntheticSatellite);
    setEncounterResult(null);
    setSimTime(new Date(SYNTHETIC_SCENARIO_START));
    setIsPlaying(false);
    setActiveModule('analyzer');
  };

  const handleReturnToCatalog = () => {
    setObjects(catalogObjects);
    const satellite = catalogObjects.find((object) => object.noradId === 40697)
      || catalogObjects.find((object) => object.classification === 'PAYLOAD')
      || null;
    const debris = catalogObjects.find((object) => object.noradId === 34454)
      || catalogObjects.find((object) => object.classification === 'DEBRIS' || object.classification === 'ROCKET BODY')
      || null;
    setSelectedSatellite(satellite);
    setSelectedDebris(debris);
    setSelectedObject(satellite);
    setEncounterResult(null);
    const snapshotTime = satellite?.snapshotCapturedAtIso || debris?.snapshotCapturedAtIso;
    setSimTime(snapshotTime ? new Date(snapshotTime) : new Date());
    setIsPlaying(!snapshotTime);
  };

  const flaggedCount = encounterResult && encounterResult.screeningFlag ? 1 : 0;
  const syntheticModeActive = objects.length > 0 && objects.every((object) => object.isSynthetic);
  const displayedPayloads = objects.filter((object) => object.classification === 'PAYLOAD').length;
  const displayedDebris = objects.filter((object) => object.classification === 'DEBRIS' || object.classification === 'ROCKET BODY').length;

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
                  <span>Orbital Data Provenance</span>
                </span>
                <button
                  onClick={handleManualDataRefresh}
                  disabled={isRefreshingData}
                  className="p-1 rounded hover:bg-[#1a3350] text-slate-400 hover:text-cyan-400 cursor-pointer"
                  title="Refresh orbital data; uses the small satellite query when debris is already cached"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingData ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="text-[10px] space-y-0.5 text-slate-400 font-mono">
                <div>Displayed catalog: {objects.length} ({displayedPayloads} payload / {displayedDebris} debris)</div>
                <div>Current mode: {dataStatus.liveAccessDisabled ? 'DISABLED by offline mode' : `${dataStatus.satelliteFeed.recordCount} payload / ${dataStatus.debrisFeed.recordCount} debris from current provider cache`}</div>
                <div className="text-amber-300">Historical analysis: {historicalSnapshotLoaded ? `AVAILABLE · snapshot captured ${dataStatus.lastFetchedIso.slice(0, 16).replace('T', ' ')} UTC` : 'UNAVAILABLE · no verified provider snapshot is loaded.'}</div>
                <div>Synthetic mode: {syntheticModeActive ? 'ACTIVE' : 'AVAILABLE'} · isolated controlled OMM pair</div>
                <div>Satellite feed: <span className={dataStatus.satelliteFeed.state === 'current' ? 'text-emerald-300' : 'text-amber-300'}>{dataStatus.satelliteFeed.state.toUpperCase()} · {dataStatus.satelliteFeed.recordCount}</span></div>
                <div>Debris feed: <span className={dataStatus.debrisFeed.state === 'current' ? 'text-emerald-300' : 'text-amber-300'}>{dataStatus.debrisFeed.state.toUpperCase()} · {dataStatus.debrisFeed.recordCount}</span></div>
                {dataStatus.satelliteFeed.downloadTimestampIso && <div>Satellite downloaded: {dataStatus.satelliteFeed.downloadTimestampIso.slice(0, 16).replace('T', ' ')} UTC</div>}
                {dataStatus.debrisFeed.downloadTimestampIso && <div>Debris downloaded: {dataStatus.debrisFeed.downloadTimestampIso.slice(0, 16).replace('T', ' ')} UTC</div>}
                <div>Satellite epochs: {dataStatus.satelliteFeed.oldestEpochIso ? `${dataStatus.satelliteFeed.oldestEpochIso.slice(0, 10)} → ${dataStatus.satelliteFeed.newestEpochIso.slice(0, 10)} UTC` : 'Unavailable'}</div>
                <div>Debris epochs: {dataStatus.debrisFeed.oldestEpochIso ? `${dataStatus.debrisFeed.oldestEpochIso.slice(0, 10)} → ${dataStatus.debrisFeed.newestEpochIso.slice(0, 10)} UTC` : 'Unavailable'}</div>
                <div>Last checked: {dataStatus.lastAttemptIso ? `${dataStatus.lastAttemptIso.slice(0, 16).replace('T', ' ')} UTC` : 'Not checked this session'}</div>
                <div>Status: <span className={`font-semibold ${dataStatus.isFallback || dataStatus.isStale || dataStatus.satelliteFeed.state !== 'current' || dataStatus.debrisFeed.state !== 'current' || syntheticModeActive ? 'text-amber-300' : 'text-emerald-400'}`}>{syntheticModeActive ? 'Synthetic educational scenario' : dataStatus.provenanceMode === 'historical' ? historicalSnapshotLoaded ? 'Historical provider snapshot' : 'Historical snapshot unavailable' : bothFeedsCurrent ? 'Current satellite + debris feeds' : hasPayloadAndDebris ? 'Both categories available; one or more feeds are cached' : 'Current feed incomplete'}</span></div>
                {dataStatus.satelliteFeed.responseDetail && <div className="text-amber-300">Satellite response: {dataStatus.satelliteFeed.responseDetail}</div>}
                {dataStatus.debrisFeed.responseDetail && <div className="text-amber-300">Debris response: {dataStatus.debrisFeed.responseDetail}</div>}
                {!dataStatus.liveAccessDisabled && dataStatus.lastError && <div className="text-amber-300">Refresh issue: {dataStatus.lastError}</div>}
                {dataStatus.retryAfterIso && <div>Next retry after: {dataStatus.retryAfterIso.slice(0, 16).replace('T', ' ')} UTC</div>}
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
                  : `ABOVE EDUCATIONAL SCREEN: ${encounterResult.minSeparationKm.toFixed(1)} km`}
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
            <Suspense fallback={<div className="h-full w-full flex items-center justify-center text-cyan-300 text-sm font-mono">Loading interactive Earth…</div>}>
              <EarthViewer
                objects={objects}
                selectedObject={selectedObject}
                onSelectObject={(obj) => {
                  setSelectedObject(obj);
                  if (obj) {
                    setEncounterResult(null);
                    if (obj.classification === 'PAYLOAD') {
                      setSelectedSatellite(obj);
                    } else if (obj.classification === 'DEBRIS' || obj.classification === 'ROCKET BODY') {
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
            </Suspense>
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
              onSelectSatellite={(sat) => { setSelectedSatellite(sat); setEncounterResult(null); }}
                onSelectDebris={(deb) => { setSelectedDebris(deb); setEncounterResult(null); }}
                encounterResult={encounterResult}
                onEncounterCalculated={setEncounterResult}
                onJumpToTime={(dt) => { setSimTime(dt); setIsPlaying(false); }}
                onSwitchToExplainable={() => setActiveModule('explain')}
                onLoadSyntheticScenario={handleLoadSyntheticScenario}
                onReturnToCatalog={handleReturnToCatalog}
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
        onLoadScenario={handleLoadSyntheticScenario}
      />
    </div>
  );
}
