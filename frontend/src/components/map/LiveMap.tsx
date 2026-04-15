"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// NIT Goa campus center — used only as the initial pan target before any
// markers have been placed. Once markers are added we fitBounds to them.
const CAMPUS_CENTER: [number, number] = [15.17, 74.013];
// Pickup points on the NIT Goa campus. Upahar Ghar and Nescafe both sit
// inside the academic block cluster; the two coords here are placeholders
// until the exact lat/lng are measured on-site.
const UPAHAR_GHAR_POS: [number, number] = [15.1690189, 74.0117258];
const NESCAFE_POS: [number, number] = [15.1690189, 74.0117258];

type Source = "upahar_ghar" | "nescafe";

interface LiveMapProps {
  pilotLat?: number;
  pilotLng?: number;
  dropLat?: number;
  dropLng?: number;
  dropName?: string;
  source?: Source;
  className?: string;
}

export default function LiveMap({
  pilotLat,
  pilotLng,
  dropLat,
  dropLng,
  dropName = "Drop",
  source = "upahar_ghar",
  className = "h-64 w-full rounded-xl",
}: LiveMapProps) {
  // Memoize so the tuple reference is stable across renders — otherwise every
  // effect that lists `pickupPos` as a dep would refire each render.
  const pickupPos = useMemo<[number, number]>(
    () => (source === "nescafe" ? NESCAFE_POS : UPAHAR_GHAR_POS),
    [source]
  );
  const pickupLabel = source === "nescafe" ? "Nescafe" : "Upahar Ghar";

  const mapRef = useRef<L.Map | null>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
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

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      pickupMarkerRef.current = null;
      pilotMarkerRef.current = null;
      dropMarkerRef.current = null;
      routeLineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render (and re-render on source change) the pickup marker. This runs
  // separately from the map-init effect so the label/position updates when
  // the order's source flips between Upahar Ghar and Nescafe.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const icon = L.divIcon({
      html: `<div class="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow">${escapeHtml(
        pickupLabel
      )}</div>`,
      className: "",
      iconSize: [80, 24],
      iconAnchor: [40, 12],
    });

    if (pickupMarkerRef.current) {
      pickupMarkerRef.current.setLatLng(pickupPos);
      pickupMarkerRef.current.setIcon(icon);
    } else {
      pickupMarkerRef.current = L.marker(pickupPos, { icon }).addTo(map);
    }
  }, [pickupLabel, pickupPos]);

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

    // Dashed line: Pickup -> Drop
    const latlngs: L.LatLngTuple[] = [pickupPos, [dropLat, dropLng]];
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
  }, [dropLat, dropLng, dropName, pickupPos]);

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
  // (pickup + drop + pilot) is always visible. This also means if the pilot
  // is physically far from NIT Goa (e.g. testing from home), the map zooms
  // out to show both them and the campus.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const points: L.LatLngTuple[] = [pickupPos];
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
  }, [pilotLat, pilotLng, dropLat, dropLng, pickupPos]);

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
