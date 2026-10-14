/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Play,
  CheckCircle,
  Globe,
  Crosshair,
  Brain,
  ShieldCheck,
  Award,
} from 'lucide-react';

interface CompetitionDemoGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateModule: (mod: 'monitor' | 'analyzer' | 'explain') => void;
  onOpenValidation: () => void;
  onLoadScenario: () => void;
}

export const CompetitionDemoGuide: React.FC<CompetitionDemoGuideProps> = ({
  isOpen,
  onClose,
  onNavigateModule,
  onOpenValidation,
  onLoadScenario,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);

  if (!isOpen) return null;

  const STEPS = [
    {
      timeRange: '0:00 – 0:25',
      title: 'Problem Statement & Research Question',
      icon: <Award className="w-5 h-5 text-cyan-400" />,
      pitch:
        '“Distinguished judges of the Zanzibar Astronomy and Space Society: OrbitGuard AI is an educational tool for exploring public orbital elements, SGP4 propagation, and estimated close approaches. It shows the input data and explains the measurements so students can inspect how an orbital screening calculation works.”',
      actionLabel: 'Explore 3D Orbital Monitor (Next)',
      onAction: () => {
        onNavigateModule('monitor');
        setCurrentStep(1);
      },
    },
    {
      timeRange: '0:25 – 0:55',
      title: 'Module 1: Orbital Monitor & 3D Earth',
      icon: <Globe className="w-5 h-5 text-[#6DA8FF]" />,
      pitch:
        '“The current provider cache contains one payload and no accepted debris records, so a current satellite–debris analysis is unavailable. The bundled historical records failed integrity checks and are disabled. The synthetic teaching mode remains available and is clearly separated from provider data.”',
      actionLabel: 'Load Synthetic Scenario & Open Analyzer',
      onAction: () => {
        onLoadScenario();
        onNavigateModule('analyzer');
        setCurrentStep(2);
      },
    },
    {
      timeRange: '0:55 – 1:40',
      title: 'Module 2: Close-Approach Encounter Analyzer',
      icon: <Crosshair className="w-5 h-5 text-[#EF6464]" />,
      pitch:
        '“In Module 2, the synthetic pair is propagated through the same satellite.js SGP4 code and numerical minimum-search method. Its calculated close approach demonstrates the workflow only; these objects and orbital inputs are fictional, not observed.”',
      actionLabel: 'Proceed to Explainable Analysis',
      onAction: () => {
        onNavigateModule('explain');
        setCurrentStep(3);
      },
    },
    {
      timeRange: '1:40 – 2:20',
      title: 'Module 3: Explainable Analysis & Screening',
      icon: <Brain className="w-5 h-5 text-purple-400" />,
      pitch:
        '“OrbitGuard AI explains the estimated separation, relative speed, element age and educational screening threshold. Its hand-weighted priority index is explicitly uncalibrated and is not a collision probability.”',
      actionLabel: 'View Automated Scientific Validation',
      onAction: () => {
        onOpenValidation();
        setCurrentStep(4);
      },
    },
    {
      timeRange: '2:20 – 2:45',
      title: 'Automated Scientific Validation Test Suite',
      icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
      pitch:
        '“The scientific validation suite checks SGP4 against a published Vallado vector, verifies an OMM input vector, and checks coordinate bounds, separation calculations, and numerical minimum refinement. Passing these checks does not certify the tool for operational collision warnings.”',
      actionLabel: 'Conclude with Scientific Impact',
      onAction: () => {
        setCurrentStep(5);
      },
    },
    {
      timeRange: '2:45 – 3:00',
      title: 'Educational & Research Impact',
      icon: <Award className="w-5 h-5 text-amber-400" />,
      pitch:
        '“OrbitGuard AI gives students a way to explore orbital data and learn how close-approach screening works, while making the limits of the result visible. Thank you.”',
      actionLabel: 'Finish Pitch Walkthrough',
      onAction: () => {
        onClose();
      },
    },
  ];

  const current = STEPS[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#11243A] border border-[#24364B] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Top Header */}
        <div className="p-4 bg-[#0c1a2c] border-b border-[#24364B] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>ZASS 2026 — 3-Minute Competition Demo Walkthrough</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-300 border border-cyan-700/50">
                  STAGE {currentStep + 1} OF {STEPS.length}
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Official presentation script structured for the ZASS Space Science Innovation Competition
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a3350] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Content */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-[#081322] border border-[#24364B]">
                {current.icon}
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider block">
                  TIMING: {current.timeRange}
                </span>
                <h3 className="text-base font-bold text-white">{current.title}</h3>
              </div>
            </div>
          </div>

          {/* Script Card */}
          <div className="bg-[#081322] p-4 rounded-lg border border-[#24364B] text-xs leading-relaxed text-slate-200 font-sans shadow-inner">
            <div className="text-[10px] font-mono uppercase text-slate-400 font-bold mb-1.5 flex items-center gap-1.5">
              <span>Presenter Voice Track:</span>
            </div>
            {current.pitch}
          </div>

          {/* Progress Indicators */}
          <div className="flex gap-1.5 pt-1">
            {STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 flex-1 rounded-full transition ${
                  idx === currentStep
                    ? 'bg-cyan-400'
                    : idx < currentStep
                    ? 'bg-cyan-800'
                    : 'bg-[#24364B]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Action Controls */}
        <div className="p-4 bg-[#0c1a2c] border-t border-[#24364B] flex items-center justify-between">
          <button
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
              currentStep === 0
                ? 'opacity-30 cursor-not-allowed text-slate-500'
                : 'bg-[#1a3350] hover:bg-[#23456c] text-slate-200'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <button
            onClick={current.onAction}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#37C9E8] hover:bg-[#52d2ed] text-slate-900 font-bold text-xs shadow-md transition cursor-pointer"
          >
            <span>{current.actionLabel}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
