import { LatLng, RunSession } from '../types';
import { calculateDistanceKm } from './routing';

export interface TrackingState {
  isActive: boolean;
  isPaused: boolean;
  startTime: number | null;
  elapsedSeconds: number;
  currentCoords: LatLng | null;
  gpsBreadcrumbs: [number, number][]; // [lat, lng]
  currentSpeedKmh: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  currentPace: string; // "5:12 /km"
  totalDistanceKm: number;
  caloriesBurned: number;
}

export function formatPace(secondsPerKm: number): string {
  if (!isFinite(secondsPerKm) || secondsPerKm <= 0 || secondsPerKm > 1800) {
    return '--:--';
  }
  const mins = Math.floor(secondsPerKm / 60);
  const secs = Math.floor(secondsPerKm % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }
  return `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

/**
 * Calculates MET based on running speed (km/h)
 */
export function getRunMET(speedKmh: number): number {
  if (speedKmh <= 0) return 1.0;
  if (speedKmh < 6) return 6.0;   // fast walk / jog
  if (speedKmh < 8) return 8.3;   // ~5.0 mph
  if (speedKmh < 9.7) return 9.8; // ~6.0 mph
  if (speedKmh < 11.3) return 11.0; // ~7.0 mph
  if (speedKmh < 12.9) return 11.8; // ~8.0 mph
  return 12.8; // > 8.0 mph
}

/**
 * Calories = MET * weight_kg * time_hours
 */
export function calculateCalories(weightKg: number, speedKmh: number, durationSeconds: number): number {
  const met = getRunMET(speedKmh);
  const hours = durationSeconds / 3600;
  return Math.round(met * weightKg * hours);
}

/**
 * Convert tracking state to a completed RunSession
 */
export function finalizeRunSession(
  state: TrackingState,
  plannedDistanceKm: number,
  startName?: string,
  endName?: string
): RunSession {
  const distanceKm = Number(state.totalDistanceKm.toFixed(2));
  const avgSpeedKmh = state.elapsedSeconds > 0
    ? Number(((distanceKm / (state.elapsedSeconds / 3600))).toFixed(1))
    : 0;

  const paceSeconds = distanceKm > 0.05
    ? Math.round(state.elapsedSeconds / distanceKm)
    : 0;

  return {
    id: 'run_' + Date.now(),
    date: Date.now(),
    durationSeconds: state.elapsedSeconds,
    distanceKm,
    avgSpeedKmh,
    maxSpeedKmh: Number(state.maxSpeedKmh.toFixed(1)),
    avgPaceMinPerKm: formatPace(paceSeconds),
    paceSecondsPerKm: paceSeconds,
    calories: state.caloriesBurned,
    routeCoordinates: state.gpsBreadcrumbs,
    plannedDistanceKm,
    startPlaceName: startName || 'Start Point',
    endPlaceName: endName || 'Finish Line',
  };
}
