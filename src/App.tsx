import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Globe, Crosshair, ShieldCheck, ArrowRight } from 'lucide-react';
import { EncounterAnalysisResult, OrbitalObject } from './types/orbital';
import { analyzeCloseApproach } from './services/orbitalEngine';
import { createSyntheticEducationalPair, SYNTHETIC_SCENARIO_START, SYNTHETIC_SCENARIO_THRESHOLD_KM } from './services/syntheticScenario';
import { EncounterAnalyzer } from './components/modules/EncounterAnalyzer';
import { ExplainableAnalysis } from './components/modules/ExplainableAnalysis';
import { ScientificValidationModal } from './components/modules/ScientificValidationModal';
import { ViewerBoundary } from './components/earth3d/ViewerBoundary';
import { REAL_DEMO_START } from './services/demoScenario';
const EarthViewer = lazy(() => import('./components/earth3d/EarthViewer').then(m => ({ default: m.EarthViewer })));
type Section = 'monitor' | 'analyzer';

export default function App() {
  const [section, setSection] = useState<Section>('monitor');
  const [catalog, setCatalog] = useState<OrbitalObject[]>([]);
  const [objects, setObjects] = useState<OrbitalObject[]>([]);
  const [selected, setSelected] = useState<OrbitalObject | null>(null);
  const [satellite, setSatellite] = useState<OrbitalObject | null>(null);
  const [debris, setDebris] = useState<OrbitalObject | null>(null);
  const [result, setResult] = useState<EncounterAnalysisResult | null>(null);
  const [simTime, setSimTime] = useState(() => new Date(REAL_DEMO_START));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(60);
  const [showExplanation, setShowExplanation] = useState(false);
  const [validation, setValidation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const panel = useRef<HTMLDivElement>(null);
  const explanationPanel = useRef<HTMLDivElement>(null);
  const activeDemo = useRef(false);
  const loadCatalog = async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/demo/objects', { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('The bundled catalog could not be loaded. Retry, or launch the simulation.');
      const data = await response.json() as OrbitalObject[];
      if (!Array.isArray(data) || !data.length) throw new Error('The bundled catalog is empty. The simulation is still available.');
      setCatalog(data);
      if (!activeDemo.current) {
        setObjects(data.filter(o => o.noradId === 40697 || o.noradId === 31946));
        const sat = data.find(o => o.noradId === 40697) || null;
        setSatellite(sat); setDebris(data.find(o => o.noradId === 31946) || null); setSelected(sat);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Catalog unavailable. Please retry.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadCatalog(); }, []);
  useEffect(() => { panel.current?.scrollTo({ top: 0 }); }, [section, result]);
  useEffect(() => { if (showExplanation) explanationPanel.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, [showExplanation]);
  const runDemo = (synthetic: boolean) => {
    const [sat, deb] = synthetic ? createSyntheticEducationalPair() : [catalog.find(o => o.noradId === 40697), catalog.find(o => o.noradId === 31946)];
    if (!sat || !deb) { setError('The real-data pair is unavailable. Retry the catalog or use the simulation.'); return; }
    activeDemo.current = true;
    if (busy) return;
    setShowExplanation(false);
    setBusy(true); setError(''); setPlaying(false); setResult(null); setSection('analyzer');
    setObjects([sat, deb]); setSatellite(sat); setDebris(deb); setSelected(sat);
    const start = new Date(synthetic ? SYNTHETIC_SCENARIO_START : REAL_DEMO_START);
    setSimTime(start);
    window.setTimeout(() => {
      try {
        const calculated = analyzeCloseApproach(sat, deb, start, 24, synthetic ? SYNTHETIC_SCENARIO_THRESHOLD_KM : 25);
        setResult(calculated); setSimTime(new Date(calculated.tCaTimestampMs - 60000)); setSpeed(10); setPlaying(true);
      } catch (e) { setError(e instanceof Error ? e.message : 'Analysis failed. Try again.'); }
      finally { setBusy(false); }
    }, 60);
  };
  const synthetic = objects.some(o => o.isSynthetic);
  return <div className="app-shell">
    <header className="app-header">
      <a href="#" className="brand" onClick={e => { e.preventDefault(); setSection('monitor'); }}><Globe size={26}/><span>OrbitGuard <b>AI</b></span></a>
      <nav aria-label="Primary sections">{([
        ['monitor', 'Orbital Explorer', Globe], ['analyzer', 'Close-Approach Analysis', Crosshair],
      ] as const).map(([id, label, Icon]) => <button key={id} onClick={() => setSection(id)} aria-current={section === id ? 'page' : undefined}><Icon size={16}/><span>{label}</span></button>)}</nav>
      <button className="validation-button" onClick={() => setValidation(true)} title="Run scientific validation"><ShieldCheck size={18}/><span>Scientific checks</span></button>
    </header>
    <main className="workspace">
      <section className="earth-panel" aria-label="Interactive Earth and propagated orbits">
        <ViewerBoundary><Suspense fallback={<div className="viewer-loading" role="status">Preparing Earth and orbital paths…</div>}>
          <EarthViewer objects={objects} selectedObject={selected} onSelectObject={setSelected} encounterResult={result} simTime={simTime} onSimTimeChange={setSimTime} isPlaying={playing} onTogglePlay={() => setPlaying(p => !p)} simSpeedMultiplier={speed} onSpeedMultiplierChange={setSpeed} activeModule={section}/>
        </Suspense></ViewerBoundary>
        <div className="earth-caption"><span className="status-dot"/>{synthetic ? 'SIMULATION · controlled orbital elements' : 'HISTORICAL SNAPSHOT · 14 OCT 2026'}<br/><small>Calculated positions · markers enlarged for visibility · drag to rotate, scroll to zoom</small></div>
      </section>
      <section className="content-panel" ref={panel} aria-label={section === 'monitor' ? 'Orbital Explorer' : 'Close-Approach Analysis'}>
        {error && <div className="notice" role="alert">{error} <button onClick={() => void loadCatalog()} disabled={loading}>Retry catalog</button></div>}
        {section === 'monitor' && <>
          <div className="hero">
            <span className="eyebrow">SPACE SCIENCE, MADE UNDERSTANDABLE</span>
            <h1>Making Invisible<br/><span>Space Hazards Visible</span></h1>
            <p>Explore how satellites and debris move around Earth. Calculate a close approach with orbital mathematics, then understand it through AI-assisted explanations.</p>
            <button className="primary-action" disabled={busy || loading || !catalog.length} onClick={() => runDemo(false)}>Analyze Close Approach <ArrowRight size={18}/></button>
            <div className="hero-note">Explore the verified historical snapshot, then compare it with a clearly labeled educational simulation. These are calculated positions, not current live measurements.</div>
          </div>
          <div className="catalog-heading"><span>{loading ? 'Loading verified snapshot…' : synthetic ? 'Educational simulation · two controlled objects' : 'Cached historical snapshot · selected real pair'}</span><small>Analysis time: {simTime.toISOString()}</small><small>{synthetic ? 'Invented teaching inputs, propagated with SGP4' : 'CelesTrak GP · bundled locally · snapshot 14 October 2026'}</small></div>
          <div className="explanation-panel">{objects.map(object => <section className="learning-point" key={object.id}><h3 style={{color: object.classification === 'PAYLOAD' ? '#67ddec' : '#f3b65a'}}>{object.name} {object.isSynthetic ? '(SIMULATED)' : '(NORAD ' + object.noradId + ')'}</h3><p>Element epoch: {object.epoch}<br/>Source: {object.source}<br/>Downloaded: {object.downloadedAtIso || 'Not applicable to simulation'}</p></section>)}<p className="text-xs text-slate-400">Cyan: satellite · Orange: debris. Paths use SGP4 propagation. Markers are enlarged for visibility; overlap is not evidence of collision.</p></div>
        </>}
        {busy && <div className="notice" role="status">Calculating synchronized SGP4 positions and refining the closest approach…</div>}
        {section === 'analyzer' && <>
          <EncounterAnalyzer encounterResult={result} busy={busy} scenario={synthetic ? 'simulation' : 'real'} realAvailable={catalog.length > 0} onRunScenario={runDemo} onJumpToTime={date => { setSimTime(date); setPlaying(false); }} onExplain={() => setShowExplanation(true)}/>
          {showExplanation && result && <div ref={explanationPanel}><ExplainableAnalysis encounter={result} onNavigateToAnalyzer={() => { setShowExplanation(false); panel.current?.scrollTo({top:0}); }}/></div>}
        </>}
      </section>
    </main>
    <ScientificValidationModal isOpen={validation} onClose={() => setValidation(false)}/>
  </div>;
}
