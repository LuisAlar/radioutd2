# Vercel Fast Origin Transfer Fix — Change Log

Nov 3, 2026 · @luis

## Summary

The radioutd2 Vercel project went over the Hobby plan's 10 GB monthly Fast Origin Transfer limit, about 11–12 GB from Oct 21 to Nov 3, 2026. This has happened before. The cause is the Snow tuner page: every open tab polls the API every 15–30 s, and `/api/get-current-show` returned the whole show's playlist on each poll with no caching.

The fix has two parts:

- **Server (Vercel API):** CDN caching on the three public endpoints, and a 20-song cap on the current-show response.
- **Client (Snow tuner):** no polling while the tab is hidden, a slower action-link poll, one bug fix, and a cache-busting version bump to `?v=3`.

## Evidence

Usage was close to zero until Oct 21. After that it ran 0.2–2.2 GB a day, all of it outgoing.

&#91;image: Vercel Fast Origin Transfer, Oct 4 – Nov 3, 2026\]

How to read the chart:

- **Fast Origin Transfer** is the data moving between Vercel's CDN and the serverless functions in `/api/*`. It measures bytes, not time.
- **Incoming** is data sent into the functions (query strings, POST bodies). It is 0 B because the requests are tiny GETs.
- **Outgoing** is data the functions send back (the JSON responses). Every response not served from the CDN cache counts toward the 10 GB.
- The grey Oct 7 bar and the "0 B / 0.0%" totals are only the hover state on a day with no data.

## Root cause

Most of the transfer came from the current-show endpoint: it was polled constantly, never cached, and its responses grew all show long.

| Factor | Detail |
| --- | --- |
| Tuner polling | Each open tab calls `get-current-show` every 30 s, `get-current-song` every 15 s and `get-action-link` every 30 s, including tabs left in the background. One tab open all month makes about 345,600 requests. |
| Growing response | `get-current-show` returned every song since the show started, because the tuner never sends `minDate`. Late in a 3–4 hour show a response is about 10+ KB. One tab open all month moves close to 1 GB. |
| No CDN caching | No endpoint set `Cache-Control`, so 50 listeners meant 50 function runs every 30 s, all with identical data. |
| Weekly pattern | Sundays (Oct 25, Nov 1) are near zero and Saturdays are small. With no show scheduled, the endpoint returns a tiny error instead of a playlist, so the large bars match show days. |

Not a cause: Zetta calling `add-song`. It runs once per song and returns `OK`. `get-current-song` returns about 100 bytes per request, so its cost is minor.

Open question: usage began on Oct 21, when the Oct 17–21 deploys landed (the API folder was moved and then moved back). The Vercel Projects tab and the function logs can confirm which endpoint and referrer the traffic came from.

## Server-side changes (Vercel API)

The three public endpoints are now cached by Vercel's CDN, so the function runs about once per cache window instead of once per listener per poll. Cached responses count toward Fast Data Transfer (100 GB on Hobby), not the 10 GB origin limit.

| File | Change |
| --- | --- |
| `utils/set-cdn-cache.js` (new) | Helper that sets `Cache-Control: public, s-maxage=N, stale-while-revalidate=2N`. Only called on successful (200) responses, so errors are never cached. |
| `api/get-current-show.js` | Cached for 15 s. Returns at most the 20 most recent songs (`MAX_SONGS = 20`), newest first, so the response size no longer grows during a show. |
| `api/get-current-song.js` | Cached for 15 s. |
| `api/get-action-link.js` | Cached for 60 s, since action links rarely change. |

Side effects:

- Now-playing in the tuner can lag a song change by about 15–45 s.
- After saving a new action link in `/mgmt/action-link`, the old one may show for up to 1–2 minutes.
- The tuner's song history shows only the last 20 songs. Raise `MAX_SONGS` if that is too few.

The Zetta `add-song` endpoint and the admin endpoints are unchanged.

## Client-side changes (Snow tuner)

Both files live in `/tuner/` on the Snow WordPress site. They were edited with exact find-and-replace on the live copies downloaded on Nov 3, 2026, so nothing else changed.

| File | Change |
| --- | --- |
| `index.a786fc7a.js` | `pollShow`, `pollSong` and `pollActionLink` send no request while the tab is hidden (`document.hidden`). They check again on the next tick, and the page refreshes within 15–30 s of the listener returning. Audio is not affected. |
| `index.a786fc7a.js` | The action-link poll runs every 5 min (`3e5`) instead of every 30 s. |
| `index.a786fc7a.js` | Bug fix: a failed song request called `displayUnknownSong()`, which doesn't exist. It now calls `displayUnknownSongs()` and shows "\[Unknown song\]". |
| `index.html` | The script tag's cache-busting param went from `?v=2` to `?v=3`. |
| `index.html` | Both Cloudflare beacon `<script>` tags were removed. Cloudflare adds the beacon when it serves the page; copies saved from the browser had it baked in, which created a duplicate. |

Rule for future edits: increase `?v=` every time the JS changes, and edit the server copy rather than a page saved from the browser.

## Why `minDate` was not adopted

The tuner does not send `minDate`, because it would stop the CDN cache from working. The CDN caches one response per exact URL. Without `minDate`, every listener requests the same URL and shares one cached copy. With it, each listener sends a different timestamp, misses the cache, and reaches the function on every poll.

It would also need more client work: the tuner redraws the whole song history from each response, so it would have to append new songs and reset when the show changes. The 20-song cap already solves the problem `minDate` was meant to solve, which was responses growing during a show.

## Deployment and verification

Deploy the server first. It does most of the work.

- [ ] Commit and push the API changes; confirm the Vercel deploy succeeded
- [ ] Run `curl -sI https://radioutd2-pied.vercel.app/api/get-current-show` twice within 15 s; the second run shows `x-vercel-cache: HIT`
- [ ] Upload `index.a786fc7a.js` to `/tuner/`, replacing the old file
- [ ] Upload `index.html` to `/tuner/`, replacing the old file
- [ ] View the tuner's page source: the script tag ends in `?v=3`
- [ ] Search the page source for `beacon`: exactly one. If none, paste one beacon tag back in before `</body>`
- [ ] DevTools → Network: hide the tab for a minute; no `get-current-*` requests while hidden
- [ ] Watch Fast Origin Transfer in the Vercel Usage dashboard over the next few weekdays; daily bars should drop sharply

## Follow-ups

- [ ] **Secrets in git:** `.env` is tracked in the repo (it was committed before `.gitignore` excluded it), so `MONGODB_URI` and the passwords are in the history. Rotate them and run `git rm --cached .env`.
- [ ] **Passwords in URLs:** `add-song` and `get-comments` take passwords as query parameters, so they appear in Vercel logs. Consider moving them to a header.
- [ ] **Confirm the source:** check the Vercel Projects tab and function logs to confirm which endpoint and referrer drove the Oct 21+ traffic.
- [ ] **Fallback:** if usage stays over 10 GB after these changes, Vercel Pro (about $20/month) raises the limits.
