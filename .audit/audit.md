# PBA Hub — audit

Audited: the whole of `src/` (61 files at the end of the pass, 56 of them `.ts`/`.tsx` — including the eleven that were written or rewritten while I was reading, see *Note on a moving tree*), plus `package.json`, `next.config.ts`, `tsconfig.json`, `README.md`, `CONTRIBUTING.md`, `DEPLOY.md`, `.github/workflows/ci.yml`, `scripts/verify-interactions.mjs`, `scripts/refresh-data.mjs`, `scripts/shot.mjs`.

Nothing under `src/` was modified. No git commands that change state were run.

Every finding below quotes the offending line and names its file and line number. Findings marked **(unconfirmed)** state exactly what would settle them; everything else is provable by reading the code as committed.

---

## Note on a moving tree

Eleven files did not exist when I listed `src/` at 12:55 and were written or rewritten while this audit was running:

| File | Written |
|---|---|
| `src/lib/pba/scoreboard.ts` | 12:57, rewritten 13:03 |
| `src/lib/pba/scoreboard-parse.ts` | 12:58, rewritten 13:02 |
| `src/lib/match.ts` | 13:00, rewritten 13:02 |
| `src/app/matches/[pstCode]/page.tsx` | 13:00 |
| `src/components/domain/match/inning-table.tsx` | 13:00 |
| `src/components/domain/match/match-summary.tsx` | 13:00 |
| `src/components/domain/match/progression-chart.tsx` | 13:00 |
| `src/components/domain/match/set-panel.tsx` | 13:00, rewritten 13:02 |
| `src/lib/pba/live.ts` | rewritten 13:03 |
| `src/components/domain/live-board.tsx` | rewritten 13:03 |

Everything else was stable. **§F reviews the 13:04 state** of this feature. Two of my conclusions changed while I was writing them, and I flag both rather than quietly dropping them: at 13:00 the new `/matches/[pstCode]` route had no inbound link (finding 39) and the live board still rendered raw text lines; by 13:03 `live-board.tsx` was rewritten to render structured matches with a link to the card, so 39 was fixed mid-audit. The two new match tables are also the only ones in the codebase that use `scope` and `<caption>` (finding 25 is scoped accordingly). If you are reading this after further edits, re-check §F first — it is the only section describing code that was still moving.

---

## Findings

### 1. Blocker — the "partial data" notice is dead on 9 of 15 routes, so an unreachable upstream renders as a confident empty state

`src/lib/pba/failures.ts:62`

```ts
  active.getStore()?.push(url);
```

`recordFailure()` only records anything while the current async context is inside a `trackFailures(...)` run. Outside one, `getStore()` returns `undefined` and the failure is silently discarded. Only `/rankings`, `/records` and `/teams` call `trackFailures` (`rankings/page.tsx:40`, `records/page.tsx:38`, `teams/page.tsx:28,54`). `DataStatus` therefore reads an empty array on every other page:

`src/components/site/data-status.tsx:10`
```ts
  const failures = provided ?? getRequestFailures();
```

and `getRequestFailures()` returns `[]` because `active.getStore() ?? []` (`failures.ts:65-68`). `/` , `/players`, `/players/[memCode]`, `/live`, `/schedule`, `/schedule/[seq]`, `/compare`, `/news`, `/teams/players`, `/teams/[code]` all render an ordinary empty state when the association's service times out. Concretely, `players/[memCode]/page.tsx:242-247` prints **"No recorded statistics — This player has no PBA League match data logged for the selected season"** for a player who simply could not be reached, and the site's own README admits this (`README.md:252-255`) while `DEPLOY.md:101` claims the opposite ("The data-status component shows one when upstream calls fail… on `/`").

*Why it matters:* the product's whole claim is "what is shown is real; what is absent may simply be unreachable" (`data-status.tsx:27`). When the banner cannot fire, the site states a falsehood about a player, a season, or the calendar — the exact failure mode the module was written to prevent.

*Fix:* make `failures` a **required** prop on `PageHeader` (`filter-bar.tsx:75-88`) so the type system forces every page to thread a request-scoped record, and wrap each page's data reads in `trackFailures` the way `rankings/page.tsx:40-46` already does. Then distinguish the two empty states: `EmptyState` when `failures.length === 0`, an "unavailable, cannot confirm" variant when it is not.

---

### 2. Blocker — when the season feed fails, the app invents a season and labels every page with it

`src/lib/pba/service.ts:26`

```ts
  return seasons.length > 0 ? seasons : [{ SeasonCode: "2026", SeasonTitle: "2026-2027" }];
```

`getSeasonList` is the root of `getCurrentSeason` → every page's default season. If `/tournament/schedule/ajax/season` fails, the app does not degrade: it substitutes a hard-coded season and then queries tournaments, rankings, statistics and leaders **for that invented code**. `/schedule/page.tsx:48` prints "2026-2027 — 0 events across the PBA, LPBA, Dream, Challenge and Team League circuits", `/players/page.tsx:107` prints "0 players registered on this circuit for 2026-2027", and the player profile filters its season statistics by `2026`. The value is also a time bomb: in the 2027-28 season, a failed feed will claim the current season is 2026-2027.

*Why it matters:* this is not a missing value, it is a fabricated one, printed with the same confidence as a real one — and it silently changes which season's numbers the whole site reports.

*Fix:* return `[]` and let the caller render "the season list is unreachable"; if a fallback is genuinely needed for offline demos, gate it behind the existing `PBA_OFFLINE` flag in `http.ts:27` so it can never fire in production.

---

### 3. High — a completed event's card labels last season's winner as this season's champion

`src/components/domain/event-card.tsx:63-69`

```tsx
              {event.status === "completed" ? "Champion" : "Prize pool"}
…
              {event.status === "completed" && !isPlaceholder(event.defendingChampion)
                ? event.defendingChampion
                : event.prizePool}
```

The value is `defendingChampion`, normalised from `PREV_WINNER_NAME` (`normalize.ts:109`) — the *previous* edition's winner. `schedule/[seq]/page.tsx:55` labels the same field correctly as "Defending champion". So on the home hero and on `/live`, the 2026 final shows "Champion: <the 2025 winner>".

*Why it matters:* it is a wrong name attached to a right label — the most damaging kind of error on a results site, and one a fan will notice immediately.

*Fix:* on a completed event label the field "Defending champion" (matching the detail page), or drop it and show the prize pool. Real champions come from `/service/ajax/tour/getTourList`'s `우승자`, which the codebase already resolves to English in `/records` and `/live` "Recent finals".

---

### 4. High — the head-to-head "Bank shot" row is actually the 2-point conversion rate

`src/app/compare/page.tsx:168`

```tsx
                        ["Bank shot", h2h.player1_2point_rate, h2h.player2_2point_rate, "pct"],
```

`player1_2point_rate` is the success rate of two-point attempts. `RawHeadToHead` has no bank-shot field at all (`types.ts:489-540`), so the row cannot be computed from this feed.

*Why it matters:* two-pointers and bank shots are different skills in 3-cushion; a fan comparing two players is being told the wrong thing about both, in a comparison table whose only job is accuracy.

*Fix:* either relabel it "2-point rate" and add the attempt/conversion counts that sit unused beside it (`player1_2point`, `player1_total_attempts`), or remove the row and take bank-shot rate from `/stats/service/season` (`뱅크샷비율`), which the player profile already displays.

---

### 5. High — `/compare` computes one `pbaType` from player one and uses it for player two and the head-to-head

`src/app/compare/page.tsx:59-65`

```ts
  const pbaType = playerA?.league?.startsWith("LPBA") ? "LPBA1" : playerA?.league || "PBA1";
…
    codeB ? getPlayerSeasonStats({ memCode: codeB, seasonCode, pbaType }) : null,
    codeA && codeB ? getHeadToHead({ memberCode1: codeA, memberCode2: codeB, seasonCode, pbaType }) : null,
```

`pbaType` is passed to **both** season-stat requests and to the head-to-head request. Compare a PBA1 player with an LPBA1 player and player two's statistics are requested from the men's table.

*Why it matters:* the comparison silently returns empty or wrong rows for the second player, and the page then renders "—" for every metric on that side while showing the two players as a legitimate pairing. The page also offers no circuit guard at all.

*Fix:* derive the type per player (`typeFor(player)` reusing `statLeagueCode()` from `players/[memCode]/page.tsx:46-50`) and refuse the cross-circuit case with a clear empty state, since the upstream head-to-head endpoint is single-circuit.

---

### 6. High — the player profile asserts "no match data" when its five feeds are down

`src/app/players/[memCode]/page.tsx:77-78`, `:242-247`

```ts
  const line = normalizePlayerStat(seasonStat);
  const hasData = hasStatData(line);
…
              <EmptyState
                title="No recorded statistics"
                description={`This player has no ${league.name} match data logged for the selected season. Try an earlier season above.`}
```

`normalizePlayerStat(null)` returns `EMPTY_STAT` (`normalize.ts:268`), and `hasStatData` (`normalize.ts:307-309`) is false for it. A transport failure on `season`, `tour`, `champion`, `rank` or `rank/total` — five calls in `Promise.all` at `:69-75` — collapses to "this player has no data", with the advice to try an earlier season, which will also fail.

*Why it matters:* the page actively misinforms about a named professional, and the suggested remedy cannot work.

*Fix:* thread the failure record (finding 1) and render "Statistics unavailable" with a retry when `failures.length > 0`, reserving the "no recorded statistics" copy for a live feed that returned an empty row.

---

### 7. High — the live board cannot tell "no match in play" from "the scoreboard is unreachable", and says "idle" for both

`src/lib/pba/live.ts:94-100`

```ts
  return {
    available: board.refs.length > 0,
    matches,
    lines: board.lines.slice(0, 40),
```

`getLiveBoard` returns `{ refs: [], lines: [] }` for a failed fragment (`scoreboard.ts:93-98` → `parseLiveBoard(null)` → `[]`, `visibleLines(null)` → `[]`), so `available` is false and `lines` is empty — identical to the genuine idle case the module's docstring is built around. `/api/live/route.ts:13` returns HTTP 200 with that payload, and `live-board.tsx:172-182` prints:

> "The association's scoreboard reports no table in play. This panel refreshes every 20 seconds and will show the score, the set and a broadcast link as soon as a match goes live."

Worse, when a *poll* fails the client keeps the previous feed and logs nothing (`live-board.tsx:103-107`), so a board that was live silently freezes behind an "Updated hh:mm:ss" timestamp that stops changing.

*Why it matters:* the front page advertises "Live pbatour.org data" and the match centre's entire promise is "reports idle rather than guessing" (`about/page.tsx:152-153`). At present it guesses, in the affirmative, on every outage.

*Fix:* give `LiveFeed` a third state (`status: "live" | "idle" | "unreachable"`) set from whether the fragment call returned null, surface it in `LiveBoard` (grey "Scoreboard unreachable — last checked HH:MM"), and count a failed poll as a stale timestamp rather than silence.

---

### 8. High — the live poller is sent a team-league *round* code in a parameter the scoreboard calls `TourCode`

`src/app/live/page.tsx:86-89`

```tsx
            <LiveBoard
              initial={feed}
              tourCode={teamSeason?.liveRound ? String(teamSeason.liveRound.라운드코드) : undefined}
            />
```

`getLiveFeed`/`getLiveBoard` put that value into `live_info.asp?TourCode=` (`scoreboard.ts:93-97`), whose identifier space is tournament `SEQ`/`MATCH_CODE` (`types.ts:64`, `service.ts:144`). A round code is a different key entirely (`RawTeamRound.라운드코드`). Two consequences follow from the code alone: (a) the server renders the feed with **no** `TourCode` (`live/page.tsx:40` calls `getLiveFeed()` bare) while the first client poll asks for a round code — so the panel's content changes for a reason no user can see; (b) the query is wrong if upstream filters on it. (Line numbers for `live.ts` in this finding refer to the 13:00 revision; it was rewritten at 13:03 and now delegates to `getLiveBoard` at `live.ts:78`.)

*Why it matters:* the one live surface is querying an identifier it does not have, and the SSR output and the polled output are not the same request. *(unconfirmed: what upstream returns for a round code — only an observed response confirms it, but the parameter mismatch is provable from the types.)*

*Fix:* pass the current event's `SEQ` (`snapshot.current?.id`) — the id the rest of the app already uses for `/schedule/[seq]` — and use the same value for the SSR call.

---

### 9. Medium-high — `num()` turns every placeholder string into a real zero, and `grouped()` prints it

`src/lib/format.ts:72-76`

```ts
export function num(value: number | string | null | undefined, fallback = 0): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}
```

`num("tbd")` → `String("tbd").replace(…, "")` → `""` → `Number("")` → `0` → `Number.isFinite(0)` → returns **0**, not the fallback. Same for `"-"`, `"미정"`, `"N/A"`, `"—"`. `int()` inherits it, and `grouped()`/`won()`/`percent()` (`:112-128`) then render "0" (or "—", because they special-case zero — so the two failures look different but are equally wrong).

Live example: `players/[memCode]/page.tsx:344` renders `grouped(careerRank.참가횟수)`; a missing field prints "0" under "Events entered". `teams/page.tsx:203-205` prints "0W 0L · 0 pts" for a club whose row arrived without numbers. `normalizeEvent` counts entrants the same way (`normalize.ts:114-115`), except it guards with `isPlaceholder` first — the guard exists in one place and not in the shared parser.

*Why it matters:* it is the single mechanism by which this codebase prints "0" where "unknown" belongs, and it sits in the function every page calls.

*Fix:* in `num`, strip first and return `fallback` when the stripped string is empty or unparseable:

```ts
const stripped = String(value).replace(/[^0-9.-]/g, "");
if (!stripped) return fallback;
const parsed = Number(stripped);
return Number.isFinite(parsed) ? parsed : fallback;
```

and have the numeric formatters distinguish "no data" (`null`) from zero, which means `normalize.ts` should preserve `null` rather than coercing to `0`.

---

### 10. Medium — the rankings table sorts a formatted currency string, so the money column can be ordered wrongly

`src/components/domain/ranking-table.tsx:53-54`

```ts
      prize: money(row.Prize),
      points: row.RankingPoint ? row.RankingPoint.toLocaleString("en-US") : "—",
```

`DataTable.compareValues` only subtracts when both values are numbers (`data-table.tsx:78-81`); these cells are strings, so the comparison falls through to `localeCompare`. `money()` emits mixed units — `₩1.2B`, `₩216.0M`, `₩150K` (`ranking-table.tsx:13-20`) — and under numeric collation `"₩1.2B"` sorts *below* `"₩216.0M"`, so in a descending sort the largest prize lands at the bottom. The default view of `/rankings` and of both home-page panels is exactly this sort (`ranking-table.tsx:84`). The moment one value crosses a unit boundary the leaderboard is wrong.

*Why it matters:* the primary ranked table on the site re-orders the leader's prize money below a smaller one, and nothing in the UI signals it.

*Fix:* pass numbers for numeric columns and format in `Cell` (`data-table.tsx:86` already does `value.toLocaleString`), i.e. `prize: row.Prize`, and let the column's `numeric` flag drive currency formatting. Same fix applies to `teams/players/page.tsx:65-71`, which passes `average()`/`percent()` strings into sortable columns.

---

### 11. Medium — the directory search silently refuses queries shorter than three characters, and the header typeahead accepts two

`src/app/players/page.tsx:41-43`
```ts
  const term = squeeze(query);
  if (term.length < 3) return [];
```
`src/components/ui/player-search.tsx:33`
```ts
  if (needle.length < 2) return [];
```

Search for "Ki" in the header and you get suggestions; press Enter (which routes to `/players?q=Ki`) and the page reports "0 players match 'Ki'" and "No players matched — try a different spelling" (`players/page.tsx:182-194`). The page never says the query was too short to run.

*Why it matters:* two surfaces of the same site disagree about whether a search happened, and the page's empty state asserts a negative result it never computed.

*Fix:* share one `MIN_QUERY_LENGTH` and, when the term is under it, render "Type at least N characters" instead of an empty result set.

---

### 12. Medium — `/players?q=` pulls the entire 2,000-row directory into the request path, on every cold cache

`src/app/players/page.tsx:70-71`

```ts
  if (query) {
    const directory = await getPlayers({ page: 1, pageSize: 2000 });
```

The README describes this payload as "783 KB and takes about 8 seconds cold" (`README.md:147-148`), and `getPlayers` sets `timeoutMs: 20_000` (`api.ts:131`). So the first search after every cache window is an 8-second, 783 KB fetch on the request path — and `/api/search-index/route.ts:26` does the same for the header index.

*Why it matters:* a single search can hold a request open for twenty seconds and block the event loop while parsing, for a result set that is filtered in memory anyway.

*Fix:* the search index is already a frozen artefact pattern (`src/lib/pba/data/*.json`, refreshed by `scripts/refresh-data.mjs`). Add a committed `player-index.json` and search that; if it must stay live, put it behind a `cache()`-wrapped module function so `/players` and `/api/search-index` share one fetch instead of two, and lower `pageSize` to what the filter needs.

---

### 13. Medium — the schedule's four headline counters mix filtered and unfiltered scopes

`src/app/schedule/page.tsx:80-89`

```tsx
            <Stat label="Events" value={grouped(allEvents.length)} />
…
            <Stat label="On now" value={grouped(snapshot.live.length)} accent={snapshot.live.length > 0} />
            <Stat label="Upcoming" value={grouped(snapshot.upcoming.length)} />
            <Stat label="Completed" value={grouped(snapshot.completed.length)} />
```

`allEvents` is everything for the season; `snapshot` is `getSeasonSnapshot(seasonCode)` over the *unfiltered* list (`:33`), while the list below is filtered by circuit (`:32`). With `?league=LPBA1` selected the tiles read "Events 42 / On now 1 / Upcoming 19 / Completed 22" for a list that contains eight rows, and the counts do not add up to the first tile.

*Why it matters:* four numbers side by side that cannot be reconciled undermine every other number on the page.

*Fix:* compute the three status counts from `events` (the filtered array, already in hand at `:35-39`), and keep `allEvents.length` only as the label on the circuit filter, where it is already used as a count (`:66`).

---

### 14. Medium — the event detail page passes `SEASON_GUBUN` where every other call site passes `SeasonCode`

`src/app/schedule/[seq]/page.tsx:38-39`

```ts
  const siblings = (await getTournaments({ season: event.season, leagueCode: event.league }))
```

`event.season` is `raw.SEASON_GUBUN` (`normalize.ts:101`), whereas `getSeasonEvents`/`/schedule` pass `RawSeason.SeasonCode` (`service.ts:40-41`, `schedule/page.tsx:25-29`). Both feed the same upstream `season` parameter, so at most one of the two is right; if `SEASON_GUBUN` is a label ("2026-2027") rather than a code ("2026"), the sibling query returns nothing and the page prints "This circuit has no other published events in this season" (`:213-215`) on every event.

*Why it matters:* either a false empty state on every event page, or a silently unused filter. *(unconfirmed which: one request to `/tournament/schedule/ajax/list?season=…&langCode=ko` with each value settles it.)*

*Fix:* carry the season code on the normalised `Event` (`normalizeEvent` already takes the raw row; add `seasonCode` from the `SeasonCode` the caller used) and use it for every downstream query.

---

### 15. Medium — a feed outage becomes a 404, telling visitors and crawlers the record does not exist

`src/app/players/[memCode]/page.tsx:61`, `schedule/[seq]/page.tsx:30`, `teams/[code]/page.tsx:52` + `:89`, `news/[seq]/page.tsx:30`

```ts
  if (!raw) notFound();
```

`getPlayer`, `getTournamentDetail`, `getPressDetail` and `resolveTeam` all return `null` for a transport failure as well as for a missing record (`api.ts:141-148`, `98-104`, `391-397`). `notFound()` renders the "Off the table" page and Next serves HTTP 404.

*Why it matters:* a transient upstream outage de-indexes live pages and tells the reader the player never existed; the correct signal is 503/retry, not 404.

*Fix:* distinguish the two at the boundary — have `getPlayer` etc. return `{ ok: true, data } | { ok: false }` (or `undefined` for "not found" versus `null` for "failed") and call `notFound()` only for a confirmed miss, throwing for an outage so `error.tsx` handles it.

---

### 16. Medium — the player's age is computed from a UTC-parsed date and the current year only

`src/app/players/[memCode]/page.tsx:80`

```ts
  const age = player.birth ? new Date().getFullYear() - new Date(player.birth).getFullYear() : null;
```

`player.birth` is a `"YYYY-MM-DD"` slice (`normalize.ts:167`), which `new Date()` parses as **UTC** midnight; read back with `getFullYear()` in a negative-offset zone that moves to the previous year, and the subtraction ignores whether this year's birthday has passed — so a player born in December is shown a year older for most of the year.

*Why it matters:* a small but definite wrong number about a named person, rendered as "34 years old".

*Fix:* compare month/day as well (or format a birthday rather than an age). A `birthdayAge(iso: string, now: Date)` in `format.ts` also removes the second `new Date()` from the render path.

---

### 17. Medium — `toDate` silently drops the time component and treats unparseable strings as "no date"

`src/lib/format.ts:8-19`

```ts
  if (typeof value === "string") {
    const parsed = new Date(value);
…
  if (typeof value === "object" && "year" in value && "monthValue" in value) {
    return new Date(value.year, value.monthValue - 1, value.dayOfMonth ?? 1, 12, 0, 0);
```

`PbaDate` allows `hour`, `minute`, `second` (`types.ts:20-22`) and they are discarded — so no surface can ever show a session time, which is the one scheduling fact a fan most wants. The string branch relies on `Date`'s own parser: a `"2026.05.03"` or `"03/05/2026"` style value becomes `NaN` → `null` → "—" and the event sorts to the end of every list (`normalize.ts:126-130`).

The same type carries `MATCH_START_DATE_NAME` / `MATCH_END_DATE_NAME` (`types.ts:70-71`), which are exactly the human-readable strings the CMS publishes *because* the date object is awkward — both are declared and never read anywhere in `src/`.

*Why it matters:* undated events lose their position in the calendar and their date display, and any published match time is dropped without a trace. *(unconfirmed: whether upstream ever sends a non-ISO string — one dump of `/tournament/schedule/ajax/list` settles it; the unused `*_NAME` fields are a fact regardless.)*

*Fix:* parse `"Y.M.D"`/`"Y-M-D"` explicitly, use `hour`/`minute` when present, and fall back to `MATCH_START_DATE_NAME` before giving up.

---

### 18. Medium — `winRate()` counts draws in the denominator, so it disagrees with the association's own win rate

`src/lib/normalize.ts:185-189`

```ts
export function winRate(p: { wins: number; losses: number; draws?: number }): number {
  const total = p.wins + p.losses + (p.draws ?? 0);
  if (!total) return 0;
  return (p.wins / total) * 100;
}
```

The label is "Win%" / "win rate" (`players/page.tsx:295-296`, `players/[memCode]:156`, `compare:323`). In a round-robin team-league season a 5W-0L-5D record reads 50%, while the upstream `승률` field — displayed on the same site as the season win rate (`players/[memCode]:202`) — reads 100%.

*Why it matters:* two numbers labelled "win rate" for the same player, from two definitions, on two pages.

*Fix:* either divide by `wins + losses` and label draws separately, or use the upstream `승률` everywhere and delete the local function.

---

### 19. Medium — event status is computed against the server's local "today", with no timezone pinned

`src/lib/normalize.ts:78-92`

```ts
export function eventStatus(start: Date | null, end: Date | null, now = new Date()): EventStatus {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
```

The PBA calendar is Korean; the server is UTC (Vercel's `icn1`/`iad1`, `DEPLOY.md:66-69`). Between 00:00 and 09:00 KST the UTC calendar day is still yesterday, so an event that started today in Seoul is not yet "On now", and one that finished yesterday is still "On now". The same assumption runs through `daysUntil` and `dayCount` (`format.ts:57-68`).

*Why it matters:* the "On now" chip, the home hero and the "In N days" countdown are the parts of the site a fan checks live, and they are wrong for nine hours a day.

*Fix:* compute the day boundary in `Asia/Seoul` once (`Intl.DateTimeFormat` with `timeZone`), and pass that date into `eventStatus`/`daysUntil` instead of `new Date()`.

---

### 20. Medium — `photo` proxy walks up to five upstream candidates serially per image and empties its whole cache when full

`src/app/api/photo/route.ts:105-120`

```ts
  const candidates = ancestorsOf(src);
  for (const candidate of candidates) {
    const asset = await fetchBinary(`https://pbatour.org/resources/upload${candidate}`);
    if (!asset) continue;
…
    if (rendered.size >= RESULT_CACHE_LIMIT) rendered.clear();
```

`ancestorsOf` returns up to five paths (`:56-71`), each a full TLS-broken HTTPS round trip with a 15 s timeout (`http.ts:295`), executed one after another. About half the roster has no photo on file (`README.md:164-165`), so a 48-card page can spend minutes in sequential round trips that all 404 — and the 404 itself is only cached client-side for 10 minutes (`:122-125`). When the 400-entry map fills, `clear()` drops everything, so the next page repopulates from scratch (a cache stampede, not an eviction).

*Why it matters:* `/players` is the most-linked page on the site; the photo proxy is on its critical path and is the slowest possible implementation of it.

*Fix:* fire the candidates with `Promise.race`-style parallel probes (or `Promise.all` with a first-success short-circuit), cache negative results for the same TTL as hits, and evict oldest-first instead of `clear()`.

---

### 21. Medium — the binary cache keeps full-size originals in memory and only ever resets wholesale

`src/lib/pba/http.ts:299-304`

```ts
    const asset: BinaryAsset = { body: result.body, contentType: result.contentType };
    if (binaryCache.size > 600) binaryCache.clear();
    binaryCache.set(url, { … });
```

Entries are the untouched upstream files (~110 KB each, per `DEPLOY.md:38`), keyed by URL, so the ceiling is roughly 600 × 110 KB ≈ 66 MB of resident Buffers per instance before anything is reclaimed — and `clear()` throws away every still-valid entry at once. `fallbackCache` (`:108-115`) has the same shape with a different threshold, and `rendered` in the photo route a third.

*Why it matters:* on a 1 GB function (Vercel Hobby), three unbounded-ish image/JSON caches plus the Next cache compete for the same memory, and the failure mode is an OOM, not a slow page.

*Fix:* one small LRU with a byte budget shared by both caches (`Map` insertion order is already being used as a proxy), and drop the `clear()` calls.

---

### 22. Medium — the failure record needs Node 22.3 while the docs promise Node 20.9, and its fallback is a process-global array

`src/lib/pba/failures.ts:32-44`

```ts
    const loader = new Function("m", "return import(m)") as (m: string) => Promise<never>;
    void loader;
    const mod = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process
      ?.getBuiltinModule?.("node:async_hooks") as { AsyncLocalStorage?: new () => Store } | undefined;
…
let fallback: string[] = [];
```

`process.getBuiltinModule` landed in Node 22.3 (`README.md:29` and `CONTRIBUTING.md:10` both say 20.9+). On 20.x the store is `null` and every failure goes to the module-level `fallback` array: concurrent requests share it, so one visitor's outage shows another visitor a banner, and `recordFailure` from a non-tracked page appends forever (`:59`) — an unbounded array that never resets. The `loader` const is constructed and discarded (`void loader`) — dead code left from an earlier approach.

*Why it matters:* the one mechanism that keeps the site honest degrades into a cross-request leak on the Node version the docs promise.

*Fix:* either raise the documented floor to 22.3, or obtain `AsyncLocalStorage` with a top-level `import { AsyncLocalStorage } from "node:async_hooks"` guarded by a `runtime === "nodejs"` check — and delete the `loader` lines.

---

### 23. Medium — `/news` fetches all three feeds on every request no matter which tab is open

`src/app/news/page.tsx:31-35`

```ts
  const [press, videos, galleries] = await Promise.all([
    getPressList(page, pageSize),
    getVideos(1, 12),
    getGalleries(1, 12),
  ]);
```

Two of the three results are discarded for any given `?tab=`. Each is a separate upstream call (`api.ts:379-413`) against a slow origin.

*Why it matters:* two wasted round trips on every newsroom view, and the tab counts (`:50-53`) are the only reason they exist.

*Fix:* fetch the active tab plus the two counts, or drop the counts and fetch only what is rendered.

---

### 24. Medium — sortable table headers are click-only, so the tables cannot be sorted from a keyboard

`src/components/ui/data-table.tsx:250-259`

```tsx
                    <th
…
                      aria-sort={active ? (sort?.direction === "desc" ? "descending" : "ascending") : undefined}
                      onClick={() => toggle(column)}
```

A `<th>` with `onClick` and no `tabIndex`, no `role="button"`, no `onKeyDown`. The `aria-sort` attribute is present but the element it describes is never focusable, and no keyboard equivalent exists for the click. (The separate "Sort" button bar at `:191-231` is reachable — but only when `columns.length > 2` and not `hideSortBar`, and it is a second, unrelated control set.)

*Why it matters:* `/rankings`, `/teams/players` and both home panels advertise column sorting; a keyboard or switch user cannot reach it, and screen-reader users are told a sort exists that they cannot operate.

*Fix:* put a `<button>` inside each `<th>` (`<button type="button" className="…w-full text-left">`) and keep `aria-sort` on the `<th>`. That is a three-line change and makes both the mouse and keyboard paths hit the same handler.

---

### 25. Medium — none of the older tables have `scope` on their headers or a `<caption>`

`src/components/ui/data-table.tsx:245,250`; `src/components/domain/standings-table.tsx:25-33`; `src/app/players/[memCode]/page.tsx:260-266`; `src/app/teams/page.tsx:224-231`; `src/app/records/page.tsx:168-171,208-210`; `src/app/compare/page.tsx:227-229`; `src/app/about/page.tsx:118-119` (a `<table>` with no `<thead>` at all).

Every `<th>` is bare, e.g. `standings-table.tsx:27` `<th>Pts</th>`. With visually-hidden columns (`hidden sm:table-cell`, `hidden md:table-cell`) the association between a cell and its header is already non-obvious on screen; without `scope` a screen reader has to guess, and the hidden headers vanish from the accessibility tree entirely on small viewports.

*Why it matters:* these tables are the product. A stat table a screen reader cannot linearise is unusable output, and the fix is one attribute per header.

*Fix:* `scope="col"` on every `<th>` in a `<thead>` row, plus a visually hidden `<caption>` naming the table ("LPBA prize-money standings, 2026 season"). For `about/page.tsx`, promote the endpoints list to a two-column table with a header row. The two tables written during this audit (`inning-table.tsx:29-35,76`, `match-summary.tsx:150-167`) already do all three correctly — copy that markup, it is the house style the rest should follow.

---

### 26. Medium — the header combobox has no `aria-activedescendant`, and `aria-controls` points at an element that does not exist while closed

`src/components/ui/player-search.tsx:169-171`

```tsx
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="player-search-results"
```

The listbox is only rendered inside `{showPanel && …}` (`:180`), so when the panel is closed `aria-controls` references a missing id (invalid ARIA). While open, focus stays in the `<input>` and the highlight is tracked in React state (`cursor`, `:131-134`) with no `aria-activedescendant`, so a screen-reader user hears nothing as they arrow through results; the `aria-selected` on each option (`:206`) is never announced because the option never receives focus or activedescendant status.

*Why it matters:* the ⌘K search is a headline feature (`README.md:189-191`); for assistive tech it is a text box that appears to do nothing on Enter.

*Fix:* `aria-activedescendant={showPanel ? `player-option-${cursor}` : undefined}` on the input, matching `id` on each option, and render the listbox container always (empty when closed) so `aria-controls` stays valid.

---

### 27. Medium — `/compare` encodes the winner in colour only

`src/app/compare/page.tsx:180-201`

```tsx
                                l > r ? "text-lime-400" : "text-fog-200",
…
                            <span className="bg-lime-400/70" style={{ width: `${leftPct}%` }} />
                            <span className="bg-rose-450/70" style={{ width: `${100 - leftPct}%` }} />
```

Which side is ahead is conveyed by lime versus grey text and by two coloured bars; there is no glyph, no text, and no `aria-label`. (The team head-to-head on `/teams/[code]:230-242` has the same pattern, though there the `3–1` digits carry the meaning.)

*Why it matters:* colour-vision deficiency is common in exactly the demographic that reads sports statistics; "who is winning this metric" is the page's only content.

*Fix:* add a non-colour cue (a ▲/▼ or bolder weight plus a visually hidden "ahead"/"behind"), and give each bar an accessible name.

---

### 28. Medium — CMS HTML is sanitised with a deny-list whose `javascript:` rule misses unquoted attributes

`src/lib/sanitize.ts:43`

```ts
  html = html.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"');
```

The pattern requires a quote after `=`. `<a href=javascript:alert(1)>` — valid HTML — passes untouched, as does `HREF = JavaScript:`. The surrounding approach is a tag *deny*-list (`:10-25`), which the module's own header calls "a conservative allow-list": `<svg>`, `<math>`, `<template>` and `srcdoc` are not considered, while `on\w+` stripping (`:39`) is regex-based. Upstream is the association's CMS rather than an open text box, so this is a hygiene problem, not a live hole.

*Why it matters:* the comment claims a guarantee the code does not provide, and one upstream CMS compromise — or one press body pasted from a third-party editor — becomes script execution on every visitor's session.

*Fix:* swap the regexes for a real sanitiser (`isomorphic-dompurify` with an explicit allow-list) or, minimum, add `(?:[^\s>]+|"[^"]*"|'[^']*')` to the URL rule and strip unquoted event handlers.

---

### 29. Medium — the same formatter is copy-pasted three times, and one of them disagrees with the others

`src/lib/format.ts:83-91` (`wonCompact`) vs `src/components/domain/ranking-table.tsx:13-20` (`money`) — byte-for-byte the same algorithm; `src/app/page.tsx:387-394` (`formatLeaderValue`) vs `src/app/records/page.tsx:240-247` (`formatValue`) — also identical.

The damage is not just duplication. `wonCompact` returns "—" for zero (`format.ts:85`), and so does `money` (`ranking-table.tsx:14`), which happens to mask finding 9 — a ranking row whose `Prize` is missing arrives as `0` from `num()` and renders "—" for the wrong reason. But `formatLeaderValue`/`formatValue` differ from the money pair in their handling of zeros and non-finite input (`page.tsx:388-390` returns the raw string for a non-number, `records/page.tsx:241-243` does the same), so the same upstream value can render three different ways depending on which page prints it. Any future edit to one copy diverges.

*Why it matters:* four pages currently render money and averages through five implementations of two ideas; the audit that follows a formatting bug has to find them all.

*Fix:* delete `money`, `formatLeaderValue` and `formatValue`; export one `metric(unit, value)` from `format.ts` and use it at all four call sites.

---

### 30. Low — dead exports, dead endpoints and a dead comment

- `api.ts:417` `getAwards` and `api.ts:430` `getHomeInfo` — never called anywhere in `src/` (`/award/ajax/tour` and `/ajax/info` are enumerated in `about/page.tsx:21-43` and `README.md:91` as things the site uses).
- `service.ts:29` `getLeagueList` — never called; `LEAGUES` in `normalize.ts:31-37` is the real source of circuit names.
- `api.ts:152-158` `RankingKind = "welcome"` and its path — never selected by any caller.
- `format.ts:101` `wonKorean`, `format.ts:171` `shortName`, `live.ts:38` `extractLines` (used only internally) — exported, never imported.
- `normalize.ts:118` `event.hasDetail` computed from `DETAIL_BTN_ACTIVE_YN`, never rendered; `normalize.ts:291-303` `ranks.*` is rendered for 9 of 11 fields.
- `@next/next/no-img-element` eslint-disable comments (`safe-image.tsx:41`, `news/page.tsx:139,147,190`, `data-table.tsx:118`) — there is no ESLint in the project (`package.json:6-12` has no lint step beyond `tsc`), so these suppress nothing.

*Fix:* delete them, or wire them up.

---

### 31. Low — `/records` hard-codes 15 of the leader categories while the README and the code both claim 26

`src/lib/normalize.ts:534-551`

```ts
/** The 26 `Category` values the season-leader feed reports. */
export const LEADER_CATEGORIES: { key: string; label: string; unit: "avg" | "int" | "pct" }[] = [
```

Fifteen entries follow; `README.md:59` repeats "26 categories". `records/page.tsx:52` filters with `LEADER_CATEGORIES.filter((category) => byCategory.has(category.key))`, so any category the feed publishes under a key not in this array is dropped without a word — including `승률` (win rate), which is the most obvious missing leaderboard. The page's own copy says "Categories the association does not publish for this circuit are omitted" (`:105`), which is the opposite of what the code does.

*Why it matters:* eleven-ish published categories are invisible, and the page explains their absence with a false statement.

*Fix:* drive the list from the feed — render `byCategory` in descending priority, with a small label map for translation — and keep `LEADER_CATEGORIES` only as an ordering/format hint.

---

### 32. Low — `getTourTitleIndex` maps `titleKo` to the English title

`src/lib/pba/service.ts:216-218`

```ts
  for (const [key, title] of Object.entries(tourTitles as Record<string, string>)) {
    if (title) index.set(key, { titleEn: title, titleKo: title, seq: key });
```

The committed artefact only holds `TITLE_EN` (`scripts/refresh-data.mjs:60-63`), so `titleKo` is always a copy of `titleEn`.

*Why it matters:* nothing renders `titleKo` today (finding 30), but the type promises a Korean title that does not exist — the next feature that reaches for it will print English where Korean is expected.

*Fix:* make `titleKo` optional and omit it, or add the Korean title to the artefact.

---

### 33. Low — `/about` claims 22 upstream endpoints and lists 22, but the site calls more, and one of the 22 is never called

`src/app/about/page.tsx:66` `value="22"`; the `ENDPOINTS` array at `:20-43`.

Missing from the list although `api.ts` calls them: `/stats/ranking_prize/ajax/tourList` (`api.ts:191`), `/stats/service/rank`, `/stats/service/rank/total` (`api.ts:242,250`), `/teamLeague/stats/ajax/getTeamListBySeasonRound` (`api.ts:359`), `/media/gallery/ajax/list` (`api.ts:409`). Present in the list although nothing calls it: `/ajax/info` (`:21`).

*Why it matters:* `/about` is the page whose stated purpose is "exactly where every number on the site comes from" (`:9`), so an inaccurate inventory is a broken promise in the one place that makes it.

*Fix:* generate the table from `api.ts` (a single exported `ENDPOINTS` map consumed by both the transport and the page) so it cannot drift.

---

### 34. Low — prev/next pagination links have no accessible name and rely on `aria-disabled`

`src/components/ui/primitives.tsx:224-233`

```tsx
      <Link
        href={buildHref(Math.max(1, page - 1))}
        aria-disabled={page === 1}
```

The content is `←` / `→` (`:233`, `:279`), so the link's accessible name is "leftwards arrow". `aria-disabled` does not remove the link from the tab order, and the visual disabling is `pointer-events-none` plus opacity, so keyboard users can still focus and follow a "disabled" link.

*Fix:* `aria-label="Previous page"` / `"Next page"`, and render a `<span>` instead of a `<Link>` on the first/last page.

---

### 35. Low — filter groups are announced as loose text, not as labelled groups

`src/components/domain/filter-bar.tsx:44-47`

```tsx
      <span className="mr-1 text-[10.5px] font-semibold uppercase …">
        {label}
      </span>
```

The visible label ("Circuit", "Season", "Metric", "Event") is a `<span>` with no programmatic association to the links it heads. There are 13 such groups across seven pages (`README.md:256-258` counts them as a known hazard); a screen reader reads "Circuit" as body text, then fourteen unlabelled links.

*Fix:* `<fieldset><legend>` around the group (or `role="group" aria-labelledby`), which also gives the duplicate "PBA Tour / LPBA Tour" links a scope.

---

### 36. Low — sticky table headers slide under the sticky site header, and the rule meant to prevent it is a no-op

`src/app/globals.css:292-296` and `:308-311`

```css
.stat-table thead th {
  position: sticky;
  top: 0;
…
[data-sticky-table="true"] .stat-table thead th {
  top: 0;
}
```

Both rules set `top: 0`; the second can never change anything, despite its comment ("A table that scrolls inside its own box must not stick under the site header"). `SiteHeader` is `sticky top-0` with `h-16` (`site-header.tsx:42,48`), so on tables that are *not* inside a scroll box — `/teams` roster, `/records`, `/players/[memCode]` tour table, `/compare` — the header row sticks to the viewport top and disappears behind the site header.

*Fix:* `top: 4rem` for page-level tables, and leave `top: 0` only inside `[data-sticky-table="true"]` (or delete the second rule).

---

### 37. Low — `tsbuildinfo` and `next-env.d.ts` are gitignored but present, and `sharp` is declared as a hard dependency while the code treats it as optional

`package.json:18` `"sharp": "^0.35.5"` under `dependencies`, vs `api/photo/route.ts:73-85` which catches an import failure and serves the original; `DEPLOY.md:92-97` describes pinning the Linux native as follow-up work. There is no `engines` field despite `README.md:29` promising Node 20.9+ (see finding 22).

*Fix:* move `sharp` to `optionalDependencies`, add `"engines": { "node": ">=22.3" }` (or fix 22), and keep build artefacts out of the tree.

---

### 38. Low — seven silent `catch` blocks make a systematic upstream change invisible

`http.ts:251`, `http.ts:306`, `http.ts:323`, `failures.ts:37`, `photo/route.ts:81`, `live-board.tsx:103`, `player-search.tsx:83`.

Each is defensible individually — a failed fetch degrades to null — but together they mean a renamed JSON field, an expired certificate or a parse change produces a site that renders plausible empty states with no server-side signal at all.

*Fix:* one `console.warn` per catch with the URL and the error code (already available), or a single `recordFailure(url, error)` that also counts. The failure store is the natural place; it is currently only a list of strings.

---

## F. The match / scorecard feature (written 12:57–13:03, reviewed as it stands)

This is the most interesting code in the repository: `scoreboard-parse.ts` reads the legacy ASP fragments into pure data, `match.ts` derives per-inning turns, streaks and race targets, and `inning-table.tsx` / `progression-chart.tsx` / `set-panel.tsx` render a genuine turn-by-turn scorecard — the thing the tour API never exposed. It is also, as of 13:05, **unreachable**.

### 39. Resolved during the audit — `/matches/[pstCode]` had no entry point at 13:00

At 13:00, `grep -r "/matches" src/` returned no match: the route existed and nothing linked to it, and `getLiveBoard`/`parseLiveBoard` — the functions written to discover a live match's `PSTCode` — were called from nothing but their own definitions.

By 13:03 `live.ts` had been rewritten to call `getLiveBoard` → `getScorecard` per live match, and `live-board.tsx:10` now builds the entry point:

```tsx
  const cardHref = `/matches/${match.pstCode}${match.watchUrl ? `?watch=${encodeURIComponent(match.watchUrl)}` : ""}`;
```

Recorded here rather than deleted because it shows how the feature landed, and because one consequence remains open: the card is reachable *only* from `/live` while a match is on the board. Nothing links to a past match from `/schedule/[seq]`, `/players/[memCode]` or `/teams/[code]`, so every finished match card is still a dead end that no crawler will find and no fan can return to.

*Fix (still open):* link a completed event's fixtures and a player's recent matches to `/matches/[pstCode]`; add `/matches/*` for completed events to whatever sitemap gets built (finding on sitemap below).

### 40. High — the match page renders two `<h1>` elements with the same text

`src/app/matches/[pstCode]/page.tsx:125-127`

```tsx
      <PageHeader
        eyebrow="Match card"
        title={names.filter(Boolean).join(" vs ") || "Match"}
```

`PageHeader` renders that as `<h1 className="display-lg …">` (`filter-bar.tsx:99`), and then `MatchHeader` renders another:

`src/components/domain/match/match-summary.tsx:43`
```tsx
        <h1 id="match-title" className="display-md mt-2 text-fog-100">
          {names.filter(Boolean).join(" vs ") || "Match"}
```

Two `h1`s, same string, one inside the other's document order.

*Why it matters:* a screen-reader user gets the page title twice, and heading navigation becomes ambiguous on the one page whose whole structure is "match → set → inning".

*Fix:* make `MatchHeader`'s title an `<h2>` (the `aria-labelledby="match-title"` on its `<section>` keeps working), and delete either it or the `PageHeader` title.

### 41. Medium — a live match is labelled "Final" as soon as one set is published

`src/components/domain/match/match-summary.tsx:31`

```ts
  const decided = summary.setsWon.some((won) => won * 2 > analysed.length) && analysed.length > 0;
```

`analysed.length` is the number of sets *published so far*, not the match's format. With one set finished (1-0) the expression is `1 * 2 > 1` → true, and the chip renders `<Chip tone="gold">Final</Chip>` (`:39`). Any match whose scoreline is not level at any point is "Final".

*Why it matters:* a live match card says the match is over — the most consequential label on the page, and the same class of error as findings 3 and 7.

*Fix:* decide from the format, not from sets played: use `Math.ceil(maxSets / 2)` where `maxSets` comes from the set list's published total (or the round/tour metadata), and render "Live"/nothing otherwise.

### 42. Medium — unreadable cells become zero points in the inning table

`src/lib/pba/scoreboard-parse.ts:161-162` and `:249-251`

```ts
        points: toNumber(pointsAndInnings[1]) ?? 0,
        innings: toNumber(pointsAndInnings[2]) ?? 0,
…
        onePoint: toNumber(values[index]) ?? 0,
        twoPoint: toNumber(values[index + 1]) ?? 0,
        total: toNumber(values[index + 2]) ?? 0,
```

`toNumber` returns `null` for anything it cannot read (`:123-127`), and every caller coerces that to `0`. In `inning-table.tsx:94,109` a zero then renders as "—" (because `turn.empty` is `scored === 0`), so a *parse failure* is displayed as a *missed inning*. `player.average` and `player.highRun` are correctly left nullable one line below (`:163-164`), so the intent is already in the file.

*Why it matters:* a parser over legacy ASP markup will hit unreadable cells routinely, and this one cannot tell "the player missed" from "we could not read the cell" — exactly the confusion findings 1 and 9 are about, one layer deeper.

*Fix:* make the numeric fields `number | null`, propagate a `turnsUnknown` flag, and render "?" (or omit the row) rather than "—" when a cell did not parse.

### 43. Medium — one broadcast link is attached to every live match

`src/lib/pba/scoreboard-parse.ts:284-289`

```ts
  const youTube = html.match(…);
  const watchUrl = youTube?.[0] ?? null;

  return [...found].map((pstCode) => ({ pstCode, watchUrl }));
```

The whole fragment is scanned once and the first YouTube URL found is given to every discovered match. With two tables live on two streams, both rows advertise the same broadcast. (Not yet observable, because nothing calls `getLiveBoard` — see finding 39; it becomes a user-visible wrong link the moment 39 is fixed.)

*Fix:* scan per row: split the fragment on the row boundary that carries each `PSTCode`, and take the URL from that row.

### 44. High — the "live" scorecard is served from a 24-hour cache, so the live board and the match card show a frozen score

`src/lib/pba/scoreboard.ts:53-54`, applied at `:67`, `:71` and `:82`

```ts
/** A finished or in-progress match never changes once the set list is read. */
const MATCH = 86_400;
```

Both fragments behind `getScorecard` (the set list and the match totals) and every per-set innings read are cached for a day. `getScorecard` is no longer only the archive path: since the 13:03 rewrite, `getLiveFeed` calls it for every match currently on the board (`live.ts:81-92`), and `LiveBoard` re-renders from that payload every 20 seconds (`live-board.tsx:110-117`). The result is a live panel whose clock updates every 20 s around numbers that can only change once a day. `/matches/[pstCode]` has the same problem with a shorter page window (`revalidate = 300`, `matches/[pstCode]/page.tsx:19`) and a "Watch this match" button (`match-summary.tsx:105-116`).

The comment's own premise is self-refuting: "a finished **or in-progress** match never changes".

*Why it matters:* this is the flagship feature — a real PBA scoreboard, the thing the README says has "never been observed carrying an actual match" — and as configured it would show the score of the first poll, all day, under a 20-second refresh indicator.

*Fix:* split the constant. `FINISHED = 86_400` for a match whose innings are complete, `LIVE = 15` (or the board's own window) for anything else. The set list carries no "finished" flag, so the cheapest correct rule is: read `/matches/[pstCode]` and `/live` with `revalidate: 15–30` and keep the 24-hour window only for `getSetInnings` of a set that is not the last one in the list.

### 44b. Medium — the 20-second poll has no in-flight guard, so a slow upstream stacks requests

`src/components/domain/live-board.tsx:110-117`

```ts
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(refresh, POLL_MS);
```

`refresh()` sets `refreshing` (`:91`), but that flag is only used to disable the button (`:149`); the interval fires regardless of whether the previous poll has returned, and each poll of `/api/live` is a `force-dynamic` route that fans out to `1 + 4 × 2` upstream fragment requests (`live.ts:79-92`, `MAX_MATCHES = 4`) with 7–15 s timeouts. With the scorecard cache cold, one poll can exceed the 20-second interval and the next one starts on top of it.

*Why it matters:* on a cold instance the live page can hold four scorecard fetches and a board fetch open while another poll begins — per tab. The upstream is a legacy ASP host that already times out under query (`README.md:248-250`).

*Fix:* guard the timer with a ref (`if (inFlight.current) return;`), and skip polling entirely when `document.visibilityState !== "visible"` — a background tab currently keeps polling every 20 seconds forever (see also finding 23, the same "fetch what nobody is looking at" pattern).

### 45. Low — `EMPTY_SCORECARD` / `EMPTY_INNINGS` are returned for failures as well as for empty answers, and the page cannot tell

`src/lib/pba/scoreboard.ts:56-60`, `:76-78`

```ts
  if (!/^\d+$/.test(pstCode)) return EMPTY_SCORECARD(pstCode);
…
  return parseScorecard(matchHtml, totalsHtml, pstCode);
```

`parseScorecard(null, null, …)` yields `{sets:[], totals:[]}` exactly like a valid but unpublished match, so `/matches/[pstCode]` reports "No scorecard for this match … or did not answer" (`page.tsx:103`) — the sentence concedes the ambiguity instead of resolving it, and the empty branch has no `DataStatus`.

*Fix:* same as finding 15 — return a discriminated result (`{ok:false}` on transport failure) and map it to the "unavailable" empty state rather than "nothing published".

### 46. Low — `progression()`, `shortBy` and `set.innings` are computed and never used

`src/lib/match.ts:232-246` (`progression`) is exported, documented as feeding the chart ("for a progression chart"), and imported by nothing: `set-panel.tsx:68-76` builds its series from `side.turns` directly. `SetSide.shortBy` (`match.ts:43,144`) is computed and never read. `Event.hasDetail` (finding 30) is the same pattern.

*Fix:* delete `progression()` (or use it from `set-panel`), and drop `shortBy` unless a "needs N to win" badge is intended.

### 47. Low — `analyseSet` silently substitutes the turn count for a published innings value of zero

`src/lib/match.ts:133`

```ts
      innings: player.innings || turns.length,
```

Upstream publishes `0` for a set with no recorded innings; the fallback makes that indistinguishable from "innings unknown, using the row count". `average`/`highRun` beside it are correctly nullable, so the code is internally inconsistent about the same risk.

*Fix:* `innings: player.innings > 0 ? player.innings : null` and render "—" for unknown, keeping `turns.length` as a separate field.


---

## A. Route inventory

`revalidate` is the segment config. Pages that read `searchParams` are dynamic at runtime regardless, so their `revalidate` only governs the upstream `fetch` data cache.

| Route | File | Fetches | What it fetches | `revalidate` |
|---|---|---|---|---|
| `/` | `src/app/page.tsx` | yes | season list → tournaments, ranking_prize ×2 (PBA1/LPBA1), teamLeague season+rounds+standings, press list (3), top5 leaders (PBA1), player count | 600 |
| `/live` | `src/app/live/page.tsx` | yes | season list → tournaments, teamLeague season+rounds+standings, tour history, live board fragment + one scorecard (2 fragments) per match on the board, up to 4 | 30 |
| `/schedule` | `src/app/schedule/page.tsx` | yes | season list, tournaments (by season) | 900 |
| `/schedule/[seq]` | `src/app/schedule/[seq]/page.tsx` | yes | tournament detail, tournaments (siblings); detail again in `generateMetadata` | 900 |
| `/matches/[pstCode]` | `src/app/matches/[pstCode]/page.tsx` | yes | match page fragment + match totals, then one innings fragment per set (parallel); read again in `generateMetadata` via `cache()` | 300 |
| `/players` | `src/app/players/page.tsx` | yes | season list; player directory (24/page, or 2 000 for a search) | 1800 |
| `/players/[memCode]` | `src/app/players/[memCode]/page.tsx` | yes | player detail, season list, season stats, tour stats, champions, season rank, career rank; detail again in `generateMetadata` | 900 |
| `/rankings` | `src/app/rankings/page.tsx` | yes | season list, ranking tour list, ranking table (prize or point) | 900 |
| `/records` | `src/app/records/page.tsx` | yes | season list, top5 leaders (circuit), tour history | 900 |
| `/teams` | `src/app/teams/page.tsx` | yes | teamLeague seasons, rounds, standings, player stats, roster | 900 |
| `/teams/[code]` | `src/app/teams/[code]/page.tsx` | yes | seasons, rounds, roster, standings, player stats, match matrix — twice (metadata + page) | 900 |
| `/teams/players` | `src/app/teams/players/page.tsx` | yes | teamLeague seasons, rounds, player stats | 900 |
| `/compare` | `src/app/compare/page.tsx` | yes | season list, 0–2 player lookups, 0–2 player details, 0–2 season stats, head-to-head | 900 |
| `/news` | `src/app/news/page.tsx` | yes | press list, videos, galleries (all three, always) | 600 |
| `/news/[seq]` | `src/app/news/[seq]/page.tsx` | yes | press detail (+ again in `generateMetadata`), press list (5) | 900 |
| `/about` | `src/app/about/page.tsx` | no | static copy + hard-coded endpoint list | none (static) |
| `/api/live` | `src/app/api/live/route.ts` | yes | live scoreboard fragment | `force-dynamic`, `revalidate = 0`, `s-maxage=10` |
| `/api/photo` | `src/app/api/photo/route.ts` | yes | asset origin (up to 5 candidate paths, serial) | none declared; response `max-age=604800` |
| `/api/search-index` | `src/app/api/search-index/route.ts` | yes | player directory (2 000 rows) | 3600 |

No `sitemap.ts`, no `robots.ts`, no `opengraph-image`, no `not-found` per segment, and no `generateMetadata` on `/` (the root layout provides one shared `openGraph` with no `url`, `images` or `metadataBase`; `layout.tsx:43-48`). Only three routes have `generateMetadata`: `/players/[memCode]`, `/schedule/[seq]`, `/news/[seq]` — plus `/matches/[pstCode]`, added during this audit (`matches/[pstCode]/page.tsx:59`). `/teams/[code]` has one too. None of them sets `alternates.canonical`.

## B. Data inventory

### B1. Endpoints

| Endpoint | Wrapper | Consumed by |
|---|---|---|
| `/{lang}/ajax/leagueInfoList` | `getLeagues` (`api.ts:68`) | **nothing** (via the unused `getLeagueList`) |
| `/{lang}/ajax/info?seasonCode` | `getHomeInfo` (`api.ts:430`) | **nothing** |
| `/{lang}/tournament/schedule/ajax/season` | `getSeasons` (`api.ts:75`) | every page, through `getSeasonList`/`getCurrentSeason` |
| `/{lang}/tournament/schedule/ajax/list` | `getTournaments` (`api.ts:84`) | `/`, `/schedule`, `/schedule/[seq]` (siblings) |
| `/{lang}/tournament/schedule/ajax/detail` | `getTournamentDetail` (`api.ts:98`) | `/schedule/[seq]` + its metadata |
| `/{lang}/player/search/ajax/indexList` | `getPlayers` (`api.ts:116`) | `/`, `/players`, `/compare` (name→code), `/api/search-index` |
| `/{lang}/player/search/ajax/detail` | `getPlayer` (`api.ts:141`) | `/players/[memCode]`, `/compare`, metadata |
| `/{lang}/stats/ranking_prize/ajax/list` | `getRanking(kind:"prize")` (`api.ts:172`) | `/`, `/rankings` |
| `/{lang}/stats/ranking_point/ajax/list` | `getRanking(kind:"point")` | `/rankings` |
| `/{lang}/stats/welcome_top_ranking/ajax/list` | `getRanking(kind:"welcome")` | **nothing** |
| `/{lang}/stats/ranking_prize/ajax/tourList` | `getRankingTours` (`api.ts:186`) | `/rankings` (event filter) |
| `/{lang}/stats/service/season` | `getPlayerSeasonStats` (`api.ts:199`) | `/players/[memCode]`, `/compare` |
| `/{lang}/stats/service/tour` | `getPlayerTourStats` (`api.ts:216`) | `/players/[memCode]` (tour-by-tour) |
| `/{lang}/stats/service/champion` | `getPlayerChampionships` (`api.ts:228`) | `/players/[memCode]` (titles) |
| `/{lang}/stats/service/rank` | `getPlayerSeasonRank` (`api.ts:236`) | `/players/[memCode]` (season standing) |
| `/{lang}/stats/service/rank/total` | `getPlayerCareerRank` (`api.ts:248`) | `/players/[memCode]` (career) |
| `/{lang}/stats/service/top5/season` | `getSeasonLeaders` (`api.ts:258`) | `/`, `/records` |
| `/{lang}/service/ajax/tour/getTourList` | `getTourHistory` (`api.ts:269`) | `/records` (roll of honour), `/live` (recent finals) |
| `/{lang}/stats/service/headtohead` | `getHeadToHead` (`api.ts:279`) | `/compare` |
| `/{lang}/teamLeague/ajax/season` | `getTeamLeagueSeasons` (`api.ts:296`) | `/teams`, `/teams/[code]`, `/teams/players`, `/` + `/live` (via `getActiveTeamSeason`) |
| `/{lang}/teamLeague/ajax/gameList` (POST) | `getTeamLeagueRounds` (`api.ts:303`) | same four |
| `/{lang}/teamLeague/stats/ajax/seasonTeam` | `getTeamStandings` (`api.ts:323`) | `/`, `/live`, `/teams`, `/teams/[code]` |
| `/{lang}/teamLeague/stats/ajax/seasonPlayer` | `getTeamPlayerStats` (`api.ts:338`) | `/teams`, `/teams/[code]`, `/teams/players` |
| `/{lang}/teamLeague/stats/ajax/getTeamListBySeasonRound` | `getTeamRoster` (`api.ts:353`) | `/teams`, `/teams/[code]` |
| `/{lang}/teamLeague/stats/ajax/getTeamWinLoseByTeam` | `getTeamMatchMatrix` (`api.ts:365`) | `/teams/[code]` (head-to-head) |
| `/{lang}/media/press/ajax/list` | `getPressList` (`api.ts:379`) | `/`, `/news`, `/news/[seq]` |
| `/{lang}/media/press/ajax/detail` | `getPressDetail` (`api.ts:390`) | `/news/[seq]` |
| `/{lang}/media/video/ajax/list` | `getVideos` (`api.ts:399`) | `/news` (always, even on the press tab) |
| `/{lang}/media/gallery/ajax/list` | `getGalleries` (`api.ts:407`) | `/news` (always) |
| `/{lang}/award/ajax/tour` | `getAwards` (`api.ts:417`) | **nothing** |
| `app.pbatour.org/mob/contest_new/code_behind/live_info.asp?TourCode=` | `getLiveFeed` (`live.ts:59`), `getLiveBoard` (`scoreboard.ts:85`) | `/live` (SSR + poller), `/api/live` |
| `app.pbatour.org/mob/contest_new/admin_en/live_info_setview.asp?PSTCode=` | `getScorecard` (`scoreboard.ts:59`) | `/matches/[pstCode]` (+ its `generateMetadata`) |
| `…/code_behind/contest_result_set_record.asp?PCGMCode=` | `getSetInnings` (`scoreboard.ts:76`) | `/matches/[pstCode]`, one call per set, in parallel |
| `…/code_behind/contest_result_set_help.asp?PSTCode=` | inside `getScorecard` | `/matches/[pstCode]` (match-totals table) |
| `pbatour.org/resources/upload{path}` | `fetchBinary` (`http.ts:278`) | `/api/photo` |

Four endpoints are wrapped and never called (`leagueInfoList`, `ajax/info`, `welcome_top_ranking`, `award/ajax/tour`), two are fetched but their payload is thrown away (the two `/news` tabs), and one wrapper is written and never called even though the feature it discovers is live (`getLiveBoard`, finding 39).

### B2. Fields received but never rendered

This is the list you asked for: everything upstream already delivers that no surface shows. `RawX` names are from `types.ts`; "unused" means no page, component or formatter reads it.

**`RawHeadToHead`** (`types.ts:489-540`) — 10 of 24 per-side fields are rendered, and the page already has all of them in memory on `/compare`:

| Field | Status |
|---|---|
| `player1_closing_rate` / `player2_closing_rate` | **never rendered** — closing probability, the sport's clutch metric |
| `player1_total_attempts`, `player1_total_success` | **never rendered** — only the derived `success_rate` is shown |
| `player1_1point`, `player1_2point` | **never rendered** — conversion counts |
| `player1_long_cnt` | **never rendered** — number of long runs (only the rate is shown) |
| `player1_first_shot_try`, `player1_first_shot_success` | **never rendered** — only the rate |
| `player1_set_diff` | never rendered |
| `average_innings` (match-wide) | never rendered |
| `player1_win_rate` | never rendered (the page shows the raw win count) |
| `player1_img`, `player1_NationImgURL` | never rendered (the page uses the profile photo) |

**`RawTeamPlayerStat`** (`types.ts:333-389`) — 22 fields parsed or received and unused: `장타` (long-run count), `장타율`, `퍼펙트큐` (perfect cue), `끝내기확률` (closing probability), `평균득점` (points per match), `세트승률`, all ten gender/format splits (`남자단식/여자단식/남자복식/여자복식/혼합복식` wins and losses), `이닝` and `세트수` (normalised into `TeamPlayer` at `normalize.ts:421,423` and then rendered nowhere), and every `*순위` field. Also `선수단축명`, `국가이미지`, `팀로고썸네일`.

**`RawTeamStat`** (`types.ts:300-331`) — `평균이닝` (innings per match), `평균득점`, `퍼펙트큐`, `뱅크샷성공률`, `초구성공률`, `공격성공률`, `상대전적승`/`상대전적패`, `승차` (games behind), `세트수`, `애버리지순위`.

**`RawPlayerStat`** (`types.ts:169-228`) — `총점`, `상금`, `랭킹포인트` (all three arrive on the *same* row as the season statistics, which is why the profile page instead makes three extra requests for them: `/rank`, `/rank/total`, `/champion`); plus `PBAType`, `MemName`, `NationCode`, `BirthDay`, `ImgUrl` (duplicated from the detail row).

**`PlayerStatLine` after normalisation** (`normalize.ts:193-228`) — `attackMade`, `attackTried`, `longRunCount` are parsed at `:284,287,288` and never displayed; only `attackRate` and `longRunRate` reach the DOM.

**`RawPlayer`** (`types.ts:111-135`) — `BankShotRate` (normalised at `:174`, rendered nowhere), `Draw` (normalised, never shown — the card prints `W–L` only), `num`, `tcnt`.

**`RawTop5Row`** (`types.ts:258-269`) — `Innings` and `PBAType`: the leaders feed publishes the winner's innings count, which no leaderboard shows.

**`RawTournament`** (`types.ts:64-98`) — `MATCH_START_DATE_NAME`, `MATCH_END_DATE_NAME` (the human-readable dates), `TOP_YN`, `VIEW_YN`, and `DETAIL_BTN_ACTIVE_YN` → `Event.hasDetail`, which is computed and never used to gate anything.

**`RawTour`** (`types.ts:472-482`) — `로고이미지` (tour logo), `등록일자`.

**`RawGallery`** (`types.ts:446-456`) — `VIEW_CNT`, `TOP_YN`, `CONTENT` (only the title and date are shown).

**`RawRankingRow`** (`types.ts:139-157`) — `PrizeRank`, `RankingPointRank`, `RankBy`, `Gender`, `ImgURLBig`, `PlayerNameENShort`, `num`, `tcnt`: each row already knows the player's rank on *both* metrics, which would let the rankings table show both columns on one screen.

**`RawPress`** (`types.ts:418-432`) — `GUBUN`, `TYPE`, `LOCALE_GUBUN`, `ROWNUM`.

**`RawSeasonRank`** (`types.ts:237-247`) — `에버리지순위` (the player's average rank for the season, arriving in the same payload as the standing card).

---

## C. Stats inventory

### `/` — home
**Shows:** current/next event (title, range, venue, prize pool), prize-money leader with points, PBA + LPBA prize tables (6 rows each), team-league top 8 (points/W/D/L/sets/ratios), four leader cards (average, high run, most wins, attack success — top 3 each), three press cards, four counters (players, events, clubs, season prize).
**A fan expects but cannot see:** the current event's *match state* (who is playing, at what stage); the defending champion's actual title history; last final's set score; the leader's average alongside their prize; anything about the last round of the team league other than the standings.

### `/live`
**Shows:** the scoreboard wire — since the 13:03 revision, one row per match on the board with both players, points in the current set, innings, sets won, completed set scores, a Watch link and a link to the match card (falling back to the fragment's raw text lines when nothing can be parsed); events in progress; the current round card (venue, window, status, purse); team standings (top 10); eight recent finals with champion name; three broadcast links.
**A fan expects:** the score of the match being played right now (which the panel shows, from a 24-hour cache — finding 44, so it does not actually update), the race target per set, who is at the table and who broke, a shot clock or last-visit indicator, and a link onward from a recent final to its scorecard.

### `/schedule`
**Shows:** four counters (unreconciled, finding 13), events grouped On now / Upcoming / Results, bucketed by month, each row with date, circuit, venue, status.
**A fan expects:** session times (dropped by `toDate`, finding 17), the number of entrants, the champion on a completed row, and — for a week-long event — which day is the final.

### `/schedule/[seq]`
**Shows:** status pill, circuit, date range, day count, venue, sponsor + logo, six facts in the aside, the same facts expanded, broadcast note, four neighbouring events.
**A fan expects:** the actual results — the bracket, the final's set score, the champion; the entry list; the prize breakdown by finishing position. The page has ten facts and not one of them is a result.

### `/players`
**Shows:** per card — average (3 dp), W–L, win %, prize, circuit chip, prize-rank badge for the top 10.
**A fan expects:** average rank, high run, matches played, and last-event form. Sorting by anything other than family name is impossible; the "Sorted A–Z by family name" note (`players/page.tsx:205-207`) is the only order available.

### `/players/[memCode]`
**Shows:** avg, high run, win rate, prize + rank, ranking points + rank; 17-cell season grid (matches, W, L, avg+rank, HR+rank, win rate+rank, innings, points+rank, sets W–L, bank %, first-shot %, attack %, long-run %, shootout %, 1-point scores, innings/match *or* bank shots made, 2-point scores); tour-by-tour table (avg, HR, matches, bank %, attack %, prize); season standing, career totals, titles.
**A fan expects:** per-match results (who they beat, with what average and high run); the average trend across the season; 2-point *attempts* and conversion (only converted counts are shown); long-run counts (`장타수` is in the payload, unrendered); perfect cues; closing probability; win/loss streak. There is no way to answer "how did they do last week".

### `/rankings`
**Shows:** podium (3 cards), full sortable table (player, nation, prize, points), circuit/season/metric/event filters.
**A fan expects:** average and high run as sortable columns (they are on the same upstream row family but from a different endpoint), per-event rank, and movement since the last event.

### `/records`
**Shows:** 15 leader categories × top 5, this season's events with champion, 40-row roll of honour.
**A fan expects:** the other ~11 categories the feed publishes (win rate above all), career/all-time records (highest average ever, longest run ever), and the leaders' innings/match counts (`RawTop5Row.Innings`, unrendered).

### `/teams`
**Shows:** round selector, standings (pts, W, D, L, sets, set ratio, point ratio), best six averages, ten club cards (rank, coach, W/L, points), 12-row roster table (avg, win %, HR, sets, singles, doubles).
**A fan expects:** the round's fixtures and results (who played whom, what the set score was), each club's average and high run (in the payload as `애버리지`/`하이런`, shown only on `/teams/[code]`), perfect cues, and the postseason bracket.

### `/teams/[code]`
**Shows:** rank, points, record, set ratio, eight-cell stat grid (win rate, sets won/lost, points for/against, team average, high run, matches), roster cards (avg, win %, HR, matches), club facts, head-to-head against every rival.
**A fan expects:** the club's fixtures/results list, its innings-per-match (`평균이닝`), closing probability (`끝내기확률`), and each player's singles/doubles split (parsed into `TeamPlayer`, unrendered).

### `/teams/players`
**Shows:** sortable table — avg, win %, HR, matches, sets, singles, bank %.
**A fan expects:** innings, points, doubles and mixed-doubles splits, long-run rate, perfect cues, and a per-round comparison.

### `/compare`
**Shows:** two profile cards, head-to-head aggregate (wins, average, HR, innings, points, success rate, long-run rate, first shot, mislabelled "bank shot", sets won) with proportional bars, season side-by-side (11 metrics).
**A fan expects:** the meetings themselves — when they played, the set scores, the averages in those matches; closing probability; 2-point and bank-shot rates that are actually what they say.

### `/news`, `/news/[seq]`, `/about`
Editorial, not statistical. `/news/[seq]` renders sanitised CMS HTML; `/about` explains provenance (with the stale endpoint list of finding 33).

### `/matches/[pstCode]` — the match card (added during this audit)
**Shows:** match title, round chip, date, a "Final" chip, a set-score strip, sets won per side, a totals table comparing both sides row by row (sets, average, high run, innings, points, 1-point, 2-point, attack %, long-run %, bank-shot %), one panel per set (race target, winner, points/innings/average/HR per side, a cumulative-score step chart, and a full inning table with 1P/2P/Run/Tot per side plus a Sum footer), an "Official sheet" link and an optional broadcast link.
**A fan expects but cannot see:** any way to reach the page at all (finding 39); links from the players in the card to their profiles — the names are plain text, so a match card is a dead end for discovery; the event context unless the URL carries `?tour=` (`readContext` reads only the query string, `matches/[pstCode]/page.tsx:34-42`); and a way onward to the tournament's other matches.

**The five gaps that matter most for 3-cushion specifically,** revised now that the match card exists. The inning-by-inning record with the 1-point/2-point split, empty-turn counts, best scoring streak and a progression chart *is* now built — but only on an orphaned route that no page links to, and with no join back to the players involved. What remains genuinely absent everywhere: **closing probability** (`끝내기확률` on the club feed, `player1_closing_rate` on head-to-head — both received, neither rendered); **a match log on the player profile** (who they beat, with what average and high run — the per-tour and per-match data exists, nothing joins it to a person); **long-run counts and perfect cues** (`장타수` is parsed into `longRunCount` and dropped, `퍼펙트큐` is never read); **1-/2-point *attempt* rates** (only conversions are shown, on the season grid and on the match card alike); and **career aggregates** (career average and career high run — the career block shows only events, titles, points and prize).

---

## D. The three biggest structural problems

### 1. The failure signal is an opt-in side channel, so "empty" and "unreachable" are the same value

`api.ts` promises `null` for "the feed did not answer" and `[]` for "nothing published" (`api.ts:1-5`), but every page immediately collapses both into `[]` via `rows()` (`api.ts:53-58`). The corrective mechanism — `failures.ts` — is a separate, request-scoped list that a page must remember to open with `trackFailures`, and only three of fifteen routes do. Everything downstream (empty states, `notFound()`, the honest-data banner) then rests on a value that cannot distinguish the two cases, and the codebase compensates with comments instead of types.

*Smallest structural change:* make the empty state unable to compile without a failure record. `PageHeader`'s `failures` becomes required (`filter-bar.tsx:75-88`), which forces each page to wrap its reads in `trackFailures` — the exact pattern `rankings/page.tsx:40-46` already uses — and add one `EmptyState` variant, `Unavailable`, for the `failures.length > 0` branch. Five pages and four detail routes change; no data-layer rewrite.

### 2. Formatting happens inside the data layer, so sorting and honesty both break

`normalize.ts` and the table builders return display strings where numbers are needed (`ranking-table.tsx:53-54` → `money()`, `teams/players/page.tsx:65-71` → `average()`/`percent()`), and `num()` silently coerces placeholders to `0` (`format.ts:72-76`). The client-side sort then compares text (findings 9, 10), and every surface that bypasses the formatters prints `0.000`/`0` for unknown values (`players/page.tsx:282`, `teams/page.tsx:162`, `standings-table.tsx:64-69`).

*Smallest structural change:* one rule, enforced in one file — domain models carry `number | null`, never strings and never `0`-for-unknown. Concretely: fix `num()` to return `fallback` for an empty numeric body, and change `buildRankingRows`/`rowsFor` to pass raw numbers for columns marked `numeric`, letting `DataTable.Cell` (`data-table.tsx:86`) format. That fixes sorting and the "0" class in two edits.

### 3. Every page re-implements the same three decisions: which season, which round, how to format a metric

`seasons.find(s => s.SeasonCode === param) ?? current` appears in `schedule`, `rankings`, `records`, `players/[memCode]`, `teams`, `teams/players`, `teams/[code]` and `compare`; `rounds.find(진행중) ?? rounds[0]` appears in four files (`service.ts:88-92`, `teams/page.tsx:47-51`, `teams/players/page.tsx:103-107`, `teams/[code]:36-40`); `money`/`wonCompact`, `formatValue`/`formatLeaderValue`, and three near-identical stat normalisers coexist. This is also where finding 14 (the wrong season key) and finding 13 (mixed scopes) come from — the same decision, made differently in nine places.

*Smallest structural change:* one new module, `src/lib/pba/scope.ts`, exporting `resolveSeason(searchParams)` and `resolveRound(season, searchParams)` (both returning `{ code, record, failures }`), plus a single `metric(unit, value)` in `format.ts`. Pages keep their own JSX and lose ~15 lines each; the season/round semantics become testable in one place.

---

## E. Minor items, not worth a numbered finding

- `event-card.tsx:76-79` — "Day N of M" derives N from `1 - until`; correct for a live event but untested against a multi-week event.
- `players/page.tsx:123-146` — the search form submits only `q`, quietly dropping the circuit filter the user had selected.
- `records/page.tsx:52-55` — `byCategory` is built from `typeof leaders`, so the map's value type is "whatever the first row was"; the `typeof` escape is unnecessary.
- `service.ts:35-38` — `getCurrentSeason` returns `seasons[0]` and documents "newest first" as an assumption about upstream ordering; if it changes, every page silently reports the wrong season.
- `news/page.tsx:115` — the pagination `buildHref` drops `tab`, harmless only because pagination is rendered exclusively on the press tab.
- `about/page.tsx:118-131` — a `<table>` with no `<thead>` used as a layout list.
- `rankings/page.tsx` — no `<h2>` anywhere: one `h1` then straight into cards and a table.
- `verify-interactions.mjs:33` and `ci.yml:38-42` — CI's artefact check hits the live upstream; a network blip or an upstream HTML error page fails the build (`refresh-data.mjs:49` calls `JSON.parse` on whatever comes back, with no `response.ok` check).
