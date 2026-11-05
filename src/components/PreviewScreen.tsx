import React, { useState } from 'react';
import { RouteOption, LatLng } from '../types';
import { LeafletMap } from './LeafletMap';
import { generateCustomRoute } from '../services/routing';
import { Play, RotateCw, ArrowLeft, Clock, MapPin, CheckCircle2 } from 'lucide-react';

interface PreviewScreenProps {
  route: RouteOption;
  startName: string;
  endName: string;
  onStartRun: (route: RouteOption) => void;
  onBackToPlan: () => void;
}

export const PreviewScreen: React.FC<PreviewScreenProps> = ({
  route: initialRoute,
  startName,
  endName,
  onStartRun,
  onBackToPlan,
}) => {
  const [route, setRoute] = useState<RouteOption>(initialRoute);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [rotationAngle, setRotationAngle] = useState<number>(0.8);

  const startCoords: LatLng = {
    lat: route.coordinates[0]?.[0] || 36.8065,
    lng: route.coordinates[0]?.[1] || 10.1815,
  };

  const endCoords: LatLng = {
    lat: route.coordinates[route.coordinates.length - 1]?.[0] || startCoords.lat,
    lng: route.coordinates[route.coordinates.length - 1]?.[1] || startCoords.lng,
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const newAngle = rotationAngle + 1.05; // rotate loop ~60 degrees
      setRotationAngle(newAngle);

      const newRoute = await generateCustomRoute(
        startCoords,
        endCoords,
        route.distanceKm,
        { angleVariation: newAngle, avoidHighways: route.avoidHighways, maxRadiusZoneKm: route.maxRadiusZoneKm }
      );
      setRoute(newRoute);
    } catch (err) {
      console.error('Failed to regenerate alternate route:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* Top Navigation */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <button
          onClick={onBackToPlan}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-800/80 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Edit Target
        </button>
        <span className="text-xs font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-full flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Route Ready
        </span>
      </div>

      {/* Main Map Display */}
      <div className="relative flex-1">
        <LeafletMap
          center={startCoords}
          zoom={14}
          startPoint={startCoords}
          endPoint={route.isLoop ? null : endCoords}
          routeCoordinates={route.coordinates}
          className="w-full h-full rounded-none"
        />

        {/* Floating Route Info Cards */}
        <div className="absolute top-3 left-3 right-3 z-[400] flex gap-2">
          <div className="flex-1 bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-xl p-2.5 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Total Length</p>
              <p className="text-lg font-black text-sky-400">
                {route.distanceKm.toFixed(2)} <span className="text-xs font-semibold text-slate-300">km</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-slate-400">Est. Time</p>
              <p className="text-lg font-black text-emerald-400 flex items-center justify-end gap-1">
                <Clock className="w-4 h-4 text-emerald-400" />
                {route.estimatedMinutes} <span className="text-xs font-semibold text-slate-300">min</span>
              </p>
            </div>
          </div>
        </div>

        {/* Waypoints & Circuit Badge */}
        <div className="absolute bottom-3 left-3 right-3 z-[400]">
          <div className="bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-xl px-3 py-2 text-xs flex items-center justify-between shadow-lg">
            <span className="flex items-center gap-1.5 text-slate-300 truncate font-medium">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              {startName} {route.isLoop ? '• (Circuit Loop)' : `➔ ${endName}`}
            </span>
            <span className="text-[10px] bg-sky-950 text-sky-300 px-2 py-0.5 rounded font-mono font-bold shrink-0">
              Zero Backtrack
            </span>
          </div>
        </div>
      </div>

      {/* Main Actions (Strictly 2 Main Buttons) */}
      <div className="p-4 border-t border-slate-800 bg-slate-900 flex gap-3">
        <button
          type="button"
          disabled={isRegenerating}
          onClick={handleRegenerate}
          className="w-1/3 py-3.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 active:scale-[0.98] transition flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <RotateCw className={`w-4 h-4 text-sky-400 ${isRegenerating ? 'animate-spin' : ''}`} />
          <span>Try Another</span>
        </button>

        <button
          type="button"
          onClick={() => onStartRun(route)}
          className="flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-extrabold text-base shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition flex items-center justify-center gap-2"
        >
          <Play className="w-5 h-5 fill-white" />
          <span>Start Run</span>
        </button>
      </div>
    </div>
  );
};
