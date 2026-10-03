/** Perspective fitting for the real room footprint and usable canvas area.
 * Camera padding is measured in pixels; published geometry is never rescaled.
 */
export function roomOverviewFit({
  width,
  height,
  span,
  depth,
  fov = 42,
  phi = 0.12,
  rotate = false,
  top = 12,
  bottom = 78,
  wallHeight = 0,
}) {
  if (
    ![width, height, span, depth, fov, phi, top, bottom, wallHeight].every(
      Number.isFinite,
    ) ||
    width <= 0 ||
    height <= 0 ||
    span <= 0 ||
    depth <= 0 ||
    fov <= 0 ||
    fov >= 120
  )
    throw Error("Valid room and viewport required");
  const usable = Math.max(height * 0.35, height - top - bottom),
    aspect = width / height,
    tan = Math.tan((fov * Math.PI) / 360),
    horizontal = rotate ? depth : span,
    vertical = rotate ? span : depth;
  let distance = 0;
  for (const x of [-horizontal / 2, horizontal / 2])
    for (const z of [-vertical / 2, vertical / 2])
      for (const y of [0, wallHeight]) {
        const near = y * Math.cos(phi) + z * Math.sin(phi),
          up = y * Math.sin(phi) - z * Math.cos(phi);
        distance = Math.max(
          distance,
          near + Math.abs(x) / (tan * aspect * 0.94),
          near + Math.abs(up) / ((tan * usable) / height),
        );
      }
  return {
    distance: distance * 1.02,
    shiftY:
      (Math.min(top, height * 0.45) - Math.min(bottom, height * 0.45)) / 2,
    usable,
  };
}

const overlaps = (a, b, gap = 2) =>
  a.x < b.x + b.w + gap &&
  a.x + a.w + gap > b.x &&
  a.y < b.y + b.h + gap &&
  a.y + a.h + gap > b.y;
/** Dense maps retain honest coverage. The finder always owns every exact ID.
 * A selected ID wins collision priority and remains inside usable chrome bounds.
 */
export function roomLabelLayout(
  items,
  { width, height, top = 8, bottom = 8, obstacles = [], seated = false } = {},
) {
  if (
    !Array.isArray(items) ||
    ![width, height, top, bottom].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0
  )
    throw Error("Valid label viewport required");
  const occupied = [...obstacles],
    result = [],
    mobile = width < 700;
  const ordered = [...items].sort(
    (a, b) =>
      Number(!!b.selected) - Number(!!a.selected) || a.y - b.y || a.x - b.x,
  );
  for (const item of ordered) {
    const others = items.filter(
      (i) =>
        i !== item &&
        Number.isFinite(i.x) &&
        Number.isFinite(i.y) &&
        Math.abs(i.y - item.y) < 30,
    );
    const nearest = others.reduce(
      (n, i) => Math.min(n, Math.abs(i.x - item.x)),
      Infinity,
    );
    const font = seated
        ? 13
        : Math.max(
            11,
            Math.min(
              15,
              Math.floor(
                (nearest - 13) / Math.max(1, String(item.id).length * 0.64),
              ),
            ),
          ),
      h = font + 10,
      w = Math.max(22, Math.ceil(String(item.id).length * font * 0.64 + 9));
    let x = item.x - w / 2,
      y = item.y - h / 2;
    const inFrame =
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      item.z >= -1 &&
      item.z <= 1 &&
      x >= 8 &&
      x + w <= width - 8 &&
      y >= top &&
      y + h <= height - bottom;
    if (item.selected) {
      x = Math.max(8, Math.min(width - w - 8, Number.isFinite(x) ? x : 8));
      y = Math.max(
        top,
        Math.min(
          height - bottom - h,
          Number.isFinite(y) ? y : height - bottom - h,
        ),
      );
    }
    let box = { x, y, w, h },
      visible = (!seated || item.selected) && (inFrame || item.selected);
    if (visible && occupied.some((o) => overlaps(box, o))) {
      visible = false;
      const offsets = item.selected
        ? [
            [-w - 8, 0],
            [w + 8, 0],
            [0, -h - 8],
            [0, h + 8],
            [0, 0],
          ]
          : [
              [0, -5],
              [0, 5],
              ...(!mobile ? [[0, -h - 4], [0, h + 4]] : []),
            ];
      for (const [dx, dy] of offsets) {
        const candidate = {
          ...box,
          x: Math.max(8, Math.min(width - w - 8, x + dx)),
          y: Math.max(top, Math.min(height - bottom - h, y + dy)),
        };
        if (!occupied.some((o) => overlaps(candidate, o))) {
          box = candidate;
          visible = true;
          break;
        }
      }
      if (item.selected && !visible) {
        // Keep a selected identity in the free edge rail even when its anchor
        // sits behind the camera or an open finder covers the footprint.
        // A desktop finder may occupy the entire left rail. Search both
        // viewport edges before allowing the selected identity to disappear.
        const rails = mobile ? [width - w - 8, 8] : [8, width - w - 8];
        for (const xx of rails) {
          for (let yy = top; yy + h <= height - bottom; yy += h + 6) {
            const candidate = { x: xx, y: yy, w, h };
            if (!occupied.some((o) => overlaps(candidate, o))) {
              box = candidate;
              visible = true;
              break;
            }
          }
          if (visible) break;
        }
      }
    }
    if (visible) occupied.push(box);
    result.push({ ...item, ...box, font, visible });
  }
  return {
    labels: result,
    visible: result.filter((i) => i.visible).length,
    total: items.length,
  };
}
