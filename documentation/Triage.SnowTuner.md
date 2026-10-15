# Snow Tuner Request-Rate Diagnosis

## Summary

The Snow tuner bundle is a likely cause of Vercel Hobby-plan usage spikes. Each
open tuner tab polls three Vercel API routes repeatedly. The current show
request is also more expensive than necessary because it returns the full
current-show history each time and does not use the API's `minDate` parameter.

This diagnosis is based on the deployed bundle captured in
`C:\Users\alarc\Downloads\index.a786fc7a.js` on 2026-10-15.

## Requests Per Open Tuner

The bundle defines these update intervals:

| Endpoint | Interval | Maximum requests in 30 days per continuously open tab |
| --- | ---: | ---: |
| `/api/get-current-show` | 30 seconds | 86,400 |
| `/api/get-current-song` | 15 seconds | 172,800 |
| `/api/get-action-link` | 30 seconds | 86,400 |
| **Total** | | **345,600** |

The actual total is slightly lower because the next `setTimeout` is scheduled
after the previous request completes. The table is the useful upper-bound
estimate for a stable connection.

`header-now-playing.js` is not a recurring-polling source. It requests
`/api/get-current-song` once when the header loads.

## Why This Can Exhaust Hobby Usage

Vercel's Hobby plan currently includes 1,000,000 Function Invocations and
1,000,000 Edge Requests per month. See the current [Hobby plan
documentation](https://vercel.com/docs/plans/hobby) and [Vercel pricing
page](https://vercel.com/pricing).

At the current polling rate:

| Concurrent continuously open tuner tabs | Estimated monthly requests | Result relative to 1M |
| ---: | ---: | --- |
| 1 | 345,600 | 34.6% of the allowance |
| 2 | 691,200 | 69.1% of the allowance |
| 3 | 1,036,800 | Exceeds the allowance |

These requests can come from different listeners, several tabs opened by one
listener, displays left open at the station, or external embeds. Other API
traffic, static asset requests, and requests from the radio automation further
reduce the remaining budget.

To determine the precise resource exhausted in a particular month, check the
Vercel Usage dashboard. The relevant metrics are Function Invocations, Edge
Requests, Active CPU, Provisioned Memory, and Fast Data Transfer. MongoDB write
volume alone is not large enough to explain a Vercel usage limit.

## Current-Show Data Transfer and Database Work

The tuner calls `/api/get-current-show` without `minDate`. The API consequently
returns every song played since the current show began on every 30-second poll.
As a show progresses, both the response size and the original database work
grow.

Before the API change, a current show with `N` play records performed:

1. One query to find the current show.
2. One query to find the matching `PlayedSong` records.
3. `N` separate `Song.findOne()` queries to retrieve song metadata.

For example, 50 plays meant 52 database queries. This is an N+1 query pattern:
after the list of `N` plays is retrieved, the application sends one more query
for every individual play.

## Change Made To `get-current-show`

`api/get-current-show.js` now makes one batched metadata query:

1. Find the current show.
2. Find the matching `PlayedSong` records.
3. Fetch all required `Song` documents with one `_id: { $in: songIds }` query.
4. Build the response by matching each play record to the returned metadata in
   memory.

The same 50-play example now performs three database queries rather than 52.
The endpoint's JSON response remains unchanged, so Snow clients do not need a
compatibility update for this server-side optimization.

## Recommended Snow Changes

Apply these in Snow's source files, rather than directly editing the minified
`index.a786fc7a.js` deployment artifact:

1. Track the timestamp of the newest received song and send it as `minDate` on
   later `/api/get-current-show` requests. Keep the existing history in the
   browser and append only newly returned songs.
2. Clear the locally stored history when the returned show changes.
3. Stop polling while the page is hidden and refresh immediately when it becomes
   visible again.
4. Reduce the current-song polling interval from 15 seconds to a cadence that
   matches the source automation's update frequency.
5. Poll the action-link endpoint less often because action links normally change
   infrequently.

Using `minDate` is the highest-value client change because it reduces the
current-show response from "the entire show so far" to "only new songs since the
last successful request."
