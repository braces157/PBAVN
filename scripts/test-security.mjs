import assert from "node:assert/strict";
import { sanitizeCmsHtml } from "../src/lib/sanitize.ts";
import { eventArtUrl } from "../src/lib/event-art.ts";
import {
  clockLabel,
  daysUntil,
  parseIsoDay,
  safeHttpUrl,
  youtubeEmbed,
  youtubeWatchUrl,
} from "../src/lib/format.ts";
import { setsWon } from "../src/lib/match.ts";
import { detectNewsCategory } from "../src/lib/news.ts";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

check("sanitizeCmsHtml strips nested script reconstruction", () => {
  const out = sanitizeCmsHtml("<scr<script>ipt>alert(1)</scr</script>ipt><p>Safe</p>");
  assert.equal(out.toLowerCase().includes("<script"), false);
  assert.equal(out.includes("Safe"), true);
});

check("sanitizeCmsHtml strips svg, slash-separated event handlers, and javascript URIs", () => {
  const out = sanitizeCmsHtml(
    `<svg onload="alert(1)"><foreignObject><script>1</script></foreignObject></svg>` +
      `<img/onerror=alert(1) src="https://pbatour.org/resources/upload/board/press/202611/a.jpg">` +
      `<a href=javascript:alert(1)>bad</a>`,
  );
  assert.equal(/<svg/i.test(out), false);
  assert.equal(/onerror/i.test(out), false);
  assert.equal(/javascript:/i.test(out), false);
  assert.equal(out.includes("/api/photo?src=%2Fboard%2Fpress%2F202611%2Fa.jpg"), true);
  // Idempotence: sanitizing twice must never prepend pbatour.org onto /api/photo
  const twice = sanitizeCmsHtml(out);
  assert.equal(twice.includes("pbatour.org/api/photo"), false);
  assert.equal(twice.includes("/api/photo?src=%2Fboard%2Fpress%2F202611%2Fa.jpg"), true);
});

check("youtubeWatchUrl blocks javascript: and spoofed hostnames", () => {
  assert.equal(youtubeWatchUrl("javascript:alert(1)//youtu.be/abcdef12345"), null);
  assert.equal(youtubeWatchUrl("https://evil.example/?x=youtu.be/abcdef12345"), null);
  assert.equal(youtubeEmbed("https://evil.example/youtube.com/watch?v=abcdef12345"), null);
  assert.equal(
    youtubeWatchUrl("https://youtu.be/dQw4w9WgXcQ?t=10"),
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
  assert.equal(
    youtubeWatchUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123"),
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
});

check("safeHttpUrl rejects non-http protocols", () => {
  assert.equal(safeHttpUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpUrl("data:text/html,<script>1</script>"), null);
  assert.equal(safeHttpUrl("https://www.pbatour.org/en/index"), "https://www.pbatour.org/en/index");
});

check("parseIsoDay rejects rolled-over calendar dates", () => {
  assert.equal(parseIsoDay("2026-02-31"), null);
  assert.equal(parseIsoDay("2026-99-99"), null);
  assert.notEqual(parseIsoDay("2026-11-19"), null);
});

check("daysUntil anchors to KST midnight even during 00:00-08:59 KST (prev UTC day)", () => {
  // 2026-11-18T17:00:00Z is 2026-11-19 02:00:00 KST.
  const utcEveningKstMorning = new Date("2026-11-18T17:00:00Z");
  assert.equal(daysUntil("2026-11-19", utcEveningKstMorning), 0);
  assert.equal(daysUntil("2026-11-20", utcEveningKstMorning), 1);
  assert.equal(daysUntil("2026-11-18", utcEveningKstMorning), -1);
});

check("clockLabel extracts HH:MM even when seconds are present", () => {
  assert.equal(clockLabel("2026-11-19 18:30:45"), "18:30");
  assert.equal(clockLabel("2026-11-19 9:05"), "09:05");
});

check("setsWon keeps zero for a swept player", () => {
  const sweepBySecond = [1, 2, 3].map((setNo) => ({
    setNo,
    pcgmCode: String(setNo),
    gameType: "15",
    playedOn: null,
    players: [
      { name: "A", points: 10, innings: 8, average: 1.25, highRun: 3, won: false },
      { name: "B", points: 15, innings: 8, average: 1.875, highRun: 5, won: true },
    ],
  }));
  assert.deepEqual(setsWon(sweepBySecond), [0, 3]);
});

check("detectNewsCategory does not misclassify 'teammate' as Team League", () => {
  assert.equal(detectNewsCategory("LPBA champion thanks teammate after victory").label, "LPBA");
  assert.equal(detectNewsCategory("PBA Team League Round 3 opens in Goyang").label, "Team League");
});

check("image proxy rewrites skip single-dot and parent traversal segments", () => {
  const dotImg = `<img src="https://pbatour.org/resources/upload/board/./press/a.jpg" alt="">`;
  const dotDotImg = `<img src="https://pbatour.org/resources/upload/board/../secret/a.jpg" alt="">`;
  assert.equal(sanitizeCmsHtml(dotImg).includes("/api/photo"), false);
  assert.equal(sanitizeCmsHtml(dotDotImg).includes("/api/photo"), false);

  assert.equal(
    eventArtUrl("https://pbatour.org/resources/upload/board/press/a.jpg", 768),
    "/api/photo?src=%2Fboard%2Fpress%2Fa.jpg&w=768",
  );
  assert.equal(
    eventArtUrl("https://pbatour.org/resources/upload/board/./press/a.jpg", 768),
    "https://pbatour.org/resources/upload/board/./press/a.jpg",
  );
  assert.equal(
    eventArtUrl("https://pbatour.org/resources/upload/board/../secret/a.jpg", 768),
    "https://pbatour.org/resources/upload/board/../secret/a.jpg",
  );
});

console.log(`\n${passed}/${passed} security & regression checks passed`);
