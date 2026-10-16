import React from 'react';
import { EncounterAnalysisResult } from '../../types/orbital';
import { EncounterChart } from './EncounterChart';
import { Brain, Crosshair } from 'lucide-react';
interface Props {
  encounterResult: EncounterAnalysisResult | null;
  busy: boolean;
  scenario: 'real' | 'simulation';
  realAvailable: boolean;
  onRunScenario: (synthetic: boolean) => void;
  onJumpToTime: (time: Date) => void;
  onExplain: () => void;
}
export function EncounterAnalyzer({encounterResult: e, busy, scenario, realAvailable, onRunScenario, onJumpToTime, onExplain}: Props) {
  return <div className="explanation-panel">
    <span className="eyebrow">ONE EXPERIMENT · TWO DATA SOURCES</span>
    <h2 className="mt-3">Close-Approach Analysis</h2>
    <p className="text-sm text-slate-400 mt-3">Choose an example. SGP4 calculates both trajectories and searches the fixed 24-hour window for the closest modeled approach.</p>
    <div className="scenario-options" aria-label="Scenario choices">
      <button disabled={busy || !realAvailable} aria-pressed={scenario === 'real'} onClick={() => onRunScenario(false)}>Real Data Snapshot<small>Sentinel-2A + debris #31946 · historical</small></button>
      <button disabled={busy} aria-pressed={scenario === 'simulation'} onClick={() => onRunScenario(true)}>Educational Simulation<small>Controlled elements · not a real event</small></button>
    </div>
    {!e && !busy && <p className="text-sm text-slate-400">Select a scenario above to calculate the encounter.</p>}
    {e && <>
      <div className="text-xs text-cyan-200 mt-5">{e.satellite.isSynthetic ? 'SIMULATION · no catalog identity' : 'CACHED HISTORICAL SNAPSHOT · not current live data'}</div>
      <div className="metric-strip"><div><strong>{e.minSeparationKm.toFixed(3)} km</strong><small>Minimum modeled separation</small></div><div><strong>{e.relativeSpeedKmS.toFixed(3)} km/s</strong><small>Relative speed at closest approach</small></div></div>
      <p className="text-sm text-slate-200">Closest approach <strong className="block font-mono text-cyan-200 mt-1">{e.tCaIso.replace('T',' ').replace('Z',' UTC')}</strong></p>
      <p className="text-xs text-slate-400 mt-3 mb-5">{e.satellite.name} and {e.debris.name}. This estimate is not a collision probability or an operational warning.</p>
      <EncounterChart encounter={e} onSelectTime={onJumpToTime}/>
      <div className="flex flex-wrap gap-3 my-5"><button className="secondary-action" onClick={() => onJumpToTime(new Date(e.tCaIso))}><Crosshair size={16}/>Show closest-approach time</button><button className="primary-action" onClick={onExplain}><Brain size={17}/>Explain with AI</button></div>
      <details className="provenance"><summary>Data provenance and analysis window</summary><p className="text-xs mt-3 break-words">Window: {e.startTimeIso} to {e.endTimeIso}<br/>Satellite epoch: {e.satellite.epoch}<br/>Debris epoch: {e.debris.epoch}<br/>Snapshot: {e.satellite.snapshotCapturedAtIso || 'Not applicable — simulated inputs'}<br/>Downloads: {e.satellite.downloadedAtIso || 'Not applicable'} / {e.debris.downloadedAtIso || 'Not applicable'}<br/>Sources: {e.satellite.source} / {e.debris.source}<br/>SGP4 estimates from orbital elements; no covariance or uncertainty bounds are available. Marker dimensions are exaggerated for visibility.</p></details>
    </>}
  </div>;
}
