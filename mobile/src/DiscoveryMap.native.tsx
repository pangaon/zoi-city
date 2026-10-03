import { useEffect, useRef, useState } from "react";
import { StyleSheet, View, Text } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { LIGHT } from "./brand";
import type { DiscoveryMapProps } from "./DiscoveryMap.types";
import { exactPins, nativePinClusters } from "./discovery";
export function DiscoveryMap({
  points,
  selected,
  scopeKey,
  focus,
  motion,
  onSelect,
}: DiscoveryMapProps) {
  const map = useRef<MapView | null>(null),
    [ready, setReady] = useState(false),
    region = useRef<Region>({
      latitude: 37,
      longitude: 15,
      latitudeDelta: 110,
      longitudeDelta: 160,
    }),
    pins = exactPins(points),
    prior = useRef("");
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
    if (ready && selectedPoint)
      map.current?.animateToRegion(
        {
          ...region.current,
          latitude: selectedPoint.lat,
          longitude: selectedPoint.lng,
          latitudeDelta: Math.min(region.current.latitudeDelta, 0.009),
          longitudeDelta: Math.min(region.current.longitudeDelta, 0.009),
        },
        motion ? 300 : 0,
      );
  }, [ready, selected, focus, motion]);
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
