import { fetchCharges, summarise } from '../utils/vercel-usage'

// GET /api/get-vercel-usage?days=30[&project=radioutd2]
// Needs VERCEL_TOKEN and VERCEL_TEAM_ID (or VERCEL_ORG_ID / VERCEL_TEAM_SLUG) in the project env.
// Billing data only changes daily, so the response is cached at the edge for an hour,
// which keeps this dashboard from adding to the usage it measures.
export default async function handler (req, res) {
  if (req.method !== 'GET') {
    res.status(405).send('This endpoint only supports GET method')
    return
  }

  const token = process.env.VERCEL_TOKEN
  if (!token) {
    res.status(500).json({ error: 'VERCEL_TOKEN is not set for this deployment.' })
    return
  }

  const query = req.query || {}
  const days = Math.min(Math.max(parseInt(query.days, 10) || 30, 1), 90)
  const project = typeof query.project === 'string' && /^[\w.-]{1,100}$/.test(query.project) ? query.project : undefined

  const now = new Date()
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const from = new Date(to.getTime() - days * 86400e3)

  try {
    const rows = await fetchCharges({
      token,
      teamId: process.env.VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID,
      slug: process.env.VERCEL_TEAM_SLUG,
      from,
      to,
    })
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    res.status(200).json(summarise(rows, { from, to, project }))
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: err.message })
  }
}
