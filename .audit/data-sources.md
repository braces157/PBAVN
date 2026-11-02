# DATA-SOURCES — PBA / LPBA / Team League upstream data

Scouted and verified **2026-11-02** (Asia/Bangkok) by live HTTP probes.
Everything below was executed, not inferred, unless the line is explicitly marked
`INFERRED`. Raw responses live in `research/probe/v3_*`; the throwaway probe
scripts are `research/probe/v3_probe{1..18}.mjs` with the shared helper
`research/probe/v3_http.mjs`.

Scope: nothing under `src/` was touched. No app code was changed.

---

## 0. Rules that apply to every `*.pbatour.org` host

| Rule | Evidence |
| --- | --- |
| `app.pbatour.org` and `www.pbatour.org` omit an intermediate cert → Node `https` needs `rejectUnauthorized: false` (the app already does this in `src/lib/pba/http.ts`). | `v3_http.mjs` uses it for every call. |
| `team.pbatour.org` is **plain HTTP**. No TLS involvement. | all `v3_team_*` artifacts are `http://`. |
| `app.pbatour.org/mob/**/code_behind/*.asp` requires a `Referer` under the same host. Without it (or with a foreign one) the server returns a **206-byte** alert stub. | `v3_probe9.mjs` `[d]`: no Referer → `len=206`, body `alert("정상적인 접근이 아닙니다.")`; `Referer: https://example.com/` → same. `Referer: https://app.pbatour.org/mob/contest_new/admin_en/live_info.asp` → 200 + rows. |
| The `admin_en` **pages** need a mobile UA; the `code_behind` **fragments** do not care. | `v3_probe9.mjs` `[d]`: desktop Chrome UA → 200, same 4152-byte body. A plain iPhone UA is enough for pages. |
| `code_behind` fragments accept both `GET` (querystring) and `POST` (form body) with identical results. jQuery uses GET; use GET. | `v3_probe9.mjs` `[d]`: POST form body → 200, 4152 bytes, 1 row. |
| `team.pbatour.org/mob/code_behind/getPlanResultDetail.asp` needs **no** Referer and **no** UA. | bare `http.request` with only `Content-Type` → 200, valid JSON. |

Reference headers used throughout:

```
User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1
Referer:    https://app.pbatour.org/mob/contest_new/admin_en/live_info.asp
```

---

## 1. QUESTION 1 — from the official JSON API to the `PSTCode` of one match

### 1.1 The join key is already in the official JSON: `MATCH_CODE` **is** the `TourCode`

`https://www.pbatour.org/en/tournament/schedule/ajax/list` returns 266 rows carrying
`SEQ`, `TITLE`, `TITLE_EN`, `MATCH_CODE`, `LEAGUE_GUBUN`, `SEASON_GUBUN`,
`MATCH_START_DATE`, `MATCH_END_DATE`, `PLACE`.

`https://www.pbatour.org/en/service/ajax/tour/getTourList?seasonCode=2026&pbaType=PBA`
returns 204 rows carrying `투어코드`, `투어명`, `PBA타입`, `투어시작일자`, `투어종료일자`.

**`schedule_list.MATCH_CODE` == `tourList.투어코드`.** Measured (`v3_probe10.mjs` `[1]`):

| subset of `schedule_list` | rows | `MATCH_CODE` found in `투어코드` |
| --- | --- | --- |
| `LEAGUE_GUBUN ≠ TLG`, numeric `MATCH_CODE` | 195 | **195 — 100 %** |
| `LEAGUE_GUBUN = TLG` (team league), numeric | 42 | 27 numeric matches, but **26 of them are coincidental collisions** |
| all numeric `MATCH_CODE` | 237 | 222 (93.7 %) |

The 15 numeric `MATCH_CODE`s that have **no** `투어코드` are all `LEAGUE_GUBUN=TLG`
(team-league rounds 43, 46, 61, 63–75…). Conversely, 26 TLG codes *do* collide with
unrelated tour codes (`94,93,92,91,89,88,86,85,59,58,57,56,55,54,53,52,51,50,49,48,47,45,44,6,5,4,3`)
— e.g. TLG round `94` vs the old LPBA tour `94`. Proof of the intended pairing:
NH농협카드 PBA 챔피언십 26-27 → `MATCH_CODE "271"` / `투어코드 271`; LPBA 26-27 →
`MATCH_CODE "270"` / `투어코드 270`; 하이원 리조트 PBA 챔피언십 2023 →
`MATCH_CODE "167"` / `투어코드 167` (the tour behind `PSTCode 68308`, which opened
this investigation).

Two caveats, both measured:

* **Filter out `LEAGUE_GUBUN = 'TLG'` before joining.** That single rule removes every
  real miss and every collision. After it, `MATCH_CODE → 투어코드` is exact.
* Title/casing still drifts (`"하이원리조트…"` vs `"하이원 리조트…"`): identical
  `투어명`/`TITLE` on only 117/222 pairs and identical start date on 181/222 when TLG
  is left in. Use `MATCH_START_DATE` as the tiebreaker, never the title string.
* `LEAGUE_GUBUN` values are exactly the stats `pbaType` values of §2
  (`PBA1`, `LPBA1`, `PBA2`, `PBA3`), while `투어 PBA타입` uses the short forms
  (`PBA`, `LPBA`, `PBA2`, `PBA3`). Tally in `v3_probe10.mjs`: `PBA1→PBA 62`,
  `LPBA1→LPBA 64`, `PBA2→PBA2 51`, `PBA3→PBA3 18`, `TLG→{PBA,LPBA,PBA2,PBA3} 27`.

If you prefer, `투어코드` can be read straight off `/service/ajax/tour/getTourList`;
`MATCH_CODE` is only needed to bridge a schedule-list row to it.

### 1.2 The bracket endpoint that yields `PSTCode` — **VERIFIED**

```
GET https://app.pbatour.org/mob/contest_new/code_behind/contest_result_sur.asp
    ?TourCode=271&iBLCode=128&iPage=1&txt_Search=
Referer: https://app.pbatour.org/mob/contest_new/admin_en/live_info.asp
User-Agent: <iPhone UA>
```

Returns an HTML fragment: **one `<div class="content_block_set …">` per match**, in
reverse chronological order. Each block contains

| Field | Markup |
| --- | --- |
| `PSTCode` | `onclick="javascript:setview(98799);"` |
| players + MemCodes | `comPlayerInfo('ko','PBA1','M0016923','이국성')` ×2 **and** `matchlayer('M0016923','M0017011')` |
| match no | `<span class="no_order t15">No 62</span>` |
| table | `<span class="t14">T5</span>` |
| kickoff | `<span class="t14">26-10-22 01:05</span>` |
| sets / avg / HR | the `win_lost_block01_set` table |

This is the endpoint the earlier session used and forgot to record: it reproduces
`rows_271_ibl2.html` … `rows_271_ibl128.html` **byte-for-byte** (identical 4 152 and
80 026-byte bodies, identical `setview(...)` sequences — `v3_probe17.mjs`), and it
reproduces `parsed_matches.json` (167's 128-bracket union = 64 PSTCodes, first one
`68308`).

**`iBLCode` is the bracket size**, not an opaque id:

| `iBLCode` | 2 | 4 | 8 | 16 | 32 | 64 | 128 | 1 | 256 | `sur` | `set` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rows for TC 271 | 1 | 2 | 4 | 8 | 16 | 20 | 20 | — | — | conn dropped | conn dropped |
| heading | 결승 | 준결승 | 8강 | 16강 | 32강 | 64강 | 128강 | — | — | — | — |

`iBLCode` ∈ `{2,4,8,16,32,64,128}` are the only useful values; `1` and `256` return
`200` with a **zero-byte** body, and `sur`/`set` make the server drop the connection
(`status 0`). The same list is what the `select#sel_Round` options on
`admin_en/contest_result_sur.asp` offer (`2,4,8,16,32,64,128,sur,set`) — read off
the page in `v3_app_contest_result_sur_271.html`.

**Paging:** `iPage` is 1-based, **20 rows per page**. 167's 128-bracket = 20+20+20+4
= **64 PSTCodes** over 4 pages, union matches `parsed_matches["167"].matches.length`
(127 matches over all rounds). Page 5 returns an empty body.

**`txt_Search` must be present** (empty is fine). Omitting it entirely makes the
request fail (`status 0`, no response). A player name filters across brackets:
`iBLCode=128&iPage=1&txt_Search=조건휘` → 7 rows including `98885` (the final) and
`98883` (the semi) — i.e. search ignores `iBLCode`, handy for "find the PSTCode of a
given player's match".

### 1.3 Generality

`iBLCode=2` returns exactly one row for `TourCode` 270 (LPBA 2026), 167 (2023),
164 (2023), 34 (2020) — tours back to 2020 are covered. `TourCode=1` returns
zero bytes (no such tour). Artifacts: `v3_setrows_271_ibl{2,128}.html`,
`v3_setrows_167_ibl{2,16}.html`, `v3_setrows_167_ibl128_p2.html`,
`v3_setrows_270_ibl2.html`.
Not checked: whether a *team-league* round (a TLG `MATCH_CODE`) is reachable here —
it should not be, TLG lives on `team.pbatour.org` (§3).

### 1.4 The rest of the chain (`PSTCode` → per-set → per-inning) — re-confirmed

```
GET https://app.pbatour.org/mob/contest_new/admin_en/live_info_setview.asp?PSTCode=98885
   → var gameNumber = "187614|1|end,187615|2|end,187616|3|end,187617|4|end,187618|5|end,187619|6|end,187620|7|end,";
GET https://app.pbatour.org/mob/contest_new/admin_en/live_info_setview.asp?PSTCode=68308
   → var gameNumber = "139146|1|end,139147|2|end,139148|3|end,139149|4|end,139150|5|end,…";   (agrees with your note)
GET https://app.pbatour.org/mob/contest_new/admin_en/contest_result_setview.asp?TourCode=271&PSTCode=98885
   → same data, but the PCGMCode list is emitted DESCENDING: "187620|7,…,187614|1,"
GET https://app.pbatour.org/mob/contest_new/code_behind/contest_result_set_help.asp?PSTCode=98885
   → match aggregate: 조건휘 VS 마르티네스, 4 SET 3, AVG 1.276/1.316, HR 7/11, 58 이닝 57, 74 득점 75, 62 1P 61, 6 2P 7, 55.7% 공격성공율 …
GET https://app.pbatour.org/mob/contest_new/code_behind/contest_result_set_record.asp?PCGMCode=187614
   → per-inning table, cells annotated <!-- 선수1 1P --> <!-- 선수1 2P --> <!-- 선수1 누적점수 --> <!-- 선수2 … -->
     thead carries the names and "(선공)" for the player who broke
```

Use `live_info_setview.asp?PSTCode=` when you only have the PSTCode (that is what the
live list links to) and `contest_result_setview.asp?TourCode=&PSTCode=` when you came
from the results list. Note the set ordering differs (ASC vs DESC) — sort by the
middle field, don't rely on position.

Artifacts: `v3_setview_271_98885.html`, `v3_record_187614.html`,
`v3_app_contest_result_sur_271.html` (the page whose JS produced every parameter above).

---

## 2. QUESTION 2 — the rich per-player stats endpoint — **VERIFIED**

The two parameters that made the old 22-byte failures were **`pbaType` must be the
`PBA1/LPBA1/PBA2/PBA3` form** (bare `PBA`/`LPBA`/`ALL` → empty list) and
**`langCode` is mandatory** (omitting it → empty list).

### 2.1 Working request

```
GET https://www.pbatour.org/en/stats/service/period
    ?startDate=2026-01-01&endDate=2026-11-02
    &pbaType=PBA1&orderBy=%EC%8A%B9%EC%88%98&sort=DESC&langCode=en
Referer: https://www.pbatour.org/en/stats/record
Accept: application/json
```

`200`, **77 464 bytes** on the wire, `result.list` = **179 players** (the saved
artifact is 160 850 B because it is re-serialised with indentation). Saved as
`research/probe/v3_period.json`.

* `startDate`/`endDate` = `YYYY-MM-DD` (exactly `getLocalDateStr()` in
  `research/frontTournamentRecord.js`; feed them `투어시작일자`/`투어종료일자`).
* `pbaType` ∈ `PBA1` (62 events), `LPBA1` (64), `PBA2` (51), `PBA3` (18) — i.e. the
  `LEAGUE_GUBUN` of §1.1. Row counts for a 2026-01-01…2026-11-02 window:
  `PBA1` 179, `LPBA1` 169, `PBA2` 684, `PBA3` 450 (2024-… window; 2026 alone is 0).
* `orderBy` = a **Korean** column name (`승수`, `에버리지`, `하이런`, …). An unknown
  value silently falls back to average.
* `sort` = `DESC`/`ASC`; verified to actually reorder
  (`승수 DESC` → KH Cho 29 wins; `승수 ASC` → SY Jeong 0 wins;
  `하이런 DESC` → Martinez HR 15).
* `langCode=en` → `NameShort`/`NameFull` in English; `langCode=ko` → Korean names
  (same 179 rows, 75 281 bytes).

### 2.2 Field inventory of one row (`result.list[0]`, 33 fields)

```
MemCode        = "M0017111"     NameShort      = "KH Cho"        NameFull = "Keon-hwi CHO"
PBAType        = "PBA"
승수            = 29             패수            = 5
세트 승         = 97             세트 패         = 56             세트 득실 = 44
점수            = 1901           이닝            = 1148
에버리지         = 1.656          하이런          = 12             평균 이닝 = 7.5
공격시도횟수      = 2743           공격성공횟수     = 1692           공격 성공율 = 61.7
1득점 횟수       = 1473           뱅크샷 횟수      = 219            뱅크샷 비율 = 23
장타            = 125            장타율          = 10.9           기대 득점 = 1.7
끝내기 확률      = 3.5            초구 성공율      = 73.1
승부치기 승      = 1              승부치기 패      = 0              승부치기 승률 = 100
승부치기 선공 횟수 = 0             승부치기 선공 승률 = 0
승부치기 후공 횟수 = 1             승부치기 후공 승률 = 100          승부치기 하이런 = 1
```

One naming note: the brief's `승부치기 선공` / `승부치기 후반` are not payload names.
The payload has `승부치기 선공 횟수`, `승부치기 선공 승률`, `승부치기 후공 횟수`,
`승부치기 후공 승률` (`frontTournamentRecord.js:300-303` reads exactly those names, so
the JS and the payload agree). `result` holds only `list` — no totals, no paging
wrapper.

### 2.3 `top5/period` — same shape, different grain

```
GET https://www.pbatour.org/en/stats/service/top5/period
    ?startDate=2026-01-01&endDate=2026-11-02
    &pbaType=PBA1&orderBy=%EC%97%90%EB%B2%84%EB%A6%AC%EC%A7%80&sort=DESC&langCode=en
```

`200`, 37 344 bytes, **135 rows = 27 categories × top 5**. Saved as
`research/probe/v3_top5period.json`. Row shape:

```
{"Innings":28,"Category":"공격성공률","PBAType":"PBA","Value":64.9,
 "NationCode":"KR","MemCode":"M0016827","ImgUrl":"/players/PBA/small/M0016827.jpg",
 "MemName":"정성윤","MemNameEn":"SY Jeong"}
```

`orderBy`/`sort` are **ignored** here (identical bytes for `승수` and `에버리지`);
group by `Category` client-side. The 27 categories:
`공격성공률, 공격성공횟수, 공격시도횟수, 기대득점, 끝내기확률, 뱅크샷, 뱅크샷비율,
세트 득실, 세트 승, 세트 패, 승부치기 선공 승률, 승부치기 선공 횟수, 승부치기 승,
승부치기 승률, 승부치기 패, 승부치기 후공 승률, 승부치기 후공 횟수, 승부치기하이런,
승수, 에버리지, 일점득점, 장타율, 점수, 초구성공률, 패수, 평균이닝, 하이런`
(note the inconsistent spaces: `세트 득실` has one, `승부치기하이런` has none).

---

## 3. QUESTION 3 — team league (`team.pbatour.org`)

### 3.1 All three calls still work — **VERIFIED** (2026-11-02)

```
POST http://team.pbatour.org/mob/code_behind/getPlanResult_new.asp
     Content-Type: application/x-www-form-urlencoded
     body: RoundCode=93&RoundNumber=3 Round&TeamGameNO=38&LangCode=ko
  → 200, 30 743 B.  6 bout rows; viewResultDetail('12657') … viewResultDetail('12662').
    Header: "No 38 하림 용가리즈 vs 하나카드 하나페이  2 : 4  AVG 1.423/2.259  HR 12/12".
    (v3_team_getPlanResult_93_38.html)
```
`RoundNumber` must be the display string `"3 Round"`; `TeamGameNO` is the `N` in
`viewResult('N')` from `getPlanDetailEnd_new2.asp`. `LangCode=en` yields English club
names.

```
GET http://team.pbatour.org/mob/ko/planResultDetail.asp?TGCode=12657
  → 200, 108 732 B, and the page injects the five vars:
      var TPTCode1 = "25317";
      var TPTCode2 = "25318";
      var TieBreakerYN = "N";
      var DoubleYN = "Y";
      var ScotchDoubleYN = "Y";
      var LastInn = "8";
      var InnLimitYN = "N";
      var InnLimitStr = "";
    plus var Add_InnInfo = "<tr>…" (a server-rendered per-inning table) and
    var RefererURL, var LangCode = "ko".
```

```
POST http://team.pbatour.org/mob/code_behind/getPlanResultDetail.asp
     body: TPTCode1=25317&TPTCode2=25318
  → 200, Content-Type: text/html; Charset=utf-8, body is JSON:
     {"MaxInn":"8",
      "InnInfo1":[{"InnScore":"2","OnePoint":"0","TwoPoint":"1","TotalScore":"2"}, …7 items],
      "InnInfo2":[ … 8 items ]}
```

### 3.2 (a) The exact parse for the TPT codes and `LastInn`

The page contains `TPTCode1` **4 times**: one `var` declaration, one `console.log`,
and twice inside the ajax `data:` expression (`"TPTCode1="+TPTCode1`). Anchor on the
`var` form:

```js
const pick = (name, html) =>
  (html.match(new RegExp(`var\\s+${name}\\s*=\\s*"([^"]*)"`)) || [, null])[1];

const TPTCode1      = pick("TPTCode1", html);       // "25317"
const TPTCode2      = pick("TPTCode2", html);       // "25318"
const LastInn       = pick("LastInn", html);        // "8"
const DoubleYN      = pick("DoubleYN", html);       // "Y"
const ScotchDoubleYN = pick("ScotchDoubleYN", html);// "Y"
const TieBreakerYN  = pick("TieBreakerYN", html);   // "N"
```
A looser `TPTCode1\s*=\s*"?(\w+)` also works today but would match the `data:` line if
the var were ever removed. `TGCode` comes from the fixture fragment
(`viewResultDetail\('(\d+)'\)`), **not** from this page.

### 3.3 (b) `TotalScore` is **cumulative**, `InnScore` is per-inning — **VERIFIED**

For `TPTCode1=25317`:
`InnScore` = `2,0,3,4,0,0,0` → running sum `2,2,5,9,9,9,9` = `TotalScore` exactly.
`OnePoint + 2*TwoPoint` reproduces `InnScore` for both players (9/9 innings checked),
so `OnePoint`/`TwoPoint` are **counts of 1-point and 2-point scoring events** in that
inning and `InnScore` is the **points scored in that inning**. Therefore:
`delta = TotalScore[i] - TotalScore[i-1] === InnScore[i]`, and
`에버리지 = points / innings` can be rebuilt from `MaxInn`.
`MaxInn` is the fixture's inning cap (`"8"` here) and may exceed `InnInfo1.length`
(player 1 stopped at 7); `len(InnInfo1) ≠ len(InnInfo2)` is normal (the second player
took the last inning).

### 3.4 (c) An in-progress round: yes — **VERIFIED on round 94** (…-11-08)

```
POST http://team.pbatour.org/mob/code_behind/getPlanDetailEnd_new2.asp
     body: RoundCode=94&RoundNumber=4 Round&LangCode=ko      → 45 fixtures
```
Same three calls then work unchanged on played fixtures of round 94:
`TeamGameNO=3` → 7 bouts `12709…12715`;
`TPTCode1=25421&TPTCode2=25422` → `MaxInn "5"`, 5+5 innings.
Artifacts: `v3_team_planEnd_94.html`, `v3_team_result_94_{3,5,10,12,22,30}.html`,
`v3_team_planResultDetail_12709.html`, `v3_team_getPlanResultDetail_12709.json`.
For a fixture that has **not** started, `getPlanResult_new.asp` still returns the
seven named set lineups with `예정` / `-` stats. For a fixture that is **live** it
returns the current set as a `teamleague-status-list_item` — see §3.6.

### 3.5 The live board — `http://team.pbatour.org/mob/ko/live.asp` — **VERIFIED LIVE**

Unlike `app.pbatour.org`, this board is **fully server-rendered**: one full HTML page,
**no ajax at all** (only `$.ajaxSetup` from the shared helper is present; `youTubeHelp`
appears only as its own definition). It self-refreshes with
`setInterval(pageReload, 30000)` → `location.reload()`, so poll it by re-fetching
every ~30 s. `?LeagueCode=1018&RoundCode=94` is accepted and only changes link targets.

Empty state: `<div class="conte_info"><p>해당 내역이 없습니다.</p></div>` (117 307 B page).
**A live fixture appeared mid-session and was captured** — `v3_team_live_populated.html`
(143 706 B, server date `2026-11-02 06:00 UTC`), extracted block in
`v3_team_live_fixture_block.html`. Structure:

```html
<div class="teamleague-status-listbox"><ul class="expanded">
  <li class="in-progress">                     <!-- the set being played -->
    <div class="set_game">
      <div class="tbl_info"><span>PBA 라운지</span>|1 Set|inn 1   <!-- venue | set | inning -->
        <a href="javascript: pushBridge.openWebBrowser('https://www.youtube.com/watch?v=0_NI_JJX9_Q');"
           class="onair-but">On Air</a>
      <ul class="score_01">
        <li><a onclick="comPlayerInfoTour('ko','','25457','에스와이 빌더스')">
              <span class="set_point">0</span>                  <!-- team set score -->
              <span class="point_box01"><span class="number0">2</span>   <!-- points this set -->
                <span class="n_col">하샤시,모리</span>          <!-- pair at the table -->
                AVG 2.000   HR 2
        <li>… 웰컴저축은행 웰컴피닉스 (25458), 조건휘,산체스, 0, AVG 0.000, HR 0
  <li class="completed">  <div class="set_box">           <!-- × 6: the other sets -->
      SET 7 | Result Player Point/inn Avg HR | 예정 최원준1 - - - | 예정 조건휘 - - -
  … SET 6 … SET 5 … SET 4 … SET 3 … SET 2
```

So a populated board gives, per live fixture: **venue, current set number, current
inning, both team names + team codes (`25457`/`25458` → `T00021`/`T00002` logos),
the two players currently at the table, their running points for the set, their AVG
and HR, the team set score, the YouTube live URL, and the schedule/state of the other
sets (`예정` / score). Note `li.completed` is a **CSS collapse state**, not "finished
set" — see `.teamleague-status-listbox ul li.completed{display:none}` in the page.
A `ko` and an `en` build both exist: `/mob/ko/live.asp` and `/mob/en/live.asp`
(143 962 B in the same live window, `v3_team_live_en.html`).

### 3.6 Live per-bout state via `getPlanResult_new.asp` (better than the board)

The fixture fragment carries the *same* live information and is easier to parse. For
the fixture that was live at capture time (`v3_team_result_live_29.html`, round 94
`TeamGameNO=29`, 하림 용가리즈 vs 휴온스 헬스케어 레전드, 0:0):

```html
SET 1 | 2026-11-02 15:04 | GP11
  <a href="javascript: youTubeHelp('https://www.youtube.com/watch?v=bvplAmHzc8o','ko');"
     class="paper">Live</a>
<div class="teamleague-status-list_items"><div class="teamleague-status-list_item">
  <div class="teamleague-status-box"><span><p>P.응우옌<br/>쩐득민</p></span>
                                   <span><p>PLAYER</p></span>
                                   <span><p>강동궁<br/>모랄레스</p></span></div>   <!-- left | mid | right -->
  <div class="teamleague-status-box"><span><p>11</p></span><span><p>GP</p></span><span><p>11</p></span></div>
  <div class="teamleague-status-box"><span><p>1/1</p></span><span><p>PT/INN</p></span><span><p>0/1</p></span></div>
  <div class="teamleague-status-box"><span><p></p></span><span><p>AVG</p></span><span><p></p></span></div>
  <div class="teamleague-status-box"><span><p>1</p></span><span><p>HR</p></span><span><p>0</p></span></div>
</div></div>
```

Read it as **one 3-cell row per metric: left value | label | right value** (`GP`,
`PT/INN`, `AVG`, `HR`). So at capture: game to 11 points, side A on 1 point in 1
inning, side B on 0 points in 1 inning, HR 1 vs 0, `AVG` blank while the set runs, the
middle name cell literally reads `PLAYER` (the second partner of a doubles pair not
yet decided). Sets 2-7 render `예정` with `-` stats.

**Important negative:** on a live fixture this fragment contains **no
`viewResultDetail(...)` link at all** (`TGCodes=0`; same for `TeamGameNO=6`,
`v3_team_result_live_6.html`). TGCodes — and therefore the innings JSON of §3.3 —
appear only once a bout is *finished*. So: live set score from
`getPlanResult_new.asp` (or the `live.asp` board); per-inning detail only after the
bout completes.

---

## 4. Dead / do-not-retry — corrected against the earlier `alt_report.txt`

| Endpoint | Result today |
| --- | --- |
| `https://app.pbatour.org/mob/contest_new/code_behind/contest_result_sur.asp` | **WORKS — 200 with rows.** `alt_report.txt` called it "200 but 206-byte stub"; that stub was the missing-`Referer` alert page (§0). Retry it properly. |
| `https://app.pbatour.org/mob/contest_new/` | 403.14 (confirmed) |
| `https://app.pbatour.org/mob/teamleague/contest_schedule.asp` | 404.0 (confirmed) |
| `https://www.pbatour.org/en/teamLeague/ajax/{gameResult,matchList}` | 404 (confirmed, not retried further) |
| `https://www.pbatour.org/en/teamLeague/stats/ajax/{getTeamGameList,gameList}` | 404 (confirmed) |
| `https://www.pbatour.org/en/stats/record` | **404** — that SPA route does not exist; the real stats page is elsewhere. Its 387-byte body is `v3_stats_page.html`. Don't use it as a `Referer` source of truth (the endpoint ignores `Referer`). |
| `http://team.pbatour.org/mob/code_behind/getLeagueInfoSub2026.asp` | 404 (confirmed) |
| `http://www.billiboard.co.kr/mob/**` | empty shells (confirmed) |
| `GET code_behind/contest_result_sur.asp` with `iBLCode` ∈ `{sur,set}` | connection dropped (`status 0`); `iBLCode` ∈ `{1,256}` → zero-byte 200 |
| `GET code_behind/contest_result_sur.asp` without `txt_Search` | `status 0`, no response — always send `txt_Search=` |
| `GET /en/stats/service/period` with `pbaType=PBA|LPBA|PBA3(2026)|ALL` or without `langCode` | 200 but `{"result":{"list":[]}}` (22 bytes) |
| `POST /en/stats/service/period` | 405 |
| `http://team.pbatour.org/mob/ko/{upcoming_matches,match_results}.asp` | 200 but rendered **empty** (99 515 / 99 428 B shells, no `set_box`, no rows) — they are tab shells, the content comes from `planDetail`-style POSTs |

## 5. Four extra `code_behind` endpoints found on the way (all used by the app's own UI)

| Endpoint | Params | Returns |
| --- | --- | --- |
| `https://app.pbatour.org/mob/contest_new/code_behind/contest_result_set.asp` | `TourCode`, `iBLCode`, `iPage`, `txt_Search` | set-format result rows (`128R 대진 결과 (세트 경기)`, `No 1 … 128강`, `Set 15,15,15`, `Avg`, `HR`, `W`). **Ignores `iBLCode`** — byte-identical 87 659 B body for `iBLCode=2` and `=128` (TC 271), so it is a fixed first page of the 128 bracket. `v3_setrows_set_271_ibl2.html` |
| `https://app.pbatour.org/mob/contest_new/code_behind/contest_result_sur_s2.asp` | `TourCode`, `iBLCode`, `iPage`, `txt_Search`, `PcPnCode` | second-stage / 본선 rows: 3 740 B final row (`조건휘 4 / 마르티네스 3`). |
| `https://app.pbatour.org/mob/contest_new/code_behind/tour_info.asp` | `TourCode` | **JSON** (222 B) — a second JSON surface on app: `[{"투어코드":"271","티켓이미지":"","투어정보":"…/TOUR271_INFO_KR_….jpg","투어정보EN":"…","앱링크":"","웹링크":""}]`. `v3_tour_info_271.html` |
| `https://app.pbatour.org/mob/contest_new/code_behind/contest_headToHead_set_help.asp` | `SeasonStart`, `SeasonEnd`, `MemCode1`, `MemCode2` | 15 631 B head-to-head table with per-season W/L, `승률`, `AVG` (what `matchlayer(...)` opens). `v3_h2h_help.html` |

## 6. Still open

* `app.pbatour.org/mob/contest_new/code_behind/live_info.asp` was **57 bytes**
  (`<style>.pt5{padding:5px 1px !important}</style>`) on every attempt today. The
  likely reason (`INFERRED`, not proven): the only fixture running was a
  *team-league* match and this list covers individual tours only — the site shows
  that fixture on `team.pbatour.org` instead. Its populated shape (rows +
  `setview(...)` + a `youTubeHelp('<url>','ko')` link) therefore remains
  **NOT VERIFIED**. Empty captures: `research/probe/v2_live_info_271.html` (59 B),
  `frag_live.html` (57 B), `v2_live_info_empty.html` (59 B).
  What *is* verified about that page: `admin_en/live_info.asp` defines
  `setview(PSTCode) → openWindow("…/live_info_setview.asp?PSTCode="+PSTCode)` and polls
  `code_behind/live_info.asp` with `data:{TourCode: TourCode}` every 30 s.
* No endpoint exposes a team-league `PSTCode`; team league keys on
  `TGCode` (bout) / `TPTCode` (player side of a bout) / `TeamGameNO` (fixture) only.
* `team.pbatour.org` has no JSON list of rounds; `getPlanLeagueList.asp` (POST
  `SeasonCode=2026&LangCode=ko`) is the only way to learn `LeagueCode 1018` /
  `RoundCode 91…94`, and `RoundNumber` must be spelled `"N Round"`.
