import { LatLng, RouteOption } from '../types';

// Earth radius in km
const EARTH_RADIUS_KM = 6371;

/**
 * Calculates straight-line distance in km using the Haversine formula
 */
export function calculateDistanceKm(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinDLat2 = Math.sin(dLat / 2);
  const sinDLng2 = Math.sin(dLng / 2);

  const h =
    sinDLat2 * sinDLat2 +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng2 * sinDLng2;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

export interface FeasibilityResult {
  isFeasible: boolean;
  minDistanceKm: number;
  message?: string;
}

/**
 * Instant local feasibility check (zero network delay)
 */
export function checkFeasibility(
  start: LatLng,
  end: LatLng,
  targetKm: number
): FeasibilityResult {
  const straightLine = calculateDistanceKm(start, end);

  // If Start == End, any distance >= 0.5km is feasible for a loop
  if (straightLine < 0.05) {
    if (targetKm < 0.5) {
      return {
        isFeasible: false,
        minDistanceKm: 0.5,
        message: 'A minimum loop of 0.5 km is recommended.',
      };
    }
    return { isFeasible: true, minDistanceKm: 0.5 };
  }

  // Realistic pedestrian shortest path requires ~1.2x straight line due to road grids
  const estimatedMinRoad = straightLine * 1.20;
  const roundedMin = Math.ceil(estimatedMinRoad * 10) / 10;

  if (targetKm < estimatedMinRoad * 0.95) {
    return {
      isFeasible: false,
      minDistanceKm: roundedMin,
      message: `The shortest walkable route between these points is ${roundedMin} km. Please increase your target distance.`,
    };
  }

  return {
    isFeasible: true,
    minDistanceKm: roundedMin,
  };
}

export interface RouteGeneratorOptions {
  avoidHighways?: boolean;
  maxRadiusZoneKm?: number | null;
  angleVariation?: number;
}

/**
 * Generates intermediate waypoints around origin in a polygon sweep to create a circular loop
 * avoiding doubling back on the same street, with support for zone radius clamping and neighborhood zigzags.
 */
function generateLoopWaypoints(
  start: LatLng,
  targetKm: number,
  options: RouteGeneratorOptions = {}
): LatLng[] {
  const { avoidHighways = false, maxRadiusZoneKm = null, angleVariation = 0 } = options;

  // Theoretical circle radius: P = 2 * PI * R
  let radiusKm = (targetKm / (2 * Math.PI)) * 0.85;

  // If user specified a maximum boundary zone from start, clamp radius
  if (maxRadiusZoneKm && maxRadiusZoneKm > 0.2) {
    radiusKm = Math.min(radiusKm, maxRadiusZoneKm * 0.9);
  }

  // If avoiding highways or densely packed in a zone, add more waypoints for zigzags
  const numWaypoints = avoidHighways || (maxRadiusZoneKm && targetKm > maxRadiusZoneKm * 3)
    ? Math.max(5, Math.min(8, Math.round(targetKm * 1.4)))
    : targetKm > 8 ? 4 : 3;

  const waypoints: LatLng[] = [];

  for (let i = 1; i <= numWaypoints; i++) {
    // Angular progression
    const baseAngle = angleVariation + (i * (2 * Math.PI)) / (numWaypoints + 1);

    // If avoidHighways is true, add residential zigzag oscillation
    let effectiveRadius = radiusKm;
    if (avoidHighways) {
      // Alternate radius by +/- 22% to force routing through inner neighborhood streets
      const wiggle = (i % 2 === 0 ? 0.78 : 1.15);
      effectiveRadius = radiusKm * wiggle;
    }

    // Ensure within max radius zone
    if (maxRadiusZoneKm && maxRadiusZoneKm > 0.2) {
      effectiveRadius = Math.min(effectiveRadius, maxRadiusZoneKm * 0.95);
    }

    const latOffset = (effectiveRadius * Math.cos(baseAngle)) / 111.0;
    const lngOffset =
      (effectiveRadius * Math.sin(baseAngle)) / (111.0 * Math.cos((start.lat * Math.PI) / 180));

    waypoints.push({
      lat: start.lat + latOffset,
      lng: start.lng + lngOffset,
    });
  }

  return waypoints;
}

/**
 * Generates detour waypoints for Point A to Point B
 */
function generatePointToPointDetourWaypoints(
  start: LatLng,
  end: LatLng,
  targetKm: number,
  options: RouteGeneratorOptions = {}
): LatLng[] {
  const { avoidHighways = false, angleVariation = 0 } = options;
  const directDistance = calculateDistanceKm(start, end);
  const extraDistance = Math.max(0, targetKm - directDistance);

  // Lateral deflection proportional to extra distance
  const deflectionKm = Math.min(extraDistance * 0.6, 6.0);

  const midLat = (start.lat + end.lat) / 2;
  const midLng = (start.lng + end.lng) / 2;

  // Normal vector perpendicular to start -> end vector
  const dLat = end.lat - start.lat;
  const dLng = end.lng - start.lng;
  const mag = Math.sqrt(dLat * dLat + dLng * dLng) || 0.0001;

  let normLat = -dLng / mag;
  let normLng = dLat / mag;

  const flip = Math.sin(angleVariation) > 0;
  if (flip) {
    normLat = -normLat;
    normLng = -normLng;
  }

  const latOffset = (deflectionKm * normLat) / 111.0;
  const lngOffset =
    (deflectionKm * normLng) / (111.0 * Math.cos((midLat * Math.PI) / 180));

  const zigzagFactor = avoidHighways ? 0.6 : 1.0;

  const waypoint1: LatLng = {
    lat: (start.lat + midLat) / 2 + latOffset * 0.7 * zigzagFactor,
    lng: (start.lng + midLng) / 2 + lngOffset * 0.7 * zigzagFactor,
  };

  const waypoint2: LatLng = {
    lat: midLat + latOffset,
    lng: midLng + lngOffset,
  };

  const waypoint3: LatLng = {
    lat: (midLat + end.lat) / 2 + latOffset * 0.7 * (avoidHighways ? 1.2 : 1.0),
    lng: (midLng + end.lng) / 2 + lngOffset * 0.7 * (avoidHighways ? 1.2 : 1.0),
  };

  return [waypoint1, waypoint2, waypoint3];
}

/**
 * Main function: Generates a custom-distance route avoiding backtracking
 */
export async function generateCustomRoute(
  start: LatLng,
  end: LatLng,
  targetKm: number,
  options: RouteGeneratorOptions = {}
): Promise<RouteOption> {
  const isLoop = calculateDistanceKm(start, end) < 0.05;
  let waypoints: LatLng[] = [];

  if (isLoop) {
    waypoints = generateLoopWaypoints(start, targetKm, options);
  } else {
    waypoints = generatePointToPointDetourWaypoints(start, end, targetKm, options);
  }

  // Ordered stops: [start, ...waypoints, end]
  const allStops = [start, ...waypoints, end];

  // Try to route via OSRM Foot API
  try {
    const coordsParam = allStops.map(p => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/foot/${coordsParam}?overview=full&geometries=geojson&continue_straight=true`;

    const res = await fetch(url, { signal: AbortSignal.timeout(2200) });
    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const actualDistanceKm = route.distance / 1000;
        const latLngCoords: [number, number][] = route.geometry.coordinates.map(
          (c: [number, number]) => [c[1], c[0]]
        );

        const estimatedMinutes = Math.round(actualDistanceKm * 5.5);

        return {
          id: 'route_' + Date.now(),
          coordinates: latLngCoords,
          distanceKm: Number(actualDistanceKm.toFixed(2)),
          estimatedMinutes,
          waypoints,
          isLoop,
          angleOffset: options.angleVariation || 0,
          avoidHighways: options.avoidHighways || false,
          maxRadiusZoneKm: options.maxRadiusZoneKm || null,
        };
      }
    }
  } catch (err) {
    console.warn('OSRM routing network fallback:', err);
  }

  // Fallback: Smooth interpolated geometric road curve
  const fallbackCoords: [number, number][] = [];
  for (let i = 0; i < allStops.length - 1; i++) {
    const p1 = allStops[i];
    const p2 = allStops[i + 1];
    const steps = 14;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      fallbackCoords.push([
        p1.lat + (p2.lat - p1.lat) * t,
        p1.lng + (p2.lng - p1.lng) * t,
      ]);
    }
  }
  fallbackCoords.push([end.lat, end.lng]);

  let fallbackDistance = 0;
  for (let i = 0; i < fallbackCoords.length - 1; i++) {
    fallbackDistance += calculateDistanceKm(
      { lat: fallbackCoords[i][0], lng: fallbackCoords[i][1] },
      { lat: fallbackCoords[i + 1][0], lng: fallbackCoords[i + 1][1] }
    );
  }

  return {
    id: 'route_' + Date.now(),
    coordinates: fallbackCoords,
    distanceKm: Number((fallbackDistance * 1.15).toFixed(2)),
    estimatedMinutes: Math.round(targetKm * 5.5),
    waypoints,
    isLoop,
    angleOffset: options.angleVariation || 0,
    avoidHighways: options.avoidHighways || false,
    maxRadiusZoneKm: options.maxRadiusZoneKm || null,
  };
}

/**
 * Calculates perpendicular/shortest distance in meters from current position to route polyline
 */
export function getDistanceFromPolylineMeters(pos: LatLng, polyline: [number, number][]): number {
  if (!polyline || polyline.length === 0) return 0;
  let minDistanceKm = Infinity;

  // Sample every few points for performance
  const step = polyline.length > 200 ? 2 : 1;
  for (let i = 0; i < polyline.length; i += step) {
    const pt = { lat: polyline[i][0], lng: polyline[i][1] };
    const dist = calculateDistanceKm(pos, pt);
    if (dist < minDistanceKm) {
      minDistanceKm = dist;
    }
  }

  return minDistanceKm * 1000; // in meters
}

/**
 * Dynamic Recalculation (Google Maps Style):
 * When user takes a wrong turn off-route, calculate a new route from current position to destination
 */
export async function recalculateRouteFromCurrent(
  currentPos: LatLng,
  destination: LatLng,
  originalRoute: RouteOption
): Promise<RouteOption> {
  const directRemaining = calculateDistanceKm(currentPos, destination);
  const targetKm = Math.max(directRemaining * 1.15, originalRoute.distanceKm * 0.4);

  return generateCustomRoute(currentPos, destination, targetKm, {
    avoidHighways: originalRoute.avoidHighways,
    maxRadiusZoneKm: originalRoute.maxRadiusZoneKm,
    angleVariation: (originalRoute.angleOffset || 0) + 0.3,
  });
}
