// Capture a full-page screenshot through CDP with accurate device metrics.
// Usage: node scripts/shot.mjs <url> <outPath> [width] [height]

import { writeFile } from "node:fs/promises";

const url = process.argv[2];
const out = process.argv[3];
const width = Number(process.argv[4] ?? 1440);
const height = Number(process.argv[5] ?? 900);
const mobile = width < 600;

const targets = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const page = targets.find((t) => t.type === "page");
if (!page) throw new Error("no page target");

const ws = new WebSocket(page.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();

ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
});

await new Promise((resolve) => ws.addEventListener("open", resolve));

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: 1,
  mobile,
});
await send("Page.navigate", { url });
// Give the app time to hydrate images and fonts.
await new Promise((resolve) => setTimeout(resolve, 5000));

// The Next.js dev-tools bubble is a development aid, not part of the UI.
await send("Runtime.evaluate", {
  expression:
    "document.querySelectorAll('nextjs-portal').forEach((el) => el.remove())",
});

const metrics = await send("Page.getLayoutMetrics");
const contentHeight = Math.ceil(
  metrics.result?.cssContentSize?.height ?? metrics.result?.contentSize?.height ?? height,
);

const shot = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: true,
  clip: { x: 0, y: 0, width, height: Math.min(contentHeight, 6000), scale: 1 },
});

const data = shot.result?.data;
if (!data) throw new Error("capture failed");
await writeFile(out, Buffer.from(data, "base64"));
console.log(`${out} ${width}x${Math.min(contentHeight, 6000)}`);
ws.close();
