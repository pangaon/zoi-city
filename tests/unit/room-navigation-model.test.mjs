import test from "node:test";
import assert from "node:assert/strict";
import {
  roomOverviewFit,
  roomLabelLayout,
} from "../../assets/events/room-navigation-model.mjs";
import {
  PerspectiveCamera,
  Vector3,
} from "../../assets/vendor/three-0.186.1/three.module.js";
const collisions = (labels) => {
  const a = labels.filter((i) => i.visible);
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++)
      assert.ok(
        !(
          a[i].x < a[j].x + a[j].w &&
          a[i].x + a[i].w > a[j].x &&
          a[i].y < a[j].y + a[j].h &&
          a[i].y + a[i].h > a[j].y
        ),
      );
};
test("perspective fit uses available pixel height without resizing room geometry", () => {
  for (const [width, height] of [
    [390, 720],
    [1440, 820],
    [844, 350],
  ])
    for (const rotate of [false, true]) {
      const input = {
          width,
          height,
          span: 30,
          depth: 21,
          top: 12,
          bottom: 95,
          wallHeight: 5.4,
          rotate,
        },
        before = JSON.stringify(input),
        v = roomOverviewFit(input),
        theta = rotate ? Math.PI / 2 : 0,
        c = new PerspectiveCamera(42, width / height, 0.05, 200);
      c.position.set(
        Math.sin(theta) * Math.sin(0.12) * v.distance,
        Math.cos(0.12) * v.distance,
        Math.cos(theta) * Math.sin(0.12) * v.distance,
      );
      c.up.set(rotate ? -1 : 0, 0, rotate ? 0 : -1);
      c.lookAt(0, 0, 0);
      c.projectionMatrix.elements[9] += (2 * v.shiftY) / height;
      c.updateMatrixWorld();
      for (const x of [-15, 15])
        for (const z of [-10.5, 10.5])
          for (const y of [0, 5.4]) {
            const p = new Vector3(x, y, z).project(c);
            assert.ok(Math.abs(p.x) < 1 && Math.abs(p.y) < 1);
          }
      assert.equal(JSON.stringify(input), before);
      assert(v.usable >= height * 0.35);
    }
});
test("fitting rejects malformed viewport or source dimensions", () => {
  for (const patch of [
    { width: 0 },
    { height: NaN },
    { span: -1 },
    { fov: 180 },
  ])
    assert.throws(() =>
      roomOverviewFit({
        width: 1440,
        height: 900,
        span: 30,
        depth: 21,
        ...patch,
      }),
    );
});
test("dense desktop numeric IDs use every anchor without overlapping 3-digit labels", () => {
  const items = Array.from({ length: 120 }, (_, i) => ({
      id: String(i + 1),
      x: 32 + (i % 20) * 34,
      y: 50 + Math.floor(i / 20) * 45,
      z: 0,
      selected: i === 117,
    })),
    copy = JSON.stringify(items),
    v = roomLabelLayout(items, { width: 750, height: 400 });
  assert.equal(v.visible, 120);
  assert.equal(v.total, 120);
  assert(v.labels.every((i) => i.font >= 11));
  collisions(v.labels);
  assert.equal(JSON.stringify(items), copy);
});
test("small-phone density reports actual coverage and retains selected table priority", () => {
  const items = Array.from({ length: 60 }, (_, i) => ({
      id: String(i + 80),
      x: 20 + (i % 20) * 17,
      y: 45 + Math.floor(i / 20) * 40,
      z: 0,
      selected: i === 23,
    })),
    v = roomLabelLayout(items, { width: 390, height: 250 });
  assert(v.visible < 60 && v.visible > 0);
  assert.equal(v.visible, v.labels.filter((x) => x.visible).length);
  assert.equal(v.labels.find((x) => x.id === "103").visible, true);
  collisions(v.labels);
});
test("selected off-camera identity moves to usable free rail rather than disappearing behind finder", () => {
  const obstacles = [{ x: 0, y: 0, w: 340, h: 220 }],
    v = roomLabelLayout(
      [{ id: "20B", x: -800, y: -20, z: 2, selected: true }],
      { width: 390, height: 450, top: 20, bottom: 90, obstacles },
    );
  const a = v.labels[0];
  assert(a.visible);
  assert(a.x >= 8 && a.x + a.w <= 382 && a.y >= 20 && a.y + a.h <= 360);
  assert(!(a.x < 340 && a.y < 220));
});
test("seated view retains only exact selected identity and preserves alphanumeric IDs", () => {
  const v = roomLabelLayout(
    [
      { id: "10A", x: 120, y: 180, z: 0 },
      { id: "10B", x: 140, y: 180, z: 0, selected: true },
      { id: "20B", x: 150, y: 180, z: 0 },
    ],
    { width: 390, height: 450, seated: true },
  );
  assert.equal(v.visible, 1);
  assert.equal(v.labels.find((x) => x.visible).id, "10B");
  assert.equal(v.labels.length, 3);
});
test("zoom increases readable number size while controls remain clear", () => {
  const zoom = (gap) =>
    roomLabelLayout(
      [
        { id: "118", x: 80, y: 150, z: 0 },
        { id: "117", x: 80 + gap, y: 150, z: 0 },
      ],
      { width: 700, height: 400, obstacles: [{ x: 0, y: 0, w: 500, h: 80 }] },
    ).labels;
  assert(zoom(90)[0].font > zoom(34)[0].font);
  for (const a of zoom(90)) assert(a.y >= 80);
  collisions(zoom(90));
});

test("landscape selected identity uses the opposite rail when the finder covers the first", () => {
  const obstacles=[{x:14,y:14,w:680,h:58},{x:14,y:86,w:300,h:290},{x:532,y:280,w:300,h:98}];
  const result=roomLabelLayout([{id:"23",x:200,y:220,z:0,selected:true}],{width:844,height:390,top:8,bottom:12,obstacles});
  const selected=result.labels[0];
  assert.equal(selected.visible,true);
  assert.ok(selected.x > 790);
  assert.ok(selected.y < 80);
  for(const o of obstacles) assert.ok(!(selected.x<o.x+o.w&&selected.x+selected.w>o.x&&selected.y<o.y+o.h&&selected.y+selected.h>o.y));
});
