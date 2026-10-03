import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LIGHT } from "./brand";
import { discoveryRead } from "./discoveryRead";
import { cleanLocation } from "./discovery";
/** Explicit suggestions from published places; choosing one never saves preferences. */
export function DiscoveryLocation({
  city,
  country,
  setCity,
  setCountry,
  disabled = false,
  prefix = "Browse",
}: {
  city: string;
  country: string;
  setCity: (v: string) => void;
  setCountry: (v: string) => void;
  disabled?: boolean;
  prefix?: string;
}) {
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0),
    [focused, setFocused] = useState("");
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setError(false);
    void discoveryRead("explore_cities", { p_limit: 100 }, controller.signal)
      .then((v) => {
        if (!Array.isArray(v) || v.length > 100) throw Error("invalid");
        if (active) {
          const seen = new Set<string>();
          setRows(
            v
              .filter((r) => typeof r.city === "string" && r.city.trim())
              .map((r) => ({
                city: cleanLocation(r.city),
                country: cleanLocation(r.country),
              }))
              .filter((r) => {
                const key = r.city + "|" + r.country;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              }),
          );
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [retry]);
  const suggestions = rows
      .filter((r) =>
        focused === "country"
          ? r.country &&
            r.country
              .toLocaleLowerCase()
              .includes(country.trim().toLocaleLowerCase())
          : r.city
              .toLocaleLowerCase()
              .includes(city.trim().toLocaleLowerCase()),
      )
      .slice(0, 5),
    countries = [...new Set(suggestions.map((r) => r.country))];
  return (
    <View style={{ gap: 10 }}>
      <Text style={s.label}>
        {prefix === "Browse" ? "City" : "Private preferred city"}
      </Text>
      <TextInput
        accessibilityLabel={
          prefix === "Browse" ? "Browse city" : "Private preferred city"
        }
        placeholder="City (optional)"
        value={city}
        editable={!disabled}
        onChangeText={setCity}
        onFocus={() => setFocused("city")}
        maxLength={120}
        autoComplete="postal-address-locality"
        textContentType="addressCity"
        style={s.input}
      />
      <Text style={s.label}>
        {prefix === "Browse" ? "Country" : "Private preferred country"}
      </Text>
      <TextInput
        accessibilityLabel={
          prefix === "Browse" ? "Browse country" : "Private preferred country"
        }
        placeholder="Country (optional)"
        value={country}
        editable={!disabled}
        onChangeText={setCountry}
        onFocus={() => setFocused("country")}
        maxLength={120}
        autoComplete="country"
        textContentType="countryName"
        style={s.input}
      />
      {error ? (
        <>
          <Text style={s.small}>
            Area suggestions are unavailable. You can still enter any city and
            country.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => setRetry((v) => v + 1)}
            style={s.action}
          >
            <Text style={s.link}>Retry area suggestions</Text>
          </Pressable>
        </>
      ) : null}
      {focused && !disabled && suggestions.length ? (
        <View style={{ gap: 8 }}>
          <Text style={s.small}>
            Suggestions from published places. You can enter another area.
          </Text>
          {focused === "country"
            ? countries.map((c) => (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  onPress={() => {
                    setCountry(c);
                    setFocused("");
                  }}
                  style={s.action}
                >
                  <Text style={s.link}>{"Use country · " + c}</Text>
                </Pressable>
              ))
            : suggestions.map((r) => (
                <Pressable
                  key={r.city + "|" + r.country}
                  accessibilityRole="button"
                  onPress={() => {
                    setCity(r.city);
                    setCountry(r.country);
                    setFocused("");
                  }}
                  style={s.action}
                >
                  <Text style={s.link}>
                    {"Use area · " +
                      r.city +
                      " · " +
                      (r.country || "All countries")}
                  </Text>
                </Pressable>
              ))}
        </View>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "700", color: LIGHT.ink },
  input: {
    minHeight: 48,
    padding: 14,
    borderWidth: 1,
    borderColor: LIGHT.line,
    borderRadius: 15,
    color: LIGHT.ink,
    backgroundColor: LIGHT.surface,
    fontSize: 16,
  },
  small: { fontSize: 12, lineHeight: 19, color: LIGHT.dim },
  action: {
    minHeight: 44,
    padding: 12,
    borderRadius: 18,
    backgroundColor: LIGHT.surfaceRaised,
  },
  link: { color: LIGHT.accent, fontSize: 13, fontWeight: "700" },
});
