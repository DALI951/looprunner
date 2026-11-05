import React, { useState, useEffect } from 'react';
import { LatLng, SavedPlace, RouteOption } from '../types';
import { checkFeasibility, generateCustomRoute, FeasibilityResult } from '../services/routing';
import { LeafletMap } from './LeafletMap';
import { Navigation, MapPin, Sparkles, AlertCircle, Bookmark, Compass } from 'lucide-react';

interface PlanScreenProps {
  savedPlaces: SavedPlace[];
  onRouteGenerated: (route: RouteOption, startName: string, endName: string) => void;
  onOpenSavedPlaces: () => void;
  userCoords: LatLng | null;
}

export const PlanScreen: React.FC<PlanScreenProps> = ({
  savedPlaces,
  onRouteGenerated,
  onOpenSavedPlaces,
  userCoords,
}) => {
  // Target distance state in km
  const [targetKm, setTargetKm] = useState<number>(5.0);
  const [isLoop, setIsLoop] = useState<boolean>(true);

  // Start & End selections
  const defaultStart = savedPlaces.find(p => p.isDefaultStart) || savedPlaces[0] || {
    id: 'default',
    name: 'Home',
    coords: userCoords || { lat: 36.8065, lng: 10.1815 },
  };

  const [startPlaceId, setStartPlaceId] = useState<string>(defaultStart.id);
  const [customStart, setCustomStart] = useState<LatLng | null>(null);

  const [endPlaceId, setEndPlaceId] = useState<string>(
    savedPlaces[1]?.id || defaultStart.id
  );
  const [customEnd, setCustomEnd] = useState<LatLng | null>(null);

  // Map picking mode
  const [pickingTarget, setPickingTarget] = useState<'start' | 'end' | null>(null);

  // Feasibility & loading state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [feasibility, setFeasibility] = useState<FeasibilityResult>({
    isFeasible: true,
    minDistanceKm: 0.5,
  });

  // Resolve current active start & end coordinates
  const getStartCoords = (): LatLng => {
    if (customStart) return customStart;
    if (startPlaceId === 'gps' && userCoords) return userCoords;
    const found = savedPlaces.find(p => p.id === startPlaceId);
    return found ? found.coords : (userCoords || { lat: 36.8065, lng: 10.1815 });
  };

  const getEndCoords = (): LatLng => {
    if (isLoop) return getStartCoords();
    if (customEnd) return customEnd;
    const found = savedPlaces.find(p => p.id === endPlaceId);
    return found ? found.coords : getStartCoords();
  };

  const startCoords = getStartCoords();
  const endCoords = getEndCoords();

  // Validate feasibility when points or target change
  useEffect(() => {
    let isCancelled = false;
    const validate = async () => {
      const res = await checkFeasibility(startCoords, endCoords, targetKm);
      if (!isCancelled) {
        setFeasibility(res);
      }
    };
    validate();
    return () => {
      isCancelled = true;
    };
  }, [startCoords.lat, startCoords.lng, endCoords.lat, endCoords.lng, targetKm, isLoop]);

  const handleMapClick = (coords: LatLng) => {
    if (pickingTarget === 'start') {
      setCustomStart(coords);
      setStartPlaceId('custom');
      setPickingTarget(null);
    } else if (pickingTarget === 'end') {
      setCustomEnd(coords);
      setEndPlaceId('custom');
      setPickingTarget(null);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const start = getStartCoords();
      const end = getEndCoords();

      // Ensure minimum distance if infeasible
      const effectiveTargetKm = !feasibility.isFeasible && feasibility.minDistanceKm
        ? feasibility.minDistanceKm
        : targetKm;

      const route = await generateCustomRoute(start, end, effectiveTargetKm, 0);

      const startName = startPlaceId === 'gps' ? 'Current GPS' : (savedPlaces.find(p => p.id === startPlaceId)?.name || 'Custom Start');
      const endName = isLoop ? startName : (savedPlaces.find(p => p.id === endPlaceId)?.name || 'Custom Finish');

      onRouteGenerated(route, startName, endName);
    } catch (err) {
      console.error('Error generating route:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* Top Header */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-sky-400" />
            Plan Route
          </h1>
          <p className="text-xs text-slate-400">Custom distance • No street repeated</p>
        </div>
        <button
          onClick={onOpenSavedPlaces}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
        >
          <Bookmark className="w-3.5 h-3.5 text-amber-400" />
          Saved ({savedPlaces.length})
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Interactive Map View */}
        <div className="relative">
          <LeafletMap
            center={startCoords}
            zoom={14}
            startPoint={startCoords}
            endPoint={isLoop ? null : endCoords}
            savedPlaces={savedPlaces}
            onMapClick={handleMapClick}
            className="h-48 w-full rounded-2xl"
          />
          {pickingTarget && (
            <div className="absolute top-2 left-2 right-2 bg-sky-600/90 text-white text-xs font-semibold py-1.5 px-3 rounded-lg backdrop-blur text-center shadow-lg animate-pulse">
              Tap anywhere on map to select {pickingTarget === 'start' ? 'Start' : 'Finish'} point
            </div>
          )}
        </div>

        {/* Target Distance Selector */}
        <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/60 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Target Distance
            </span>
            <span className="text-2xl font-extrabold text-sky-400">
              {targetKm.toFixed(1)} <span className="text-sm font-semibold text-slate-400">km</span>
            </span>
          </div>

          <input
            type="range"
            min="1.0"
            max="25.0"
            step="0.5"
            value={targetKm}
            onChange={e => setTargetKm(parseFloat(e.target.value))}
            className="w-full accent-sky-400 h-2 bg-slate-700 rounded-lg cursor-pointer"
          />

          {/* Quick Distance Presets */}
          <div className="flex items-center justify-between gap-2 mt-3">
            {[3.0, 5.0, 10.0, 15.0].map(km => (
              <button
                key={km}
                type="button"
                onClick={() => setTargetKm(km)}
                className={`flex-1 py-1 text-xs font-semibold rounded-lg border transition ${
                  targetKm === km
                    ? 'bg-sky-500 text-white border-sky-400 shadow-sm'
                    : 'bg-slate-700/60 text-slate-300 border-slate-600 hover:bg-slate-700'
                }`}
              >
                {km} km
              </button>
            ))}
          </div>
        </div>

        {/* Start & End Points Card */}
        <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/60 shadow-md space-y-3">
          {/* Start Point Selection */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                Start Point
              </span>
              <button
                onClick={() => setPickingTarget('start')}
                className="text-[11px] text-sky-400 hover:text-sky-300 underline"
              >
                Pin on map
              </button>
            </label>
            <select
              value={startPlaceId}
              onChange={e => {
                setStartPlaceId(e.target.value);
                setCustomStart(null);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
            >
              {userCoords && <option value="gps">📍 Current GPS Location</option>}
              {savedPlaces.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.isDefaultStart ? '★' : ''}
                </option>
              ))}
              {customStart && <option value="custom">📌 Custom Picked on Map</option>}
            </select>
          </div>

          {/* Loop vs Point-to-Point Toggle */}
          <div className="pt-1">
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setIsLoop(true)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition ${
                  isLoop
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🔄 Circular Loop (Start = End)
              </button>
              <button
                type="button"
                onClick={() => setIsLoop(false)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition ${
                  !isLoop
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🏁 Different Destination
              </button>
            </div>
          </div>

          {/* Destination Selection (only when not in loop mode) */}
          {!isLoop && (
            <div className="pt-2 border-t border-slate-700/60">
              <label className="text-xs font-medium text-slate-400 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
                  Finish Point
                </span>
                <button
                  onClick={() => setPickingTarget('end')}
                  className="text-[11px] text-sky-400 hover:text-sky-300 underline"
                >
                  Pin on map
                </button>
              </label>
              <select
                value={endPlaceId}
                onChange={e => {
                  setEndPlaceId(e.target.value);
                  setCustomEnd(null);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
              >
                {savedPlaces.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                {customEnd && <option value="custom">📌 Custom Picked on Map</option>}
              </select>
            </div>
          )}
        </div>

        {/* Feasibility Alert Card */}
        {!feasibility.isFeasible && (
          <div className="bg-amber-950/40 border border-amber-600/60 rounded-2xl p-3.5 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-semibold text-amber-200">Distance Too Short</p>
              <p className="text-amber-300/90 mt-0.5">
                {feasibility.message ||
                  `The shortest path between these points is ${feasibility.minDistanceKm} km.`}
              </p>
              <button
                type="button"
                onClick={() => setTargetKm(feasibility.minDistanceKm)}
                className="mt-2 text-xs font-bold text-amber-200 bg-amber-800/60 hover:bg-amber-700/80 px-2.5 py-1 rounded-lg border border-amber-600 transition"
              >
                Auto-Adjust to {feasibility.minDistanceKm} km
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Actions Bar (Strictly 1-2 Prominent Buttons) */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/95 backdrop-blur flex gap-3">
        <button
          type="button"
          disabled={isGenerating}
          onClick={handleGenerate}
          className="flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-white font-bold text-base shadow-lg shadow-sky-500/20 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Calculating Loop...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Generate Route ({targetKm.toFixed(1)} km)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
