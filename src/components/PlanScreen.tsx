import React, { useState, useEffect } from 'react';
import { LatLng, SavedPlace, RouteOption } from '../types';
import { checkFeasibility, generateCustomRoute, FeasibilityResult } from '../services/routing';
import { LeafletMap } from './LeafletMap';
import {
  Compass,
  Bookmark,
  Sparkles,
  Play,
  RotateCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Shield,
  CircleDot,
} from 'lucide-react';

interface PlanScreenProps {
  savedPlaces: SavedPlace[];
  onStartRun: (route: RouteOption, startName: string, endName: string) => void;
  onOpenSavedPlaces: () => void;
  userCoords: LatLng | null;
}

export const PlanScreen: React.FC<PlanScreenProps> = ({
  savedPlaces,
  onStartRun,
  onOpenSavedPlaces,
  userCoords,
}) => {
  // Target distance state in km
  const [targetKm, setTargetKm] = useState<number>(5.0);
  const [isLoop, setIsLoop] = useState<boolean>(true);

  // New features: Avoid highways & Zone limit
  const [avoidHighways, setAvoidHighways] = useState<boolean>(false);
  const [hasZoneLimit, setHasZoneLimit] = useState<boolean>(false);
  const [maxZoneKm, setMaxZoneKm] = useState<number>(1.5);

  // Active generated route (null before generating)
  const [activeRoute, setActiveRoute] = useState<RouteOption | null>(null);
  const [rotationAngle, setRotationAngle] = useState<number>(0.8);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Bottom card expand/collapse toggle
  const [isConfigExpanded, setIsConfigExpanded] = useState<boolean>(true);

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

  // Feasibility state
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
      setActiveRoute(null);
    } else if (pickingTarget === 'end') {
      setCustomEnd(coords);
      setEndPlaceId('custom');
      setPickingTarget(null);
      setActiveRoute(null);
    }
  };

  const handleGenerate = async (angle: number = 0) => {
    setIsGenerating(true);
    try {
      const start = getStartCoords();
      const end = getEndCoords();

      const effectiveTargetKm =
        !feasibility.isFeasible && feasibility.minDistanceKm
          ? feasibility.minDistanceKm
          : targetKm;

      const route = await generateCustomRoute(start, end, effectiveTargetKm, {
        avoidHighways,
        maxRadiusZoneKm: hasZoneLimit ? maxZoneKm : null,
        angleVariation: angle,
      });

      setActiveRoute(route);
      setIsConfigExpanded(false); // Focus on the hero map
    } catch (err) {
      console.error('Error generating route:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateAnother = async () => {
    const nextAngle = rotationAngle + 1.1; // Rotate ~65 degrees
    setRotationAngle(nextAngle);
    await handleGenerate(nextAngle);
  };

  const handleStartRunClick = () => {
    if (!activeRoute) return;
    const startName =
      startPlaceId === 'gps'
        ? 'Current GPS'
        : savedPlaces.find(p => p.id === startPlaceId)?.name || 'Custom Start';
    const endName = isLoop
      ? startName
      : savedPlaces.find(p => p.id === endPlaceId)?.name || 'Custom Finish';

    onStartRun(activeRoute, startName, endName);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden relative">
      {/* Top Header */}
      <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-20">
        <div>
          <h1 className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-sky-400" />
            Route Planner
          </h1>
          <p className="text-[10px] text-slate-400">
            {activeRoute ? 'Route mapped below' : 'Set distance • Road circuit generator'}
          </p>
        </div>

        <button
          onClick={onOpenSavedPlaces}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
        >
          <Bookmark className="w-3.5 h-3.5 text-amber-400" />
          Saved ({savedPlaces.length})
        </button>
      </div>

      {/* Main Hero Leaflet Map */}
      <div className="relative flex-1 w-full min-h-[220px]">
        <LeafletMap
          center={startCoords}
          zoom={14}
          startPoint={startCoords}
          endPoint={isLoop ? null : endCoords}
          routeCoordinates={activeRoute ? activeRoute.coordinates : []}
          savedPlaces={savedPlaces}
          zoneRadiusKm={hasZoneLimit ? maxZoneKm : null}
          onMapClick={handleMapClick}
          className="w-full h-full"
        />

        {/* Map Tap Helper Notification */}
        {pickingTarget && (
          <div className="absolute top-3 left-3 right-3 z-[400] bg-sky-600/95 text-white text-xs font-bold py-2 px-3 rounded-xl backdrop-blur text-center shadow-lg animate-pulse border border-sky-400">
            Tap anywhere on the map to set {pickingTarget === 'start' ? 'Start' : 'Finish'} point
          </div>
        )}

        {/* Floating Route Badge when route is drawn */}
        {activeRoute && !pickingTarget && (
          <div className="absolute top-3 left-3 right-3 z-[400] flex items-center justify-between pointer-events-none">
            <div className="bg-slate-900/95 backdrop-blur border border-sky-500/60 rounded-xl px-3 py-1.5 shadow-xl flex items-center gap-2 pointer-events-auto">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
              <span className="text-xs font-black text-sky-300">
                {activeRoute.distanceKm.toFixed(2)} km route
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                (~{activeRoute.estimatedMinutes}m)
              </span>
            </div>

            <button
              onClick={() => setIsConfigExpanded(!isConfigExpanded)}
              className="bg-slate-900/95 backdrop-blur border border-slate-700 hover:border-slate-500 text-slate-200 text-xs font-bold px-2.5 py-1.5 rounded-xl shadow-xl flex items-center gap-1 pointer-events-auto transition"
            >
              {isConfigExpanded ? (
                <>
                  <span>Hide Details</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span>Edit Target</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Bottom Control Sheet */}
      <div className="bg-slate-900 border-t border-slate-800 p-4 space-y-3 z-30 shadow-2xl">
        {/* Expanded Configuration Mode */}
        {isConfigExpanded && (
          <div className="space-y-3 max-h-[38vh] overflow-y-auto pr-1">
            {/* Target Distance Controls */}
            <div className="bg-slate-950/70 rounded-2xl p-3 border border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Target Distance
                </span>
                <span className="text-xl font-black text-sky-400 font-mono">
                  {targetKm.toFixed(1)} <span className="text-xs text-slate-400 font-sans">km</span>
                </span>
              </div>

              <input
                type="range"
                min="1.0"
                max="25.0"
                step="0.5"
                value={targetKm}
                onChange={e => {
                  setTargetKm(parseFloat(e.target.value));
                  setActiveRoute(null);
                }}
                className="w-full accent-sky-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />

              {/* Quick Presets */}
              <div className="flex items-center justify-between gap-1.5 mt-2">
                {[3.0, 5.0, 10.0, 15.0].map(km => (
                  <button
                    key={km}
                    type="button"
                    onClick={() => {
                      setTargetKm(km);
                      setActiveRoute(null);
                    }}
                    className={`flex-1 py-1 text-xs font-bold rounded-lg border transition ${
                      targetKm === km
                        ? 'bg-sky-500 text-white border-sky-400'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {km} km
                  </button>
                ))}
              </div>
            </div>

            {/* Neighborhood Zigzag & Zone Boundary Toggles */}
            <div className="bg-slate-950/70 rounded-2xl p-3 border border-slate-800 space-y-2.5">
              {/* Avoid Highways / Busy Roads Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Shield className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-200">Avoid Busy Streets / Highways</p>
                    <p className="text-[10px] text-slate-400">Zigzag quietly between homes & local paths</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={avoidHighways}
                    onChange={e => {
                      setAvoidHighways(e.target.checked);
                      setActiveRoute(null);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {/* Max Zone Distance Limit Toggle */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <CircleDot className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-200">Limit Distance From Start</p>
                      <p className="text-[10px] text-slate-400">Stay within a defined radius bubble</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasZoneLimit}
                      onChange={e => {
                        setHasZoneLimit(e.target.checked);
                        setActiveRoute(null);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {hasZoneLimit && (
                  <div className="mt-2.5 pt-2 bg-slate-900 p-2.5 rounded-xl border border-slate-800 animate-fadeIn">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400 text-[11px]">Maximum Radius from Start:</span>
                      <span className="font-bold text-amber-400 font-mono">{maxZoneKm.toFixed(1)} km</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="5.0"
                      step="0.2"
                      value={maxZoneKm}
                      onChange={e => {
                        setMaxZoneKm(parseFloat(e.target.value));
                        setActiveRoute(null);
                      }}
                      className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Dashed amber zone shown on map. Loops will snake within this boundary.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Waypoints Card */}
            <div className="bg-slate-950/70 rounded-2xl p-3 border border-slate-800 space-y-2.5">
              {/* Start selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    Start Location
                  </label>
                  <button
                    type="button"
                    onClick={() => setPickingTarget('start')}
                    className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold"
                  >
                    Pin on map
                  </button>
                </div>
                <select
                  value={startPlaceId}
                  onChange={e => {
                    setStartPlaceId(e.target.value);
                    setCustomStart(null);
                    setActiveRoute(null);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  {userCoords && <option value="gps">📍 Current GPS Location</option>}
                  {savedPlaces.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.isDefaultStart ? '★' : ''}
                    </option>
                  ))}
                  {customStart && <option value="custom">📌 Custom Map Pin</option>}
                </select>
              </div>

              {/* Loop Toggle */}
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsLoop(true);
                    setActiveRoute(null);
                  }}
                  className={`flex-1 py-1 text-xs font-semibold rounded-lg transition ${
                    isLoop ? 'bg-sky-600 text-white' : 'text-slate-400'
                  }`}
                >
                  🔄 Circular Loop
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsLoop(false);
                    setActiveRoute(null);
                  }}
                  className={`flex-1 py-1 text-xs font-semibold rounded-lg transition ${
                    !isLoop ? 'bg-sky-600 text-white' : 'text-slate-400'
                  }`}
                >
                  🏁 A to B Destination
                </button>
              </div>

              {/* Destination (if not loop) */}
              {!isLoop && (
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                      Finish Point
                    </label>
                    <button
                      type="button"
                      onClick={() => setPickingTarget('end')}
                      className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold"
                    >
                      Pin on map
                    </button>
                  </div>
                  <select
                    value={endPlaceId}
                    onChange={e => {
                      setEndPlaceId(e.target.value);
                      setCustomEnd(null);
                      setActiveRoute(null);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    {savedPlaces.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                    {customEnd && <option value="custom">📌 Custom Map Pin</option>}
                  </select>
                </div>
              )}
            </div>

            {/* Feasibility Alert */}
            {!feasibility.isFeasible && (
              <div className="bg-amber-950/40 border border-amber-600/70 rounded-2xl p-3 flex items-start gap-2.5 text-xs">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-amber-200">Distance Too Short</p>
                  <p className="text-amber-300/80 text-[11px] mt-0.5">
                    {feasibility.message ||
                      `Shortest path is ${feasibility.minDistanceKm} km.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetKm(feasibility.minDistanceKm);
                      setActiveRoute(null);
                    }}
                    className="mt-1.5 text-xs font-bold text-amber-200 bg-amber-800/80 hover:bg-amber-700 px-2 py-0.5 rounded-lg border border-amber-600"
                  >
                    Adjust to {feasibility.minDistanceKm} km
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Actions (Strictly 1-2 Prominent Buttons) */}
        {activeRoute ? (
          /* ACTION STATE 2: Route is generated and line is on the map */
          <div className="space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between text-xs text-slate-300 px-1">
              <span className="font-semibold text-sky-400">
                ✓ Route drawn on map above
              </span>
              <div className="flex gap-1.5">
                {avoidHighways && (
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800 font-mono">
                    Quiet Paths
                  </span>
                )}
                {hasZoneLimit && (
                  <span className="text-[10px] bg-amber-950 text-amber-300 px-2 py-0.5 rounded border border-amber-800 font-mono">
                    ≤{maxZoneKm}km Bubble
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2.5">
              {/* Button 1: Try Another Route (rotates the loop angle) */}
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleRegenerateAnother}
                className="w-1/3 py-3.5 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 active:scale-[0.98] transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <RotateCw
                  className={`w-4 h-4 text-sky-400 ${isGenerating ? 'animate-spin' : ''}`}
                />
                <span>Try Another</span>
              </button>

              {/* Button 2: Start Run */}
              <button
                type="button"
                onClick={handleStartRunClick}
                className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-base shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5 fill-white" />
                <span>Start Run ({activeRoute.distanceKm.toFixed(1)} km)</span>
              </button>
            </div>
          </div>
        ) : (
          /* ACTION STATE 1: Generate Route Button */
          <div className="flex gap-2.5">
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => handleGenerate(0)}
              className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-white font-extrabold text-base shadow-lg shadow-sky-500/25 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Calculating Route...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Generate Route ({targetKm.toFixed(1)} km)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
