import mongoose from 'mongoose'
import PlayedSong from '../models/PlayedSong'
import Song from '../models/Song'
import Show from '../models/Show'
import attributePlaysToShows from '../utils/attribute-plays-to-shows'

// Pass as a showId to select plays that could not be attributed to any show
export const UNATTRIBUTED = 'unattributed'

// Dates are stored as Central wall-clock time in the UTC fields, so UTC date parts are the Central ones
const playDay = { $subtract: [{ $dayOfWeek: '$date' }, 1] }
const playCalendarDate = { $dateToString: { format: '%Y-%m-%d', date: '$date' } }

function matchDates (from, to) {
  return { $match: { date: { $gte: from, $lt: to } } }
}

function matchShow (showId) {
  return { $match: { attributedShowId: showId === UNATTRIBUTED ? null : new mongoose.Types.ObjectId(showId) } }
}

function lookupSong (localField) {
  return [
    { $lookup: { from: Song.collection.name, localField, foreignField: '_id', as: 'song' } },
    { $unwind: '$song' },
  ]
}

function firstCount (facet) {
  return facet.length > 0 ? facet[0].count : 0
}

export async function getPlaySummary ({ from, to }) {
  const [result] = await PlayedSong.aggregate([
    matchDates(from, to),
    ...attributePlaysToShows(),
    {
      $facet: {
        plays: [{ $count: 'count' }],
        songs: [{ $group: { _id: '$songId' } }, { $count: 'count' }],
        artists: [{ $group: { _id: '$songId' } }, ...lookupSong('_id'), { $group: { _id: '$song.artist' } }, { $count: 'count' }],
        attribution: [{ $group: { _id: '$attributionSource', plays: { $sum: 1 } } }],
        byDayHour: [{ $group: { _id: { day: playDay, hour: { $hour: '$date' } }, plays: { $sum: 1 } } }],
      },
    },
  ])

  const attribution = { stored: 0, schedule: 0, unattributed: 0 }
  for (const row of result.attribution) {
    attribution[row._id || UNATTRIBUTED] = row.plays
  }

  return {
    plays: firstCount(result.plays),
    uniqueSongs: firstCount(result.songs),
    uniqueArtists: firstCount(result.artists),
    attribution,
    byDayHour: result.byDayHour.map(row => ({ day: row._id.day, hour: row._id.hour, plays: row.plays })),
  }
}

export async function getTopPlays ({ from, to, type, showId, limit }) {
  const pipeline = [matchDates(from, to)]
  if (showId) {
    pipeline.push(...attributePlaysToShows(), matchShow(showId))
  }

  pipeline.push({ $group: { _id: '$songId', plays: { $sum: 1 }, lastPlayed: { $max: '$date' } } }, ...lookupSong('_id'))

  if (type === 'artist') {
    pipeline.push(
      { $group: { _id: '$song.artist', plays: { $sum: '$plays' }, songs: { $sum: 1 }, lastPlayed: { $max: '$lastPlayed' } } },
      { $project: { _id: 0, artist: '$_id', plays: 1, songs: 1, lastPlayed: 1 } },
    )
  } else if (type === 'album') {
    pipeline.push(
      { $group: { _id: { artist: '$song.artist', album: '$song.album' }, plays: { $sum: '$plays' }, songs: { $sum: 1 }, lastPlayed: { $max: '$lastPlayed' } } },
      { $project: { _id: 0, artist: '$_id.artist', album: '$_id.album', plays: 1, songs: 1, lastPlayed: 1 } },
    )
  } else {
    pipeline.push({ $project: { _id: 0, songId: '$_id', title: '$song.title', artist: '$song.artist', album: '$song.album', plays: 1, lastPlayed: 1 } })
  }

  pipeline.push({ $sort: { plays: -1, artist: 1 } }, { $limit: limit })

  return PlayedSong.aggregate(pipeline)
}

export async function getShowPlayStats ({ from, to }) {
  const stats = await PlayedSong.aggregate([
    matchDates(from, to),
    ...attributePlaysToShows(),
    {
      $group: {
        _id: '$attributedShowId',
        plays: { $sum: 1 },
        storedPlays: { $sum: { $cond: [{ $eq: ['$attributionSource', 'stored'] }, 1, 0] } },
        songIds: { $addToSet: '$songId' },
        airingDates: { $addToSet: playCalendarDate },
      },
    },
    { $project: { plays: 1, storedPlays: 1, uniqueSongs: { $size: '$songIds' }, airings: { $size: '$airingDates' } } },
  ])

  const statsByShowId = new Map(stats.map(row => [String(row._id), row]))
  const showIds = stats.filter(row => row._id).map(row => row._id)

  // Active shows are included even without plays, so silent slots are visible
  const shows = await Show.find({ $or: [{ _id: { $in: showIds } }, { effectiveTo: null }] }, null, {
    sort: { day: 1, startHour: 1 },
  }).exec()

  const empty = { plays: 0, storedPlays: 0, uniqueSongs: 0, airings: 0 }
  const unattributed = statsByShowId.get('null') || empty

  return {
    shows: shows.map(show => {
      const row = statsByShowId.get(String(show._id)) || empty
      return {
        showId: show._id,
        title: show.title,
        host: show.host,
        description: show.description,
        iconUrl: show.iconUrl,
        colorLight: show.colorLight,
        colorDark: show.colorDark,
        day: show.day,
        startHour: show.startHour,
        endHour: show.endHour,
        retired: Boolean(show.effectiveTo),
        plays: row.plays,
        storedPlays: row.storedPlays,
        uniqueSongs: row.uniqueSongs,
        airings: row.airings,
      }
    }),
    unattributed: {
      plays: unattributed.plays,
      uniqueSongs: unattributed.uniqueSongs,
      airings: unattributed.airings,
    },
  }
}

export async function getShowAirings ({ from, to, showId }) {
  return PlayedSong.aggregate([
    matchDates(from, to),
    ...attributePlaysToShows(),
    matchShow(showId),
    { $group: { _id: playCalendarDate, plays: { $sum: 1 }, firstPlay: { $min: '$date' }, lastPlay: { $max: '$date' } } },
    { $sort: { _id: -1 } },
    { $project: { _id: 0, date: '$_id', plays: 1, firstPlay: 1, lastPlay: 1 } },
  ])
}

export async function getPlaylist ({ from, to, showId }) {
  return PlayedSong.aggregate([
    matchDates(from, to),
    ...attributePlaysToShows(),
    matchShow(showId),
    { $sort: { date: 1 } },
    ...lookupSong('songId'),
    { $project: { _id: 0, date: 1, title: '$song.title', artist: '$song.artist', album: '$song.album', attributionSource: 1 } },
  ])
}
