#!/usr/bin/env node
// Compares this team's real Vercel usage (pulled from the billing API while we
// are on Pro) against the Hobby plan's included limits, so we can show with data
// whether radioutd2 would fit on Hobby.
//
// Usage (Node 18+, no dependencies):
//   VERCEL_TOKEN=... VERCEL_TEAM_ID=team_... node scripts/vercel-usage-vs-hobby.mjs
//   ... --days 30                 rolling window ending today (default 30, Hobby resets on a 30-day cycle)
//   ... --from 2026-11-01 --to 2026-11-30
//   ... --project radioutd2       only count rows tagged with this project name or id
//   ... --csv usage.csv           also write one row per day per service
//   ... --dump                    print the raw service names / units / tag keys (run this first)
//   ... --split 2026-11-04        compare the daily rate before vs after a date (the cache fix)
//   ... --daily                   print one row per day per metric (tab-separated, paste into a sheet)
//
// Data source: GET https://api.vercel.com/v1/billing/charges (FOCUS v1.3 JSONL, 1-day granularity)
// https://vercel.com/docs/rest-api/billing/list-focus-billing-charges

import { writeFileSync } from 'node:fs'

// Hobby included usage, from https://vercel.com/docs/plans/hobby (checked 2026-11-10).
// `match` is tested against the FOCUS ServiceName. Units are normalised to `unit`.
const HOBBY_LIMITS = [
  { name: 'Fast Origin Transfer', match: /origin transfer/i, limit: 10, unit: 'GB' },
  { name: 'Fast Data Transfer', match: /fast data transfer/i, limit: 100, unit: 'GB' },
  { name: 'CDN / Edge Requests', match: /(edge|cdn) requests/i, limit: 1_000_000, unit: 'requests' },
  { name: 'Function Invocations', match: /function invocations|invocations/i, limit: 1_000_000, unit: 'invocations' },
  { name: 'Active CPU', match: /active cpu/i, limit: 4, unit: 'hours' },
  { name: 'Provisioned Memory', match: /provisioned memory/i, limit: 360, unit: 'GB-hrs' },
  { name: 'Image Transformations', match: /image transformations?/i, limit: 5_000, unit: 'units' },
]

function parseArgs (argv) {
  const args = { days: 30 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dump') args.dump = true
    else if (a.startsWith('--')) args[a.slice(2)] = argv[++i]
  }
  return args
}

function dayStart (d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

// Converts byte-ish and time-ish units to the limit's unit. Unknown units pass through
// unchanged and are flagged so the numbers are never silently wrong.
function normalise (qty, unit, target) {
  const u = (unit || '').toLowerCase()
  if (target === 'GB') {
    if (/^(gb|gigabytes?)$/.test(u)) return [qty, true]
    if (/^(mb|megabytes?)$/.test(u)) return [qty / 1e3, true]
    if (/^(kb|kilobytes?)$/.test(u)) return [qty / 1e6, true]
    if (/^(b|bytes?)$/.test(u)) return [qty / 1e9, true]
    if (/^(tb|terabytes?)$/.test(u)) return [qty * 1e3, true]
  }
  if (target === 'hours') {
    if (/hour|hr/.test(u)) return [qty, true]
    if (/^(ms|milliseconds?)$/.test(u)) return [qty / 3.6e6, true]
    if (/^(s|seconds?)$/.test(u)) return [qty / 3600, true]
  }
  if (target === 'GB-hrs' && /gb.?h/.test(u)) return [qty, true]
  if (['requests', 'invocations', 'units'].includes(target) && !/byte|gb|mb|hour|sec/.test(u)) return [qty, true]
  return [qty, false]
}

function fmt (n) {
  if (n >= 1000) return Math.round(n).toLocaleString('en-US')
  return n.toFixed(n < 1 ? 3 : 2)
}

async function fetchCharges ({ token, teamId, slug, from, to }) {
  const url = new URL('https://api.vercel.com/v1/billing/charges')
  url.searchParams.set('from', from.toISOString())
  url.searchParams.set('to', to.toISOString())
  if (teamId) url.searchParams.set('teamId', teamId)
  else if (slug) url.searchParams.set('slug', slug)

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    throw new Error(`Billing API ${res.status}: ${await res.text()}`)
  }
  const text = await res.text()
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line))
}

function rowMatchesProject (row, project) {
  if (!project) return true
  let tags = row.Tags
  if (typeof tags === 'string') {
    try { tags = JSON.parse(tags) } catch { return tags.includes(project) }
  }
  return Object.values(tags || {}).some(v => String(v) === project)
}

async function main () {
  const args = parseArgs(process.argv.slice(2))
  const token = process.env.VERCEL_TOKEN
  if (!token) {
    console.error('Set VERCEL_TOKEN (create one at https://vercel.com/account/tokens) and VERCEL_TEAM_ID or VERCEL_TEAM_SLUG.')
    process.exit(1)
  }

  const to = args.to ? new Date(`${args.to}T00:00:00Z`) : dayStart(new Date())
  const from = args.from
    ? new Date(`${args.from}T00:00:00Z`)
    : new Date(to.getTime() - Number(args.days) * 86400e3)
  const windowDays = Math.round((to - from) / 86400e3)

  const rows = (await fetchCharges({
    token,
    teamId: process.env.VERCEL_TEAM_ID,
    slug: process.env.VERCEL_TEAM_SLUG,
    from,
    to,
  })).filter(r => rowMatchesProject(r, args.project))

  if (args.dump) {
    const services = new Map()
    const tagKeys = new Set()
    for (const r of rows) {
      const key = `${r.ServiceName} | ${r.ChargeCategory} | ${r.ConsumedUnit}`
      services.set(key, (services.get(key) || 0) + Number(r.ConsumedQuantity || 0))
      let tags = r.Tags
      if (typeof tags === 'string') { try { tags = JSON.parse(tags) } catch { tags = {} } }
      Object.keys(tags || {}).forEach(k => tagKeys.add(k))
    }
    console.log(`${rows.length} rows. ServiceName | ChargeCategory | ConsumedUnit -> total quantity`)
    for (const [k, v] of [...services].sort()) console.log(`  ${k} -> ${fmt(v)}`)
    console.log('Tag keys:', [...tagKeys].join(', ') || '(none)')
    console.log('Sample row:', JSON.stringify(rows[0], null, 2))
    return
  }

  // metric -> day (YYYY-MM-DD) -> quantity in the limit's unit
  const daily = new Map(HOBBY_LIMITS.map(l => [l.name, new Map()]))
  const unknownUnits = new Set()
  const csv = ['date,service,unit,consumed_quantity,billed_cost_usd']

  for (const r of rows) {
    if (r.ChargeCategory !== 'Usage' || r.ConsumedQuantity == null) continue
    const day = String(r.ChargePeriodStart).slice(0, 10)
    csv.push([day, JSON.stringify(r.ServiceName), r.ConsumedUnit, r.ConsumedQuantity, r.BilledCost].join(','))

    const limit = HOBBY_LIMITS.find(l => l.match.test(r.ServiceName || ''))
    if (!limit) continue
    const [qty, ok] = normalise(Number(r.ConsumedQuantity), r.ConsumedUnit, limit.unit)
    if (!ok) unknownUnits.add(`${r.ServiceName}: "${r.ConsumedUnit}"`)
    const m = daily.get(limit.name)
    m.set(day, (m.get(day) || 0) + qty)
  }

  if (args.csv) {
    writeFileSync(args.csv, csv.join('\n') + '\n')
    console.log(`Wrote ${csv.length - 1} rows to ${args.csv}`)
  }

  console.log(`\nVercel usage vs Hobby limits, ${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)} (${windowDays} days)${args.project ? `, project ${args.project}` : ', whole team'}\n`)
  const header = ['Metric', 'Used', 'Hobby limit', '% used', 'Peak day', '30-day pace*', 'Verdict']
  const table = [header]
  let worst = 0

  for (const l of HOBBY_LIMITS) {
    const days = daily.get(l.name)
    const values = [...days.values()]
    const total = values.reduce((a, b) => a + b, 0)
    const peak = values.length ? Math.max(...values) : 0
    // Pace: average of the last 7 days with data, scaled to 30 days
    const recent = [...days.entries()].sort().slice(-7).map(([, v]) => v)
    const pace = recent.length ? (recent.reduce((a, b) => a + b, 0) / recent.length) * 30 : 0
    const pct = (total / l.limit) * (30 / windowDays) * 100 // scaled to a 30-day window
    worst = Math.max(worst, pct, (pace / l.limit) * 100)
    const verdict = pct > 100 || pace > l.limit ? 'OVER' : pct > 70 || pace > l.limit * 0.7 ? 'TIGHT' : 'ok'
    table.push([l.name, `${fmt(total)} ${l.unit}`, `${fmt(l.limit)} ${l.unit}`, `${pct.toFixed(1)}%`, fmt(peak), fmt(pace), verdict])
  }

  const widths = header.map((_, i) => Math.max(...table.map(r => String(r[i]).length)))
  for (const r of table) console.log(r.map((c, i) => String(c).padEnd(widths[i])).join('  '))
  console.log('\n* average of the last 7 days with data, times 30. "% used" is scaled to a 30-day window when --days differs.')
  console.log(`Highest share of any Hobby limit: ${worst.toFixed(1)}%  ->  ${worst <= 70 ? 'fits on Hobby with headroom' : worst <= 100 ? 'fits on Hobby, but with under 30% headroom' : 'would exceed Hobby'}`)
  if (args.split) printSplit(daily, args.split)
  if (args.daily) printDaily(daily)

  if (unknownUnits.size) {
    console.log('\nWARNING: unrecognised units (numbers shown unconverted, check with --dump):')
    unknownUnits.forEach(u => console.log('  ' + u))
  }
}

// Before/after a change (e.g. the Nov 3 cache fix). Uses the average of days that had
// any usage, times 30, so quiet days (no shows, before launch) don't hide the real rate.
function printSplit (daily, split) {
  console.log(`\nBefore vs after ${split} (average of days with usage, x30, as % of Hobby)\n`)
  const rows = [['Metric', 'Active days before', 'Before /30d', '% Hobby', 'Active days after', 'After /30d', '% Hobby', 'Change']]
  for (const l of HOBBY_LIMITS) {
    const entries = [...daily.get(l.name).entries()].filter(([, v]) => v > 0)
    const side = pred => {
      const vals = entries.filter(([d]) => pred(d)).map(([, v]) => v)
      const per30 = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) * 30 : 0
      return { n: vals.length, per30, pct: (per30 / l.limit) * 100 }
    }
    const b = side(d => d < split)
    const a = side(d => d >= split)
    const change = b.per30 ? `${(((a.per30 - b.per30) / b.per30) * 100).toFixed(0)}%` : 'n/a'
    rows.push([l.name, b.n, `${fmt(b.per30)} ${l.unit}`, `${b.pct.toFixed(0)}%`, a.n, `${fmt(a.per30)} ${l.unit}`, `${a.pct.toFixed(0)}%`, change])
  }
  const widths = rows[0].map((_, i) => Math.max(...rows.map(r => String(r[i]).length)))
  for (const r of rows) console.log(r.map((c, i) => String(c).padEnd(widths[i])).join('  '))
}

function printDaily (daily) {
  const names = HOBBY_LIMITS.map(l => l.name).filter(n => daily.get(n).size)
  const days = [...new Set(names.flatMap(n => [...daily.get(n).keys()]))].sort()
  console.log('\nDaily usage\n')
  console.log(['date', ...names].join('\t'))
  for (const d of days) console.log([d, ...names.map(n => fmt(daily.get(n).get(d) || 0))].join('\t'))
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
