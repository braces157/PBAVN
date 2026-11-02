// Drives the running site in a real browser and asserts the interactions that
// matter: table sorting, row navigation, header search, and no horizontal
// overflow at phone width.
//
//   npm run build && npm start     # in one terminal
//   npm run verify                 # in another
//
// Launches its own headless Chrome, so nothing needs to be running beforehand.

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.VERIFY_BASE_URL ?? "http://127.0.0.1:3100";
const CDP_PORT = 9222;
const CDP = `http://127.0.0.1:${CDP_PORT}`;

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const browserPath = CANDIDATES.find((candidate) => existsSync(candidate));
if (!browserPath) {
  console.error("No Chrome or Edge found. Set CHROME_PATH to a Chromium binary.");
  process.exit(1);
}

const reachable = await fetch(`${BASE}/api/search-index`).then(
  (response) => response.ok,
  () => false,
);
if (!reachable) {
  console.error(`No server at ${BASE}. Run "npm run build && npm start" first.`);
  process.exit(1);
}

// A fresh profile per run. A reused one holds a SingletonLock from any previous
// browser that did not shut down cleanly, and a new Chrome can then hand the
// launch to the stale instance, or give up, without ever opening the port. The
// directory is removed on the way out so repeated local runs start clean too.
//
// `tmpdir()` and not `process.env.TEMP`: TEMP and TMPDIR are unset on a GitHub
// ubuntu runner, so TEMP alone resolved every run to the same /tmp path on every
// machine.
const profileDir = mkdtempSync(join(tmpdir(), "pba-verify-"));

const browser = spawn(
  browserPath,
  [
    "--headless=new",
    "--disable-gpu",
    // Not every runner gives /dev/shm its full size, and a browser that runs out
    // of it dies without saying so. Costs nothing where it is not the problem.
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ],
  // Chrome's own output is the only evidence there is when it never opens the
  // port, so it is kept. Ignoring it made an earlier failure here unreadable.
  { stdio: ["ignore", "pipe", "pipe"], detached: false },
);

// Kept in memory, not echoed: on Linux the useful lines are short, but a Windows
// Chrome repeats a dozen updater warnings a second and drowns the check results.
// Everything is still printed if the browser fails to start, which is the only
// time it is read.
const browserOutput = [];
for (const stream of [browser.stdout, browser.stderr]) {
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => browserOutput.push(chunk));
}

let exited = null;
browser.on("exit", (code, signal) => {
  exited = signal ?? code;
});

const stopBrowser = () => {
  try {
    browser.kill();
  } catch {
    /* already gone */
  }
  // Best effort. The kill is asynchronous, so on Windows the profile's files are
  // still held open at this point and the removal fails with EPERM. Clearing it
  // is housekeeping; letting it throw from an exit handler would turn a run whose
  // checks all passed into exit code 1, which is the opposite of what this
  // reports.
  try {
    rmSync(profileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    /* the OS will get to it */
  }
};
process.on("exit", stopBrowser);

async function waitForCdp() {
  // 60 s, not 10: the second a busy runner takes to start the graphics stack is
  // not a property of the site, and a launch that is merely slow is not a
  // failure. A browser that dies is reported immediately rather than waited out.
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (exited !== null) {
      throw new Error(
        `Chrome exited (${exited}) before opening a debugging port.\n${browserOutput.join("").slice(-4000)}`,
      );
    }
    try {
      const version = await fetch(`${CDP}/json/version`);
      if (version.ok) return version.json();
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `Chrome did not expose a debugging port within 60 s.\n${browserOutput.join("").slice(-4000)}`,
  );
}

await waitForCdp();

const targets = await (await fetch(`${CDP}/json/list`)).json();
const page = targets.find((target) => target.type === "page");
if (!page) throw new Error("No page target");

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

const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.result?.exceptionDetails) throw new Error(JSON.stringify(result.result.exceptionDetails).slice(0, 300));
  return result.result?.result?.value;
};

const navigate = async (path, settle = 3500) => {
  await send("Page.navigate", { url: `${BASE}${path}` });
  await new Promise((resolve) => setTimeout(resolve, settle));
};

/**
 * Poll a page expression until it is truthy, or give up.
 *
 * Every page here reads a live upstream API, so a fixed sleep measures how fast
 * the association's server answered, not whether the page works. A runner in
 * Virginia took longer than 3.5 s to fill the team-league table and the check
 * failed on a page that renders correctly. The assertion is unchanged; only the
 * moment it is read moved.
 */
const waitFor = async (expression, timeout = 25_000) => {
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline) {
    last = await evaluate(expression);
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return last;
};

const viewport = (width, height, mobile) =>
  send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });

const results = [];
const check = (name, pass, detail) => {
  results.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

await send("Page.enable");
await send("Runtime.enable");
await viewport(1440, 1000, false);

await navigate("/rankings");
const before = await waitFor(`
  [...document.querySelectorAll('table.stat-table tbody tr')].slice(0, 3)
    .map(row => row.querySelectorAll('td')[1]?.textContent.trim())
`);
const clicked = await evaluate(`
  (() => {
    const other = [...document.querySelectorAll('button[aria-pressed]')]
      .find(chip => chip.getAttribute('aria-pressed') === 'false');
    if (!other) return false;
    other.click();
    return other.textContent.trim();
  })()
`);
await new Promise((resolve) => setTimeout(resolve, 700));
const after = await evaluate(`
  [...document.querySelectorAll('table.stat-table tbody tr')].slice(0, 3)
    .map(row => row.querySelectorAll('td')[1]?.textContent.trim())
`);
check(
  "sorting a column reorders the table",
  clicked !== false && JSON.stringify(before) !== JSON.stringify(after),
  `${clicked}: ${before?.[0]} -> ${after?.[0]}`,
);

await navigate("/rankings");
const target = await evaluate(`
  (() => {
    const cell = document.querySelector('table.stat-table tbody tr').querySelectorAll('td')[3];
    const box = cell.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  })()
`);
for (const type of ["mousePressed", "mouseReleased"]) {
  await send("Input.dispatchMouseEvent", { type, x: target.x, y: target.y, button: "left", clickCount: 1 });
}
await new Promise((resolve) => setTimeout(resolve, 3000));
const path = await evaluate("location.pathname");
check("clicking a non-link cell opens the detail page", /^\/players\//.test(path ?? ""), path);

await navigate("/");
await evaluate(`document.querySelector('input[role="combobox"]').focus()`);
await new Promise((resolve) => setTimeout(resolve, 1800));
for (const character of "gayoung") {
  await send("Input.dispatchKeyEvent", { type: "char", text: character });
  await new Promise((resolve) => setTimeout(resolve, 60));
}
await new Promise((resolve) => setTimeout(resolve, 1200));
const options = await evaluate(`
  [...document.querySelectorAll('[role="option"]')].map(o => o.textContent.replace(/\\s+/g, ' ').trim()).slice(0, 3)
`);
check("header search suggests players", Array.isArray(options) && options.length > 0, options?.[0]);
check("search ignores the hyphen in a name", /Ga-young KIM/i.test(options?.[0] ?? ""), options?.[0]);

await navigate("/teams/players");
const teamLinks = await waitFor(
  `document.querySelectorAll('table.stat-table tbody tr a[href^="/players/"]').length || 0`,
);
check("team league rows link to player profiles", teamLinks > 0, `${teamLinks} links`);

// A match card is the deepest view on the site: sets, then every turn.
await navigate("/matches/98885?tour=271&seq=tour2026051210390860&round=Final", 6000);
const setPanels = await waitFor(`document.querySelectorAll('section[id^="set-"]').length || 0`);
check("a match card renders a panel per set", setPanels >= 5, `${setPanels} sets`);

const turnRows = await waitFor(`
  [...document.querySelectorAll('section[id^="set-"] table tbody')]
    .reduce((total, body) => total + body.querySelectorAll('tr').length, 0)
`);
check("every set publishes its turn-by-turn rows", turnRows > 50, `${turnRows} turns`);

const cardScore = await evaluate(`document.querySelector('dl dd .tnum')?.textContent?.trim()`);
check("the card leads with the sets won", /\d/.test(cardScore ?? ""), cardScore);

// The event page is the only route into a card that a person can find by clicking.
await navigate("/schedule/tour2026051210390860", 8000);
const cardLinks = await waitFor(`document.querySelectorAll('a[href^="/matches/"]').length || 0`);
check("an event page links every drawn match to its card", cardLinks > 20, `${cardLinks} cards`);

// The period-stats table is the widest stats surface on the site.
await navigate("/records?stat=bankShotRate", 5000);
const periodRows = await waitFor(`
  [...document.querySelectorAll('table')]
    .some(table => table.querySelectorAll('tbody tr').length > 10)
`);
check("the season form table ranks more than ten players", periodRows === true, String(periodRows));

await viewport(390, 844, true);
for (const route of [
  "/",
  "/players",
  "/rankings",
  "/teams",
  "/teams/players",
  "/players/M0017111",
  "/records",
  "/matches/98885",
  "/schedule/tour2026051210390860",
]) {
  await navigate(route, 5000);
  const overflow = await evaluate(`
    (() => {
      document.documentElement.style.overflowX = 'visible';
      document.body.style.overflowX = 'visible';
      return {
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      };
    })()
  `);
  check(
    `no horizontal overflow at 390px on ${route}`,
    overflow.scroll <= overflow.client + 1,
    `${overflow.scroll}/${overflow.client}`,
  );
}

ws.close();
const failed = results.filter((pass) => !pass).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
stopBrowser();
process.exit(failed === 0 ? 0 : 1);
