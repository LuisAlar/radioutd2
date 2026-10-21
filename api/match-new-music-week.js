import dbConnect from '../utils/db-connect'
import getSongsByArtistAlbum from '../utils/get-songs-by-artist-album'
import PlayedSong from '../models/PlayedSong'
import { DateTime } from 'luxon'

export default async function handler (req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('This endpoint only supports POST method')
  }

  const rows = req.body && req.body.rows
  const weekStartValue = req.body && req.body.weekStart
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).send('A non-empty rows array is required')
  }

  if (typeof weekStartValue !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(weekStartValue)) {
    return res.status(400).send('weekStart must be a Sunday in YYYY-MM-DD format')
  }

  const weekStart = DateTime.fromISO(weekStartValue, { zone: 'utc' })
  const todayInCentral = DateTime.now().setZone('America/Chicago').startOf('day')
  const currentSunday = DateTime.fromISO(todayInCentral.minus({ days: todayInCentral.weekday % 7 }).toISODate(), { zone: 'utc' })
  if (!weekStart.isValid || weekStart.toISODate() !== weekStartValue || weekStart.weekday !== 7 || weekStart >= currentSunday || weekStart < currentSunday.minus({ weeks: 8 })) {
    return res.status(400).send('Choose one of the previous eight completed Sunday-to-Saturday weeks')
  }

  const pairsByKey = new Map()
  for (const row of rows) {
    if (!row || typeof row.artist !== 'string' || typeof row.album !== 'string') continue
    const artist = row.artist.trim()
    const album = row.album.trim()
    if (!artist || !album) continue
    const key = JSON.stringify([artist, album])
    if (!pairsByKey.has(key)) {
      pairsByKey.set(key, {
        artist,
        album,
        promoter: typeof row.promoter === 'string' ? row.promoter.trim() : '',
      })
    }
  }

  if (pairsByKey.size === 0) {
    return res.status(400).send('No valid artist and album rows were provided')
  }

  try {
    await dbConnect()
    const candidates = Array.from(pairsByKey.values())
    const matchedSongs = await getSongsByArtistAlbum(candidates)
    if (!matchedSongs) {
      return res.status(500).send('Could not look up songs')
    }

    const songsByPair = new Map()
    for (const song of matchedSongs) {
      const key = JSON.stringify([song.artist, song.album])
      if (!songsByPair.has(key)) songsByPair.set(key, [])
      songsByPair.get(key).push(song)
    }

    const weekEnd = weekStart.plus({ days: 7 })
    const matchedSongIds = matchedSongs.map(song => song._id)
    const playCounts = matchedSongIds.length === 0
      ? []
      : await PlayedSong.aggregate([
          {
            $match: {
              songId: { $in: matchedSongIds },
              date: { $gte: weekStart.toJSDate(), $lt: weekEnd.toJSDate() },
            },
          },
          { $group: { _id: '$songId', numPlays: { $sum: 1 } } },
        ])
    const countsBySongId = new Map(playCounts.map(item => [String(item._id), item.numPlays]))

    const results = candidates.map(candidate => {
      const key = JSON.stringify([candidate.artist, candidate.album])
      const songs = songsByPair.get(key) || []
      return {
        artist: candidate.artist,
        album: candidate.album,
        promoter: candidate.promoter,
        matched: songs.length > 0,
        numPlays: songs.reduce((total, song) => total + (countsBySongId.get(String(song._id)) || 0), 0),
      }
    })

    results.sort((a, b) => b.numPlays - a.numPlays || a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album))

    return res.status(200).json({
      weekStart: weekStart.toISODate(),
      weekEnd: weekEnd.minus({ days: 1 }).toISODate(),
      matchedCount: results.filter(row => row.matched).length,
      unmatchedCount: results.filter(row => !row.matched).length,
      rows: results,
    })
  } catch (err) {
    console.error('Error building weekly new music report', err)
    return res.status(500).send('Could not build weekly report')
  }
}
