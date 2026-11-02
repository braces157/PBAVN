# PBA Hub

A fast, readable web client for the **Professional Billiards Association** (PBA) tour — player
statistics, team-league tables, live scoreboard, rankings, the full calendar and the record book.

Every number on the site is read at request time from the association's own public data service
(`pbatour.org`). Nothing is hand-entered, scraped into a warehouse, or estimated.

- **Stack:** Next.js 15 (App Router) / React 19 / TypeScript / Tailwind CSS v4
- **Data:** pbatour.org JSON API + the legacy scoreboard on app.pbatour.org
- **Language:** English UI, with original Korean retained where it identifies a person

---

## Quick start

```bash
npm ci
npm run dev        # http://localhost:3100
```

Production:

```bash
npm run build
npm start          # http://localhost:3100
```

Requires Node 20.9+ (built and tested on Node 22 and Node 25).

To check the site the way CI does, with a browser driving the real pages:

```bash
npm run lint       # tsc --noEmit
npm run build
npm start &        # in another terminal
npm run verify     # launches headless Chrome, asserts 12 interactions
```

`npm run refresh-data` rebuilds the two committed translation lookups described under
[Translation artefacts](#translation-artefacts). CI fails when they are stale.

---

## What's in the site

| Route | What it shows |
| --- | --- |
| `/` | Live status, current/next event, prize-money leader, PBA + LPBA tables, team-league standings, season leaders, news |
| `/live` | Scoreboard wire (polled every 20s), events in progress, current team-league round, recent finals, broadcast links |
| `/schedule` | Full calendar by season and circuit, grouped into On now / Upcoming / Results |
| `/schedule/[seq]` | One event: dates, venue, prize money, defending champion, broadcast, equipment, event guide |
| `/players` | 1,700+ professionals, searchable by name (English or Korean), filterable by circuit and initial |
| `/players/[memCode]` | Player profile: season stats with per-metric rank, tour-by-tour results, titles, career totals |
| `/rankings` | Prize-money and ranking-point tables, filterable by circuit, season and individual event |
| `/teams` | Team league: round selector, standings, best averages, all ten clubs |
| `/teams/[code]` | Club page: roster, team statistics, head-to-head record against every rival |
| `/teams/players` | Every team-league player, sortable by average, win rate, high run and more |
| `/records` | Season category leaders (26 categories) plus the full roll of honour |
| `/compare` | Head-to-head: how two players compare and every recorded meeting between them |
| `/news` | Press releases, PBA TV video and photo galleries |
| `/news/[seq]` | Article body (sanitised CMS HTML) |
| `/about` | Circuits explained, and the exact endpoint list behind every figure |

---

## How the data layer works

There was no published API. The client was reverse-engineered from the official front end, which
turns out to be an undocumented JSON service behind a legacy Angular/Java stack.

### Discovery

The site loads `frontMain.js`, `frontPlayerSearch.js`, `frontPlayerStats.js`, `frontTeamLeague`
inline scripts and friends. Grepping those for `ajaxGet(...)` yielded the whole surface, which
follows a consistent shape:

```
https://www.pbatour.org/{lang}/{module}/ajax/{action}
https://www.pbatour.org/{lang}/service/ajax/{action}
```

`{lang}` is `en` or `ko` — the service returns the same rows either way and simply exposes both a
Korean label and an `_EN` field, so this app always requests `en` and prefers the English field.

### Endpoints consumed

| Endpoint | Used for |
| --- | --- |
| `/ajax/leagueInfoList` | Circuit codes (PBA1, LPBA1, PBA2, PBA3, TLG) |
| `/ajax/info` | Homepage aggregate |
| `/tournament/schedule/ajax/season` | Season list |
| `/tournament/schedule/ajax/list` | Tournament calendar |
| `/tournament/schedule/ajax/detail` | Single event |
| `/player/search/ajax/indexList` | Player directory + season totals |
| `/player/search/ajax/detail` | Player profile |
| `/stats/ranking_prize/ajax/list` | Prize-money table |
| `/stats/ranking_point/ajax/list` | Ranking-point table |
| `/stats/ranking_prize/ajax/seasonList`, `/tourList` | Ranking filters |
| `/stats/service/season` | Per-player season statistics |
| `/stats/service/tour` | Per-player, per-event statistics |
| `/stats/service/champion` | Player titles |
| `/stats/service/rank`, `/rank/total` | Season and career standing |
| `/stats/service/top5/season` | Season category leaders |
| `/stats/service/headtohead` | Two-player head-to-head aggregate |
| `/teamLeague/ajax/season` | Team-league seasons |
| `/teamLeague/ajax/gameList` | Team-league rounds (POST) |
| `/teamLeague/stats/ajax/seasonTeam` | Team standings |
| `/teamLeague/stats/ajax/seasonPlayer` | Team-league player stats |
| `/teamLeague/stats/ajax/getTeamListBySeasonRound` | Club profiles |
| `/teamLeague/stats/ajax/getTeamWinLoseByTeam` | Club-vs-club record matrix |
| `/media/press/ajax/list`, `/detail` | Press |
| `/media/video/ajax/list`, `/media/gallery/ajax/list` | Video, galleries |
| `/award/ajax/tour` | Awards |
| `app.pbatour.org/mob/contest_new/code_behind/live_info.asp` | Live scoreboard fragment |

### Three things that made this harder than it looks

**1. No CORS.** The service sends no `Access-Control-Allow-Origin`, so every call is made from the
Next.js server. Pages render on the server and the only browser-side fetch is the live poller
(`/api/live`).

**2. A broken TLS chain.** The upstream omits the intermediate certificate. Browsers paper over
that; Node refuses with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. `src/lib/pba/http.ts` therefore tries
the normal `fetch` first — the path Next can cache — and, only on a TLS failure, falls back to a
`node:https` request that trusts the chain for the association's hosts, with a short in-process
cache. Everything else keeps full certificate verification.

**3. Korean column aliases.** The `/stats/service/*` endpoints answer with Korean property names
(`에버리지`, `하이런`, `승리수`) because the Java layer maps straight off SQL aliases. Those shapes
are typed verbatim in `src/lib/pba/types.ts` and translated once in `src/lib/normalize.ts`, so no
UI component ever touches a Korean key.

### Resilience

- Every upstream call resolves to `null` on failure; a dead feed degrades one module, not the page.
- Requests carry per-endpoint revalidation windows (60s for live, 15 min for stats, 24 h for
  league and season lists).
- Player photos and club logos 404 for a sizeable share of members — `SafeImage` swaps in a
  typographic fallback on the first failed load instead of showing a broken image.
- The live scoreboard returns an empty fragment whenever no table is active. The page reports
  "idle" rather than inventing a match.

### Translation artefacts

Champion names and tour titles arrive in Korean. The English equivalents live in two APIs that
are expensive to read: the player directory is 783 KB and takes about 8 seconds cold, which made
`/records` a ten-second page. Both lookups are therefore snapshotted into
`src/lib/pba/data/*.json` (58 KB total) and read from disk, so no page pays that cost.

Regenerate them when a new season roster is published:

```bash
npm run refresh-data
```

CI re-runs that command and fails when the committed artefacts no longer match the live API.


### Player photos

The directory publishes two copies of every portrait: a ~160px `small` thumbnail and a ~640px
`big` one. Both the search and ranking feeds hand out the *small* path, which is why a 170–240px
card used to show a 160px file — soft at 1x, visibly blurred on a retina display, and half the
roster has no photo at all, so those cards rendered as empty boxes.

Photo URLs therefore point at `/api/photo` (`src/app/api/photo/route.ts`), which:

- upgrades the path to the `big` copy, trying the plain folder swap and the `_S_` → `_B_` marker
  swap before giving up and using exactly what the feed supplied — newer uploads are named
  `M0017160_B_2026….jpg`, older ones `M0017191.jpg`;
- resizes with sharp to the width the layout asked for and re-encodes as WebP — a 344px card gets
  a 344px WebP of ~14 KB instead of a 640px JPEG of ~110 KB;
- emits `srcSet` candidates at 2x and 3x, so a retina screen fetches the detail it needs and
  everyone else does not pay for it;
- returns 404 for the half of the roster with no file, so the client settles on the initials plate
  (`InitialsPlate`) instead of an image-plus-alt-text flash.

Both the transport (`fetchBinary`) and the resizing degrade gracefully: if sharp is unavailable the
route serves the 640px original, and if the asset host is down the avatar falls back to initials.

---

## Interface

Built against what the strongest stats products do: HLTV's sortable tables with a rank beside
every figure, FotMob and SofaScore's header search and persistent sub-navigation.

- **Global player search** in the header, reachable with `⌘K` or `Ctrl+K`. Typing ranks a frozen
  1,700-record index in memory, so results appear with no network hop. It ignores hyphens, accents
  and spacing, so `Ga-young`, `Gayoung` and `ga young` all find the same player.
- **Every table sorts.** One table component backs the rankings, the team-league standings and the
  player lists. Click any column header or the sort bar. Ranks renumber to follow the sort, the way
  a leaderboard should. Sorting happens in the browser over rows the server already rendered, so it
  is instant and the page stays shareable.
- **Sticky column headers.** Tables that run long scroll inside their own box with the header
  pinned, and the site header never collides with it.
- **In-page navigation** on player profiles, so a four-thousand-pixel page can be jumped through by
  section instead of scrolled.
- **Every player is clickable**, including the team-league rosters and standings that used to be
  dead ends.

## Project layout

```
src/
  app/                     route segments (all server components except the live board)
    api/live/route.ts      polling endpoint for the scoreboard wire
    api/photo/route.ts     player photo proxy: big-source fetch, sharp resize, WebP
    api/search-index/route.ts  frozen player index for header typeahead
    error.tsx              render-failure boundary with retry
    loading.tsx            route skeleton
  components/
    site/                  header, footer, wordmark, partial-data notice
    domain/                event cards, tables, live board, filter bar, player sub-nav
    ui/                    primitives, data table, player search, media, safe image
  lib/
    pba/http.ts            transport, TLS fallback, binary asset fetch, asset helpers
    pba/failures.ts        per-request failure record behind the partial-data notice
    pba/api.ts             one function per endpoint
    pba/types.ts           raw upstream shapes
    pba/service.ts         composed reads (current season, snapshots, English resolution)
    pba/live.ts            scoreboard fragment extraction
    pba/data/*.json        committed translation lookups (see below)
    photo.ts               player photo paths -> `/api/photo` URLs and src sets
    normalize.ts           raw to domain models
    format.ts              dates, money, averages, text
    sanitize.ts            CMS HTML sanitiser
scripts/
  verify-interactions.mjs  drives a real browser; the check CI runs
  refresh-data.mjs         rebuilds src/lib/pba/data from the live API
  shot.mjs                 full-page screenshot through CDP
```

## Design notes

- Near-black baize background, a single electric-lime accent, and one tint per circuit
  (PBA / LPBA / Dream / Challenge / Team League) so a glance is enough.
- Archivo for display, Inter for text, tabular numerals everywhere a column of figures appears.
- All filtering is URL state, so every view is shareable, cacheable and server-rendered.
- Responsive down to 390px; dense tables tighten their padding rather than clipping.

## Known limitations

- **Live match data is unproven.** The scoreboard fragment returns an empty payload whenever no
  table is active, and the association's `ended_matches` and `next_game` fragments time out under
  query. The wire is built and polls, but it has never been observed carrying an actual match.
  When idle the page says so rather than inventing a result.
- **The partial-data notice covers three pages.** `/rankings`, `/records` and `/teams` record
  transport failures and say so. `/players`, `/live` and `/schedule` still render an ordinary empty
  state when the upstream is unreachable. Threading the same signal through them is mechanical work,
  not a design question.
- **Thirteen hand-built filter parameter bags.** Each `FilterRow` call site restates every other
  parameter on its page. Adding a filter means touching all of them or silently dropping state.
  This works today; it is a maintenance hazard, not a user-visible bug.
- **Some proper nouns stay Korean.** Press releases are published in Korean only, and defending
  champion *clubs* have no English form anywhere upstream.
- **No tests beyond the browser checks.** `npm run verify` covers the interactions that were
  regressions. The data layer has no unit tests.


## Attribution

Unofficial project. PBA, LPBA and all tournament marks, logos and player likenesses belong to the
Professional Billiards Association. Statistics are reproduced from the association's public data
service for informational use; where this site and pbatour.org disagree, the official site is right.
