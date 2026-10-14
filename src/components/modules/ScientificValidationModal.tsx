/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ValidationSuiteSummary, ValidationTestItem } from '../../types/orbital';
import { runScientificValidationSuite } from '../../services/orbitalEngine';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Check,
  ShieldCheck,
  Clock,
  Activity,
  Layers,
  X,
} from 'lucide-react';

interface ScientificValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScientificValidationModal: React.FC<ScientificValidationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [suiteResult, setSuiteResult] = useState<ValidationSuiteSummary | null>(() =>
    runScientificValidationSuite()
  );
  const [isRunning, setIsRunning] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleRerunTests = () => {
    setIsRunning(true);
    setTimeout(() => {
      const fresh = runScientificValidationSuite();
      setSuiteResult(fresh);
      setIsRunning(false);
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#11243A] border border-[#24364B] rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-4 border-b border-[#24364B] bg-[#0c1a2c] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>OrbitGuard Scientific Validation Suite</span>
                {suiteResult && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">
                    {suiteResult.passed} / {suiteResult.total} BENCHMARKS PASSED
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Automated SGP4 ephemeris benchmarks, coordinate rotations, and numerical optimizer verification
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRerunTests}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#37C9E8] hover:bg-[#52d2ed] text-slate-900 font-bold text-xs rounded transition cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
              <span>{isRunning ? 'Running Tests...' : 'Re-Run Test Suite'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a3350] transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Test List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {suiteResult?.tests.map((test) => (
            <div
              key={test.id}
              className={`p-3 rounded-lg border text-xs space-y-2 transition ${
                test.passed
                  ? 'bg-[#0e1e33] border-emerald-900/50 text-slate-200'
                  : 'bg-[#2a1318] border-red-900/50 text-red-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {test.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-[#EF6464] flex-shrink-0" />
                  )}
                  <div>
                    <span className="font-bold text-white text-xs">{test.name}</span>
                    <span className="font-mono text-[10px] text-slate-400 ml-2">[{test.id}]</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-[10px]">
                  <span className="text-slate-400">{test.durationMs}ms</span>
                  <span
                    className={`font-bold px-1.5 py-0.5 rounded ${
                      test.passed ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'
                    }`}
                  >
                    {test.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400">{test.description}</p>

              {/* Expected vs Actual Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-[#081322] p-2 rounded border border-[#24364B] font-mono text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Expected Bound</span>
                  <span className="text-cyan-400">{test.expected}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Calculated Actual</span>
                  <span className="text-white font-bold">{test.actual}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Scientific Tolerance</span>
                  <span className="text-slate-300">{test.tolerance}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#24364B] bg-[#0c1a2c] flex items-center justify-between text-xs text-slate-400">
          <div>
            Verified under Vallado SGP4 standard • Last executed:{' '}
            <span className="font-mono text-slate-300">
              {suiteResult?.runAt.slice(11, 19)} UTC
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[#1a3350] hover:bg-[#23456c] text-white text-xs font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
