import React, { useState } from 'react';
import { RunSession, PersonalRecords } from '../types';
import { formatDuration } from '../services/tracking';
import {
  Trophy,
  TrendingUp,
  Table,
  PlusCircle,
  Download,
  Calendar,
  Zap,
  Gauge,
  Flame,
  Trash2,
  Sparkles,
} from 'lucide-react';

interface HistoryScreenProps {
  runs: RunSession[];
  personalRecords: PersonalRecords;
  onPlanNewRun: () => void;
  onOpenUpdates: () => void;
  onDeleteRun: (id: string) => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  runs,
  personalRecords,
  onPlanNewRun,
  onOpenUpdates,
  onDeleteRun,
}) => {
  const [activeTab, setActiveTab] = useState<'records' | 'charts' | 'sheet'>('records');
  const [chartMetric, setChartMetric] = useState<'speed' | 'pace' | 'distance'>('speed');

  // Format date helper
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Top Header */}
      <div className="px-5 pt-4 pb-2 border-b border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Progress & Records
            </h1>
            <p className="text-xs text-slate-400">
              {runs.length} runs recorded • {personalRecords.totalDistanceKm} km total
            </p>
          </div>
          <button
            onClick={onOpenUpdates}
            className="text-[11px] font-bold text-sky-400 bg-sky-950/80 hover:bg-sky-900 border border-sky-800 px-2.5 py-1.5 rounded-xl transition flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            Check APK
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 mt-3">
          <button
            onClick={() => setActiveTab('records')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'records'
                ? 'bg-slate-800 text-amber-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Records
          </button>

          <button
            onClick={() => setActiveTab('charts')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'charts'
                ? 'bg-slate-800 text-sky-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Graph
          </button>

          <button
            onClick={() => setActiveTab('sheet')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'sheet'
                ? 'bg-slate-800 text-emerald-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            Log Sheet
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {runs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-3xl">
              🏃
            </div>
            <p className="text-base font-bold text-slate-200">No Runs Saved Yet</p>
            <p className="text-xs text-slate-400 max-w-xs">
              Complete your first run using the Planner to start building your personal record board and progress charts.
            </p>
          </div>
        ) : (
          <>
            {/* TAB 1: Personal Records & Hall of Fame */}
            {activeTab === 'records' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* Longest Run */}
                  <div className="bg-gradient-to-br from-amber-500/10 to-slate-900 rounded-2xl p-4 border border-amber-500/30 shadow-md">
                    <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold uppercase">
                      <Trophy className="w-4 h-4" />
                      Longest Run
                    </div>
                    <p className="text-2xl font-black text-white font-mono mt-2">
                      {personalRecords.longestRunKm.toFixed(2)}
                      <span className="text-xs font-sans text-amber-300/80 ml-1">km</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">Single maximum run</p>
                  </div>

                  {/* Top Speed */}
                  <div className="bg-gradient-to-br from-sky-500/10 to-slate-900 rounded-2xl p-4 border border-sky-500/30 shadow-md">
                    <div className="flex items-center gap-1.5 text-sky-400 text-xs font-bold uppercase">
                      <Gauge className="w-4 h-4" />
                      Top Speed
                    </div>
                    <p className="text-2xl font-black text-white font-mono mt-2">
                      {personalRecords.topSpeedKmh.toFixed(1)}
                      <span className="text-xs font-sans text-sky-300/80 ml-1">km/h</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">Peak sprint record</p>
                  </div>

                  {/* Best Pace */}
                  <div className="bg-gradient-to-br from-emerald-500/10 to-slate-900 rounded-2xl p-4 border border-emerald-500/30 shadow-md">
                    <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase">
                      <Zap className="w-4 h-4" />
                      Best Pace
                    </div>
                    <p className="text-2xl font-black text-white font-mono mt-2">
                      {personalRecords.bestPaceSeconds > 0
                        ? `${Math.floor(personalRecords.bestPaceSeconds / 60)}:${(
                            personalRecords.bestPaceSeconds % 60
                          )
                            .toString()
                            .padStart(2, '0')}`
                        : '--:--'}
                      <span className="text-[10px] font-sans text-emerald-300/80 ml-1">/km</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">Fastest average tempo</p>
                  </div>

                  {/* Total Calories */}
                  <div className="bg-gradient-to-br from-orange-500/10 to-slate-900 rounded-2xl p-4 border border-orange-500/30 shadow-md">
                    <div className="flex items-center gap-1.5 text-orange-400 text-xs font-bold uppercase">
                      <Flame className="w-4 h-4" />
                      Calories
                    </div>
                    <p className="text-2xl font-black text-white font-mono mt-2">
                      {personalRecords.totalCalories}
                      <span className="text-xs font-sans text-orange-300/80 ml-1">kcal</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">Total energy burned</p>
                  </div>
                </div>

                {/* Lifetime Summary Strip */}
                <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-md flex items-center justify-around text-center">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Total Runs</p>
                    <p className="text-xl font-black text-white mt-0.5">{personalRecords.totalRuns}</p>
                  </div>
                  <div className="w-px h-8 bg-slate-800" />
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Total Distance</p>
                    <p className="text-xl font-black text-sky-400 mt-0.5">{personalRecords.totalDistanceKm} km</p>
                  </div>
                  <div className="w-px h-8 bg-slate-800" />
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Total Time</p>
                    <p className="text-xl font-black text-emerald-400 mt-0.5 font-mono">
                      {formatDuration(personalRecords.totalDurationSeconds)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Progress Graph (Dynamic Visual SVG Chart) */}
            {activeTab === 'charts' && (
              <div className="space-y-4">
                {/* Metric Selector */}
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setChartMetric('speed')}
                    className={`flex-1 py-1 text-xs font-medium rounded-lg transition ${
                      chartMetric === 'speed' ? 'bg-sky-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    Top & Avg Speed
                  </button>
                  <button
                    onClick={() => setChartMetric('distance')}
                    className={`flex-1 py-1 text-xs font-medium rounded-lg transition ${
                      chartMetric === 'distance' ? 'bg-sky-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    Distance (km)
                  </button>
                  <button
                    onClick={() => setChartMetric('pace')}
                    className={`flex-1 py-1 text-xs font-medium rounded-lg transition ${
                      chartMetric === 'pace' ? 'bg-sky-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    Pace Trend
                  </button>
                </div>

                {/* SVG Trend Chart */}
                <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-300">
                      {chartMetric === 'speed'
                        ? 'Speed Progress (km/h) Over Time'
                        : chartMetric === 'distance'
                        ? 'Run Volume (km) Trend'
                        : 'Pace Improvement (Lower is Faster)'}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Improving
                    </span>
                  </div>

                  {/* Dynamic SVG Line/Bar Chart */}
                  <div className="h-52 w-full flex items-end">
                    {(() => {
                      // Chronological order for chart (left to right)
                      const chartData = [...runs].reverse().slice(-12);
                      const maxVal = Math.max(
                        ...chartData.map(r =>
                          chartMetric === 'speed'
                            ? r.maxSpeedKmh
                            : chartMetric === 'distance'
                            ? r.distanceKm
                            : (r.paceSecondsPerKm || 400)
                        ),
                        1
                      );

                      return (
                        <div className="w-full h-full flex items-end gap-2 pt-6 pb-2 border-b border-slate-800">
                          {chartData.map((run, idx) => {
                            const val =
                              chartMetric === 'speed'
                                ? run.maxSpeedKmh
                                : chartMetric === 'distance'
                                ? run.distanceKm
                                : run.paceSecondsPerKm;

                            const heightPercent = Math.min(
                              100,
                              Math.max(15, Math.round((val / maxVal) * 100))
                            );

                            return (
                              <div
                                key={run.id || idx}
                                className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end"
                              >
                                {/* Tooltip on hover */}
                                <div className="opacity-0 group-hover:opacity-100 transition absolute -top-8 bg-slate-800 text-[10px] text-white px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-10 border border-slate-700">
                                  {chartMetric === 'speed'
                                    ? `${run.maxSpeedKmh.toFixed(1)} km/h`
                                    : chartMetric === 'distance'
                                    ? `${run.distanceKm.toFixed(1)} km`
                                    : run.avgPaceMinPerKm}
                                </div>

                                <div
                                  style={{ height: `${heightPercent}%` }}
                                  className={`w-full max-w-[28px] rounded-t-lg transition-all duration-300 ${
                                    chartMetric === 'speed'
                                      ? 'bg-gradient-to-t from-sky-600 to-sky-400'
                                      : chartMetric === 'distance'
                                      ? 'bg-gradient-to-t from-emerald-600 to-teal-400'
                                      : 'bg-gradient-to-t from-amber-600 to-yellow-400'
                                  }`}
                                />
                                <span className="text-[9px] text-slate-500 font-mono">
                                  #{idx + 1}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Run Log Sheet (Clean Data Table) */}
            {activeTab === 'sheet' && (
              <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/80 text-slate-400 font-bold border-b border-slate-700">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Distance</th>
                        <th className="p-3">Duration</th>
                        <th className="p-3">Avg Pace</th>
                        <th className="p-3">Max Speed</th>
                        <th className="p-3">Kcal</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {runs.map(run => (
                        <tr key={run.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3 font-medium text-slate-300 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-500" />
                              {formatDate(run.date)}
                            </div>
                          </td>
                          <td className="p-3 font-black text-sky-400 whitespace-nowrap font-mono">
                            {run.distanceKm.toFixed(2)} km
                          </td>
                          <td className="p-3 text-slate-300 whitespace-nowrap font-mono">
                            {formatDuration(run.durationSeconds)}
                          </td>
                          <td className="p-3 text-amber-300 whitespace-nowrap font-mono">
                            {run.avgPaceMinPerKm}
                          </td>
                          <td className="p-3 text-emerald-400 whitespace-nowrap font-mono">
                            {run.maxSpeedKmh.toFixed(1)} km/h
                          </td>
                          <td className="p-3 text-orange-400 whitespace-nowrap font-mono">
                            {run.calories}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => onDeleteRun(run.id)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded transition"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Main Actions (Strictly 1-2 Prominent Buttons) */}
      <div className="p-4 border-t border-slate-800 bg-slate-900 flex gap-3">
        <button
          type="button"
          onClick={onPlanNewRun}
          className="flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-white font-extrabold text-base shadow-lg shadow-sky-500/20 active:scale-[0.98] transition flex items-center justify-center gap-2"
        >
          <PlusCircle className="w-5 h-5" />
          <span>Plan New Run</span>
        </button>
      </div>
    </div>
  );
};
