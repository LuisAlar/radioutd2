import matchNewMusicAllTime from '../utils/match-new-music-all-time'
import matchNewMusicRecentWeeks from '../utils/match-new-music-recent-weeks'
import matchNewMusicWeek from '../utils/match-new-music-week'

// One serverless function for all three new-music reports (Hobby plan allows 12 functions):
// - body.weekStart          -> one chosen week (New Music Week Lookup page)
// - ?view=weekly            -> the last two weeks (New Music (Weekly) page)
// - otherwise               -> all-time plays (New Music page)
export default async function handler (req, res) {
  if (req.body && typeof req.body.weekStart !== 'undefined') {
    return matchNewMusicWeek(req, res)
  }

  if (req.query && req.query.view === 'weekly') {
    return matchNewMusicRecentWeeks(req, res)
  }

  return matchNewMusicAllTime(req, res)
}
