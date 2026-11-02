import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";

const cd = async (method, params = {}, port) =>
  new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/devtools/browser/x`);
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ id: 1, method, params }));
    });
    ws.addEventListener("message", (e) => {
      resolve(JSON.parse(e.data));
      ws.close();
    });
  });

const port = 9500;
const profile = "/tmp/pba-run4-profile";
const browser = spawn(
  "/usr/bin/google-chrome",
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore", detached: false },
);
let page = null;
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/list`);
    const list = await r.json();
    page = list.find((t) => t.type === "page");
    if (page) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 250));
}
console.log("page target:", page ? "found" : "MISSING");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 1;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
await new Promise((r) => ws.addEventListener("open", r));
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const i = id++;
    pending.set(i, resolve);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const ev = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
  return r.result?.result?.value;
};
await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: "about:blank" });
await new Promise((r) => setTimeout(r, 1000));
const txt = await ev("document.body ? document.body.innerText : '(no body)'");
console.log("innerText length:", String(txt).length);
console.log("--- sample ---");
console.log(String(txt).slice(0, 200));
writeFileSync("/tmp/run4-sample.txt", String(txt));
