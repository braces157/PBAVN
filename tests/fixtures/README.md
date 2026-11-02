# Scoring-terminal fixtures

Real responses from the association's scoring terminal, saved so the parsers can
be tested without a network and so the markup contract is visible in review.

| File | Source |
| --- | --- |
| `match-68308.html` | `admin_en/live_info_setview.asp?PSTCode=68308&LangCode=en` — five sets, race to 15 |
| `totals-68308.html` | `code_behind/contest_result_set_help.asp?PSTCode=68308&LangCode=en` |
| `set-139146.html` | `code_behind/contest_result_set_record.asp?PCGMCode=139146&LangCode=en` — one set, turn by turn |
| `bracket-final.html` | `code_behind/contest_result_sur.asp?TourCode=167&iBLCode=2` — the Korean default |
| `bracket-english.html` | the same row with `&LangCode=en`, which is what the app requests |
| `bracket-r16.html` | `code_behind/contest_result_sur.asp?TourCode=167&iBLCode=16` |
| `search-tour271-cho.html` | `code_behind/contest_result_sur.asp?TourCode=271&iBLCode=128&iPage=1&txt_Search=Cho&LangCode=en` — 16 rows across 7 round headings |
| `search-empty.html` | the same terminal's answer to a Korean search term with `LangCode=en`: a 0-byte body, which is a real "no rows", not a failure |
| `team-fixtures-93.html` | `POST team.pbatour.org/mob/code_behind/getPlanDetailEnd_new2.asp` for finished round 93 — 45 played fixture blocks |
| `team-fixtures-94-scheduled.html` | the same endpoint for round 94 while it was still to be played — 34 scheduled `content_block` blocks |
| `team-bouts-38.html` | `POST team.pbatour.org/mob/code_behind/getPlanResult_new.asp` (`TeamGameNO=38`) — score board and six bouts with record-sheet links |
| `team-bouts-live.html` | **reconstructed**, not saved: a live fixture fragment shows the running set and no record-sheet links until a bout finishes, but no probe caught that state. Built from the documented live shape, using the same markup the saved bout fragments carry |
| `team-bout-detail-12657.html` | `GET team.pbatour.org/mob/ko/planResultDetail.asp?TGCode=12657` — the page carrying the `TPTCode1` / `TPTCode2` / `LastInn` variables |
| `team-innings-12657.json` | `POST team.pbatour.org/mob/code_behind/getPlanResultDetail.asp` (`TPTCode1=25317&TPTCode2=25318`) — per-inning chain, side two one inning longer |

Every file is verbatim except `match-68308.html`, which is truncated before the
first `<div class="set_box">`. The leading 360 KB is the mobile page shell, with
no match data in it.

These are inputs to `npm test`, not reference output. If the association changes
its markup, the tests fail here before a page renders a wrong score.
