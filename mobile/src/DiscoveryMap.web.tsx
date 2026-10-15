import { createElement, useEffect, useRef, useState } from "react";
import { Text, View, Pressable } from "react-native";
import { LIGHT } from "./brand";
import { exactPins, fullMapToolsLink } from "./discovery";
import { matchBounds, focusOptions } from "../../assets/map-data/loader.mjs";
import type { DiscoveryMapProps } from "./DiscoveryMap.types";
import {useMapLocation} from './useMapLocation';
import {MapLocationControl} from './MapLocationControl';
import {deviceLocationRegion,deviceLocationLabel,deviceAccuracyFeature} from '../../assets/map-data/foreground-location.mjs';
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
  height = 340,
  selected,
  scopeKey,
  focus,
  motion,
  onSelect,
}: DiscoveryMapProps) {
  const [locationOptions,setLocationOptions]=useState(false);
  const node = useRef<HTMLDivElement | null>(null),
    map = useRef<any>(null),
    live = useRef({ points, selected, onSelect, scopeKey }),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    prior = useRef(""),
    priorSelection = useRef("");
  live.current = { points, selected, onSelect, scopeKey };
  const marker=useRef<any>(null),cameraIntent=useRef(0),selectionIntent=useRef({key:'',epoch:0});
  const location=useMapLocation(scopeKey,(fix,{center})=>{if(center&&map.current){const r=deviceLocationRegion(fix);map.current.easeTo({center:[fix.longitude,fix.latitude],zoom:Math.max(1,Math.min(14,Math.log2(360/r.longitudeDelta))),duration:motion?300:0});}});
  useEffect(()=>{location.manualMove();},[selected,focus]);
  useEffect(()=>{marker.current?.remove();marker.current=null;if(!ready||!map.current)return;map.current.getSource('zoi-device-accuracy')?.setData(deviceAccuracyFeature(location.state.fix));if(!location.state.fix)return;const fix=location.state.fix,node=document.createElement('div');node.setAttribute('role','img');node.setAttribute('aria-label',deviceLocationLabel(fix));node.title=deviceLocationLabel(fix);Object.assign(node.style,{width:'18px',height:'18px',borderRadius:'50%',background:'#1676df',border:'3px solid white',boxShadow:'0 0 0 5px #1676df22'});marker.current=new (window as any).maplibregl.Marker({element:node}).setLngLat([fix.longitude,fix.latitude]).addTo(map.current);return()=>{marker.current?.remove();marker.current=null;};},[ready,location.state.fix]);
  useEffect(()=>{if(error)location.clear();},[error]);
  const selectedPoint = exactPins(points).find((p:any)=>p.s===selected);
  useEffect(() => {
    let active = true;
    setError("");
    setReady(false);
    prior.current = "";
    priorSelection.current = "";
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
        m.on("movestart",(e:any)=>{if(e.originalEvent){cameraIntent.current++;location.manualMove();prior.current=live.current.scopeKey;}});
        m.on("click",()=>{cameraIntent.current++;location.manualMove();prior.current=live.current.scopeKey;});
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
          m.addSource('zoi-device-accuracy',{type:'geojson',data:deviceAccuracyFeature(null)});
          m.addLayer({id:'zoi-device-accuracy',type:'fill',source:'zoi-device-accuracy',paint:{'fill-color':'#1676df','fill-opacity':0.12}});
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
    const selectionKey=selected+'|'+focus;
    if(selectionIntent.current.key!==selectionKey)selectionIntent.current={key:selectionKey,epoch:cameraIntent.current};
    if (!ready || !map.current) return;
    map.current.setPaintProperty("zoi-pins", "circle-color", [
      "case",
      ["==", ["get", "slug"], selected],
      "#10294d",
      "#075dcc",
    ]);
    const p = selectedPoint;
    const sameSelection = priorSelection.current === selected;
    priorSelection.current = selected;
    if (p&&selectionIntent.current.epoch===cameraIntent.current)
      map.current.easeTo(
        focusOptions(p, {
          currentZoom: sameSelection ? map.current.getZoom() : null,
          width: node.current?.clientWidth,
          height: node.current?.clientHeight || height,
          reducedMotion: !motion,
        }),
      );
  }, [ready, selected, selectedPoint?.lat, selectedPoint?.lng, focus, motion]);
  return (
    <View style={{gap:8}}>
    <View
      onLayout={() => map.current?.resize()}
      style={{
        height,
        borderRadius: 24,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: LIGHT.line,
        backgroundColor: LIGHT.surfaceRaised,
      }}
    >
      {createElement("style", null, ".zoi-native-map .maplibregl-ctrl-group button{width:44px;height:44px;min-width:44px;min-height:44px}.zoi-native-map button:focus-visible{outline:3px solid #075dcc;outline-offset:2px}")}
      {createElement("div", {
        ref: node,
        className: "zoi-native-map",
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
              style={{minWidth:44,minHeight:44,justifyContent:"center"}}
              onPress={() => setAttempt((v) => v + 1)}
            >
              <Text style={{ color: LIGHT.accent }}>Retry interactive map</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
    <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}><Pressable accessibilityRole="link" accessibilityLabel="Open full map tools in browser" onPress={()=>{const center=map.current?.getCenter();const href=fullMapToolsLink(points.find(p=>p.s===selected)||{s:selected},center?{latitude:center.lat,longitude:center.lng,longitudeDelta:360/(2**map.current.getZoom())*(node.current?.clientWidth||350)/512,width:node.current?.clientWidth||350}:{});window.location.assign(href);}} style={{minHeight:44,minWidth:44,justifyContent:"center",flexShrink:1,borderRadius:10,padding:10,backgroundColor:LIGHT.surface,borderWidth:1,borderColor:LIGHT.line}}><Text style={{color:LIGHT.accent,fontWeight:"700",fontSize:12}}>Full map tools ↗</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{expanded:locationOptions}} style={{minHeight:44,minWidth:44,justifyContent:"center",padding:10,borderRadius:10,backgroundColor:LIGHT.surface,borderWidth:1,borderColor:LIGHT.line}} onPress={()=>setLocationOptions(v=>!v)}><Text style={{color:LIGHT.accent,fontWeight:"700",fontSize:12}}>{locationOptions?"Close location options":"Location options"}</Text></Pressable></View>
    {locationOptions&&ready&&!error?<MapLocationControl inline state={location.state} onRequest={()=>{cameraIntent.current++;prior.current=scopeKey;location.request();}} onClear={location.clear}/>:null}</View>
  );
}
