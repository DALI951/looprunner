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
  const glowLayerRef = useRef<L.Polyline | null>(null);
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

    // OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Zoom control at top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Trigger size calculation
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    // ResizeObserver ensures map is always 100% visible even when parent resizes
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

  // Invalidate size on center / view updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([center.lat, center.lng], zoom);
    setTimeout(() => {
      map.invalidateSize();
    }, 80);
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

    // 2. Start / Loop Pin
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

    // 3. Distinct Finish Pin (only when not a loop)
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

    // 4. Planned Route Polyline
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

      // Fit bounds smoothly with padding
      setTimeout(() => {
        try {
          const bounds = line.getBounds();
          if (bounds.isValid()) {
            map.fitBounds(bounds, {
              padding: [40, 40],
              maxZoom: 16,
              animate: true,
            });
          }
        } catch {
          // ignore if container sizing in transition
        }
      }, 50);
    }

    // 5. Recorded Actual Runner GPS Path (Amber)
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
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <div ref={containerRef} className="w-full h-full min-h-[280px]" />
    </div>
  );
};
