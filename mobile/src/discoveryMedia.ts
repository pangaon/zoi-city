import { publicListingMedia } from "../../assets/discovery/public-listing-media.mjs";

/** Native presentation consumes the same bounded public media decision as web. */
export function discoveryMedia(row: any): {
  uri: string | null;
  kind: "hero" | "poster" | "logo" | null;
  fit: "contain" | "cover";
  backdrop: "dark" | "light" | "neutral";
} {
  const media = publicListingMedia(row);
  const legacyLogo =
    !row?.media_input &&
    !row?.profile &&
    !row?.owner_content &&
    row?.image_kind === "logo";
  const kind = media.hero
    ? legacyLogo
      ? "logo"
      : media.imageKind === "event_poster"
        ? "poster"
        : "hero"
    : media.logo
      ? "logo"
      : null;
  return {
    uri: media.hero || media.logo || null,
    kind,
    fit:
      kind === "poster" || legacyLogo
        ? "contain"
        : kind === "logo"
          ? media.logoFit === "cover"
            ? "cover"
            : "contain"
          : "cover",
    backdrop:
      kind === "logo" && media.logoBackdrop === "dark"
        ? "dark"
        : kind === "logo" && media.logoBackdrop === "light"
          ? "light"
          : "neutral",
  };
}
