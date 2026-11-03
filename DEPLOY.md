# Deploying PBA Hub for free

Verdict: **Vercel Hobby**, with **Netlify free** as the fallback. Cloudflare, static
hosting and the edge runtimes cannot run this app as written. The reasons are below,
measured on this checkout rather than assumed.

---

## Why the usual "just make it static" advice fails

Three facts decide this, all verified on 2026-11-02.

**1. The upstream needs TLS verification turned off.** `www.pbatour.org` still serves a
chain with the intermediate certificate missing. A plain `fetch` from Node fails:

```
FETCH FAIL  221ms  https://www.pbatour.org/en/ajax/leagueInfoList  => UNABLE_TO_VERIFY_LEAF_SIGNATURE
```

Browsers hide this by fetching the missing link themselves. Node does not, which is why
`src/lib/pba/http.ts` falls back to `node:https` with the missing intermediate pinned
into its CA list (`src/lib/pba/certs.ts`) and verification left fully on. Any runtime
that cannot drive `node:https` with a custom `ca` list cannot read the data at all. That
counts out Cloudflare Workers and Pages, Deno Deploy, and every edge runtime.

**2. The site is server rendered, not static.** `next build` reports 16 of 19 routes as
dynamic, and there are three API routes:

| Route | Kind | Why |
| --- | --- | --- |
| 11 pages with `revalidate` | ISR | data fetched at request time |
| `/players`, `/rankings`, `/schedule`, `/teams`, `/news`, `/compare` | dynamic | filtering lives in `searchParams` |
| `/api/live` | dynamic | scoreboard polled every 20 s |
| `/api/photo` | dynamic | sharp resize to WebP |
| `/api/search-index` | cached 1 h | 1,700-row search index |

GitHub Pages and any "drag the `out/` folder" host are out. So is `output: "export"`.

**3. `sharp` is load-bearing.** The photo proxy turns a 110 KB JPEG into a 3.5 KB WebP.
Needs the Node runtime.

---

## Vercel Hobby

Free, no card, and it is the only host where this deploy is genuinely zero config. The
Next.js 15 App Router, ISR, the fetch data cache and `sharp` are all first class.

Limits that matter here (from the [Hobby plan page](https://vercel.com/docs/plans/hobby)):

- 1,000,000 function invocations per month
- 4 CPU-hours per month
- 100 GB data transfer

The one real ceiling is `/api/live`. A scoreboard poll is 20 s per open tab, but the route
already sends `s-maxage=10`, so the CDN collapses concurrent viewers into roughly one
invocation every 10 s. That is about 260k invocations a month for a permanently active
live board, which fits. Traffic would have to be large before CPU-hours bind.

**Deploy it:**

```bash
npx vercel login          # opens the browser
npx vercel --prod         # from this folder, no git repo required
```

Then set the function region to Seoul, `icn1`, in Project Settings. Every page fans out
several sequential calls to a Korean origin, and the default `iad1` in Virginia makes each
one cross the Pacific. Seoul is listed in the
[region table](https://vercel.com/docs/regions), and Hobby plans may pick one.

**The catch.** Hobby is for non-commercial use. A fan site with no ads, no donations and no
paywall is fine. If this ever earns money, move to Netlify free, which allows commercial
use, or pay Vercel $20.

## Netlify free (fallback)

Same shape, close to the same effort, and no commercial-use clause. Connect the repo and
the Next.js runtime handles ISR and the API routes. Limits are 100 GB bandwidth, 300 build
minutes and 125,000 function invocations per month, from the
[free plan announcement](https://www.netlify.com/blog/introducing-netlify-free-plan/).

The invocation cap is eight times tighter than Vercel's, and the live board is what would
eat it, so this is the second choice on headroom alone.

---

## Checklist after the first deploy

Both of these have failed on this stack before, and both degrade quietly rather than
crashing.

1. **Photos are still WebP.** Open any player page and check that an `/api/photo?…` request
   returns `Content-Type: image/webp`. This once failed because the lockfile carried only
   the Windows `@img/sharp-win32-x64` native package; the current lockfile resolves the
   Linux natives and a Vercel install gets them. If sharp ever fails to load there, the
   route catches the failure and serves the raw 640px JPEG instead — the page still looks
   correct, it just gets 25 times heavier.
2. **`/api/live` answers**, even when idle. Right now it returns
   `{"available":false,"lines":[],…}`, which is correct for "no table active". A 500 means
   the `app.pbatour.org` fragment fetch broke, not the JSON API.
3. **No degraded banner** on `/`. The data-status component shows one when upstream calls
   fail, so it is the fastest read on whether the host can reach Korea at all.

## Not recommended, and why

| Option | Outcome |
| --- | --- |
| Cloudflare Pages or Workers | Cannot disable TLS verification, so the data layer returns null everywhere |
| Static export on any host | Needs a server, `next: {revalidate}` and no-CORS upstream |
| Render free | Works on a real Node server, but 15 minute spin-down and a 50 s cold start, and no CDN in front of the dynamic pages |
| Fly.io, Railway | No usable free tier any more |
| Oracle Cloud Always Free, Cloud Run | Cheapest over five years, but a VM or container to babysit and a card on file |
| `cloudflared tunnel --url` | Fastest way to show someone the site from this PC, and it dies with the laptop |

## TLS, one more time

This used to end with "pin the missing intermediate into a `ca` bundle" as a TODO. It is
done: `src/lib/pba/certs.ts` commits the GlobalSign intermediate the upstream omits,
`src/lib/pba/http.ts` trusts only the system store plus that pin, and
`rejectUnauthorized` stays `true` everywhere. The MITM risk of
`rejectUnauthorized: false` is gone, and a TLS-inspecting proxy can still add itself via
`NODE_EXTRA_CA_CERTS`.

Cloudflare remains unviable regardless: Workers cannot run `node:https` with a custom
`ca` list at all, so the fallback path — the only one that can read the upstream — does
not exist there.
