import React, { useState } from 'react';
import { storage } from '../services/storage';
import { calculateCalories } from '../services/tracking';
import { runsToGpxBundle, saveGpx } from '../services/gpx';
import {
  ArrowLeft,
  Scale,
  Minus,
  Plus,
  Flame,
  Download,
  RefreshCw,
  Trash2,
  Check,
  Info,
  ShieldAlert,
} from 'lucide-react';

interface SettingsScreenProps {
  onBackToPlan: () => void;
  onOpenUpdates: () => void;
  onDataCleared: () => void;
}

const MIN_WEIGHT = 30;
const MAX_WEIGHT = 200;

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBackToPlan,
  onOpenUpdates,
  onDataCleared,
}) => {
  const [settings, setSettings] = useState(() => storage.getSettings());
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState<string>(
    String(settings.weightKg)
  );

  const runs = storage.getRuns();

  const flash = () => {
    setSavedAt(Date.now());
    window.setTimeout(() => setSavedAt(null), 1600);
  };

  const persist = (patch: Partial<typeof settings>) => {
    const next = storage.saveSettings(patch);
    setSettings(next);
    flash();
    return next;
  };

  const commitWeight = (value: number) => {
    if (!isFinite(value)) return;
    const clamped = Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, Math.round(value)));
    setWeightInput(String(clamped));
    if (clamped !== settings.weightKg) persist({ weightKg: clamped });
  };

  const stepWeight = (delta: number) => {
    commitWeight((parseFloat(weightInput) || settings.weightKg) + delta);
  };

  const handleExportAll = async () => {
    if (runs.length === 0) {
      setExportNote('No saved runs to export yet.');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    await saveGpx(`looprunner-${stamp}.gpx`, runsToGpxBundle(runs));
    setExportNote(`Exported ${runs.length} run${runs.length === 1 ? '' : 's'}.`);
    window.setTimeout(() => setExportNote(null), 4000);
  };

  const handleReset = () => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      window.setTimeout(() => setConfirmingReset(false), 4000);
      return;
    }
    storage.clearAllData();
    setConfirmingReset(false);
    setSettings(storage.getSettings());
    setWeightInput(String(storage.getSettings().weightKg));
    onDataCleared();
  };

  // Live feedback: what the current weight means for the calorie estimate.
  const kcalPer30Min = calculateCalories(settings.weightKg, 10, 1800);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-800 bg-slate-900/60">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToPlan}
            className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Back to planner"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Scale className="w-5 h-5 text-sky-400" />
              Settings
            </h1>
            <p className="text-xs text-slate-400">
              Your body weight drives every calorie number in the app
            </p>
          </div>
          {savedAt && (
            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              Saved
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Body weight */}
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">
              Body weight
            </span>
            <span className="text-[10px] text-slate-500">kg</span>
          </div>

          <div className="flex items-center justify-center gap-4 mt-3">
            <button
              onClick={() => stepWeight(-1)}
              className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center active:scale-95 transition"
              title="-1 kg"
            >
              <Minus className="w-5 h-5" />
            </button>

            <input
              type="number"
              inputMode="decimal"
              min={MIN_WEIGHT}
              max={MAX_WEIGHT}
              value={weightInput}
              onChange={e => setWeightInput(e.target.value)}
              onBlur={e => commitWeight(parseFloat(e.target.value))}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  commitWeight(parseFloat((e.target as HTMLInputElement).value));
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-28 text-center text-4xl font-black text-white bg-transparent border-b-2 border-sky-500/60 focus:border-sky-400 outline-none font-mono"
            />

            <button
              onClick={() => stepWeight(1)}
              className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center active:scale-95 transition"
              title="+1 kg"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2 bg-orange-500/10 border border-orange-500/25 rounded-xl px-3 py-2">
            <Flame className="w-4 h-4 text-orange-400 shrink-0" />
            <p className="text-[11px] text-orange-200/90 leading-snug">
              At {settings.weightKg} kg you burn about{' '}
              <strong className="text-orange-300">{kcalPer30Min} kcal</strong> per
              30 minutes at 10 km/h.
            </p>
          </div>

          <p className="text-[10px] text-slate-500 mt-2 leading-snug">
            Weight is stored only on this phone. Runs recorded before you changed
            it keep their original calorie count.
          </p>
        </div>

        {/* Data */}
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-md space-y-3">
          <span className="text-xs font-bold uppercase text-slate-400">
            Your data
          </span>

          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>{runs.length} saved runs</span>
            <span className="text-slate-500">
              {storage.getPersonalRecords().totalDistanceKm} km total
            </span>
          </div>

          <button
            onClick={handleExportAll}
            className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition"
          >
            <Download className="w-4 h-4 text-sky-400" />
            Export all runs as GPX
          </button>

          {exportNote && (
            <p className="text-[11px] text-emerald-400 text-center">{exportNote}</p>
          )}

          <button
            onClick={handleReset}
            className={`w-full py-3 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition ${
              confirmingReset
                ? 'bg-rose-600 hover:bg-rose-500 border-rose-500 text-white'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-rose-300'
            }`}
          >
            {confirmingReset ? (
              <>
                <ShieldAlert className="w-4 h-4" />
                Tap again to erase everything
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Erase all runs, places & settings
              </>
            )}
          </button>
        </div>

        {/* Updates */}
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-md space-y-3">
          <span className="text-xs font-bold uppercase text-slate-400">
            Updates
          </span>

          <label className="block">
            <span className="text-[11px] text-slate-400">GitHub repository</span>
            <input
              type="text"
              value={settings.githubRepo}
              onChange={e => persist({ githubRepo: e.target.value.trim() })}
              spellCheck={false}
              className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono outline-none focus:border-sky-500"
              placeholder="DALI951/looprunner"
            />
          </label>

          <button
            onClick={onOpenUpdates}
            className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition"
          >
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            Check for APK update
          </button>
        </div>

        {/* About */}
        <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <Info className="w-4 h-4" />
            <span className="font-bold text-slate-300">LoopRunner</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
            Plan a loop by distance, run it with live GPS, keep every run on the
            phone. No account, no cloud, no ads.
          </p>
        </div>
      </div>
    </div>
  );
};
