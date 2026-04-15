"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// NIT Goa campus center — used only as the initial pan target before any
// markers have been placed. Once markers are added we fitBounds to them.
const CAMPUS_CENTER: [number, number] = [15.17, 74.013];
// Canteen marker sits near the academic block cluster (Upahar Ghar / Nescafe
// are co-located with the departments). Adjust if actual canteen coords differ.
const CANTEEN_POS: [number, number] = [15.1690189, 74.0117258];

interface LiveMapProps {
  pilotLat?: number;
  pilotLng?: number;
  dropLat?: number;
  dropLng?: number;
  dropName?: string;
  className?: string;
}

export default function LiveMap({
  pilotLat,
  pilotLng,
  dropLat,
  dropLng,
  dropName = "Drop",
  className = "h-64 w-full rounded-xl",
}: LiveMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const pilotMarkerRef = useRef<L.Marker | null>(null);
  const dropMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(CAMPUS_CENTER, 17);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    // Canteen marker (pickup point, static)
    L.marker(CANTEEN_POS, {
      icon: L.divIcon({
        html: '<div class="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow">Canteen</div>',
        className: "",
        iconSize: [60, 24],
        iconAnchor: [30, 12],
      }),
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      pilotMarkerRef.current = null;
      dropMarkerRef.current = null;
      routeLineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update drop marker + route line when drop location or name changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || dropLat === undefined || dropLng === undefined) return;

    if (dropMarkerRef.current) {
      dropMarkerRef.current.setLatLng([dropLat, dropLng]);
      dropMarkerRef.current.setIcon(
        L.divIcon({
          html: `<div class="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow">${escapeHtml(
            dropName
          )}</div>`,
          className: "",
          iconSize: [80, 24],
          iconAnchor: [40, 12],
        })
      );
    } else {
      dropMarkerRef.current = L.marker([dropLat, dropLng], {
        icon: L.divIcon({
          html: `<div class="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow">${escapeHtml(
            dropName
          )}</div>`,
          className: "",
          iconSize: [80, 24],
          iconAnchor: [40, 12],
        }),
      }).addTo(map);
    }

    // Dashed line: Canteen -> Drop
    const latlngs: L.LatLngTuple[] = [CANTEEN_POS, [dropLat, dropLng]];
    if (routeLineRef.current) {
      routeLineRef.current.setLatLngs(latlngs);
    } else {
      routeLineRef.current = L.polyline(latlngs, {
        color: "#f97316",
        weight: 3,
        opacity: 0.6,
        dashArray: "10 6",
      }).addTo(map);
    }
  }, [dropLat, dropLng, dropName]);

  // Update pilot marker position
  useEffect(() => {
    const map = mapRef.current;
    if (!map || pilotLat === undefined || pilotLng === undefined) return;

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
      }).addTo(map);
    }
  }, [pilotLat, pilotLng]);

  // Auto-fit map bounds whenever any marker moves, so every active marker
  // (canteen + drop + pilot) is always visible. This also means if the pilot
  // is physically far from NIT Goa (e.g. testing from home), the map zooms
  // out to show both them and the campus.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const points: L.LatLngTuple[] = [CANTEEN_POS];
    if (dropLat !== undefined && dropLng !== undefined) {
      points.push([dropLat, dropLng]);
    }
    if (pilotLat !== undefined && pilotLng !== undefined) {
      points.push([pilotLat, pilotLng]);
    }
    if (points.length < 2) return;

    map.fitBounds(L.latLngBounds(points), {
      padding: [32, 32],
      maxZoom: 17,
    });
  }, [pilotLat, pilotLng, dropLat, dropLng]);

  return <div ref={containerRef} className={className} />;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
