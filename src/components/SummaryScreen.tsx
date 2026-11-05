import React from 'react';
import { RunSession, PersonalRecords } from '../types';
import { LeafletMap } from './LeafletMap';
import { formatDuration } from '../services/tracking';
import { Trophy, Clock, Route, Gauge, Flame, Zap, Check, Trash2 } from 'lucide-react';

interface SummaryScreenProps {
  session: RunSession;
  personalRecords: PersonalRecords;
  onSaveRun: () => void;
  onDiscardRun: () => void;
}

export const SummaryScreen: React.FC<SummaryScreenProps> = ({
  session,
  personalRecords,
  onSaveRun,
  onDiscardRun,
}) => {
  // Check if any personal records were broken
  const isLongest = session.distanceKm > personalRecords.longestRunKm && session.distanceKm > 0;
  const isTopSpeed = session.maxSpeedKmh > personalRecords.topSpeedKmh && session.maxSpeedKmh > 0;
  const isBestPace = session.paceSecondsPerKm > 0 &&
    (personalRecords.bestPaceSeconds === 0 || session.paceSecondsPerKm < personalRecords.bestPaceSeconds);

  const startCoord = session.routeCoordinates[0]
    ? { lat: session.routeCoordinates[0][0], lng: session.routeCoordinates[0][1] }
    : { lat: 36.8065, lng: 10.1815 };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 text-center border-b border-slate-800 bg-slate-900/60">
        <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-emerald-500/20 border border-amber-500/30 mb-2">
          <Trophy className="w-8 h-8 text-amber-400" />
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">Run Complete!</h1>
        <p className="text-xs text-slate-400">Great effort today • Here is your debrief</p>

        {/* PR Banners */}
        {(isLongest || isTopSpeed || isBestPace) && (
          <div className="mt-3 inline-flex flex-wrap items-center justify-center gap-2">
            {isLongest && (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                🏆 New Longest Run ({session.distanceKm.toFixed(1)} km)
              </span>
            )}
            {isTopSpeed && (
              <span className="bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                ⚡ New Top Speed ({session.maxSpeedKmh.toFixed(1)} km/h)
              </span>
            )}
            {isBestPace && (
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                🚀 New Best Pace ({session.avgPaceMinPerKm})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Stats Grid & Map */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Map Trace */}
        <div className="h-44 rounded-2xl overflow-hidden border border-slate-800 shadow-lg">
          <LeafletMap
            center={startCoord}
            zoom={14}
            routeCoordinates={session.routeCoordinates}
            className="w-full h-full"
          />
        </div>

        {/* 6 Essential Stats */}
        <div className="grid grid-cols-2 gap-3">
          {/* Duration */}
          <div className="bg-slate-900/90 rounded-2xl p-3.5 border border-slate-800 shadow-md">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
              <Clock className="w-4 h-4 text-sky-400" />
              Duration
            </div>
            <p className="text-2xl font-black text-white font-mono mt-1">
              {formatDuration(session.durationSeconds)}
            </p>
          </div>

          {/* Distance */}
          <div className="bg-slate-900/90 rounded-2xl p-3.5 border border-slate-800 shadow-md">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
              <Route className="w-4 h-4 text-emerald-400" />
              Distance
            </div>
            <p className="text-2xl font-black text-white font-mono mt-1">
              {session.distanceKm.toFixed(2)} <span className="text-xs text-slate-400 font-sans">km</span>
            </p>
          </div>

          {/* Avg Pace */}
          <div className="bg-slate-900/90 rounded-2xl p-3.5 border border-slate-800 shadow-md">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
              <Zap className="w-4 h-4 text-amber-400" />
              Avg Pace
            </div>
            <p className="text-2xl font-black text-white font-mono mt-1">
              {session.avgPaceMinPerKm}
            </p>
            <p className="text-[10px] text-slate-500">min/km</p>
          </div>

          {/* Avg Speed */}
          <div className="bg-slate-900/90 rounded-2xl p-3.5 border border-slate-800 shadow-md">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
              <Gauge className="w-4 h-4 text-indigo-400" />
              Avg Speed
            </div>
            <p className="text-2xl font-black text-white font-mono mt-1">
              {session.avgSpeedKmh.toFixed(1)} <span className="text-xs text-slate-400 font-sans">km/h</span>
            </p>
          </div>

          {/* Max Speed */}
          <div className="bg-slate-900/90 rounded-2xl p-3.5 border border-slate-800 shadow-md">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
              <Gauge className="w-4 h-4 text-rose-400" />
              Max Speed
            </div>
            <p className="text-2xl font-black text-white font-mono mt-1">
              {session.maxSpeedKmh.toFixed(1)} <span className="text-xs text-slate-400 font-sans">km/h</span>
            </p>
          </div>

          {/* Calories */}
          <div className="bg-slate-900/90 rounded-2xl p-3.5 border border-slate-800 shadow-md">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
              <Flame className="w-4 h-4 text-orange-400" />
              Calories
            </div>
            <p className="text-2xl font-black text-white font-mono mt-1">
              {session.calories} <span className="text-xs text-slate-400 font-sans">kcal</span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Actions (Strictly 2 Main Buttons) */}
      <div className="p-4 border-t border-slate-800 bg-slate-900 flex gap-3">
        <button
          type="button"
          onClick={onDiscardRun}
          className="w-1/3 py-3.5 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 font-bold text-xs border border-slate-700 active:scale-[0.98] transition flex items-center justify-center gap-1.5"
        >
          <Trash2 className="w-4 h-4" />
          <span>Discard</span>
        </button>

        <button
          type="button"
          onClick={onSaveRun}
          className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-white font-black text-base shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5 stroke-[3]" />
          <span>Save to History</span>
        </button>
      </div>
    </div>
  );
};
