// Vercel usage vs Hobby limits, for the /mgmt/usage.html dashboard.
// Same logic as scripts/vercel-usage-vs-hobby.mjs (keep HOBBY_LIMITS in sync with it).
// Data source: GET https://api.vercel.com/v1/billing/charges (FOCUS JSONL, 1-day granularity)

// Hobby included usage, from https://vercel.com/docs/plans/hobby (checked 2026-11-10).
export const HOBBY_LIMITS = [
  { name: 'Fast Origin Transfer', match: /origin transfer/i, limit: 10, unit: 'GB' },
  { name: 'Fast Data Transfer', match: /fast data transfer/i, limit: 100, unit: 'GB' },
  { name: 'CDN / Edge Requests', match: /(edge|cdn) requests/i, limit: 1_000_000, unit: 'requests' },
  { name: 'Function Invocations', match: /function invocations|invocations/i, limit: 1_000_000, unit: 'invocations' },
  { name: 'Active CPU', match: /active cpu/i, limit: 4, unit: 'hours' },
  { name: 'Provisioned Memory', match: /provisioned memory/i, limit: 360, unit: 'GB-hrs' },
  { name: 'Image Transformations', match: /image transformations?/i, limit: 5_000, unit: 'units' },
]

const TIGHT = 0.7

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

function rowMatchesProject (row, project) {
  if (!project) return true
  let tags = row.Tags
  if (typeof tags === 'string') {
    try { tags = JSON.parse(tags) } catch { return tags.includes(project) }
  }
  return Object.values(tags || {}).some(v => String(v) === project)
}

function verdictFor (share) {
  return share > 1 ? 'over' : share > TIGHT ? 'tight' : 'ok'
}

export async function fetchCharges ({ token, teamId, slug, from, to }) {
  const url = new URL('https://api.vercel.com/v1/billing/charges')
  url.searchParams.set('from', from.toISOString())
  url.searchParams.set('to', to.toISOString())
  if (teamId) url.searchParams.set('teamId', teamId)
  else if (slug) url.searchParams.set('slug', slug)

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Billing API ${res.status}: ${await res.text()}`)
  const text = await res.text()
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line))
}

// Turns billing rows into one entry per Hobby metric, with a full daily series.
export function summarise (rows, { from, to, project }) {
  const windowDays = Math.max(1, Math.round((to - from) / 86400e3))
  const dates = []
  for (let t = from.getTime(); t < to.getTime(); t += 86400e3) dates.push(new Date(t).toISOString().slice(0, 10))

  const daily = new Map(HOBBY_LIMITS.map(l => [l.name, new Map()]))
  const unknownUnits = new Set()
  let billedUsd = 0

  for (const r of rows) {
    if (!rowMatchesProject(r, project)) continue
    billedUsd += Number(r.BilledCost || 0)
    if (r.ChargeCategory !== 'Usage' || r.ConsumedQuantity == null) continue
    const limit = HOBBY_LIMITS.find(l => l.match.test(r.ServiceName || ''))
    if (!limit) continue
    const [qty, ok] = normalise(Number(r.ConsumedQuantity), r.ConsumedUnit, limit.unit)
    if (!ok) unknownUnits.add(`${r.ServiceName}: "${r.ConsumedUnit}"`)
    const day = String(r.ChargePeriodStart).slice(0, 10)
    const m = daily.get(limit.name)
    m.set(day, (m.get(day) || 0) + qty)
  }

  const metrics = HOBBY_LIMITS.map(l => {
    const days = daily.get(l.name)
    const values = [...days.values()]
    const total = values.reduce((a, b) => a + b, 0)
    const peak = values.length ? Math.max(...values) : 0
    // Pace: average of the last 7 days with data, scaled to 30 days
    const recent = [...days.entries()].sort().slice(-7).map(([, v]) => v)
    const pace = recent.length ? (recent.reduce((a, b) => a + b, 0) / recent.length) * 30 : 0
    const share = (total / l.limit) * (30 / windowDays) // scaled to a 30-day window
    const paceShare = pace / l.limit
    return {
      name: l.name,
      unit: l.unit,
      limit: l.limit,
      total,
      peak,
      pace,
      pct: share * 100,
      pacePct: paceShare * 100,
      verdict: verdictFor(Math.max(share, paceShare)),
      daily: dates.map(d => days.get(d) || 0),
    }
  })

  const worst = Math.max(0, ...metrics.map(m => Math.max(m.pct, m.pacePct)))
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    windowDays,
    project: project || null,
    dates,
    metrics,
    worstPct: worst,
    verdict: verdictFor(worst / 100),
    billedUsd,
    unknownUnits: [...unknownUnits],
    generatedAt: new Date().toISOString(),
  }
}
