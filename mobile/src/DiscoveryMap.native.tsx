import { useEffect, useRef, useState } from "react";
import { StyleSheet, View, Text, Pressable, Linking } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { LIGHT } from "./brand";
import type { DiscoveryMapProps } from "./DiscoveryMap.types";
import { exactPins, nativePinClusters, fullMapToolsLink } from "./discovery";
export function DiscoveryMap({
  points,
  selected,
  scopeKey,
  focus,
  motion,
  onSelect,
}: DiscoveryMapProps) {
  const mounted = useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const map = useRef<MapView | null>(null),
    [ready, setReady] = useState(false),
    [opening, setOpening] = useState(false),
    [toolError, setToolError] = useState(""),
    region = useRef<Region>({
      latitude: 37,
      longitude: 15,
      latitudeDelta: 110,
      longitudeDelta: 160,
    }),
    pins = exactPins(points),
    prior = useRef(""),
    priorSelection = useRef("");
  const [selectedPoint] = pins.filter((p: any) => p.s === selected);
  useEffect(() => {
    if (!ready || prior.current === scopeKey) return;
    if (pins.length) prior.current = scopeKey;
    if (pins.length)
      map.current?.fitToCoordinates(
        pins.map((p: any) => ({ latitude: p.lat, longitude: p.lng })),
        {
          edgePadding: { top: 45, right: 35, bottom: 45, left: 35 },
          animated: motion,
        },
      );
  }, [ready, scopeKey, pins.length, motion]);
  useEffect(() => {
    if (!ready || !selectedPoint) return;
    const sameSelection = priorSelection.current === selected;
    priorSelection.current = selected;
    map.current?.animateToRegion(
        {
          ...region.current,
          latitude: selectedPoint.lat,
          longitude: selectedPoint.lng,
          latitudeDelta: sameSelection ? Math.min(region.current.latitudeDelta, 0.009) : 0.009,
          longitudeDelta: sameSelection ? Math.min(region.current.longitudeDelta, 0.009) : 0.009,
        },
        motion ? 300 : 0,
      );
  }, [ready, selected, selectedPoint?.lat, selectedPoint?.lng, focus, motion]);
  // Render only real positions in the current viewport. No scattered centroid pins.
  const [, setViewport] = useState(0),
    [width, setWidth] = useState(350);
  const clusters = nativePinClusters(pins, region.current, width, 340),
    shown = clusters.slice(0, 500);
  return (
    <View
      style={s.frame}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={region.current}
        accessibilityLabel="Zoi street-level places map"
        onMapReady={() => setReady(true)}
        onRegionChangeComplete={(r) => {
          region.current = r;
          setViewport((v) => v + 1);
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {shown.map((cluster) => {
          const p = cluster.places[0],
            same = cluster.places.every(
              (v: any) =>
                Math.abs(v.lat - p.lat) < 0.00001 &&
                Math.abs(v.lng - p.lng) < 0.00001,
            );
          return (
            <Marker
              key={cluster.key}
              identifier={cluster.key}
              coordinate={{
                latitude: cluster.latitude,
                longitude: cluster.longitude,
              }}
              title={
                cluster.places.length === 1
                  ? p.n
                  : cluster.places.length + " places · tap to explore"
              }
              pinColor={
                cluster.places.some((v: any) => v.s === selected)
                  ? LIGHT.ink
                  : LIGHT.accent
              }
              onPress={() => {
                if (cluster.places.length === 1 || same) onSelect(p.s);
                else
                  map.current?.fitToCoordinates(
                    cluster.places.map((v: any) => ({
                      latitude: v.lat,
                      longitude: v.lng,
                    })),
                    {
                      edgePadding: { top: 45, right: 35, bottom: 45, left: 35 },
                      animated: motion,
                    },
                  );
              }}
            >
              {cluster.places.length > 1 ? (
                <View style={s.cluster}>
                  <Text style={s.clusterCount}>{cluster.places.length}</Text>
                </View>
              ) : undefined}
            </Marker>
          );
        })}
      </MapView>
      <View style={s.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" onPress={()=>map.current?.animateToRegion({...region.current,latitudeDelta:Math.min(170,region.current.latitudeDelta*2),longitudeDelta:Math.min(350,region.current.longitudeDelta*2)},motion?250:0)} style={s.action}><Text style={s.actionText}>−</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" onPress={()=>map.current?.animateToRegion({...region.current,latitudeDelta:Math.max(0.0005,region.current.latitudeDelta/2),longitudeDelta:Math.max(0.0005,region.current.longitudeDelta/2)},motion?250:0)} style={s.action}><Text style={s.actionText}>＋</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Open full map tools in browser" disabled={opening} onPress={async()=>{setOpening(true);setToolError("");try{await Linking.openURL(fullMapToolsLink(points.find(p=>p.s===selected)||{s:selected},{...region.current,width}));}catch{if(mounted.current)setToolError("The browser could not open. Try full map tools again.");}finally{if(mounted.current)setOpening(false);}}} style={[s.action,{flex:1}]}><Text style={[s.actionText,{fontSize:12}]}>{opening?"Opening…":"Full map tools ↗"}</Text></Pressable>
      </View>
      {toolError?<View style={s.note}><Text accessibilityRole="alert" style={s.text}>{toolError}</Text></View>:null}
      {!ready ? (
        <View pointerEvents="none" style={s.note}>
          <Text style={s.text}>Opening the map…</Text>
        </View>
      ) : null}
      {clusters.length > 500 ? (
        <View pointerEvents="none" style={s.note}>
          <Text style={s.text}>
            Zoom closer to see more street-level places.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  actions:{position:"absolute",top:10,left:10,right:10,flexDirection:"row",gap:6},
  action:{minWidth:40,minHeight:40,borderRadius:10,backgroundColor:LIGHT.surface,borderWidth:1,borderColor:LIGHT.line,alignItems:"center",justifyContent:"center",paddingHorizontal:10},
  actionText:{color:LIGHT.ink,fontWeight:"700",fontSize:20},
  frame: {
    height: 340,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: LIGHT.surfaceRaised,
    borderWidth: 1,
    borderColor: LIGHT.line,
  },
  note: {
    position: "absolute",
    left: 12,
    bottom: 12,
    right: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: LIGHT.surface,
  },
  text: { color: LIGHT.muted, fontSize: 12 },
  cluster: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: "#fff",
    backgroundColor: LIGHT.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  clusterCount: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
