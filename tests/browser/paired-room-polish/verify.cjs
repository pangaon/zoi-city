const fs = require("node:fs/promises"),
  path = require("node:path"),
  http = require("node:http"),
  assert = require("node:assert/strict"),
  { chromium } = require("playwright-core");
const root = path.resolve(__dirname, "../../.."),
  out =
    process.env.OUTPUT_DIR ||
    path.join(
      root,
      "docs/audits/evidence/paired-room-polish-producer-2026-10-03/final-browser",
    );
const montreal = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#08111f}#room:not(:fullscreen):not(.rs-expanded){height:82dvh;min-height:560px;max-height:none}</style><div id="room"></div><script type="module">import{mountRoomScene}from'/assets/events/room-scene.mjs';import{MONTREAL_PLAN_SOURCE as plan,MONTREAL_TABLES as tables,MONTREAL_CATEGORIES as categories}from'/assets/events/opa/montreal-room-plan.mjs';window.scene=await mountRoomScene(document.querySelector('#room'),{plan,tables,categories,onSelect:()=>{},onContinue:()=>{}});</script>`;
const server = http.createServer(async (req, res) => {
  try {
    let p = new URL(req.url, "http://local").pathname;
    if (p === "/montreal") {
      res.setHeader("Content-Type", "text/html");
      return res.end(montreal);
    }
    if (p.endsWith("/")) p += "index.html";
    const f = path.resolve(root, "." + p);
    if (!f.startsWith(root + "/")) throw Error();
    const ext = path.extname(f);
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".jpg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".json": "application/json",
      }[ext] || "application/octet-stream",
    );
    res.end(await fs.readFile(f));
  } catch {
    res.statusCode = 404;
    res.end();
  }
});
async function controls(room) {
  return room.locator(".fc-controls,.rs-toolbar").evaluate((bar) => {
    const br = bar.getBoundingClientRect(),
      buttons = [...bar.querySelectorAll("button")].filter(
        (b) => getComputedStyle(b).display !== "none",
      );
    return {
      scrollWidth: bar.scrollWidth,
      width: bar.clientWidth,
      height: br.height,
      buttons: buttons.map((b) => {
        const r = b.getBoundingClientRect(),
          hit = document.elementFromPoint(
            r.x + r.width / 2,
            r.y + r.height / 2,
          );
        return {
          text: b.textContent.trim(),
          fits:
            r.left >= br.left &&
            r.right <= br.right + 1 &&
            r.top >= br.top &&
            r.bottom <= br.bottom + 1,
          height: r.height,
          hit: hit === b || b.contains(hit),
        };
      }),
    };
  });
}
async function labels(room, stage) {
  return room.evaluate((root, stage) => {
    const buttons = [
      ...root.querySelectorAll(".fc-markers button,.rs-labels button"),
    ].filter((b) => !b.hidden && getComputedStyle(b).display !== "none");
    const rows = buttons.map((b) => {
      const r = b.getBoundingClientRect(),
        hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return {
        id: b.textContent.trim(),
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        color: getComputedStyle(b).borderBottomColor,
        hit: hit === b || b.contains(hit),
        occluder: hit?.className || hit?.tagName,
      };
    });
    const overlaps = [];
    for (let i = 0; i < rows.length; i++)
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i],
          b = rows[j];
        if (
          a.x < b.x + b.w &&
          a.x + a.w > b.x &&
          a.y < b.y + b.h &&
          a.y + a.h > b.y
        )
          overlaps.push([a.id, b.id]);
      }
    return {
      stage,
      visible: rows.length,
      overlaps,
      occluded: rows.filter((r) => !r.hit),
      rows,
    };
  }, stage);
}
(async () => {
  await fs.mkdir(out, { recursive: true });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = "http://127.0.0.1:" + server.address().port,
    b = await chromium.launch({
      executablePath:
        process.env.CHROMIUM_EXECUTABLE_PATH ||
        "/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
      args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
    });
  const results = [];
  try {
    for (const city of ["toronto", "montreal"])
      for (const config of (process.env.ROOM_CASES_JSON ? JSON.parse(process.env.ROOM_CASES_JSON) : [{width:390,height:900,motion:"reduce"},{width:1440,height:900,motion:"reduce"},{width:320,height:700,motion:"no-preference"},{width:844,height:390,motion:"no-preference"}])) {
        const {width,height,motion}=config, suffix=`${width}-${height}-${motion}`;
        const p = await b.newPage({
          viewport: { width, height },
          hasTouch: width !== 1440,
          reducedMotion: motion,
        });
        const errors = [];
        p.on("pageerror", (e) => errors.push(e.message));
        await p.route("**/*", (r) =>
          new URL(r.request().url()).origin === origin
            ? r.continue()
            : r.abort(),
        );
        await p.goto(
          origin +
            (city === "toronto"
              ? "/events/giannis-ploutarchos-andromache-toronto-2027/#room"
              : "/montreal"),
        );
        const room = p.locator("[data-room-skin=zoi]").first();
        await room.locator("canvas").waitFor();
        await room.scrollIntoViewIfNeeded();
        await p.waitForTimeout(900);
        await room
          .getByRole("button", { name: "Full screen", exact: true })
          .click();
        await p.waitForTimeout(motion === "reduce" ? 500 : 1200);
        const mapping = await room.evaluate(async (root, city) => {
          const expected =
            city === "toronto"
              ? (
                  await import("/assets/events/signature/venue-experience.mjs")
                ).TABLES.map((t) => ({
                  id: t.id,
                  color: {
                    red: "#f21827",
                    blue: "#22a9d7",
                    white: "#ffffff",
                    green: "#8cc53e",
                    yellow: "#ffeb28",
                    magenta: "#ef0094",
                  }[t.tier],
                }))
              : (
                  await import("/assets/events/opa/montreal-room-plan.mjs")
                ).MONTREAL_TABLES.map((t) => ({
                  id: t.id,
                  category: t.category,
                }));
          if (city === "montreal") {
            const c = (
              await import("/assets/events/opa/montreal-room-plan.mjs")
            ).MONTREAL_CATEGORIES;
            expected.forEach((t) => (t.color = c[t.category].color));
          }
          const nodes = [
            ...root.querySelectorAll(".fc-markers button,.rs-labels button"),
          ];
          return {
            expectedCount: expected.length,
            actualCount: nodes.length,
            uniqueCount: new Set(nodes.map((n) => n.textContent.trim())).size,
            mismatches: expected.filter((t) => {
              const n = nodes.find(
                (n) => n.textContent.trim() === String(t.id),
              );
              return (
                !n ||
                n.style.getPropertyValue(
                  city === "toronto" ? "--tier" : "--marker",
                ) !== t.color
              );
            }),
          };
        }, city);
        assert.equal(mapping.expectedCount, mapping.actualCount);
        assert.equal(mapping.uniqueCount, mapping.expectedCount);
        assert.deepEqual(mapping.mismatches, []);
        await room
          .getByRole("button", { name: "Find table", exact: true })
          .click();
        const completeFinder = await room
          .locator(
            city === "toronto"
              ? ".fc-number-tray [data-fc-table]"
              : ".rs-numbers [data-table]",
          )
          .count();
        assert.equal(completeFinder, mapping.expectedCount);
        await room.getByRole("searchbox").press("Escape");
        const observations = [await labels(room, "oblique")];
        const state = await controls(room);
        assert.ok(state.scrollWidth <= state.width + 1, JSON.stringify(state));
        if (width < 700)
          assert.ok(state.height <= 110, JSON.stringify(state));
        assert.ok(
          state.buttons.every((b) => b.fits && b.height >= 44 && b.hit),
          JSON.stringify(state),
        );
        await p.screenshot({
          path: path.join(out, `${city}-${suffix}-fullscreen.png`),
        });
        await room
          .getByRole("button", { name: "Find table", exact: true })
          .click();
        const search = room.getByRole("searchbox");
        await search.fill(city === "toronto" ? "12" : "10A");
        await room
          .locator(
            city === "toronto"
              ? '[data-fc-table="12"]'
              : '.rs-numbers [data-table="10A"]',
          )
          .last()
          .click();
        await room
          .getByRole("button", { name: "View from table", exact: true })
          .click();
        await p.waitForTimeout(motion === "reduce" ? 500 : 1200);
        observations.push(await labels(room, "seated"));
        await p.screenshot({
          path: path.join(out, `${city}-${suffix}-seated.png`),
        });
        await room
          .getByRole("button", { name: "Whole room", exact: true })
          .click();
        await p.waitForTimeout(motion === "reduce" ? 500 : 1200);
        await p.screenshot({
          path: path.join(out, `${city}-${suffix}-overview.png`),
        });
        observations.push(await labels(room, "overhead"));
        await fs.writeFile(
          path.join(out, `${city}-${suffix}-coverage.json`),
          JSON.stringify({ mapping, observations }, null, 2),
        );
        if (width === 1440)
          assert.equal(
            observations.find((x) => x.stage === "overhead").visible,
            mapping.expectedCount,
            "every desktop source number is readable without collision hiding",
          );
        // Canvas gestures rotate the view without reselecting a table.
        const selectedBefore = await room.locator('.fc-markers [aria-pressed=true],.rs-labels [aria-pressed=true]').textContent();
        const canvas = room.locator('canvas'), rect = await canvas.boundingBox();
        const x=rect.x+rect.width*.4, y=rect.y+rect.height*.6;
        if(width !== 1440){
          const cdp=await p.context().newCDPSession(p);
          await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
          await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+50,y:y-20}]});
          await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
          await cdp.detach();
        }else{
          await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+50,y-20,{steps:5});await p.mouse.up();
        }
        await p.waitForTimeout(900);
        assert.equal(await room.locator('.fc-markers [aria-pressed=true],.rs-labels [aria-pressed=true]').textContent(),selectedBefore);
        observations.push(await labels(room,'dragged'));
        for (const id of city === 'toronto' ? ['1','23','118'] : ['10B','20B','122']) {
          await room.getByRole('button',{name:'Find table',exact:true}).click();
          const retained=room.locator('.fc-markers [aria-pressed=true],.rs-labels [aria-pressed=true]');
          await retained.waitFor({state:'visible',timeout:10000});
          await p.waitForTimeout(300);
          const retainedId=await retained.textContent(), openState=await labels(room,'finder-open');
          await fs.writeFile(path.join(out,`${city}-${suffix}-finder-open.json`),JSON.stringify(openState,null,2));
          if(!openState.rows.some(x=>x.id===retainedId&&x.hit)) await p.screenshot({path:path.join(out,`${city}-${suffix}-finder-failure.png`)});
          assert.ok(openState.rows.some(x=>x.id===retainedId&&x.hit),JSON.stringify(openState));
          await room.getByRole('searchbox').fill(id);
          await room.locator(city === 'toronto' ? `[data-fc-table="${id}"]` : `.rs-numbers [data-table="${id}"]`).last().click();
          await p.waitForTimeout(900);
          const selected=room.locator('.fc-markers [aria-pressed=true],.rs-labels [aria-pressed=true]');
          assert.equal(await selected.textContent(),id);
          assert.equal(await selected.isVisible(),true);
          assert.ok((await labels(room,'focus-'+id)).rows.some(x=>x.id===id&&x.hit));
        }
        observations.push(await labels(room,'close-up'));
        await p.screenshot({path:path.join(out,`${city}-${suffix}-close-up.png`)});
        await room.getByRole('button',{name:'Whole room',exact:true}).click();
        await p.waitForTimeout(900);
        const final = await controls(room);
        assert.ok(
          final.buttons.every((b) => b.fits && b.hit),
          JSON.stringify(final),
        );
        await room
          .getByRole("button", { name: "Exit full screen", exact: true })
          .click();
        assert.equal(
          await p.evaluate(() => !!document.fullscreenElement),
          false,
        );
        assert.deepEqual(errors, []);
        assert.ok(
          observations.every((x) => !x.overlaps.length && !x.occluded.length),
          JSON.stringify(observations),
        );
        assert.equal(observations.find((x) => x.stage === "seated").visible, 1);
        results.push({ city, width, height, motion, state, final, mapping, observations });
        await p.close();
      }
  } finally {
    await b.close();
    await new Promise((r) => server.close(r));
    await fs.writeFile(
      path.join(out, "results.json"),
      JSON.stringify(results, null, 2),
    );
  }
  console.log("Passed", results.length, "paired room control journeys");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
