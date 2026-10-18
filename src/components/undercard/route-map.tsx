"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Brief } from "@/lib/types";

const STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

/** Heatmap of the headliner's audience plus the suggested routing stops. */
export function RouteMap({ brief }: { brief: Pick<Brief, "center" | "heat" | "routing" | "input"> }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    let map: import("maplibre-gl").Map | undefined;
    let cancelled = false;
    (async () => {
      const maplibre = await import("maplibre-gl");
      maplibre.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      if (cancelled || !el.current) return;
      const m = new maplibre.Map({ container: el.current, style: STYLE, center: [brief.center.lng, brief.center.lat], zoom: 4.6, attributionControl: { compact: true },
        // Keep the last frame so the map shows up when the brief is printed or saved as a PDF.
        canvasContextAttributes: { preserveDrawingBuffer: true } });
      map = m;
      m.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      m.on("load", () => {
        if (!map) return;
        map.addSource("heat", { type: "geojson", data: { type: "FeatureCollection", features: (brief.heat ?? []).map((c) => ({ type: "Feature", properties: { w: c.affinity }, geometry: { type: "Point", coordinates: [c.lng, c.lat] } })) } });
        map.addLayer({ id: "heat", type: "heatmap", source: "heat", paint: { "heatmap-weight": ["get", "w"], "heatmap-radius": 38, "heatmap-opacity": 0.75, "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.2, "#3b1d5a", 0.5, "#b4386b", 0.8, "#f07a3a", 1, "#ffd27a"] } });
        const stops = brief.routing.map((r, i) => ({ type: "Feature" as const, properties: { label: `${i + 1}. ${r.city.split(",")[0]}`, a: r.affinity }, geometry: { type: "Point" as const, coordinates: [r.lng, r.lat] } }));
        map.addSource("stops", { type: "geojson", data: { type: "FeatureCollection", features: stops } });
        map.addLayer({ id: "stops", type: "circle", source: "stops", paint: { "circle-radius": ["interpolate", ["linear"], ["get", "a"], 0, 4, 1, 9], "circle-color": "#ffffff", "circle-stroke-color": "#f07a3a", "circle-stroke-width": 2 } });
        map.addLayer({ id: "stop-labels", type: "symbol", source: "stops", layout: { "text-field": ["get", "label"], "text-size": 12, "text-offset": [0, 1.3], "text-font": ["Open Sans Regular"] }, paint: { "text-color": "#fff", "text-halo-color": "#000", "text-halo-width": 1.2 } });
        // The show city is drawn on the canvas (not as a DOM marker) so it stays in place when printed.
        map.addSource("home", { type: "geojson", data: { type: "Feature", properties: { label: `${brief.input.city.split(",")[0]} (your show)` }, geometry: { type: "Point", coordinates: [brief.center.lng, brief.center.lat] } } });
        map.addLayer({ id: "home", type: "circle", source: "home", paint: { "circle-radius": 8, "circle-color": "#f07a3a", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5 } });
        map.addLayer({ id: "home-label", type: "symbol", source: "home", layout: { "text-field": ["get", "label"], "text-size": 12, "text-max-width": 20, "text-offset": [0, -1.4], "text-font": ["Open Sans Bold"] }, paint: { "text-color": "#ffd27a", "text-halo-color": "#000", "text-halo-width": 1.2 } });
        const pts = [...brief.routing.map((r) => [r.lng, r.lat] as [number, number]), [brief.center.lng, brief.center.lat] as [number, number]];
        if (pts.length > 1) {
          const b = pts.reduce((bb, p) => bb.extend(p), new maplibre.LngLatBounds(pts[0], pts[0]));
          map.fitBounds(b, { padding: 50, maxZoom: 7, duration: 0 });
        }
      });
    })();
    return () => { cancelled = true; map?.remove(); };
  }, [brief]);
  return <div ref={el} className="h-72 w-full overflow-hidden rounded-xl border border-border bg-black/40 print:h-64" aria-label="Map of audience hotspots and routing stops" />;
}
