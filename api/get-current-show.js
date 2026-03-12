import allowCors from '../utils/allow-cors'
import dbConnect from '../utils/db-connect'
import newCentralTimezoneDate from '../utils/new-central-timezone-date'
import getCurrentShow from '../utils/get-current-show'
import Song from '../models/Song'
import PlayedSong from '../models/PlayedSong'

export default async function handler (req, res) {
  if (allowCors(req, res)) {
    return
  }

  if (req.method !== 'GET') {
    console.trace('get-current-show only supports GET method')
    res.status(500).send('This endpoint only supports GET method')
    return
  }

  await dbConnect()

  let minDate = 0
  if (req.query && typeof req.query.minDate === 'string') {
    minDate = parseInt(req.query.minDate)
  }

  let result = {
    show: null,
    songs: null,
  }

  result.show = await getCurrentShow()
  if (!result.show) {
    return res.status(500).send('Error finding current show')
  }

  const curShowStartDate = newCentralTimezoneDate()
  curShowStartDate.setHours(result.show.startHour)
  curShowStartDate.setMinutes(0)
  curShowStartDate.setSeconds(0)
  curShowStartDate.setMilliseconds(0)

  const queryDate = newCentralTimezoneDate()
  queryDate.setTime(Math.max(curShowStartDate.getTime(), minDate))

  try {
    result.songs = await PlayedSong.find({
      date: { $gte: queryDate },
    }, null, {
      sort: {
        date: -1,
      }
    }).exec()
  } catch (err) {
    console.trace('Error finding songs for current show')
    console.error(err)
    return res.status(500).send('Error finding songs for current show')
  }

  for (let i = 0; i < result.songs.length; ++i) {
    const id = result.songs[i].songId
    const playedDate = result.songs[i].date

    try {
      const meta = await Song.findOne({
        _id: id,
      }).exec()

      result.songs[i] = {
        title: meta.title,
        artist: meta.artist,
        album: meta.album,
        date: playedDate,
      }
    } catch (err) {
      console.trace('Error finding song metadata by ID: ' + id)
      console.error(err)
      return res.status(500).send('Error finding song metadata')
    }
  }

  return res.status(200).json(result)
}
