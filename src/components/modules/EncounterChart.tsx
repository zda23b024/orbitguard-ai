/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { DistancePoint, EncounterAnalysisResult } from '../../types/orbital';

interface EncounterChartProps {
  encounter: EncounterAnalysisResult;
  onSelectTime?: (date: Date) => void;
}

export const EncounterChart: React.FC<EncounterChartProps> = ({
  encounter,
  onSelectTime,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const points = encounter.distanceProfile.map(p => p.timestampMs === encounter.tCaTimestampMs
    ? { ...p, distanceKm: encounter.minSeparationKm, relSpeedKmS: encounter.relativeSpeedKmS }
    : p);
  if (!points || points.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
        No distance profile data available for this encounter.
      </div>
    );
  }

  // Chart dimensions & scaling
  const width = 800;
  const height = 240;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 40;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const distances = points.map((p) => p.distanceKm);
  const minD = Math.min(...distances);
  const maxD = Math.max(...distances, encounter.educationalThresholdKm * 1.5);

  const firstTime = points[0].timestampMs;
  const duration = Math.max(1, points[points.length - 1].timestampMs - firstTime);
  const scaleX = (index: number) =>
    padLeft + ((points[index].timestampMs - firstTime) / duration) * chartW;
  const scaleY = (val: number) =>
    padTop + chartH - ((val - Math.min(0, minD)) / (maxD - Math.min(0, minD))) * chartH;

  // Build SVG path
  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(1)} ${scaleY(p.distanceKm).toFixed(1)}`)
    .join(' ');

  // Area under curve
  const areaD = `${pathD} L ${scaleX(points.length - 1)} ${padTop + chartH} L ${scaleX(0)} ${padTop + chartH} Z`;

  // Find index closest to min separation
  const closestIndex = points.findIndex(point => point.timestampMs === encounter.tCaTimestampMs);
  const minIdx = closestIndex >= 0 ? closestIndex : distances.indexOf(minD);
  const minX = scaleX(minIdx);
  const minY = scaleY(minD);

  // Threshold Y coordinate
  const threshY = scaleY(encounter.educationalThresholdKm);

  // Y-axis ticks
  const yTicks = [
    0,
    encounter.educationalThresholdKm,
    Math.round(maxD * 0.5),
    Math.round(maxD),
  ].sort((a, b) => a - b);

  // Mouse interaction
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseSvgX = ((e.clientX - rect.left) / rect.width) * width;
    const relX = mouseSvgX - padLeft;
    if (relX < 0 || relX > chartW) {
      setHoverIndex(null);
      return;
    }
    const ratio = Math.max(0, Math.min(1, relX / chartW));
    const timestamp = firstTime + ratio * duration;
    const idx = points.reduce((best, point, i) => Math.abs(point.timestampMs - timestamp) < Math.abs(points[best].timestampMs - timestamp) ? i : best, 0);
    setHoverIndex(idx);
  };

  const activePoint = hoverIndex !== null ? points[hoverIndex] : points[minIdx];
  const activeX = hoverIndex !== null ? scaleX(hoverIndex) : minX;
  const activeY = hoverIndex !== null ? scaleY(activePoint.distanceKm) : minY;

  return (
    <div ref={containerRef} className="w-full flex flex-col gap-2">
      {/* Chart Top Header & Active Metric Readout */}
      <div className="flex flex-wrap items-center justify-between text-xs px-1">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-200">
            Separation Distance Profile ||r₁(t) − r₂(t)||
          </span>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#EF6464]" />
            <span className="text-slate-400">
              Threshold ({encounter.educationalThresholdKm} km)
            </span>
          </div>
        </div>

        {activePoint && (
          <div className="flex items-center gap-4 font-mono text-[11px] bg-[#081322] px-2.5 py-1 rounded border border-[#24364B]">
            <span className="text-slate-400">
              t: <span className="text-white">{activePoint.timeIso.slice(11, 19)} UTC</span>
            </span>
            <span className="text-slate-400">
              d: <span className="text-cyan-400 font-bold">{activePoint.distanceKm.toFixed(3)} km</span>
            </span>
            <span className="text-slate-400">
              v_rel: <span className="text-amber-400">{activePoint.relSpeedKmS.toFixed(3)} km/s</span>
            </span>
          </div>
        )}
      </div>

      {/* SVG Canvas Chart */}
      <div className="relative w-full overflow-hidden bg-[#0a182b] rounded-lg border border-[#24364B] p-1">
        <svg
          role="img"
          aria-label={`Calculated separation over time. Minimum ${encounter.minSeparationKm.toFixed(3)} kilometres at ${encounter.tCaIso}`}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
          onClick={event => {
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (((event.clientX - rect.left) / rect.width) * width - padLeft) / chartW));
            const timestamp = firstTime + ratio * duration;
            const point = points.reduce((best, p) => Math.abs(p.timestampMs - timestamp) < Math.abs(best.timestampMs - timestamp) ? p : best);
            onSelectTime?.(new Date(point.timestampMs));
          }}
          style={{ cursor: onSelectTime ? 'pointer' : 'default' }}
        >
          <defs>
            <linearGradient id="distGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#37C9E8" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#37C9E8" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="dangerZoneGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EF6464" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#EF6464" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Screening Danger Zone Rect (< Threshold) */}
          <rect
            x={padLeft}
            y={threshY}
            width={chartW}
            height={padTop + chartH - threshY}
            fill="url(#dangerZoneGrad)"
          />

          {/* Horizontal Grid lines */}
          {yTicks.map((tickVal) => {
            const y = scaleY(tickVal);
            return (
              <g key={tickVal}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#1c2f47"
                  strokeDasharray="3 3"
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  fill="#64748b"
                  fontSize="10"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {tickVal} km
                </text>
              </g>
            );
          })}

          {/* Threshold Red Dashed Line */}
          <line
            x1={padLeft}
            y1={threshY}
            x2={width - padRight}
            y2={threshY}
            stroke="#EF6464"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Area fill */}
          <path d={areaD} fill="url(#distGrad)" />

          {/* Primary Distance Line */}
          <path
            d={pathD}
            fill="none"
            stroke="#37C9E8"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Minimum Approach Marker (t_CA) */}
          <circle
            cx={minX}
            cy={minY}
            r="6"
            fill="#EF6464"
            stroke="#ffffff"
            strokeWidth="2"
          />
          <text
            x={minX}
            y={minY - 12}
            fill="#EF6464"
            fontSize="11"
            fontWeight="bold"
            textAnchor="middle"
          >
            t_CA: {encounter.minSeparationKm.toFixed(3)} km
          </text>

          {/* Active Hover Cursor Line */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={activeX}
                y1={padTop}
                x2={activeX}
                y2={padTop + chartH}
                stroke="#ffffff"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={activeX}
                cy={activeY}
                r="4.5"
                fill="#37C9E8"
                stroke="#081322"
                strokeWidth="2"
              />
            </g>
          )}

          {/* X-axis time marks */}
          <text
            x={padLeft}
            y={height - 12}
            fill="#64748b"
            fontSize="10"
            fontFamily="monospace"
          >
            {points[0].timeIso.slice(11, 16)} UTC (Start)
          </text>
          <text
            x={width - padRight}
            y={height - 12}
            fill="#64748b"
            fontSize="10"
            fontFamily="monospace"
            textAnchor="end"
          >
            {points[points.length - 1].timeIso.slice(11, 16)} UTC (+{encounter.timeWindowHours}h)
          </text>
        </svg>

        {onSelectTime && (
          <div className="text-[10px] text-center text-slate-500 mt-1">
            Click anywhere on the curve to navigate 3D Earth simulation time to that moment.
          </div>
        )}
      </div>
    </div>
  );
};
