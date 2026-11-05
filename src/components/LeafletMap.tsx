import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { LatLng, SavedPlace } from '../types';

interface LeafletMapProps {
  center: LatLng;
  zoom?: number;
  startPoint?: LatLng | null;
  endPoint?: LatLng | null;
  routeCoordinates?: [number, number][]; // Planned route [lat, lng]
  actualBreadcrumbs?: [number, number][]; // Recorded runner path
  currentRunnerPos?: LatLng | null;
  savedPlaces?: SavedPlace[];
  onMapClick?: (coords: LatLng) => void;
  interactive?: boolean;
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
  onMapClick,
  className = 'w-full h-full min-h-[300px]',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const breadcrumbLayerRef = useRef<L.Polyline | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const runnerMarkerRef = useRef<L.Marker | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: zoom,
      zoomControl: false,
    });

    // Clean OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Zoom controls at top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update center when center prop changes
  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.setView([center.lat, center.lng], zoom);
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 100);
    }
  }, [center.lat, center.lng, zoom]);

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

    // 1. Saved Places Pins
    savedPlaces.forEach(place => {
      const pinIcon = L.divIcon({
        className: 'custom-pin-marker',
        html: `
          <div style="background: #3b82f6; color: white; padding: 4px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.4); display: flex; align-items: center; gap: 4px; border: 2px solid white; transform: translate(-50%, -100%);">
            <span>📍</span>
            <span>${place.name}</span>
          </div>
        `,
        iconSize: [0, 0],
      });
      L.marker([place.coords.lat, place.coords.lng], { icon: pinIcon })
        .addTo(markersLayer)
        .bindPopup(`<b>${place.name}</b><br/>Saved Location`);
    });

    // 2. Start Point Pin
    if (startPoint) {
      const startIcon = L.divIcon({
        className: 'start-marker',
        html: `
          <div style="background: #10b981; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: 0 4px 10px rgba(16,185,129,0.5); transform: translate(-50%, -50%);">
            🏃
          </div>
        `,
        iconSize: [0, 0],
      });
      L.marker([startPoint.lat, startPoint.lng], { icon: startIcon })
        .addTo(markersLayer)
        .bindPopup('<b>Start Point</b>');
    }

    // 3. End Point Pin (if different from start)
    if (endPoint && (!startPoint || Math.abs(endPoint.lat - startPoint.lat) > 0.0001 || Math.abs(endPoint.lng - startPoint.lng) > 0.0001)) {
      const endIcon = L.divIcon({
        className: 'end-marker',
        html: `
          <div style="background: #ef4444; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: 0 4px 10px rgba(239,68,68,0.5); transform: translate(-50%, -50%);">
            🏁
          </div>
        `,
        iconSize: [0, 0],
      });
      L.marker([endPoint.lat, endPoint.lng], { icon: endIcon })
        .addTo(markersLayer)
        .bindPopup('<b>Finish Point</b>');
    }

    // 4. Planned Route Polyline
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    if (routeCoordinates && routeCoordinates.length > 0) {
      // Glow underlayer
      const glowLine = L.polyline(routeCoordinates, {
        color: '#0284c7',
        weight: 9,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(markersLayer);

      // Main route polyline
      const routeLine = L.polyline(routeCoordinates, {
        color: '#38bdf8',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(markersLayer);

      routeLayerRef.current = routeLine;

      // Fit bounds nicely around the route
      const bounds = routeLine.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      }
    }

    // 5. Actual GPS Trail (Orange)
    if (breadcrumbLayerRef.current) {
      breadcrumbLayerRef.current.remove();
      breadcrumbLayerRef.current = null;
    }

    if (actualBreadcrumbs && actualBreadcrumbs.length > 0) {
      const trail = L.polyline(actualBreadcrumbs, {
        color: '#f59e0b',
        weight: 6,
        opacity: 0.9,
        dashArray: '1, 8',
      }).addTo(markersLayer);
      breadcrumbLayerRef.current = trail;
    }
  }, [startPoint, endPoint, routeCoordinates, actualBreadcrumbs, savedPlaces]);

  // Live Runner Pulse Marker
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
    } else if (runnerMarkerRef.current) {
      runnerMarkerRef.current.remove();
      runnerMarkerRef.current = null;
    }
  }, [currentRunnerPos]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-700/60 shadow-xl ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
