"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

type Coordinate = [number, number];

type Props = {
  onChange: (geojson: string, areaHectares: number, coordinates: Coordinate[]) => void;
};

function polygonAreaHectares(points: Coordinate[]) {
  if (points.length < 3) return 0;
  const radians = Math.PI / 180;
  const earthRadius = 6378137;
  const centerLat =
    points.reduce((sum, [, lat]) => sum + lat, 0) / points.length;
  const projected = points.map(([lng, lat]) => [
    earthRadius * lng * radians * Math.cos(centerLat * radians),
    earthRadius * lat * radians,
  ]);
  let area = 0;
  projected.forEach(([x1, y1], index) => {
    const [x2, y2] = projected[(index + 1) % projected.length];
    area += x1 * y2 - x2 * y1;
  });
  return Math.abs(area / 2) / 10000;
}

export default function MapEditor({ onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const [points, setPoints] = useState<Coordinate[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function setup() {
      if (!containerRef.current || mapRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView([21.78, 88.23], 10);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      const layers = L.layerGroup().addTo(map);
      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        setPoints((current) => [...current, [event.latlng.lng, event.latlng.lat]]);
      });
      mapRef.current = map;
      layerRef.current = layers;
    }
    setup();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    async function draw() {
      const L = await import("leaflet");
      const layers = layerRef.current;
      if (!layers) return;
      layers.clearLayers();
      points.forEach(([lng, lat], index) => {
        const marker = L.circleMarker([lat, lng], {
          radius: 5,
          fillColor: "#f4b942",
          fillOpacity: 1,
          color: "#ffffff",
          weight: 2,
        }).bindTooltip(`${index + 1}`, {
          permanent: true,
          direction: "top",
          className: "point-label",
        });
        marker.addTo(layers);
      });
      if (points.length >= 2) {
        L.polyline(
          points.map(([lng, lat]) => [lat, lng]),
          { color: "#0d6758", weight: 3, dashArray: points.length < 3 ? "7 7" : undefined },
        ).addTo(layers);
      }
      if (points.length >= 3) {
        L.polygon(
          points.map(([lng, lat]) => [lat, lng]),
          { color: "#0d6758", fillColor: "#2b8a78", fillOpacity: 0.25, weight: 3 },
        ).addTo(layers);
      }
      const area = polygonAreaHectares(points);
      const ring = points.length >= 3 ? [...points, points[0]] : points;
      const geojson = JSON.stringify({
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [ring] },
      });
      onChange(geojson, area, points);
    }
    draw();
  }, [points, onChange]);

  const useSample = () => {
    const sample: Coordinate[] = [
      [88.2098, 21.7935],
      [88.2221, 21.7967],
      [88.2294, 21.7872],
      [88.2192, 21.7793],
      [88.2074, 21.7841],
    ];
    setPoints(sample);
    mapRef.current?.fitBounds(
      sample.map(([lng, lat]) => [lat, lng] as [number, number]),
      { padding: [50, 50] },
    );
  };

  const area = polygonAreaHectares(points);

  return (
    <div className="map-shell">
      <div className="map-toolbar">
        <div>
          <span className="eyebrow">Boundary editor</span>
          <strong>Click the map to place boundary points</strong>
        </div>
        <div className="map-actions">
          <button type="button" className="text-button" onClick={useSample}>Use sample</button>
          <button
            type="button"
            className="text-button"
            disabled={!points.length}
            onClick={() => setPoints((current) => current.slice(0, -1))}
          >
            Undo
          </button>
          <button type="button" className="text-button danger" disabled={!points.length} onClick={() => setPoints([])}>
            Clear
          </button>
        </div>
      </div>
      <div className="map-wrap">
        <div ref={containerRef} className="map-canvas" aria-label="Interactive project boundary map" />
        <div className="map-hint"><span>＋</span> Tap to add point</div>
      </div>
      <div className="map-stats">
        <div><span>Boundary points</span><strong>{points.length}</strong></div>
        <div><span>Calculated area</span><strong>{area ? area.toFixed(2) : "0.00"} ha</strong></div>
        <div><span>Geometry</span><strong>{points.length >= 3 ? "Valid polygon" : "Add 3+ points"}</strong></div>
      </div>
    </div>
  );
}
