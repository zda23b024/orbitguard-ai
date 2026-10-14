/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { OrbitalObject, PropagatedState } from '../../types/orbital';
import { propagateObject } from '../../services/orbitalEngine';
import {
  Search,
  Crosshair,
  Satellite as SatelliteIcon,
  Layers,
  Info,
  Calendar,
  Compass,
  Zap,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface OrbitalMonitorProps {
  objects: OrbitalObject[];
  selectedObject: OrbitalObject | null;
  onSelectObject: (obj: OrbitalObject | null) => void;
  simTime: Date;
  onSwitchToAnalyzerWithObject: (obj: OrbitalObject) => void;
  flaggedEncountersCount: number;
}

export const OrbitalMonitor: React.FC<OrbitalMonitorProps> = ({
  objects,
  selectedObject,
  onSelectObject,
  simTime,
  onSwitchToAnalyzerWithObject,
  flaggedEncountersCount,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PAYLOAD' | 'DEBRIS'>('ALL');

  // Filtered objects list
  const filteredObjects = useMemo(() => {
    return objects.filter((obj) => {
      const matchesSearch =
        obj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(obj.noradId).includes(searchQuery);

      if (!matchesSearch) return false;

      if (filterType === 'PAYLOAD') return obj.classification === 'PAYLOAD';
      if (filterType === 'DEBRIS') return obj.classification !== 'PAYLOAD';
      return true;
    });
  }, [objects, searchQuery, filterType]);

  // Compute live propagated state of selected object
  const selectedState: PropagatedState | null = useMemo(() => {
    if (!selectedObject) return null;
    return propagateObject(selectedObject, simTime);
  }, [selectedObject, simTime]);

  const payloadsCount = objects.filter((o) => o.classification === 'PAYLOAD').length;
  const debrisCount = objects.filter((o) => o.classification !== 'PAYLOAD').length;

  return (
    <div className="flex flex-col h-full bg-[#11243A] text-slate-100 border-r border-[#24364B] overflow-hidden">
      {/* Top Header Metrics Bar */}
      <div className="p-4 border-b border-[#24364B] bg-[#0c1a2c]">
        <div className="text-xs uppercase tracking-wider text-cyan-400 font-semibold mb-2 flex items-center justify-between">
          <span>Orbital Environment Monitor</span>
          <span className="font-mono text-[10px] text-slate-400">MODULE 1</span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="bg-[#11243A] p-2 rounded border border-[#24364B]">
            <div className="text-[10px] text-slate-400 uppercase">Tracked</div>
            <div className="text-base font-bold font-mono text-white">{objects.length}</div>
          </div>
          <div className="bg-[#11243A] p-2 rounded border border-[#24364B]">
            <div className="text-[10px] text-slate-400 uppercase">Satellites</div>
            <div className="text-base font-bold font-mono text-[#6DA8FF]">{payloadsCount}</div>
          </div>
          <div className="bg-[#11243A] p-2 rounded border border-[#24364B]">
            <div className="text-[10px] text-slate-400 uppercase">Debris</div>
            <div className="text-base font-bold font-mono text-[#F3B65A]">{debrisCount}</div>
          </div>
          <div className="bg-[#11243A] p-2 rounded border border-[#24364B]">
            <div className="text-[10px] text-slate-400 uppercase">Flagged</div>
            <div className="text-base font-bold font-mono text-[#EF6464]">{flaggedEncountersCount}</div>
          </div>
        </div>
      </div>

      {/* Search and Filter Row */}
      <div className="p-3 border-b border-[#24364B] bg-[#11243A] space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search NORAD ID or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#081322] border border-[#24364B] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex rounded-lg bg-[#081322] p-0.5 border border-[#24364B]">
          {(['ALL', 'PAYLOAD', 'DEBRIS'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`flex-1 py-1 text-[11px] font-medium rounded cursor-pointer transition ${
                filterType === type
                  ? 'bg-[#1b3350] text-cyan-300 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {type === 'ALL' ? 'All Objects' : type === 'PAYLOAD' ? 'Satellites' : 'Debris'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area: Object List and Details Panel */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#24364B]">
        {/* Selected Object Telemetry Inspector */}
        {selectedObject && selectedState && (
          <div className="p-3.5 bg-[#0e1e33] border-b-2 border-cyan-500/40 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">{selectedObject.name}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      selectedObject.classification === 'PAYLOAD'
                        ? 'bg-blue-900/60 text-blue-300'
                        : 'bg-amber-900/60 text-amber-300'
                    }`}
                  >
                    {selectedObject.classification}
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  NORAD ID: <span className="text-cyan-400">#{selectedObject.noradId}</span> | COSPAR: {selectedObject.intlDes}
                </div>
              </div>

              <button
                onClick={() => onSelectObject(null)}
                className="text-[11px] text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded border border-[#24364B] cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Calculated SGP4 Values vs TLE Source Values */}
            <div className="space-y-2">
              <div className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1">
                <Zap className="w-3 h-3" />
                <span>Real-Time Calculated Values (SGP4 Engine)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs bg-[#081322] p-2 rounded border border-[#24364B]">
                <div>
                  <span className="text-slate-400 block text-[10px]">Current Altitude</span>
                  <span className="font-mono text-cyan-300 font-bold">
                    {selectedState.valid ? `${selectedState.geodetic.altitudeKm.toFixed(1)} km` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Orbital Velocity</span>
                  <span className="font-mono text-white font-bold">
                    {selectedState.valid ? `${selectedState.speedKmS.toFixed(2)} km/s` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Sub-Satellite Lat/Lon</span>
                  <span className="font-mono text-slate-300 text-[11px]">
                    {selectedState.valid
                      ? `${selectedState.geodetic.latitude.toFixed(2)}°, ${selectedState.geodetic.longitude.toFixed(2)}°`
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Simulation Time</span>
                  <span className="font-mono text-slate-300 text-[11px]">
                    {simTime.toISOString().slice(11, 19)} UTC
                  </span>
                </div>
              </div>
            </div>

            {/* Source TLE Parameters */}
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                <Info className="w-3 h-3" />
                <span>Source Orbital Elements (CelesTrak GP)</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[11px] bg-[#0a182b] p-2 rounded border border-[#24364B]">
                <div>
                  <span className="text-slate-400 block text-[10px]">Inclination</span>
                  <span className="font-mono text-slate-200">{selectedObject.inclinationDeg.toFixed(2)}°</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Orbital Period</span>
                  <span className="font-mono text-slate-200">{selectedObject.periodMinutes.toFixed(1)} m</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Eccentricity</span>
                  <span className="font-mono text-slate-200">{selectedObject.eccentricity.toFixed(5)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Perigee / Apogee</span>
                  <span className="font-mono text-slate-200">{selectedObject.perigeeKm.toFixed(0)} / {selectedObject.apogeeKm.toFixed(0)} km</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">BSTAR Drag</span>
                  <span className="font-mono text-slate-200">{selectedObject.bstarDrag.toExponential(2)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Data Epoch</span>
                  <span className="font-mono text-slate-200">{selectedObject.epoch.slice(0, 10)}</span>
                </div>
              </div>
            </div>

            {/* Quick Action to Analyze Close Approach */}
            <button
              onClick={() => onSwitchToAnalyzerWithObject(selectedObject)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#37C9E8] hover:bg-[#4dd3f0] text-slate-900 font-bold text-xs shadow-md transition cursor-pointer"
            >
              <span>Analyze Close Approach with this Object</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Objects List */}
        <div className="p-2 space-y-1">
          <div className="text-[10px] text-slate-400 font-semibold px-2 py-1 uppercase tracking-wider">
            Catalog Objects ({filteredObjects.length})
          </div>

          {filteredObjects.map((obj) => {
            const isSelected = selectedObject?.id === obj.id;
            const isPayload = obj.classification === 'PAYLOAD';

            return (
              <div
                key={obj.id}
                onClick={() => onSelectObject(obj)}
                className={`p-2.5 rounded-lg border transition cursor-pointer flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-[#1b3554] border-[#37C9E8] text-white shadow-sm'
                    : 'bg-[#0e1d30]/60 hover:bg-[#142942] border-[#24364B]/80 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      isPayload ? 'bg-[#6DA8FF]' : 'bg-[#F3B65A]'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-xs truncate">{obj.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      #{obj.noradId} • {obj.orbitClass} • {obj.perigeeKm.toFixed(0)} km
                    </div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      isPayload
                        ? 'bg-blue-900/60 text-blue-300'
                        : 'bg-amber-900/60 text-amber-300'
                    }`}
                  >
                    {isPayload ? 'SATELLITE' : 'DEBRIS'}
                  </span>
                </div>
              </div>
            );
          })}

          {filteredObjects.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-400">
              No matching orbital objects found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
