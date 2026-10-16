import React, { useEffect, useState } from 'react';
import { EncounterAnalysisResult, formatObjectIdentifier } from '../../types/orbital';
import { Brain, ArrowRight } from 'lucide-react';

interface Props { encounter: EncounterAnalysisResult | null; onNavigateToAnalyzer: () => void; }
export const ExplainableAnalysis: React.FC<Props> = ({ encounter, onNavigateToAnalyzer }) => {
  const [tab, setTab] = useState<'student' | 'technical'>('student');
  const [wording, setWording] = useState('');
  const [source, setSource] = useState<'gemini' | 'deterministic'>('deterministic');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!encounter) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let active = true;
    setWording(''); setSource('deterministic'); setBusy(true);
    setStatus('Asking Gemini to explain the verified result. Built-in explanations remain available below.');
    void (async () => {
      try {
        const response = await fetch('/api/ai/explain', {
          method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ satelliteId: encounter.satellite.id, debrisId: encounter.debris.id, startTime: encounter.startTimeIso, timeWindowHours: encounter.timeWindowHours, thresholdKm: encounter.educationalThresholdKm, dataset: encounter.satellite.dataMode === 'historical' ? 'historical' : undefined }),
        });
        if (!response.ok) throw new Error('Explanation service unavailable');
        const data = await response.json();
        if (!active) return;
        if (data.measurements?.minSeparationKm !== encounter.minSeparationKm || data.measurements?.relativeSpeedKmS !== encounter.relativeSpeedKmS || data.measurements?.tCaIso !== encounter.tCaIso) throw new Error('The server result differs from the displayed calculation');
        if (typeof data.explanation !== 'string' || !['gemini', 'deterministic'].includes(data.source)) throw new Error('Invalid explanation response');
        setSource(data.source); setWording(data.explanation);
        setStatus(data.source === 'gemini' ? 'AI-generated explanation · Gemini wording; SGP4 measurements' : `Built-in scientific explanation · ${data.fallbackReason === 'disabled' ? 'Gemini disabled' : data.fallbackReason === 'not_configured' ? 'Gemini not configured' : data.fallbackReason === 'response_rejected' ? 'AI wording did not pass the scientific safeguards' : 'Gemini temporarily unavailable'}`);
      } catch {
        if (active) { setSource('deterministic'); setStatus('Built-in scientific explanation · AI service unavailable or result mismatch'); }
      } finally { clearTimeout(timer); if (active) setBusy(false); }
    })();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [encounter, retry]);
  if (!encounter) return <div className="explanation-panel"><Brain className="text-cyan-300 mb-4"/><h2>Every explanation starts with a calculation.</h2><p className="text-slate-400 text-sm my-5">Launch a demonstration in the Close-Approach Analysis, then choose Explain with AI.</p><button className="primary-action" onClick={onNavigateToAnalyzer}>Open Close-Approach Analysis <ArrowRight size={16}/></button></div>;
  const e = encounter;
  const simulated = Boolean(e.satellite.isSynthetic);
  const points = [
    ['Meet the objects', simulated ? 'These are two invented teaching objects: a satellite and a debris fragment. Their controlled orbital elements go through the same SGP4 physics engine as real records.' : `${e.satellite.name} is the selected payload satellite. ${e.debris.name} is a cataloged debris fragment. This example uses stored CelesTrak orbital elements, not current measurements.`],
    ['Two paths around Earth', 'The blue path belongs to the satellite and the orange path to the debris. SGP4 estimates where each object moves from its orbital elements. The paths and markers are calculated positions, not direct observations.'],
    ['What does minimum separation mean?', `During the selected ${e.timeWindowHours}-hour window, the closest distance found between the modeled positions is ${e.minSeparationKm.toFixed(3)} km. This happens at ${e.tCaIso}. A smaller distance means a closer modeled approach, not a measured collision probability.`],
    ['What does relative speed mean?', `The relative speed at that instant is ${e.relativeSpeedKmS.toFixed(3)} km/s. It describes how fast the objects move relative to each other, using the difference of their velocity vectors. It is not either object's individual speed around Earth.`],
    ['A close approach is not a collision', `The ${e.educationalThresholdKm} km threshold is an educational screen. Crossing it only highlights an estimated close approach. Orbital uncertainty and object dimensions would also be needed for an operational assessment; this app does not calculate collision probability.`],
    ['Why this matters on Earth', 'Satellites support weather forecasts, communications, navigation, and Earth observation. Understanding the space environment helps students see why these services depend on responsible satellite operations.'],
    ['What we can conclude', simulated ? 'We can explore how these synthetic inputs produce a close approach. This is not a real event or an operational warning.' : 'We can reproduce a modeled historical approach from the stored elements. We cannot conclude that the objects collided, are currently close, or require a maneuver.'],
  ];
  return <div className="explanation-panel">
    <span className="eyebrow">PHYSICS CALCULATES. AI EXPLAINS.</span><h2 className="mt-3">Understand this encounter</h2>
    <div className="metric-strip"><div><strong>{e.minSeparationKm.toFixed(3)} km</strong><small>Modeled minimum separation</small></div><div><strong>{e.relativeSpeedKmS.toFixed(3)} km/s</strong><small>Relative speed at closest approach</small></div></div>
    <div className="rounded-xl border border-cyan-800/50 bg-cyan-950/20 p-4" aria-live="polite"><p className="text-xs text-cyan-200 font-semibold">{busy ? 'Requesting AI wording…' : source === 'gemini' ? 'AI-generated explanation' : 'Built-in scientific explanation'}</p><p className="text-xs text-slate-400 mt-2">{status}</p>{wording && <p className="text-sm text-slate-200 mt-3">{wording}</p>}<button className="secondary-action mb-0" disabled={busy} onClick={() => setRetry(r => r + 1)}>Retry AI explanation</button></div>
    <div className="explanation-tabs" role="tablist" aria-label="Explanation level"><button role="tab" aria-selected={tab === 'student'} onClick={() => setTab('student')}>For students</button><button role="tab" aria-selected={tab === 'technical'} onClick={() => setTab('technical')}>For judges · technical</button></div>
    {tab === 'student' ? <div role="tabpanel">{points.map(([title, text]) => <section className="learning-point" key={title}><h3>{title}</h3><p>{text}</p></section>)}<details><summary>Why do the markers look much larger than real objects?</summary><p className="mt-3">They are enlarged so you can find them. Use the numerical distance and chart for separation; marker size and overlap do not represent physical object size or collision.</p></details><details><summary>Does AI calculate the orbit?</summary><p className="mt-3">No. SGP4 produces positions and velocities. A numerical search estimates closest approach. Gemini only explains these verified outputs; the fixed measurements above never come from generated text.</p></details></div> : <div role="tabpanel">
      <section className="learning-point"><h3>Method and reproducibility</h3><p>SGP4 propagates both objects to synchronized UTC times in TEME. Separation is the norm of the position difference; relative speed is the norm of the velocity difference at closest approach. The engine samples every 30 seconds and refines candidate minima to a 1 ms numerical tolerance. Numerical precision is not a physical accuracy guarantee.</p></section>
      <pre>{`DATA MODE: ${simulated ? 'SIMULATION' : 'HISTORICAL SNAPSHOT'}\nOBJECTS: ${e.satellite.name} (${formatObjectIdentifier(e.satellite)}) / ${e.debris.name} (${formatObjectIdentifier(e.debris)})\nELEMENT EPOCHS: ${e.satellite.epoch} / ${e.debris.epoch}\nWINDOW: ${e.startTimeIso} to ${e.endTimeIso}\nCLOSEST APPROACH: ${e.tCaIso}\nSNAPSHOT: ${e.satellite.snapshotCapturedAtIso || 'Not applicable: synthetic inputs'}\nDOWNLOADS: ${e.satellite.downloadedAtIso || 'Not applicable'} / ${e.debris.downloadedAtIso || 'Not applicable'}\nSOURCES: ${e.satellite.source} / ${e.debris.source}\nCOMPUTED: ${e.calculatedAtIso}`}</pre>
      <section className="learning-point"><h3>Scope and limitations</h3><p>Public orbital elements provide no covariance here. This finite-window search can miss narrow minima and does not model all uncertainties. No collision probability, maneuver advice, operational alert, or trained collision-prediction model is provided. The chart and explanations reference the calculation above, while the 3D playback clock can move independently.</p></section>
    </div>}
    <button className="secondary-action" onClick={onNavigateToAnalyzer}>Return to the encounter and chart <ArrowRight size={15}/></button>
  </div>;
};
