import { createElement, useEffect, useRef, useState } from "react";
import { Text, View, Pressable } from "react-native";
import { LIGHT } from "./brand";
import { exactPins } from "./discovery";
import { matchBounds, focusOptions } from "../../assets/map-data/loader.mjs";
import type { DiscoveryMapProps } from "./DiscoveryMap.types";
let sdk: Promise<void> | null = null;
function loadSDK() {
  if ((window as any).maplibregl && (window as any).ZoiBasemap)
    return Promise.resolve();
  if (sdk) return sdk;
  sdk = (async () => {
    if (!document.querySelector("[data-zoi-map-css]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://www.zoi.city/assets/vendor/maplibre-gl.css";
      link.dataset.zoiMapCss = "1";
      document.head.appendChild(link);
    }
    for (const url of [
      "/assets/vendor/maplibre-gl.js",
      "/assets/zoi-basemap.js",
    ]) {
      if (
        (url.includes("maplibre") && (window as any).maplibregl) ||
        (url.includes("basemap") && (window as any).ZoiBasemap)
      )
        continue;
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        const timer = setTimeout(() => {
          s.remove();
          reject(Error("The interactive map took too long to load."));
        }, 12000);
        s.src = "https://www.zoi.city" + url;
        s.onload = () => {
          clearTimeout(timer);
          resolve();
        };
        s.onerror = () => {
          clearTimeout(timer);
          s.remove();
          reject(Error("The interactive map could not load."));
        };
        document.head.appendChild(s);
      });
    }
  })().catch((e) => {
    sdk = null;
    throw e;
  });
  return sdk;
}
export function DiscoveryMap({
  points,
  selected,
  scopeKey,
  focus,
  motion,
  onSelect,
}: DiscoveryMapProps) {
  const node = useRef<HTMLDivElement | null>(null),
    map = useRef<any>(null),
    live = useRef({ points, selected, onSelect }),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    prior = useRef("");
  live.current = { points, selected, onSelect };
  useEffect(() => {
    let active = true;
    setError("");
    setReady(false);
    prior.current = "";
    void loadSDK()
      .then(() => {
        if (!active || !node.current) return;
        const mb = (window as any).maplibregl,
          m = new mb.Map({
            container: node.current,
            style: (window as any).ZoiBasemap.style({
              theme: "light",
              terrain: false,
              buildings: true,
            }),
            center: [15, 37],
            zoom: 1.5,
            attributionControl: true,
            pitch: 0,
            bearing: 0,
            cooperativeGestures: true,
          });
        map.current = m;
        m.addControl(
          new mb.NavigationControl({ showCompass: false }),
          "top-right",
        );
        m.on("load", () => {
          if (!active) return;
          m.addSource("zoi-places", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
            cluster: true,
            clusterMaxZoom: 16,
            clusterRadius: 36,
          });
          m.addLayer({
            id: "zoi-clusters",
            type: "circle",
            source: "zoi-places",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#075dcc",
              "circle-radius": 21,
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 3,
            },
          });
          m.addLayer({
            id: "zoi-counts",
            type: "symbol",
            source: "zoi-places",
            filter: ["has", "point_count"],
            layout: {
              "text-field": "{point_count_abbreviated}",
              "text-font": ["Noto Sans Bold"],
              "text-size": 13,
            },
            paint: { "text-color": "#fff" },
          });
          m.addLayer({
            id: "zoi-pins",
            type: "circle",
            source: "zoi-places",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": [
                "case",
                ["==", ["get", "slug"], selected],
                "#10294d",
                "#075dcc",
              ],
              "circle-radius": 9,
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 3,
            },
          });
          setReady(true);
        });
        m.on("click", "zoi-pins", (e: any) => {
          const slug = e.features?.[0]?.properties?.slug;
          if (live.current.points.some((p: any) => p.s === slug))
            live.current.onSelect(slug);
        });
        m.on("click", "zoi-clusters", async (e: any) => {
          const f = e.features?.[0];
          if (!f) return;
          try {
            const z = await m
              .getSource("zoi-places")
              .getClusterExpansionZoom(f.properties.cluster_id);
            if (active)
              m.easeTo({
                center: f.geometry.coordinates,
                zoom: z,
                duration: motion ? 300 : 0,
              });
          } catch {
            // The source can disappear when the user changes screen or scope.
          }
        });
        m.on(
          "mouseenter",
          "zoi-pins",
          () => (m.getCanvas().style.cursor = "pointer"),
        );
        m.on("mouseleave", "zoi-pins", () => (m.getCanvas().style.cursor = ""));
        m.on("error", (e: any) => {
          if (active && !m.isStyleLoaded())
            setError(
              "The basemap is unavailable. Your places are still in the list.",
            );
        });
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      map.current?.remove();
      map.current = null;
    };
  }, [attempt]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const pins = exactPins(points);
    map.current
      .getSource("zoi-places")
      .setData({
        type: "FeatureCollection",
        features: pins.map((p: any) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [p.lng, p.lat] },
          properties: { slug: p.s },
        })),
      });
    if (prior.current !== scopeKey) {
      const bounds = matchBounds(pins);
      if (bounds) prior.current = scopeKey;
      if (bounds)
        map.current.fitBounds(bounds, {
          padding: 45,
          maxZoom: 13,
          duration: motion ? 350 : 0,
        });
    }
  }, [ready, points, scopeKey, motion]);
  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.setPaintProperty("zoi-pins", "circle-color", [
      "case",
      ["==", ["get", "slug"], selected],
      "#10294d",
      "#075dcc",
    ]);
    const p = exactPins(points).find((p: any) => p.s === selected);
    if (p)
      map.current.easeTo(
        focusOptions(p, {
          currentZoom: map.current.getZoom(),
          width: node.current?.clientWidth,
          height: 340,
          reducedMotion: !motion,
        }),
      );
  }, [ready, selected, focus, motion]);
  return (
    <View
      style={{
        height: 340,
        borderRadius: 24,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: LIGHT.line,
        backgroundColor: LIGHT.surfaceRaised,
      }}
    >
      {createElement("div", {
        ref: node,
        role: "region",
        "aria-label": "Zoi street-level places map",
        style: { height: "100%", width: "100%" },
      })}
      {!ready || error ? (
        <View
          style={{
            position: "absolute",
            left: 12,
            bottom: 12,
            right: 12,
            padding: 12,
            borderRadius: 12,
            backgroundColor: LIGHT.surface,
            gap: 8,
          }}
        >
          <Text style={{ color: LIGHT.muted }}>
            {error || "Opening the map…"}
          </Text>
          {error ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setAttempt((v) => v + 1)}
            >
              <Text style={{ color: LIGHT.accent }}>Retry interactive map</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
