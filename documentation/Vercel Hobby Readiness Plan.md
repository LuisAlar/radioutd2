# Vercel Hobby Readiness Plan

Nov 10, 2026 · @luis

## Summary

The radioutd2 project went over a Hobby plan limit, the site was paused on Nov 3, and we moved to Vercel Pro (about $20/month) to get it back up. A fix has been live since Nov 3.

The goal is to go back to the free Hobby plan once we have data showing we fit. While we are on Pro, we track our usage against the Hobby limits. When a full 30 days after the fix stays comfortably under every limit, we downgrade.

- **What broke:** Fast Origin Transfer, at about 280% of the Hobby limit at the October rate.
- **What we expect after the fix:** transfer drops to about 13% or less. Requests and invocations were already under half the limit.
- **What to watch:** Active CPU. It was close to the limit and the fix probably reduces it, but we haven't proven that yet.
- **Earliest decision date:** about Dec 4, 2026, once a full 30-day window after the fix exists.

Related: [Vercel Fast Origin Transfer Fix — Change Log](Vercel%20Fast%20Origin%20Transfer%20Fix%20—%20Change%20Log.md).

## Key terms

| Term | What it means for us |
| --- | --- |
| **Fast Origin Transfer** | Bytes sent between Vercel's CDN and our API functions. Every response that isn't served from the cache counts toward it. Hobby limit: 10 GB. |
| **Fast Data Transfer** | Bytes sent from Vercel's CDN to listeners' browsers. Cached responses count here instead of toward Origin Transfer. Hobby limit: 100 GB. |
| **CDN Requests** | Every request to the site, including ones served from the cache. Hobby limit: 1,000,000. |
| **Function Invocations** | How many times an API function actually runs. Hobby limit: 1,000,000. |
| **Active CPU** | CPU time our functions spend working (not waiting on the database). Hobby limit: 4 hours. |
| **Rolling 30 days** | Hobby limits apply to the last 30 days, not a calendar month. Going over pauses the site; there's no option to pay for overages. |

## What happened

The Snow tuner page polls our API every 15–30 seconds from every open tab. Before the fix, none of those responses were cached, and `get-current-show` returned the show's whole playlist on every poll.

Usage for the 30 days ending Nov 3, from the Vercel dashboard. Almost all of it fell between Oct 21 and Nov 3 (about 13 days), so the third column shows the rate during those days scaled to 30 days. That's the rate we would actually be judged on.

| Metric | Hobby limit | Dashboard (30 days) | Rate scaled to 30 days | % of Hobby |
| --- | --- | --- | --- | --- |
| Fast Origin Transfer | 10 GB | 12.21 GB | ~28 GB | **~280%** |
| Active CPU | 4 h | 3 h 16 m | ~7.5 h | **~190%** |
| CDN Requests | 1M | 192K | ~440K | ~44% |
| Function Invocations | 1M | 190K | ~440K | ~44% |
| Provisioned Memory | 360 GB-hrs | 21.7 GB-hrs | ~50 GB-hrs | ~14% |
| Fast Data Transfer | 100 GB | 302 MB | ~0.7 GB | <1% |

What the numbers tell us:

1. **Nothing was cached.** Invocations (190K) almost equal requests (192K), so about 99% of requests ran a function.
2. **Responses were large.** 12.21 GB ÷ 190K is about 64 KB per response on average. That's more than the tuner playlist alone can explain. We still need to find out which endpoint sent the most data (see "Open questions").
3. **Active CPU would have been the next limit to break,** even if transfer had been fine.

## What the fix changed

All of these changes have been live since Nov 3. Full details are in the change log.

| Change | Effect |
| --- | --- |
| CDN caching on `get-current-show` and `get-current-song` (15 s) | Listeners share one cached response, so some function runs and some Origin Transfer move to Fast Data Transfer. This helps most when several people listen at once. |
| `get-current-show` returns at most 20 songs | Each response is now about 1–3 KB instead of growing all show. **This is the biggest transfer saving.** |
| Tuner doesn't poll while the tab is hidden | Fewer requests, invocations and CPU. |
| Action-link polling removed | That poll was about a quarter of all requests. |

Verified on Nov 10: the live API returns `X-Vercel-Cache: HIT`, and `get-current-show` is 937 bytes.

## Expected usage after the fix

These are estimates. The tracking below is how we confirm them.

| Metric | Expected | Risk |
| --- | --- | --- |
| Fast Origin Transfer | Under about 1.3 GB per 30 days (~13%) even if traffic stays the same, because responses are now small. | Very low |
| CDN Requests | Under 44%. The fix only lowers this. | Low |
| Function Invocations | Under 44%. | Low |
| **Active CPU** | Must fall by about 47% just to fit, and by about 63% to leave 30% headroom. Likely, but not yet proven. | **Watch this** |

Why CPU is uncertain: with only one or two listeners at a time, a 15-second cache is rarely reused, so it doesn't save many function runs. Most of the CPU savings come from removing the action-link poll, from hidden tabs not polling, and from smaller database queries.

If CPU is too high, there's a quick fix that needs no change to the tuner: cache `get-current-show` for 60 s and `get-current-song` for 30 s. The trade-off is that now-playing updates in the tuner lag a little longer after a song change.

## How we track it

We use [scripts/vercel-usage-vs-hobby.mjs](../scripts/vercel-usage-vs-hobby.mjs). It pulls daily usage from Vercel's billing API, which keeps one year of history, and compares it with the Hobby limits.

**One-time setup:** create a token at vercel.com/account/tokens and find the team ID in team Settings.

```sh
export VERCEL_TOKEN=...
export VERCEL_TEAM_ID=team_...

# First run: check that Vercel's product names and units match what the script expects
node scripts/vercel-usage-vs-hobby.mjs --dump

# Weekly: rolling 30 days vs Hobby, before/after the fix, and a CSV for the record
node scripts/vercel-usage-vs-hobby.mjs --split 2026-11-04 --csv documentation/usage/usage-YYYY-MM-DD.csv

# Full history since before the incident, one row per day
node scripts/vercel-usage-vs-hobby.mjs --from 2026-10-04 --split 2026-11-04 --daily
```

The output has two tables:

- **Main table:** usage in the window, % of each Hobby limit, the busiest day, a projection from the last 7 days, and a verdict of `ok`, `TIGHT` (over 70%) or `OVER`.
- **`--split` table:** the rate before and after the fix. It counts only days with usage, so quiet days don't hide the real rate.

Also check the project's **Observability** tab in Vercel. It breaks down requests, invocations, CPU and transfer by route, so it shows which endpoint is the expensive one.

## Decision rule

Agree on this before the results come in. We downgrade to Hobby when all three are true:

1. **A full 30-day window after the fix** (Nov 4 or later) has every metric under **70%** of its Hobby limit. For Active CPU, that's under about 2.8 hours.
2. **The rate during normal show weeks** (`--split`, after the fix) is also under 70%. Thanksgiving and finals bring less traffic, so a quiet window alone isn't enough proof.
3. **No metric is getting worse** in the weekly CSVs.

Why 70%: Hobby can't pay for overages. Going over pauses the site, which is what happened on Nov 3, so we want room for a busy month.

If Active CPU is the only metric over 70%, apply the longer cache times first, then measure again for another 2–3 weeks.

## Timeline and checklist

- [ ] **Nov 10–14:** run `--dump` and check the names and units. Run the full-history command and save the CSV.
- [ ] **Nov 10–14:** check Observability to see which route uses the most CPU and transfer.
- [ ] **Weekly (Mondays):** run the weekly command and commit the CSV to `documentation/usage/`.
- [ ] **About Dec 4:** first full 30-day window after the fix. Apply the decision rule.
- [ ] **If we pass:** downgrade to Hobby. Keep running the weekly check for the first month on Hobby.
- [ ] **If CPU is tight:** apply the longer cache times and measure again.
- [ ] **Before downgrading:** confirm the station's use fits Hobby's personal, non-commercial terms.

## Open questions

- **What made responses average 64 KB?** The tuner playlist alone doesn't explain it. To find out, check Observability or rebuild the old response sizes from the database.
- **Why did usage start on Oct 21?** That date matches the deploys that moved the API folder. Observability or the function logs can show the endpoint and the referrer.
- **Does the billing API show usage that's included free in Pro?** It should list quantities even when the cost is $0. The first `--dump` run will show this.

## Sources

- [Vercel Hobby plan limits](https://vercel.com/docs/plans/hobby)
- [Vercel billing charges API](https://vercel.com/docs/rest-api/billing/list-focus-billing-charges)
- Vercel Usage dashboard screenshots, Nov 3, 2026: `Screenshot 2026-11-03 174218.png`, `Solution.visual.png`
