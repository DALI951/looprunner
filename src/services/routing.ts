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
 * Check if the target distance is physically possible between start and end
 */
export async function checkFeasibility(
  start: LatLng,
  end: LatLng,
  targetKm: number
): Promise<FeasibilityResult> {
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

  // Estimated pedestrian shortest path usually requires ~1.2x straight line due to road grids
  let estimatedMinRoad = straightLine * 1.15;

  // Attempt real OSRM shortest path calculation
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${start.lng},${start.lat};${end.lng},${end.lat}?overview=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        estimatedMinRoad = data.routes[0].distance / 1000;
      }
    }
  } catch {
    // fallback to conservative geometric estimate
  }

  // Round up to 1 decimal place
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

/**
 * Generates intermediate waypoints around origin in a polygon sweep to create a circular loop
 * avoiding doubling back on the same street.
 */
function generateLoopWaypoints(
  start: LatLng,
  targetKm: number,
  angleOffsetRad: number = 0
): LatLng[] {
  // Approximate radius needed for perimeter of circle: P = 2 * PI * R
  // Walking path winding factor is ~1.25, so:
  const radiusKm = (targetKm / (2 * Math.PI)) * 0.85;

  // We place 3 or 4 directional waypoints around the circle
  const numWaypoints = targetKm > 8 ? 4 : 3;
  const waypoints: LatLng[] = [];

  for (let i = 1; i <= numWaypoints; i++) {
    // Angular progression ensuring sequential non-crossing loop
    const angle = angleOffsetRad + (i * (2 * Math.PI)) / (numWaypoints + 1);

    // Apply latitude-adjusted degree conversion
    const latOffset = (radiusKm * Math.cos(angle)) / 111.0;
    const lngOffset =
      (radiusKm * Math.sin(angle)) / (111.0 * Math.cos((start.lat * Math.PI) / 180));

    waypoints.push({
      lat: start.lat + latOffset,
      lng: start.lng + lngOffset,
    });
  }

  return waypoints;
}

/**
 * Generates detour waypoints for Point A to Point B when targetKm > shortest path
 */
function generatePointToPointDetourWaypoints(
  start: LatLng,
  end: LatLng,
  targetKm: number,
  flipSide: boolean = false
): LatLng[] {
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

  // Perpendicular unit vector
  let normLat = -dLng / mag;
  let normLng = dLat / mag;

  if (flipSide) {
    normLat = -normLat;
    normLng = -normLng;
  }

  const latOffset = (deflectionKm * normLat) / 111.0;
  const lngOffset =
    (deflectionKm * normLng) / (111.0 * Math.cos((midLat * Math.PI) / 180));

  const waypoint1: LatLng = {
    lat: (start.lat + midLat) / 2 + latOffset * 0.7,
    lng: (start.lng + midLng) / 2 + lngOffset * 0.7,
  };

  const waypoint2: LatLng = {
    lat: midLat + latOffset,
    lng: midLng + lngOffset,
  };

  const waypoint3: LatLng = {
    lat: (midLat + end.lat) / 2 + latOffset * 0.7,
    lng: (midLng + end.lng) / 2 + lngOffset * 0.7,
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
  angleVariation: number = 0
): Promise<RouteOption> {
  const isLoop = calculateDistanceKm(start, end) < 0.05;
  let waypoints: LatLng[] = [];

  if (isLoop) {
    // Generate radial perimeter waypoints
    waypoints = generateLoopWaypoints(start, targetKm, angleVariation);
  } else {
    // Generate lateral detour waypoints
    const flip = Math.sin(angleVariation) > 0;
    waypoints = generatePointToPointDetourWaypoints(start, end, targetKm, flip);
  }

  // Construct complete ordered list of points: [start, ...waypoints, end]
  const allStops = [start, ...waypoints, end];

  // Try to route via OSRM Foot API
  try {
    const coordsParam = allStops.map(p => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/foot/${coordsParam}?overview=full&geometries=geojson&continue_straight=true`;

    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const actualDistanceKm = route.distance / 1000;
        // GeoJSON coordinates are [lng, lat], convert to Leaflet [lat, lng]
        const latLngCoords: [number, number][] = route.geometry.coordinates.map(
          (c: [number, number]) => [c[1], c[0]]
        );

        // Average running pace ~ 5.5 min/km
        const estimatedMinutes = Math.round(actualDistanceKm * 5.5);

        return {
          id: 'route_' + Date.now(),
          coordinates: latLngCoords,
          distanceKm: Number(actualDistanceKm.toFixed(2)),
          estimatedMinutes,
          waypoints,
          isLoop,
          angleOffset: angleVariation,
        };
      }
    }
  } catch (err) {
    console.warn('OSRM network routing fallback engaged:', err);
  }

  // Fallback: Smooth interpolated geometric curve when offline
  const fallbackCoords: [number, number][] = [];
  for (let i = 0; i < allStops.length - 1; i++) {
    const p1 = allStops[i];
    const p2 = allStops[i + 1];
    const steps = 12;
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
    angleOffset: angleVariation,
  };
}
