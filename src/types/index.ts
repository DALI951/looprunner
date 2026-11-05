export interface LatLng {
  lat: number;
  lng: number;
}

export interface SavedPlace {
  id: string;
  name: string;
  coords: LatLng;
  isDefaultStart?: boolean;
  createdAt: number;
}

export interface RouteOption {
  id: string;
  coordinates: [number, number][]; // [lat, lng]
  distanceKm: number;
  estimatedMinutes: number;
  waypoints: LatLng[];
  elevationGain?: number;
  isLoop: boolean;
  angleOffset?: number;
  avoidHighways?: boolean;
  maxRadiusZoneKm?: number | null;
}

export interface RunSession {
  id: string;
  date: number; // timestamp
  durationSeconds: number;
  distanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  avgPaceMinPerKm: string;
  paceSecondsPerKm: number;
  calories: number;
  routeCoordinates: [number, number][]; // actual GPS path
  plannedDistanceKm: number;
  startPlaceName?: string;
  endPlaceName?: string;
  notes?: string;
}

export interface PersonalRecords {
  longestRunKm: number;
  topSpeedKmh: number;
  bestPaceSeconds: number; // lowest is best
  totalDistanceKm: number;
  totalRuns: number;
  totalDurationSeconds: number;
  totalCalories: number;
}

export interface AppSettings {
  weightKg: number;
  githubRepo: string; // e.g. "username/looprunner" for updates
  unitSystem: 'metric' | 'imperial';
  simulatedGpsSpeedKmh: number;
}
