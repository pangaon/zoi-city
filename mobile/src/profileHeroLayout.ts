/** Conservative photo-header sizing for enlarged system text and wrapped Greek names. */
export function estimatePhotoHeroHeight({
  width,
  baseHeight,
  fontScale,
  title,
  titleFontSize,
  titleLineHeight,
  supportingText = [],
  horizontalPadding = 18,
  verticalPadding = 34,
}: {
  width: number;
  baseHeight: number;
  fontScale: number;
  title: string;
  titleFontSize: number;
  titleLineHeight: number;
  supportingText?: Array<{ text: string; fontSize: number; lineHeight: number; maxLines?: number }>;
  horizontalPadding?: number;
  verticalPadding?: number;
}) {
  const scale = Math.max(1, Number.isFinite(fontScale) ? fontScale : 1);
  const textWidth = Math.max(96, width - horizontalPadding * 2 - 28);
  const lines = (text: string, fontSize: number, maxLines = Number.POSITIVE_INFINITY) => {
    const estimatedCharactersPerLine = Math.max(4, textWidth / (fontSize * scale * 0.58));
    return Math.min(maxLines, Math.max(1, Math.ceil(Array.from(text.trim()).length / estimatedCharactersPerLine)));
  };
  const supporting = supportingText.reduce((height, item) =>
    height + lines(item.text, item.fontSize, item.maxLines) * item.lineHeight * scale,
  0);
  const gaps = (supportingText.filter(item => item.text.trim()).length + 1) * 6 * scale;
  const titleHeight = lines(title, titleFontSize) * titleLineHeight * scale;
  // Native line-height rounding varies by platform/font fallback. Keep enough
  // slack that a wrapped CJK/Greek location label never enters the photo crop.
  return Math.ceil(Math.max(baseHeight, verticalPadding + titleHeight + supporting + gaps + 32));
}
