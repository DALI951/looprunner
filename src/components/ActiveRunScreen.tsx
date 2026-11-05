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
import { Play, Pause, Square, Flame, Gauge, Zap, Map as MapIcon } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';

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

  // Dynamic route state (recalculated if off-route)
  const [liveRoute, setLiveRoute] = useState<RouteOption>(initialRoute);
  const [recalculatingMsg, setRecalculatingMsg] = useState<string | null>(null);
  const isReroutingRef = useRef<boolean>(false);
  const offRouteCountRef = useRef<number>(0);

  // Tracking state — ALL START AT STRICT ZERO
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number>(0.0);
  const [maxSpeedKmh, setMaxSpeedKmh] = useState<number>(0.0);
  const [currentPace, setCurrentPace] = useState<string>('--:--');
  const [calories, setCalories] = useState<number>(0);
  const [breadcrumbs, setBreadcrumbs] = useState<[number, number][]>([]);

  // Current real runner GPS position
  const [currentRunnerPos, setCurrentRunnerPos] = useState<LatLng>({
    lat: initialRoute.coordinates[0]?.[0] || 36.8065,
    lng: initialRoute.coordinates[0]?.[1] || 10.1815,
  });

  const lastPosRef = useRef<LatLng | null>(null);
  const lastTimeRef = useRef<number>(Date.now());
  const stationaryTimerRef = useRef<number>(0);

  // UI toggle for map
  const [showMap, setShowMap] = useState<boolean>(true);

  // Destination coordinates
  const destinationCoords: LatLng = {
    lat:
      liveRoute.coordinates[liveRoute.coordinates.length - 1]?.[0] ||
      currentRunnerPos.lat,
    lng:
      liveRoute.coordinates[liveRoute.coordinates.length - 1]?.[1] ||
      currentRunnerPos.lng,
  };

  // Trigger recalculation if runner takes wrong turn
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

  // Stopwatch timer (only counts elapsed duration)
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);

      // Check if user has been stationary (no GPS speed for > 4s)
      stationaryTimerRef.current += 1;
      if (stationaryTimerRef.current >= 4) {
        // Reset current speed to 0.0 when not moving
        setCurrentSpeedKmh(0.0);
        setCurrentPace('--:--');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused]);

  // Real GPS Location Engine (Capacitor Native or Web Geolocation)
  useEffect(() => {
    let watchId: string | number | null = null;
    let isSubscribed = true;

    const handleNewGpsPosition = (latitude: number, longitude: number, speedMps: number | null) => {
      if (!isSubscribed || isPaused) return;

      const newCoord: LatLng = { lat: latitude, lng: longitude };
      setCurrentRunnerPos(newCoord);

      const now = Date.now();
      const lastCoord = lastPosRef.current;
      lastPosRef.current = newCoord;

      if (!lastCoord) {
        lastTimeRef.current = now;
        return;
      }

      // Compute displacement in meters
      const deltaMeters = calculateDistanceKm(lastCoord, newCoord) * 1000;
      const timeDeltaSec = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      // Jitter filter: GPS satellites fluctuate by 2-4 meters even when standing still.
      // Ignore movements < 4 meters if reported speed is essentially zero.
      const hasRealMovement = deltaMeters >= 4.0 || (speedMps !== null && speedMps > 0.6);

      if (hasRealMovement) {
        stationaryTimerRef.current = 0;

        // Calculate speed in km/h
        let speedKmh = 0;
        if (speedMps !== null && speedMps > 0.4) {
          speedKmh = speedMps * 3.6;
        } else if (timeDeltaSec > 0.5) {
          speedKmh = (deltaMeters / timeDeltaSec) * 3.6;
        }

        // Filter out unreasonable GPS speed spikes (> 35 km/h for human running)
        if (speedKmh <= 35) {
          const cleanSpeed = Number(speedKmh.toFixed(1));
          setCurrentSpeedKmh(cleanSpeed);
          setMaxSpeedKmh(m => Math.max(m, cleanSpeed));
        }

        // Add real displacement to total distance
        const deltaKm = deltaMeters / 1000;
        setDistanceKm(prev => {
          const updated = Number((prev + deltaKm).toFixed(3));

          // Update current pace based on active running
          if (updated > 0.03 && elapsedSeconds > 0) {
            const paceSec = Math.round(elapsedSeconds / updated);
            setCurrentPace(formatPace(paceSec));
          }

          // Update calories based on real movement
          const avgSpeed = (updated / (Math.max(1, elapsedSeconds) / 3600));
          setCalories(calculateCalories(settings.weightKg, avgSpeed, elapsedSeconds));

          return updated;
        });

        // Add to breadcrumb trail
        setBreadcrumbs(prev => [...prev, [newCoord.lat, newCoord.lng]]);

        // Check if runner deviated off-track
        const deviationMeters = getDistanceFromPolylineMeters(newCoord, liveRoute.coordinates);
        if (deviationMeters > 50) {
          offRouteCountRef.current += 1;
          if (offRouteCountRef.current >= 3 && !isReroutingRef.current) {
            triggerRecalculation(newCoord, `🔄 Off route (${Math.round(deviationMeters)}m): Recalculating...`);
          }
        } else {
          offRouteCountRef.current = 0;
        }
      }
    };

    // Start watching position
    const startTracking = async () => {
      try {
        // Attempt Capacitor native GPS first (works on Android APK)
        watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 1000 },
          (position, err) => {
            if (err) {
              console.warn('Capacitor geolocation watch error:', err);
              return;
            }
            if (position?.coords) {
              handleNewGpsPosition(
                position.coords.latitude,
                position.coords.longitude,
                position.coords.speed
              );
            }
          }
        );
      } catch {
        // Fallback to browser navigator.geolocation
        if ('geolocation' in navigator) {
          watchId = navigator.geolocation.watchPosition(
            pos => {
              handleNewGpsPosition(
                pos.coords.latitude,
                pos.coords.longitude,
                pos.coords.speed
              );
            },
            err => console.warn('Browser GPS error:', err),
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
          );
        }
      }
    };

    startTracking();

    return () => {
      isSubscribed = false;
      if (typeof watchId === 'string') {
        Geolocation.clearWatch({ id: watchId }).catch(() => {});
      } else if (typeof watchId === 'number' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isPaused, liveRoute, elapsedSeconds, settings.weightKg]);

  const handleFinish = () => {
    // Record only ACTUAL real movement
    const finalDistanceKm = Number(distanceKm.toFixed(2));
    const avgSpeedKmh =
      elapsedSeconds > 0 && finalDistanceKm > 0.02
        ? Number(((finalDistanceKm / (elapsedSeconds / 3600))).toFixed(1))
        : 0;

    const rawState: TrackingState = {
      isActive: false,
      isPaused: true,
      startTime: Date.now() - elapsedSeconds * 1000,
      elapsedSeconds,
      currentCoords: currentRunnerPos,
      gpsBreadcrumbs: breadcrumbs,
      currentSpeedKmh: 0,
      maxSpeedKmh,
      avgSpeedKmh,
      currentPace: finalDistanceKm > 0.05 ? currentPace : '--:--',
      totalDistanceKm: finalDistanceKm,
      caloriesBurned: calories,
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
          <span className={`w-2.5 h-2.5 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
          <span className="font-bold tracking-wide uppercase text-slate-300">
            {isPaused ? 'Run Paused' : 'Live GPS Tracking'}
          </span>
        </div>

        <button
          onClick={() => setShowMap(!showMap)}
          className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
          title="Toggle Map"
        >
          <MapIcon className="w-4 h-4" />
        </button>
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
              Distance Ran
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
              <span className="text-emerald-400 font-bold">{progressPercent}%</span> of target
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
