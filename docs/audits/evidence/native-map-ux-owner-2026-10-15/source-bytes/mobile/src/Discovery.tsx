import { DiscoveryLocation } from "./DiscoveryLocation";
import { TRAVEL_MODES } from "../../assets/map-data/directions.mjs";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  AppState,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "./Auth";
import { CommunitySettings } from "./CommunityProfile";
import { LIGHT, DARK } from "./brand";
import { discoveryMedia } from "./discoveryMedia";
import { usePresentationPreferences, GlassHero } from "./Presentation";
import { DiscoveryMap } from "./DiscoveryMap";
import {
  browseArea,
  discoveryArea,
  discoveryPreferences,
  discoveryRows,
  discoveryPoints,
  scopedPoints,
  exactPins,
  pointStatus,
  selectedEntity,
  selectedDiscoveryPoint,
  emptyDiscoveryRecovery,
  placeDirections,
  discoveryShare,
  type DiscoveryState,
} from "./discovery";
import { discoveryPrivateRpc } from "./discoveryScope";
import { discoveryRead } from "./discoveryRead";
import { placeDestination } from "./placeNavigation";
import { loadMapPages, retryMapRead, createAdaptiveMapRead } from "../../assets/map-data/loader.mjs";
import { suggestionController } from "../../assets/discovery/autocomplete.mjs";
function Action({
  label,
  onPress,
  selected = false,
  disabled = false,
  text,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  text?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.action, selected && s.active, disabled && { opacity: 0.5 }]}
    >
      <Text style={[s.link, selected && { color: LIGHT.onButton }]}>
        {text || label}
      </Text>
    </Pressable>
  );
}
function Photo({ row, detail = false }: { row: any; detail?: boolean }) {
  const media = discoveryMedia(row);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (!media.uri || failedUri === media.uri)
    return detail ? null : (
      <View style={s.monogram}>
        <Text style={{ fontSize: 22, color: LIGHT.accent }}>
          {row.name.slice(0, 1)}
        </Text>
      </View>
    );
  return (
    <View
      style={{
        width: detail ? "100%" : 58,
        height: detail ? (media.kind === "logo" ? 140 : 200) : 58,
        padding: media.kind === "logo" ? (detail ? 14 : 6) : 0,
        borderRadius: detail ? 20 : 14,
        overflow: "hidden",
        marginBottom: detail ? 14 : 0,
        backgroundColor:
          media.backdrop === "dark"
            ? DARK.surface
            : media.backdrop === "light"
              ? LIGHT.surface
              : LIGHT.surfaceRaised,
      }}
    >
      <Image
        key={`${row.id}:${media.uri}`}
        accessibilityLabel={`${row.name}${media.kind === "logo" ? " logo" : ""}`}
        source={{ uri: media.uri }}
        onError={() => setFailedUri(media.uri)}
        resizeMode={media.kind === "logo" ? "contain" : media.fit}
        style={{ width: "100%", height: "100%" }}
      />
    </View>
  );
}
export function Discover({
  open,
  signIn,
  state,
  setState,
  expanded = false,
  onExpandedChange,
}: {
  open: (path: string) => void;
  signIn: () => void;
  state: DiscoveryState;
  setState: (state: DiscoveryState) => void;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}) {
  const { client, session, booting } = useAuth(),
    actor = session?.user.id || "",
    preferences = usePresentationPreferences(),
    alive = useRef(true),
    revision = useRef(0),
    homeRevision = useRef(0),
    selectedRevision = useRef(0),
    currentState = useRef(state);
  currentState.current = state;
  const [home, setHome] = useState<any>(null),
    [homeBusy, setHomeBusy] = useState(!!actor),
    [homeError, setHomeError] = useState(""),
    [editor, setEditor] = useState(false),
    [areaEditor, setAreaEditor] = useState(false),
    [city, setCity] = useState(""),
    [country, setCountry] = useState(""),
    [areaError, setAreaError] = useState("");
  const [rows, setRows] = useState<any[]>([]),
    [offset, setOffset] = useState(0),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [suggestions, setSuggestions] = useState<any>({
      status: "closed",
      rows: [],
    }),
    [active, setActive] = useState(-1),
    [showSuggestions, setShowSuggestions] = useState(false);
  const [points, setPoints] = useState<any[]>([]),
    [mapBusy, setMapBusy] = useState(false),
    [mapError, setMapError] = useState(""),
    [mapRead, setMapRead] = useState(false),
    [mapRetry, setMapRetry] = useState(0),
    [focus, setFocus] = useState(0),
    [selected, setSelected] = useState<any>(null),
    [selectBusy, setSelectBusy] = useState(false),
    [selectError, setSelectError] = useState(""),
    [selectionRetry, setSelectionRetry] = useState(0),
    [actionError, setActionError] = useState("");
  const [mapFilters, setMapFilters] = useState(false),
    [placeDetails, setPlaceDetails] = useState(false),
    [availableHeight, setAvailableHeight] = useState(600),
    [availableWidth, setAvailableWidth] = useState(390);
  const expandControl = useRef<any>(null);
  const mapMode = state.mode === "map";
  const closeExpanded = () => {
    onExpandedChange?.(false);
    setTimeout(() => expandControl.current?.focus?.(), 0);
  };
  useEffect(() => { setPlaceDetails(false); }, [actor, state.selected]);
  useEffect(() => {
    if (!expanded) return;
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      closeExpanded();
      return true;
    });
    const escape = (event: any) => {
      if (event.key === "Escape") { event.preventDefault(); closeExpanded(); }
    };
    const doc = typeof document !== "undefined" ? document : null;
    doc?.addEventListener("keydown", escape);
    return () => { back.remove(); doc?.removeEventListener("keydown", escape); };
  }, [expanded, onExpandedChange]);
  const landscapeMap = mapMode && availableWidth >= 650 && availableHeight < 500;
  const mapHeight = Math.round(Math.max(180, Math.min(expanded ? 720 : 360,
    availableHeight * (expanded ? 0.52 : state.selected ? 0.35 : 0.48))));
  const [travelMode, setTravelMode] = useState("driving"),
    [routeOrigin, setRouteOrigin] = useState("");
  useEffect(() => {
    setRouteOrigin("");
    setTravelMode("driving");
  }, [actor, state.selected]);
  const area = discoveryArea(state, home?.home || null),
    key = JSON.stringify([
      actor,
      state.query,
      state.type,
      area.city,
      area.country,
    ]),
    keyRef = useRef(key);
  keyRef.current = key;
  const current = () =>
    alive.current && (client.session?.user.id || "") === actor;
  const loadHome = async () => {
    const stamp = ++homeRevision.current;
    if (!actor) {
      setHome(null);
      setHomeBusy(false);
      return;
    }
    setHomeBusy(true);
    setHomeError("");
    try {
      const result = discoveryPreferences(
        await discoveryPrivateRpc(
          client,
          actor,
          () => current() && stamp === homeRevision.current,
          "community_me",
          {},
        ),
      );
      if (current() && stamp === homeRevision.current) setHome(result);
    } catch (e) {
      if (current() && stamp === homeRevision.current) {
        setHome(null);
        setHomeError(
          e instanceof Error ? e.message : "Home preferences are unavailable.",
        );
      }
    } finally {
      if (current() && stamp === homeRevision.current) setHomeBusy(false);
    }
  };
  useEffect(() => {
    alive.current = true;
    void loadHome();
    const foreground = AppState.addEventListener("change", (v) => {
      if (v === "active") void loadHome();
    });
    return () => {
      alive.current = false;
      revision.current++;
      homeRevision.current++;
      selectedRevision.current++;
      foreground.remove();
    };
  }, [actor]);
  const load = async (append = false, signal?: AbortSignal) => {
    const stamp = ++revision.current,
      started = key,
      next = append ? offset : 0;
    setLoading(true);
    setError("");
    if (!append) {
      setRows([]);
      setOffset(0);
      setMore(false);
    }
    try {
      const raw = await retryMapRead(() =>
        discoveryRead(
          "explore_search",
          {
            p_q: state.query || null,
            p_type: state.type || null,
            p_city: area.city || null,
            p_country: area.country || null,
            p_limit: 24,
            p_offset: next,
          },
          signal,
        ),
      );
      const value = discoveryRows(raw, area, state.type);
      if (
        !alive.current ||
        stamp !== revision.current ||
        started !== keyRef.current ||
        signal?.aborted
      )
        return;
      setRows((old) =>
        append
          ? [
              ...old,
              ...value.filter((r: any) => !old.some((p) => p.slug === r.slug)),
            ]
          : value,
      );
      setOffset(next + raw.length);
      setMore(raw.length === 24);
    } catch (e) {
      if (
        alive.current &&
        stamp === revision.current &&
        started === keyRef.current &&
        !signal?.aborted
      )
        setError("Your places could not load. Retry this search.");
    } finally {
      if (
        alive.current &&
        stamp === revision.current &&
        started === keyRef.current
      )
        setLoading(false);
    }
  };
  useEffect(() => {
    const controller = new AbortController();
    setRows([]);
    setError("");
    if (!booting && !homeBusy && !editor) void load(false, controller.signal);
    return () => {
      controller.abort();
      revision.current++;
    };
  }, [key, retry, booting, homeBusy, editor]);
  useEffect(() => {
    const queue = suggestionController({
      onState: (v: any) => {
        if (alive.current) {
          setSuggestions(v);
          setActive(-1);
        }
      },
    });
    if (showSuggestions && !homeBusy)
      queue.run(state.input, {
        type: state.type,
        city: area.city,
        country: area.country,
      });
    return () => queue.cancel();
  }, [
    state.input,
    state.type,
    area.city,
    area.country,
    showSuggestions,
    homeBusy,
  ]);
  useEffect(() => {
    if (state.mode !== "map" || mapRead) return;
    const controller = new AbortController();
    let valid = true;
    setMapBusy(true);
    setMapError("");
    void loadMapPages(
      createAdaptiveMapRead((offset: number, limit: number) =>
        discoveryRead(
          "explore_geo",
          { p_limit: limit, p_offset: offset },
          controller.signal,
        )),
      { retries: 0, concurrency: 2 },
    )
      .then((result: any) => {
        if (!valid) return;
        setPoints(result.complete ? discoveryPoints(result.rows) : []);
        setMapRead(result.complete);
        if (!result.complete)
          setMapError(
            "Some map pages could not load. Retry for the complete map.",
          );
      })
      .catch(() => {
        if (valid)
          setMapError(
            "Map positions could not load. Your places are still in the list.",
          );
      })
      .finally(() => {
        if (valid) setMapBusy(false);
      });
    return () => {
      valid = false;
      controller.abort();
    };
  }, [state.mode, mapRetry]);
  const scoped = useMemo(()=>scopedPoints(points, area, state.type, state.query),[points,area.city,area.country,state.type,state.query]),
    pins = useMemo(()=>exactPins(scoped),[scoped]),
    pointBySlug = useMemo(()=>new Map(points.map((p: any) => [p.s, p])),[points]);
  useEffect(() => {
    setSelected(null);
    setSelectError("");
    setActionError("");
    if (!state.selected) return;
    const stamp = ++selectedRevision.current,
      slug = state.selected,
      controller = new AbortController();
    setSelectBusy(true);
    const row = rows.find((r) => r.slug === slug);
    void (async () => {
      try {
        const entity = selectedEntity(
          await retryMapRead(() =>
            discoveryRead("home_entity", { p_slug: slug }, controller.signal),
          ),
          slug,
          row?.id,
        );
        try {
          entity.reviewed_destination = await discoveryRead(
            "geography_reviewed_point",
            { p_listing: entity.id },
            controller.signal,
          );
        } catch {}
        if (
          alive.current &&
          stamp === selectedRevision.current &&
          currentState.current.selected === slug
        )
          setSelected(entity);
      } catch (e) {
        if (
          alive.current &&
          stamp === selectedRevision.current &&
          currentState.current.selected === slug
        )
          setSelectError(
            e instanceof Error ? e.message : "This place could not be loaded.",
          );
      } finally {
        if (alive.current && stamp === selectedRevision.current)
          setSelectBusy(false);
      }
    })();
    return () => {
      controller.abort();
      selectedRevision.current++;
    };
  }, [state.selected, selectionRetry]);
  const select = (slug: string) => {
    setShowSuggestions(false);
    setState({ ...state, selected: slug });
  };
  const submit = () => {
    if (showSuggestions && active >= 0 && suggestions.rows[active]) {
      select(suggestions.rows[active].slug);
      return;
    }
    setShowSuggestions(false);
    setState({
      ...state,
      query: state.input.trim().slice(0, 200),
      selected: "",
    });
    setRetry((v) => v + 1);
  };
  const action = async (fn: () => Promise<any>) => {
    setActionError("");
    try {
      await fn();
    } catch {
      if (alive.current)
        setActionError("This action could not open. Please try again.");
    }
  };
  const selectedMatchesIntent = !!selected && (selected.slug === state.selected || selected.canonical_slug === state.selected);
  const selectedPoint = useMemo(()=>selectedMatchesIntent
    ? selectedDiscoveryPoint(selected, pointBySlug.get(selected.canonical_slug || selected.slug))
    : null,[selectedMatchesIntent,selected,pointBySlug]);
  const mapPoints = useMemo(()=>selectedPoint ? [selectedPoint, ...scoped.filter((p:any)=>p.s!==selectedPoint.s)] : scoped,[selectedPoint,scoped]);
  const coLocated = selectedPoint
    ? exactPins(points).filter(
        (p: any) =>
          p.s !== state.selected &&
          Number(p.lat).toFixed(5) === Number(selectedPoint.lat).toFixed(5) &&
          Number(p.lng).toFixed(5) === Number(selectedPoint.lng).toFixed(5),
      )
    : [];
  const baseDirections = selectedMatchesIntent ? placeDirections(selected, selectedPoint) : null;
  let directions = baseDirections, directionsError = "";
  if (selected && baseDirections?.basis !== "name") {
    try { directions = placeDirections(selected, selectedPoint, {mode: travelMode, origin: routeOrigin}); }
    catch (error) { directions = null; directionsError = error instanceof Error ? error.message : "Check the starting address."; }
  }
  const directionURL = directions?.url || "";
  const routeOptions = baseDirections && baseDirections.basis !== "name" ? (
                <View style={s.routePanel}>
                  <Text style={s.heading}>Plan directions</Text>
                  <Text style={s.small}>Choose how to travel</Text>
                  <View style={s.row} accessibilityLabel="Travel mode">
                    {TRAVEL_MODES.map((item: {value: string; label: string}) => (
                      <Action key={item.value} label={item.label} selected={travelMode === item.value}
                        onPress={() => setTravelMode(item.value)} />
                    ))}
                  </View>
                  <Text style={s.small}>Starting address (optional)</Text>
                  <TextInput value={routeOrigin} onChangeText={setRouteOrigin} maxLength={700}
                    accessibilityLabel="Starting address for directions"
                    placeholder="Current location in Google Maps" placeholderTextColor={LIGHT.dim}
                    textContentType="fullStreetAddress" style={s.input} />
                  <Text style={s.small}>Google Maps calculates the route and available navigation. Leave the start blank to use your location there.</Text>
                  {directionsError ? <Text accessibilityRole="alert" style={s.error}>{directionsError}</Text> : null}
                </View>
              ) : null;
  const shareAction = <Action
                  label="Share this place"
                  onPress={() =>
                    void action(() =>
                      Share.share({
                        message: discoveryShare(
                          selected.canonical_slug || selected.slug,
                        ),
                      }),
                    )
                  }
                />;
  if (editor && actor)
    return (
      <CommunitySettings
        preferencesOnly
        key={actor}
        back={() => {
          setEditor(false);
          void loadHome();
        }}
        profile={(id) => {
          setEditor(false);
          open("/community/?profile=" + id);
        }}
      />
    );
  return (
    <View style={s.discoveryFrame} onLayout={event => {
      const {height, width} = event.nativeEvent.layout;
      if (Number.isFinite(width) && width > 0) setAvailableWidth(width);
      if (Number.isFinite(height) && height > 0) setAvailableHeight(height);
    }}>
      {mapMode ? <View style={s.mapToolbar}>
        {availableHeight >= 320 ? <Text style={s.heading}>Map</Text> : null}
        <View style={s.row}>
          <Action label="List" onPress={() => { onExpandedChange?.(false); setState({ ...state, mode: "list" }); }} />
          <Action text="Filters" label={mapFilters ? "Close filters" : "Search & filters"} selected={mapFilters}
            onPress={() => setMapFilters(value => !value)} />
          <Pressable ref={expandControl} accessibilityRole="button"
            accessibilityLabel={expanded ? "Close expanded map" : "Expand map"}
            accessibilityState={{ expanded }}
            style={s.action} onPress={() => expanded ? closeExpanded() : onExpandedChange?.(true)}>
            <Text style={s.link}>{expanded ? "Close" : "Expand"}</Text>
          </Pressable>
        </View>
      </View> : null}
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[s.content, mapMode && s.mapContent]}
    >
      {!mapMode || mapFilters ? <>
      {!mapMode ? <GlassHero>
        <Text style={s.eyebrow}>YOUR GREEK WORLD</Text>
        <Text style={s.title}>Close to home.{"\n"}Open to everywhere.</Text>
        <Text style={s.body}>
          Find your people, places and next plans. Keep your home, explore
          somewhere new.
        </Text>
      </GlassHero> : null}
      <View style={s.panel}>
        <View style={s.row}>
          <Text style={s.heading}>Exploring {area.label}</Text>
          <Text style={s.badge}>
            {area.source === "home"
              ? "Saved home"
              : area.source === "temporary"
                ? "Temporary area"
                : "Worldwide"}
          </Text>
        </View>
        {homeBusy ? (
          <Text style={s.small}>Checking your saved home…</Text>
        ) : null}
        {homeError ? (
          <>
            <Text accessibilityRole="alert" style={s.error}>
              {homeError} Browsing everywhere until preferences are confirmed.
            </Text>
            <Action
              label="Retry home preferences"
              onPress={() => void loadHome()}
            />
          </>
        ) : null}
        <View style={s.row}>
          <Action
            label="Browse another area"
            selected={areaEditor}
            onPress={() => {
              setCity(state.area?.city || "");
              setCountry(state.area?.country || "");
              setAreaError("");
              setAreaEditor(!areaEditor);
            }}
          />
          <Action
            label="Everywhere"
            selected={state.source === "global"}
            onPress={() =>
              setState({ ...state, source: "global", area: null, selected: "" })
            }
          />
          {actor ? (
            <Action
              label="Back to my home"
              onPress={() =>
                setState({
                  ...state,
                  input: "",
                  query: "",
                  area: null,
                  source: "auto",
                  selected: "",
                })
              }
            />
          ) : null}
          <Action
            label={actor ? "Home preferences" : "Sign in to set home"}
            onPress={() => { onExpandedChange?.(false); actor ? setEditor(true) : signIn(); }}
          />
        </View>
        {home?.topics.length ? (
          <Text style={s.small}>
            Your interests: {home.topics.join(" · ")}. Interests shape your
            Community feed; search stays under your control.
          </Text>
        ) : null}
        {areaEditor ? (
          <View style={{ gap: 10 }}>
            <Text style={s.small}>
              This only changes where you browse. Your saved home stays
              unchanged.
            </Text>
            <DiscoveryLocation
              city={city}
              country={country}
              setCity={setCity}
              setCountry={setCountry}
            />
            {areaError ? (
              <Text accessibilityRole="alert" style={s.error}>
                {areaError}
              </Text>
            ) : null}
            <Action
              label="Explore this area"
              onPress={() => {
                try {
                  const next = browseArea(city, country);
                  setState({
                    ...state,
                    area: next,
                    source: "explicit",
                    selected: "",
                  });
                  setAreaEditor(false);
                } catch (e) {
                  setAreaError((e as Error).message);
                }
              }}
            />
          </View>
        ) : null}
      </View>
      <View style={{ gap: 10 }}>
        <View style={s.row}>
          <TextInput
            accessibilityLabel="Search Greek places"
            placeholder="A place, artist, business…"
            value={state.input}
            onChangeText={(input) => {
              setShowSuggestions(true);
              setState({ ...state, input });
            }}
            onFocus={() => setShowSuggestions(true)}
            onSubmitEditing={submit}
            onKeyPress={(e) => {
              const k = e.nativeEvent.key;
              if (k === "Escape") setShowSuggestions(false);
              if (
                ["ArrowDown", "ArrowUp"].includes(k) &&
                suggestions.rows.length
              )
                setActive((v) =>
                  k === "ArrowDown"
                    ? (v + 1) % suggestions.rows.length
                    : (v - 1 + suggestions.rows.length) %
                      suggestions.rows.length,
                );
            }}
            maxLength={200}
            style={[s.input, { flex: 1, minWidth: 150 }]}
          />
          <Action label="Search" onPress={submit} />
        </View>
        {showSuggestions && suggestions.status !== "closed" ? (
          <View style={s.panel}>
            <Text style={s.small}>
              {suggestions.status === "loading"
                ? "Finding matches…"
                : suggestions.status === "error"
                  ? "Suggestions could not load."
                  : suggestions.outside
                    ? "Matches outside your filters. Opening one keeps your browsing area."
                    : suggestions.rows.length
                      ? "Suggested places"
                      : "No matching pages. Search or change your area."}
            </Text>
            {suggestions.status === "error" ? (
              <Action
                label="Retry suggestions"
                onPress={() => {
                  setShowSuggestions(false);
                  setTimeout(() => setShowSuggestions(true), 0);
                }}
              />
            ) : null}
            {suggestions.rows.map((r: any, i: number) => (
              <Action
                key={r.slug}
                selected={active === i}
                label={
                  r.name +
                  " · " +
                  [r.city, r.country].filter(Boolean).join(", ")
                }
                onPress={() => select(r.slug)}
              />
            ))}
          </View>
        ) : null}
        <View style={s.row}>
          {[
            ["", "All"],
            ["business", "Businesses"],
            ["artist", "Artists"],
            ["professional", "Professionals"],
            ["church", "Churches"],
            ["organization", "Organizations"],
            ["event", "Events"],
            ["venue", "Venues"],
          ].map(([type, label]) => (
            <Action
              key={type}
              label={label}
              selected={state.type === type}
              onPress={() => {
                setShowSuggestions(false);
                setState({ ...state, type, selected: "" });
              }}
            />
          ))}
        </View>
        <View style={s.row}>
          <Action
            label="List"
            selected={state.mode === "list"}
            onPress={() => setState({ ...state, mode: "list" })}
          />
          <Action
            label="Map"
            selected={state.mode === "map"}
            onPress={() => setState({ ...state, mode: "map" })}
          />
        </View>
      </View>
      </> : null}
      <View style={[mapMode && {gap:12}, landscapeMap && s.mapColumns]}>
      {state.mode === "map" ? (
        <View style={[{ gap: 12 }, landscapeMap && s.mapColumn]}>
          <DiscoveryMap
            height={mapHeight}
            points={mapPoints}
            selected={selectedPoint?.s || state.selected}
            scopeKey={key}
            focus={focus}
            motion={preferences.motion}
            onSelect={select}
          />
          {!state.selected || mapFilters ? <Text style={s.small}>
            {mapBusy
              ? "Reading map positions…"
              : pins.filter((p:any)=>p.position_diagnosis?.reviewed).length +
                " reviewed map positions; " + pins.filter((p:any)=>!p.position_diagnosis?.reviewed).length +
                " stored positions awaiting independent verification. Approximate and unmapped places remain in the list."}
          </Text> : null}
          {mapError ? (
            <>
              <Text accessibilityRole="alert" style={s.error}>
                {mapError}
              </Text>
              <Action
                label="Retry map positions"
                onPress={() => {
                  setMapRead(false);
                  setMapRetry((v) => v + 1);
                }}
              />
            </>
          ) : null}
          {mapFilters && pins.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {pins.slice(0, 100).map((p: any) => (
                <Action
                  key={p.s}
                  label={"Map place · " + p.n}
                  selected={state.selected === p.s}
                  onPress={() => select(p.s)}
                />
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}
      {state.selected ? (
        <View style={[s.panel, mapMode && {padding:12,gap:8}, landscapeMap && s.mapColumn, { borderColor: LIGHT.accent }]}>
          <View style={s.row}>
            <Text style={[s.heading, mapMode && {flex:1}]}>{mapMode && selected && selectedMatchesIntent ? selected.name : "Your selected place"}</Text>
            {mapMode ? <Pressable accessibilityRole="button" accessibilityLabel="Close selected place"
              style={[s.action,{paddingHorizontal:12}]} onPress={() => setState({...state, selected:""})}>
              <Text style={s.link}>×</Text>
            </Pressable> : <Action
              label="Close selected place"
              onPress={() => setState({ ...state, selected: "" })}
            />}
          </View>
          {selectBusy ? <ActivityIndicator /> : null}
          {selectError ? (
            <>
              <Text accessibilityRole="alert" style={s.error}>
                {selectError}
              </Text>
              <Action
                label="Retry selected place"
                onPress={() => setSelectionRetry((v) => v + 1)}
              />
            </>
          ) : null}
          {selected && selectedMatchesIntent ? (
            <>
              {!mapMode || placeDetails ? <Photo row={selected} detail /> : null}
              {!mapMode ? <Text style={s.heading}>{selected.name}</Text> : null}
              <Text style={s.body}>
                {[selected.address, selected.city, selected.country]
                  .filter(Boolean)
                  .join(", ")}
              </Text>
              <Text style={s.small}>
                {pointStatus(selectedPoint)}
              </Text>
              {!mapMode ? routeOptions : null}
              <View style={s.row}>
                <Action
                  label="Open this place"
                  onPress={() =>
                    open(
                      placeDestination({
                        slug: selected.canonical_slug || selected.slug,
                      })!,
                    )
                  }
                />
                {directions && directionURL ? (
                  <Action
                    label={directions.basis === "name" ? directions.label : "Open directions in Google Maps"}
                    onPress={() =>
                      void action(() => Linking.openURL(directionURL))
                    }
                  />
                ) : null}
                {!mapMode ? shareAction : null}
                {state.mode === "map" &&
                exactPins(
                  [
                    selectedPoint,
                  ].filter(Boolean),
                ).length ? (
                  <Action
                    label="Focus this pin"
                    onPress={() => setFocus((v) => v + 1)}
                  />
                ) : null}
              </View>
              {mapMode ? <Action label={placeDetails ? "Close place details" : "Place details & travel options"}
                selected={placeDetails} onPress={() => setPlaceDetails(value => !value)} /> : null}
              {!mapMode || placeDetails ? <>
              {mapMode ? routeOptions : null}
                {mapMode ? shareAction : null}
              {coLocated.length ? (
                <View style={{ gap: 8 }}>
                  <Text style={s.small}>
                    Other places at this same mapped position
                  </Text>
                  {coLocated.map((p: any) => (
                    <Action
                      key={p.s}
                      label={"Same position · " + p.n}
                      onPress={() => select(p.s)}
                    />
                  ))}
                </View>
              ) : null}
              {directions ? (
                <Text style={s.small}>
                  {directions.basis === "name"
                    ? "Maps searches by name; confirm the destination before travelling."
                    : "Directions open your map provider. Confirm the destination before travelling."}
                </Text>
              ) : null}
              </> : null}
            </>
          ) : null}
          {actionError ? (
            <Text accessibilityRole="alert" style={s.error}>
              {actionError}
            </Text>
          ) : null}
        </View>
      ) : null}
      </View>
      {mapMode && !mapFilters && error ? <View style={s.panel}>
        <Text accessibilityRole="alert" style={s.error}>{error}</Text>
        <Action label="Retry places" onPress={() => setRetry(value => value + 1)} />
      </View> : null}
      {!mapMode || mapFilters ? <>
      <View style={s.row}>
        <Text style={s.heading}>Places to explore</Text>
        <Text style={s.small}>
          {rows.length} loaded{more ? " · more available" : ""}
        </Text>
      </View>
      {loading ? <ActivityIndicator /> : null}
      {error ? (
        <View style={s.panel}>
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
          <Action label="Retry places" onPress={() => setRetry((v) => v + 1)} />
        </View>
      ) : null}
      {!loading && !error && !rows.length && !homeBusy ? (
        <View style={s.panel}>
          <Text style={s.heading}>{area.source === "global" ? "No matching places." : "Try a wider view."}</Text>
          <Text style={s.body}>
            {area.source === "global" ? "Clear this search and its filters to explore all places." : "No matching places in this area. Explore everywhere while keeping your saved home."}
          </Text>
          <Action
            label={emptyDiscoveryRecovery(state,area).label}
            onPress={() => setState(emptyDiscoveryRecovery(state,area).state)}
          />
        </View>
      ) : null}
      {rows.map((row) => (
        <Pressable
          key={row.slug}
          accessibilityRole="button"
          accessibilityLabel={"Preview " + row.name}
          onPress={() => select(row.slug)}
          style={s.place}
        >
          <Photo row={row} />
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={s.heading}>{row.name}</Text>
            <Text style={s.small}>
              {[row.city, row.country].filter(Boolean).join(", ")}
            </Text>
            <Text style={s.body} numberOfLines={3}>
              {row.description ||
                row.category ||
                row.entity_type?.replaceAll("_", " ")}
            </Text>
            {state.mode === "map" ? (
              <Text style={s.small}>
                {pointStatus(pointBySlug.get(row.slug))}
              </Text>
            ) : null}
          </View>
          <Text style={s.link}>↗</Text>
        </Pressable>
      ))}
      {more ? (
        <Action
          label="Load more places"
          disabled={loading}
          onPress={() => void load(true)}
        />
      ) : null}
      </> : null}
    </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  discoveryFrame: { flex: 1 },
  mapColumns: {flexDirection:"row",alignItems:"flex-start",gap:12},
  mapColumn: {flex:1,minWidth:0},
  mapContent: { padding: 12, gap: 12, paddingBottom: 20 },
  mapToolbar: { flexDirection:"row", flexWrap:"wrap", alignItems:"center", justifyContent:"space-between", gap: 8, padding: 12, paddingBottom: 0 },
  content: { padding: 20, gap: 20, paddingBottom: 36 },
  title: {
    fontSize: 35,
    lineHeight: 40,
    fontWeight: "700",
    letterSpacing: -1,
    color: LIGHT.ink,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    color: LIGHT.accent,
    fontWeight: "700",
  },
  body: { fontSize: 15, lineHeight: 23, color: LIGHT.muted },
  small: { fontSize: 12, lineHeight: 19, color: LIGHT.dim },
  heading: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700",
    color: LIGHT.ink,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 9, alignItems: "center" },
  routePanel: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: LIGHT.surfaceRaised, borderWidth: 1, borderColor: LIGHT.line },
  panel: {
    padding: 18,
    gap: 12,
    backgroundColor: LIGHT.surface,
    borderWidth: 1,
    borderColor: LIGHT.line,
    borderRadius: 24,
  },
  action: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: LIGHT.surfaceRaised,
    borderRadius: 22,
    justifyContent: "center",
  },
  active: { backgroundColor: LIGHT.ink },
  link: { fontWeight: "700", fontSize: 13, color: LIGHT.accent },
  input: {
    minHeight: 50,
    padding: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: LIGHT.line,
    color: LIGHT.ink,
    backgroundColor: LIGHT.surface,
    fontSize: 16,
  },
  badge: { fontSize: 11, color: LIGHT.accent },
  error: { fontSize: 13, lineHeight: 20, color: LIGHT.error },
  place: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    backgroundColor: LIGHT.surface,
    borderWidth: 1,
    borderColor: LIGHT.line,
    borderRadius: 22,
    alignItems: "flex-start",
  },
  monogram: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: LIGHT.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
});
