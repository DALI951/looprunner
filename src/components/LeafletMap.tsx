import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { LatLng, SavedPlace } from '../types';
import { Crosshair } from 'lucide-react';

interface LeafletMapProps {
  center: LatLng;
  zoom?: number;
  startPoint?: LatLng | null;
  endPoint?: LatLng | null;
  routeCoordinates?: [number, number][]; // Planned route [lat, lng]
  actualBreadcrumbs?: [number, number][]; // Recorded runner path
  currentRunnerPos?: LatLng | null;
  savedPlaces?: SavedPlace[];
  zoneRadiusKm?: number | null; // Zone limit circle from start
  autoFollowRunner?: boolean; // Follow user camera
  speedKmh?: number | null; // Live speed overlay
  onMapClick?: (coords: LatLng) => void;
  className?: string;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  center,
  zoom = 14,
  startPoint,
  endPoint,
  routeCoordinates = [],
  actualBreadcrumbs = [],
  currentRunnerPos,
  savedPlaces = [],
  zoneRadiusKm,
  autoFollowRunner = false,
  speedKmh,
  onMapClick,
  className = 'w-full h-full min-h-[300px]',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const glowLayerRef = useRef<L.Polyline | null>(null);
  const breadcrumbLayerRef = useRef<L.Polyline | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const runnerMarkerRef = useRef<L.Marker | null>(null);
  const zoneCircleRef = useRef<L.Circle | null>(null);

  const [isFollowing, setIsFollowing] = useState<boolean>(autoFollowRunner);

  // Sync isFollowing if prop changes
  useEffect(() => {
    setIsFollowing(autoFollowRunner);
  }, [autoFollowRunner]);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: zoom,
      zoomControl: false,
    });

    // OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Zoom control at top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Detect user manual dragging to temporarily pause auto-follow
    map.on('dragstart', () => {
      if (currentRunnerPos) {
        setIsFollowing(false);
      }
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Invalidate size on center / view updates (if not in active run follow mode)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!currentRunnerPos) {
      map.setView([center.lat, center.lng], zoom);
      setTimeout(() => {
        map.invalidateSize();
      }, 80);
    }
  }, [center.lat, center.lng, zoom, currentRunnerPos]);

  // Click handler
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (onMapClick) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [onMapClick]);

  // Update Markers & Layers
  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    // 1. Zone Boundary Circle (Max Distance from Start)
    if (zoneCircleRef.current) {
      zoneCircleRef.current.remove();
      zoneCircleRef.current = null;
    }
    if (startPoint && zoneRadiusKm && zoneRadiusKm > 0.2) {
      const circle = L.circle([startPoint.lat, startPoint.lng], {
        radius: zoneRadiusKm * 1000,
        color: '#f59e0b',
        weight: 2,
        opacity: 0.8,
        dashArray: '8, 8',
        fillColor: '#f59e0b',
        fillOpacity: 0.05,
      }).addTo(markersLayer);
      zoneCircleRef.current = circle;
    }

    // 2. Saved Places Pins
    savedPlaces.forEach(place => {
      const pinIcon = L.divIcon({
        className: 'custom-pin-marker',
        html: `
          <div style="background: #2563eb; color: white; padding: 4px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; box-shadow: 0 4px 8px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 4px; border: 2px solid white; transform: translate(-50%, -100%); white-space: nowrap;">
            <span>📍</span>
            <span>${place.name}</span>
          </div>
        `,
        iconSize: [0, 0],
      });
      L.marker([place.coords.lat, place.coords.lng], { icon: pinIcon })
        .addTo(markersLayer)
        .bindPopup(`<b>${place.name}</b><br/>Saved Place`);
    });

    const isLoop =
      startPoint &&
      endPoint &&
      Math.abs(startPoint.lat - endPoint.lat) < 0.0005 &&
      Math.abs(startPoint.lng - endPoint.lng) < 0.0005;

    // 3. Start / Loop Pin
    if (startPoint) {
      const startHtml = isLoop
        ? `
          <div style="background: #10b981; color: white; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 800; border: 2px solid white; box-shadow: 0 4px 10px rgba(16,185,129,0.7); display: flex; align-items: center; gap: 4px; transform: translate(-50%, -50%); white-space: nowrap;">
            <span>🔄</span>
            <span>START & FINISH</span>
          </div>
        `
        : `
          <div style="background: #10b981; color: white; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 800; border: 2px solid white; box-shadow: 0 4px 10px rgba(16,185,129,0.7); display: flex; align-items: center; gap: 4px; transform: translate(-50%, -50%); white-space: nowrap;">
            <span>🏃</span>
            <span>START</span>
          </div>
        `;

      const startIcon = L.divIcon({
        className: 'start-marker',
        html: startHtml,
        iconSize: [0, 0],
      });
      L.marker([startPoint.lat, startPoint.lng], { icon: startIcon, zIndexOffset: 500 }).addTo(
        markersLayer
      );
    }

    // 4. Distinct Finish Pin
    if (endPoint && !isLoop) {
      const endIcon = L.divIcon({
        className: 'end-marker',
        html: `
          <div style="background: #ef4444; color: white; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 800; border: 2px solid white; box-shadow: 0 4px 10px rgba(239,68,68,0.7); display: flex; align-items: center; gap: 4px; transform: translate(-50%, -50%); white-space: nowrap;">
            <span>🏁</span>
            <span>FINISH</span>
          </div>
        `,
        iconSize: [0, 0],
      });
      L.marker([endPoint.lat, endPoint.lng], { icon: endIcon, zIndexOffset: 500 }).addTo(
        markersLayer
      );
    }

    // 5. Planned Route Polyline
    if (glowLayerRef.current) {
      glowLayerRef.current.remove();
      glowLayerRef.current = null;
    }
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    if (routeCoordinates && routeCoordinates.length > 0) {
      // Glow underlayer
      const glow = L.polyline(routeCoordinates, {
        color: '#0284c7',
        weight: 10,
        opacity: 0.5,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(markersLayer);
      glowLayerRef.current = glow;

      // Primary vibrant neon route line
      const line = L.polyline(routeCoordinates, {
        color: '#00f0ff',
        weight: 5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(markersLayer);
      routeLayerRef.current = line;

      // Fit bounds if not actively tracking a runner position
      if (!currentRunnerPos) {
        setTimeout(() => {
          try {
            const bounds = line.getBounds();
            if (bounds.isValid()) {
              map.fitBounds(bounds, {
                padding: [45, 45],
                maxZoom: 16,
                animate: true,
              });
            }
          } catch {
            // ignore
          }
        }, 50);
      }
    }

    // 6. Recorded GPS Path (Amber)
    if (breadcrumbLayerRef.current) {
      breadcrumbLayerRef.current.remove();
      breadcrumbLayerRef.current = null;
    }

    if (actualBreadcrumbs && actualBreadcrumbs.length > 0) {
      const trail = L.polyline(actualBreadcrumbs, {
        color: '#f59e0b',
        weight: 6,
        opacity: 0.95,
        dashArray: '2, 6',
      }).addTo(markersLayer);
      breadcrumbLayerRef.current = trail;
    }
  }, [startPoint, endPoint, routeCoordinates, actualBreadcrumbs, savedPlaces, zoneRadiusKm]);

  // Live Runner Pulse Marker & Camera Follow
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (currentRunnerPos) {
      if (!runnerMarkerRef.current) {
        const pulseIcon = L.divIcon({
          className: 'runner-pulse-marker',
          html: `
            <div class="runner-pulse-ring"></div>
            <div class="runner-pulse-dot"></div>
          `,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        runnerMarkerRef.current = L.marker([currentRunnerPos.lat, currentRunnerPos.lng], {
          icon: pulseIcon,
          zIndexOffset: 1000,
        }).addTo(map);
      } else {
        runnerMarkerRef.current.setLatLng([currentRunnerPos.lat, currentRunnerPos.lng]);
      }

      // Smooth camera pan to follow the runner
      if (isFollowing) {
        map.panTo([currentRunnerPos.lat, currentRunnerPos.lng], {
          animate: true,
          duration: 0.6,
        });
      }
    } else if (runnerMarkerRef.current) {
      runnerMarkerRef.current.remove();
      runnerMarkerRef.current = null;
    }
  }, [currentRunnerPos, isFollowing]);

  const handleRecenter = () => {
    setIsFollowing(true);
    if (mapRef.current && currentRunnerPos) {
      mapRef.current.setView([currentRunnerPos.lat, currentRunnerPos.lng], 16, { animate: true });
    }
  };

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <div ref={containerRef} className="w-full h-full min-h-[280px]" />

      {/* Floating Speed & Camera Follow Overlays during active run */}
      {currentRunnerPos && (
        <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 pointer-events-none">
          {speedKmh !== undefined && speedKmh !== null && (
            <div className="bg-slate-900/95 backdrop-blur border border-sky-500/80 rounded-2xl px-3 py-1.5 shadow-2xl flex items-center gap-2 pointer-events-auto">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <p className="text-[9px] uppercase font-bold text-slate-400 leading-none">Speed</p>
                <p className="text-sm font-black text-white font-mono leading-tight">
                  {speedKmh.toFixed(1)} <span className="text-[10px] text-sky-400 font-sans">km/h</span>
                </p>
              </div>
            </div>
          )}

          {/* Recenter / Auto-Follow Toggle Button */}
          <button
            onClick={handleRecenter}
            className={`p-2.5 rounded-2xl border shadow-xl transition pointer-events-auto flex items-center gap-1.5 text-xs font-bold ${
              isFollowing
                ? 'bg-sky-600 border-sky-400 text-white shadow-sky-500/30'
                : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Recenter and follow me"
          >
            <Crosshair className={`w-4 h-4 ${isFollowing ? 'animate-spin' : ''}`} />
            <span>{isFollowing ? 'Tracking Me' : 'Follow Me'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
