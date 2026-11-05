import React, { useState, useEffect, useRef } from 'react';
import { RouteOption, LatLng, RunSession } from '../types';
import { LeafletMap } from './LeafletMap';
import {
  TrackingState,
  formatDuration,
  formatPace,
  calculateCalories,
  finalizeRunSession,
} from '../services/tracking';
import {
  calculateDistanceKm,
  getDistanceFromPolylineMeters,
  recalculateRouteFromCurrent,
} from '../services/routing';
import { storage } from '../services/storage';
import { Play, Pause, Square, Flame, Gauge, Zap, Map as MapIcon, CornerDownRight } from 'lucide-react';

interface ActiveRunScreenProps {
  route: RouteOption;
  startName: string;
  endName: string;
  onFinishRun: (session: RunSession) => void;
  onCancelRun: () => void;
}

export const ActiveRunScreen: React.FC<ActiveRunScreenProps> = ({
  route: initialRoute,
  startName,
  endName,
  onFinishRun,
}) => {
  const settings = storage.getSettings();

  // Dynamic route state (can be updated when recalculating)
  const [liveRoute, setLiveRoute] = useState<RouteOption>(initialRoute);
  const [recalculatingMsg, setRecalculatingMsg] = useState<string | null>(null);
  const isReroutingRef = useRef<boolean>(false);
  const offRouteCountRef = useRef<number>(0);

  // Tracking state
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number>(9.8);
  const [maxSpeedKmh, setMaxSpeedKmh] = useState<number>(10.2);
  const [currentPace, setCurrentPace] = useState<string>('6:07');
  const [calories, setCalories] = useState<number>(0);
  const [breadcrumbs, setBreadcrumbs] = useState<[number, number][]>([]);
  const [currentRunnerPos, setCurrentRunnerPos] = useState<LatLng>({
    lat: initialRoute.coordinates[0]?.[0] || 36.8065,
    lng: initialRoute.coordinates[0]?.[1] || 10.1815,
  });

  // UI toggle for map
  const [showMap, setShowMap] = useState<boolean>(true);

  // PC Test Simulation toggle
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const simStepRef = useRef<number>(0);

  // Destination coordinates
  const destinationCoords: LatLng = {
    lat:
      liveRoute.coordinates[liveRoute.coordinates.length - 1]?.[0] ||
      currentRunnerPos.lat,
    lng:
      liveRoute.coordinates[liveRoute.coordinates.length - 1]?.[1] ||
      currentRunnerPos.lng,
  };

  // Watch position ID
  const watchIdRef = useRef<number | null>(null);

  // Helper to trigger reroute
  const triggerRecalculation = async (pos: LatLng, reason: string) => {
    if (isReroutingRef.current) return;
    isReroutingRef.current = true;
    setRecalculatingMsg(reason);

    try {
      const newRoute = await recalculateRouteFromCurrent(
        pos,
        destinationCoords,
        liveRoute
      );
      setLiveRoute(newRoute);
      simStepRef.current = 0; // restart simulation on new route
      setTimeout(() => {
        setRecalculatingMsg('✓ Route updated ahead!');
        setTimeout(() => setRecalculatingMsg(null), 3000);
      }, 800);
    } catch (err) {
      console.warn('Rerouting error:', err);
      setRecalculatingMsg(null);
    } finally {
      isReroutingRef.current = false;
      offRouteCountRef.current = 0;
    }
  };

  // Timer loop
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setElapsedSeconds(prev => {
        const next = prev + 1;

        if (isSimulating && liveRoute.coordinates.length > 0) {
          const totalPoints = liveRoute.coordinates.length;
          simStepRef.current = (simStepRef.current + 1) % totalPoints;
          const targetCoord = liveRoute.coordinates[simStepRef.current];
          const newPos = { lat: targetCoord[0], lng: targetCoord[1] };
          setCurrentRunnerPos(newPos);

          setBreadcrumbs(prevCoords => {
            const updated = [...prevCoords, [newPos.lat, newPos.lng] as [number, number]];
            return updated.slice(-300);
          });

          // Simulated speed variation
          const simulatedSpeed = 9.4 + Math.sin(next * 0.18) * 2.5;
          setCurrentSpeedKmh(Number(simulatedSpeed.toFixed(1)));
          setMaxSpeedKmh(m => Math.max(m, simulatedSpeed));

          const fraction = (next * (simulatedSpeed / 3600));
          const currentDist = Math.min(fraction, liveRoute.distanceKm * 1.05);
          setDistanceKm(Number(currentDist.toFixed(2)));

          const paceSec = currentDist > 0.05 ? Math.round(next / currentDist) : 360;
          setCurrentPace(formatPace(paceSec));

          const cals = calculateCalories(settings.weightKg, simulatedSpeed, next);
          setCalories(cals);
        } else {
          // Real GPS calorie and pace update
          if (distanceKm > 0.05) {
            const paceSec = Math.round(next / distanceKm);
            setCurrentPace(formatPace(paceSec));
            const avgSpeed = (distanceKm / (next / 3600));
            setCalories(calculateCalories(settings.weightKg, avgSpeed, next));
          }
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, isSimulating, liveRoute.coordinates, liveRoute.distanceKm, distanceKm, settings.weightKg]);

  // Real GPS Geolocation tracking & Off-Track Detection
  useEffect(() => {
    if (isSimulating) return;

    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        pos => {
          const newCoord: LatLng = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };

          setCurrentRunnerPos(newCoord);
          setBreadcrumbs(prev => [...prev, [newCoord.lat, newCoord.lng]]);

          // GPS speed
          if (pos.coords.speed !== null && pos.coords.speed >= 0) {
            const speedKmh = pos.coords.speed * 3.6;
            setCurrentSpeedKmh(Number(speedKmh.toFixed(1)));
            setMaxSpeedKmh(m => Math.max(m, speedKmh));
          }

          // Check deviation from planned route
          const deviationMeters = getDistanceFromPolylineMeters(newCoord, liveRoute.coordinates);
          if (deviationMeters > 50) {
            offRouteCountRef.current += 1;
            if (offRouteCountRef.current >= 3 && !isReroutingRef.current) {
              triggerRecalculation(newCoord, `🔄 Off route (${Math.round(deviationMeters)}m): Recalculating...`);
            }
          } else {
            offRouteCountRef.current = 0;
          }

          // Accumulate distance
          setBreadcrumbs(coords => {
            if (coords.length > 1) {
              const last = coords[coords.length - 2];
              const delta = calculateDistanceKm(
                { lat: last[0], lng: last[1] },
                newCoord
              );
              setDistanceKm(d => Number((d + delta).toFixed(2)));
            }
            return coords;
          });
        },
        err => console.warn('GPS location error:', err),
        { enableHighAccuracy: true, maximumAge: 1000 }
      );
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isSimulating, liveRoute]);

  // Manual detour simulator trigger for PC testing
  const handleSimulateDetour = () => {
    const deviatedPos: LatLng = {
      lat: currentRunnerPos.lat + 0.0035, // ~380 meters off-track
      lng: currentRunnerPos.lng + 0.0035,
    };
    setCurrentRunnerPos(deviatedPos);
    triggerRecalculation(deviatedPos, '🔄 Took unexpected turn: Recalculating new route...');
  };

  const handleFinish = () => {
    const rawState: TrackingState = {
      isActive: false,
      isPaused: true,
      startTime: Date.now() - elapsedSeconds * 1000,
      elapsedSeconds,
      currentCoords: currentRunnerPos,
      gpsBreadcrumbs: breadcrumbs.length > 0 ? breadcrumbs : liveRoute.coordinates,
      currentSpeedKmh,
      maxSpeedKmh,
      avgSpeedKmh: elapsedSeconds > 0 ? (distanceKm / (elapsedSeconds / 3600)) : 0,
      currentPace,
      totalDistanceKm: distanceKm > 0 ? distanceKm : liveRoute.distanceKm,
      caloriesBurned: calories > 0 ? calories : Math.round(liveRoute.distanceKm * 65),
    };

    const session = finalizeRunSession(rawState, liveRoute.distanceKm, startName, endName);
    onFinishRun(session);
  };

  const progressPercent = Math.min(100, Math.round((distanceKm / liveRoute.distanceKm) * 100));

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none">
      {/* Top Status Bar */}
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold tracking-wide uppercase text-slate-300">
            {isPaused ? 'Run Paused' : 'Live Tracking'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Detour test button for PC */}
          {isSimulating && (
            <button
              onClick={handleSimulateDetour}
              className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-700 flex items-center gap-1"
              title="Test off-track dynamic recalculation"
            >
              <CornerDownRight className="w-3 h-3" />
              <span>Simulate Detour</span>
            </button>
          )}

          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`px-2 py-0.5 rounded text-[11px] font-bold border transition ${
              isSimulating
                ? 'bg-sky-950 text-sky-400 border-sky-600'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {isSimulating ? '🖥️ PC Mode' : '📍 GPS'}
          </button>

          <button
            onClick={() => setShowMap(!showMap)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            title="Toggle Map"
          >
            <MapIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dynamic Recalculating Notification Banner */}
      {recalculatingMsg && (
        <div className="bg-sky-600 text-white text-xs font-bold py-2 px-4 text-center shadow-lg animate-pulse flex items-center justify-center gap-2 z-50">
          <span>{recalculatingMsg}</span>
        </div>
      )}

      {/* Main HUD Body */}
      <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4">
        {/* Big Elapsed Time */}
        <div className="text-center py-1">
          <p className="text-xs uppercase font-extrabold text-slate-400 tracking-widest">
            Duration
          </p>
          <p className="text-5xl font-black font-mono tracking-tight text-white mt-0.5">
            {formatDuration(elapsedSeconds)}
          </p>
        </div>

        {/* Big Distance & Progress Bar */}
        <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 shadow-xl">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Distance
            </span>
            <span className="text-xs font-semibold text-slate-400">
              Target: {liveRoute.distanceKm.toFixed(1)} km
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl font-black text-sky-400 font-mono">
              {distanceKm.toFixed(2)}
            </span>
            <span className="text-base font-bold text-slate-400">km</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-800 rounded-full h-3 mt-3 overflow-hidden border border-slate-700">
            <div
              className="bg-gradient-to-r from-sky-400 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-lg shadow-sky-500/50"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Live Speed */}
          <div className="bg-slate-900/80 rounded-2xl p-3.5 border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase">
              <Gauge className="w-3.5 h-3.5 text-sky-400" />
              Live Speed
            </div>
            <p className="text-3xl font-black text-white font-mono mt-1">
              {currentSpeedKmh.toFixed(1)}
            </p>
            <p className="text-[10px] text-slate-400">km/h (Top: {maxSpeedKmh.toFixed(1)})</p>
          </div>

          {/* Current Pace */}
          <div className="bg-slate-900/80 rounded-2xl p-3.5 border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Pace
            </div>
            <p className="text-3xl font-black text-white font-mono mt-1">
              {currentPace}
            </p>
            <p className="text-[10px] text-slate-400">min/km</p>
          </div>

          {/* Calories Burned */}
          <div className="col-span-2 bg-slate-900/80 rounded-2xl p-3.5 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/30">
                <Flame className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Energy Burned</p>
                <p className="text-xl font-black text-white font-mono">{calories} kcal</p>
              </div>
            </div>
            <div className="text-right text-[11px] text-slate-400">
              <span className="text-emerald-400 font-bold">{progressPercent}%</span> completed
            </div>
          </div>
        </div>

        {/* Live Leaflet Map with Auto-Follow & Live Speed HUD */}
        {showMap && (
          <div className="flex-1 min-h-[200px] rounded-2xl overflow-hidden border border-slate-800 shadow-xl relative">
            <LeafletMap
              center={currentRunnerPos}
              zoom={16}
              routeCoordinates={liveRoute.coordinates}
              actualBreadcrumbs={breadcrumbs}
              currentRunnerPos={currentRunnerPos}
              autoFollowRunner={true}
              speedKmh={currentSpeedKmh}
              zoneRadiusKm={liveRoute.maxRadiusZoneKm}
              className="w-full h-full min-h-[200px]"
            />
          </div>
        )}
      </div>

      {/* Main Actions (Strictly 2 Main Buttons) */}
      <div className="p-4 border-t border-slate-800 bg-slate-900 flex gap-3">
        {/* Button 1: Pause / Resume */}
        <button
          type="button"
          onClick={() => setIsPaused(!isPaused)}
          className={`flex-1 py-4 px-4 rounded-2xl font-extrabold text-base transition flex items-center justify-center gap-2 active:scale-[0.98] ${
            isPaused
              ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/25'
          }`}
        >
          {isPaused ? (
            <>
              <Play className="w-5 h-5 fill-current" />
              <span>Resume Run</span>
            </>
          ) : (
            <>
              <Pause className="w-5 h-5 fill-current" />
              <span>Pause</span>
            </>
          )}
        </button>

        {/* Button 2: Finish Run */}
        <button
          type="button"
          onClick={handleFinish}
          className="flex-1 py-4 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-base shadow-lg shadow-rose-600/25 active:scale-[0.98] transition flex items-center justify-center gap-2"
        >
          <Square className="w-5 h-5 fill-white" />
          <span>Finish Run</span>
        </button>
      </div>
    </div>
  );
};
