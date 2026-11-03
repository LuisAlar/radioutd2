import dbConnect from '../utils/db-connect'
import { UNATTRIBUTED, getPlaySummary, getTopPlays, getShowPlayStats, getShowAirings, getPlaylist } from '../utils/get-play-stats'
import { DateTime } from 'luxon'

const MAX_RANGE_DAYS = 366
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const TOP_TYPES = ['song', 'artist', 'album']

// Dates are stored as Central wall-clock time in the UTC fields, so a Central
// calendar date is parsed as a UTC date to line up with them.
function parseDay (value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const day = DateTime.fromISO(value, { zone: 'utc' })
  return day.isValid && day.toISODate() === value ? day : null
}

// `to` is inclusive
function parseRange (query) {
  const from = parseDay(query.from)
  const to = parseDay(query.to)
  if (!from || !to || to < from || to.diff(from, 'days').days >= MAX_RANGE_DAYS) return null
  return { from: from.toJSDate(), to: to.plus({ days: 1 }).toJSDate() }
}

function parseShowId (value) {
  if (value === UNATTRIBUTED) return value
  return typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value) ? value : null
}

export default async function handler (req, res) {
  if (req.method !== 'GET') {
    console.trace('get-play-stats only supports GET method')
    res.status(500).send('This endpoint only supports GET method')
    return
  }

  const query = req.query || {}
  const view = query.view

  // A playlist covers a single date; every other view covers a from/to range
  const range = view === 'playlist' ? parseRange({ from: query.date, to: query.date }) : parseRange(query)
  if (!range) {
    return res.status(400).send(`Dates must be YYYY-MM-DD, with a range of at most ${MAX_RANGE_DAYS} days`)
  }

  const showId = typeof query.showId === 'undefined' ? null : parseShowId(query.showId)
  if (typeof query.showId !== 'undefined' && !showId) {
    return res.status(400).send('Invalid showId')
  }

  await dbConnect()

  try {
    let result = null

    if (view === 'summary') {
      result = await getPlaySummary(range)
    } else if (view === 'top') {
      const type = TOP_TYPES.includes(query.type) ? query.type : 'song'
      const limit = Math.min(Math.max(parseInt(query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT)
      result = await getTopPlays({ ...range, type, showId, limit })
    } else if (view === 'shows') {
      result = await getShowPlayStats(range)
    } else if (view === 'airings' || view === 'playlist') {
      if (!showId) {
        return res.status(400).send(`The ${view} view requires a showId`)
      }
      result = view === 'airings' ? await getShowAirings({ ...range, showId }) : await getPlaylist({ ...range, showId })
    } else {
      return res.status(400).send('view must be one of: summary, top, shows, airings, playlist')
    }

    // Short edge cache so dashboard refreshes don't each invoke the function
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return res.status(200).json(result)
  } catch (err) {
    console.trace('Error building play stats')
    console.error(err)
    return res.status(500).send('Could not build play stats')
  }
}
