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

Every file is verbatim except `match-68308.html`, which is truncated before the
first `<div class="set_box">`. The leading 360 KB is the mobile page shell, with
no match data in it.

These are inputs to `npm test`, not reference output. If the association changes
its markup, the tests fail here before a page renders a wrong score.
