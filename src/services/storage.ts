import { SavedPlace, RunSession, PersonalRecords, AppSettings } from '../types';

const PLACES_KEY = 'looprunner_saved_places';
const RUNS_KEY = 'looprunner_run_sessions';
const SETTINGS_KEY = 'looprunner_settings';

const DEFAULT_SETTINGS: AppSettings = {
  weightKg: 70,
  githubRepo: 'DALI951/looprunner',
  unitSystem: 'metric',
  simulatedGpsSpeedKmh: 10,
};

const DEFAULT_PLACES: SavedPlace[] = [
  {
    id: 'place-home',
    name: 'Home',
    coords: { lat: 36.8065, lng: 10.1815 }, // Default sample coords (Tunis/Mediterranean, easily customizable)
    isDefaultStart: true,
    createdAt: Date.now(),
  },
  {
    id: 'place-park',
    name: 'Central Park',
    coords: { lat: 36.8180, lng: 10.1650 },
    isDefaultStart: false,
    createdAt: Date.now(),
  },
];

export const storage = {
  // Saved Places
  getSavedPlaces(): SavedPlace[] {
    try {
      const data = localStorage.getItem(PLACES_KEY);
      if (!data) {
        localStorage.setItem(PLACES_KEY, JSON.stringify(DEFAULT_PLACES));
        return DEFAULT_PLACES;
      }
      return JSON.parse(data);
    } catch {
      return DEFAULT_PLACES;
    }
  },

  savePlace(place: Omit<SavedPlace, 'id' | 'createdAt'>): SavedPlace {
    const places = this.getSavedPlaces();
    const newPlace: SavedPlace = {
      ...place,
      id: 'place_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: Date.now(),
    };
    places.push(newPlace);
    localStorage.setItem(PLACES_KEY, JSON.stringify(places));
    return newPlace;
  },

  deletePlace(id: string): void {
    const places = this.getSavedPlaces().filter(p => p.id !== id);
    localStorage.setItem(PLACES_KEY, JSON.stringify(places));
  },

  // Run History
  getRuns(): RunSession[] {
    try {
      const data = localStorage.getItem(RUNS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveRun(run: RunSession): void {
    const runs = this.getRuns();
    // Prepend latest run
    runs.unshift(run);
    localStorage.setItem(RUNS_KEY, JSON.stringify(runs));
  },

  deleteRun(id: string): void {
    const runs = this.getRuns().filter(r => r.id !== id);
    localStorage.setItem(RUNS_KEY, JSON.stringify(runs));
  },

  // Personal Records
  getPersonalRecords(): PersonalRecords {
    const runs = this.getRuns();
    if (runs.length === 0) {
      return {
        longestRunKm: 0,
        topSpeedKmh: 0,
        bestPaceSeconds: 0,
        totalDistanceKm: 0,
        totalRuns: 0,
        totalDurationSeconds: 0,
        totalCalories: 0,
      };
    }

    let longestRunKm = 0;
    let topSpeedKmh = 0;
    let bestPaceSeconds = Infinity;
    let totalDistanceKm = 0;
    let totalDurationSeconds = 0;
    let totalCalories = 0;

    for (const r of runs) {
      if (r.distanceKm > longestRunKm) longestRunKm = r.distanceKm;
      if (r.maxSpeedKmh > topSpeedKmh) topSpeedKmh = r.maxSpeedKmh;
      if (r.paceSecondsPerKm > 0 && r.paceSecondsPerKm < bestPaceSeconds) {
        bestPaceSeconds = r.paceSecondsPerKm;
      }
      totalDistanceKm += r.distanceKm;
      totalDurationSeconds += r.durationSeconds;
      totalCalories += r.calories;
    }

    return {
      longestRunKm: Number(longestRunKm.toFixed(2)),
      topSpeedKmh: Number(topSpeedKmh.toFixed(1)),
      bestPaceSeconds: bestPaceSeconds === Infinity ? 0 : bestPaceSeconds,
      totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
      totalRuns: runs.length,
      totalDurationSeconds,
      totalCalories,
    };
  },

  // Settings
  getSettings(): AppSettings {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    return updated;
  },

  // Clear / Reset
  clearAllData(): void {
    localStorage.removeItem(PLACES_KEY);
    localStorage.removeItem(RUNS_KEY);
    localStorage.removeItem(SETTINGS_KEY);
  }
};
