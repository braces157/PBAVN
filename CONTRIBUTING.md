# Contributing

## Setting up

```bash
npm ci
npm run dev          # http://localhost:3100
```

Node 20.9 or newer. No API key, account or environment variable is needed: the data
comes from the association's public service.

## Before you open a pull request

```bash
npm run lint         # tsc --noEmit
npm run build
npm start &          # in another terminal
npm run verify       # drives a real browser and asserts the interactions
```

`npm run verify` launches its own headless Chrome or Edge. Set `CHROME_PATH` if neither
is on a standard path. CI runs the same three steps, so a green local run means a green
build.

If you touched anything under `src/lib/pba/data/`, run `npm run refresh-data` and commit
the result. CI fails when those artefacts are stale.

## Reviews

Every pull request gets a CodeRabbit review on the diff, from
`.github/workflows/coderabbit-review.yml`: it runs the CodeRabbit CLI when the pull
request opens and again on every push, and leaves one comment that is rewritten in place
rather than one comment per push. Each run reads the whole diff from the merge base, so a
push that breaks an earlier hunk is caught as well as the hunk itself. The CodeRabbit
GitHub App, if it is installed, may review alongside it.

The workflow needs a `CODERABBIT_API_KEY` repository secret. Without it the job says so
and skips rather than failing every pull request. Both reviews are advisory: they raise
findings, they do not gate. The gates are `npm run lint`, `npm test`, `npm run build`
and `npm run verify` in `ci.yml`, and a finding worth keeping belongs in a commit.

`.coderabbit.yaml` carries the conventions from below, so a reviewer that has not read
this file still notices when a change breaks them.

## Project shape

```
src/app/                 routes; every one is a server component
src/app/api/             route handlers: live polling, search index, photo proxy
src/components/domain/    things shaped like the data: tables, cards, sub-nav
src/components/ui/        primitives with no domain knowledge
src/lib/pba/             upstream transport, endpoint wrappers, raw types
src/lib/normalize.ts     raw upstream shape to domain model
src/lib/format.ts        dates, money, averages, text
```

Read `src/lib/pba/http.ts` first. It carries the three upstream quirks (no CORS, a
broken TLS chain, a failure record) that explain why the data layer looks the way it
does.

## Conventions

**Data flows one way.** Upstream JSON is parsed at the boundary in `src/lib/pba`, typed
in `pba/types.ts`, and converted to domain models in `normalize.ts`. Components never
see a raw upstream field or a Korean column alias.

**Filtering lives in the URL.** Every filter is a query parameter rendered as a link.
That keeps views shareable and server-rendered. If you add a filter, thread it through
the existing `FilterRow` call sites rather than inventing a second mechanism.

**Sorting lives in the client.** Tables ship rows the server already rendered; one
component reorders them. Do not add a server round trip for a sort.

**No function props across the server boundary.** A client component cannot receive a
render function from a server component. Tables pass serialisable cell values, not
callbacks.

**Comments explain why.** Anything the code cannot show belongs in a comment. Anything
it can show does not.

## Reporting a data problem

Statistics are reproduced from `pbatour.org`. If a figure here disagrees with the
official site, the official site is right, and the fix belongs upstream. Open an issue
describing the discrepancy and where you saw it.

A feed returning nothing is usually the association's service, not a bug here. Set
`PBA_OFFLINE=1` to see how the site degrades when the upstream is unreachable.
