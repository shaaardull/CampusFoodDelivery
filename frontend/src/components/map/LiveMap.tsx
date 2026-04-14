"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// NIT Goa campus coordinates
const CAMPUS_CENTER: [number, number] = [15.1700, 74.0130];
// Canteen marker sits near the academic block cluster (Upahar Ghar / Nescafe
// are co-located with the departments). Adjust if actual canteen coords differ.
const CANTEEN_POS: [number, number] = [15.1690189, 74.0117258]; // Gyan Mandir vicinity
const HOSTEL_POS: [number, number] = [15.1710367, 74.0147882]; // Talpona Hostel

interface LiveMapProps {
  pilotLat?: number;
  pilotLng?: number;
  dropLat?: number;
  dropLng?: number;
  className?: string;
}

export default function LiveMap({
  pilotLat,
  pilotLng,
  dropLat,
  dropLng,
  className = "h-64 w-full rounded-xl",
}: LiveMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const pilotMarkerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(CAMPUS_CENTER, 17);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    // Canteen marker
    L.marker(CANTEEN_POS, {
      icon: L.divIcon({
        html: '<div class="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow">Canteen</div>',
        className: "",
        iconSize: [60, 24],
        iconAnchor: [30, 12],
      }),
    }).addTo(map);

    // Hostel marker
    L.marker(HOSTEL_POS, {
      icon: L.divIcon({
        html: '<div class="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow">Hostel</div>',
        className: "",
        iconSize: [50, 24],
        iconAnchor: [25, 12],
      }),
    }).addTo(map);

    // Drop location marker if provided
    if (dropLat && dropLng) {
      L.marker([dropLat, dropLng], {
        icon: L.divIcon({
          html: '<div class="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow">Drop</div>',
          className: "",
          iconSize: [40, 24],
          iconAnchor: [20, 12],
        }),
      }).addTo(map);
    }

    // Route line (static)
    L.polyline([CANTEEN_POS, HOSTEL_POS], {
      color: "#f97316",
      weight: 3,
      opacity: 0.6,
      dashArray: "10 6",
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update pilot marker position
  useEffect(() => {
    if (!mapRef.current || !pilotLat || !pilotLng) return;

    if (pilotMarkerRef.current) {
      pilotMarkerRef.current.setLatLng([pilotLat, pilotLng]);
    } else {
      pilotMarkerRef.current = L.marker([pilotLat, pilotLng], {
        icon: L.divIcon({
          html: '<div class="bg-brand-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow animate-pulse">Pilot</div>',
          className: "",
          iconSize: [40, 24],
          iconAnchor: [20, 12],
        }),
      }).addTo(mapRef.current);
    }
  }, [pilotLat, pilotLng]);

  return <div ref={containerRef} className={className} />;
}
