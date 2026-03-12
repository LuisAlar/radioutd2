import dbConnect from '../utils/db-connect'
import getSongsByArtistAlbum from '../utils/get-songs-by-artist-album'
import getSongNumPlaysByWeek from '../utils/get-song-num-plays-by-week'
import { DateTime } from 'luxon'

export default async function handler (req, res) {
  if (req.method !== 'POST') {
    console.trace('match-new-music only supports POST method')
    res.status(500).send('This endpoint only supports POST method')
    return
  }

  if (typeof req.body.rows.length === 'undefined') {
    console.trace('Invalid body')
    res.status(400).send('Invalid body')
  }

  await dbConnect()

  //const songs = []
  const artistAlbumMatches = await getSongsByArtistAlbum(req.body.rows)
  const curDate = DateTime.now().startOf('day')
  const eightWeeksAgoDate = curDate.minus({weeks: 8})
  const twoWeeksAgoDate = curDate.minus({weeks: 1})
  const dateOfFirstSunday = twoWeeksAgoDate.startOf('week').minus({days: 1})

  const artistAlbumNumPlays = new Map()
  const results = []

  for(let i = 0; i < 2; i++){

    const weekBegin = dateOfFirstSunday.plus({weeks: i}).toString()
    const weekEnd = dateOfFirstSunday.plus({weeks: i, days: 6}).toString()
    //console.log(weekBegin)
    //console.log(weekEnd)

    /*
    songs.push({
      id: "Week of " + DateTime.fromISO(weekBegin).toFormat('LLL dd yyyy') + " to " + DateTime.fromISO(weekEnd).toFormat('LLL dd yyyy'),
    })
    */

    results.push({
      id: "Week of " + DateTime.fromISO(weekBegin).toFormat('LLL dd yyyy') + " to " + DateTime.fromISO(weekEnd).toFormat('LLL dd yyyy'),
    })

    for (const match of artistAlbumMatches) {
      const numPlaysForCurSong = await getSongNumPlaysByWeek(match._id, weekBegin, weekEnd)
      if(numPlaysForCurSong > 0){
        /*
        songs.push({
          id: match._id,
          title: match.title,
          artist: match.artist,
          album: match.album,
          numPlays: numPlaysForCurSong,
        })
        */
        const curSong = {
          id: match._id,
          title: match.title,
          artist: match.artist,
          album: match.album,
          numPlays: numPlaysForCurSong,
        }
        const pair = `${curSong.artist} / ${curSong.album}`
        let stored = artistAlbumNumPlays.get(pair)
        if (typeof stored !== 'undefined') {
          artistAlbumNumPlays.set(pair, {
            id: stored.id,
            artist: stored.artist,
            album: stored.album,
            numPlays: stored.numPlays + curSong.numPlays,
          })
        } else {
          artistAlbumNumPlays.set(pair, {
            id: curSong.id,
            artist: curSong.artist,
            album: curSong.album,
            numPlays: curSong.numPlays,
          })
        }

      }

    }

    for (const value of artistAlbumNumPlays.values()) {
      console.log(value)
      results.push(value)
    }

    console.log(artistAlbumNumPlays)
    artistAlbumNumPlays.clear()
  }



  //console.log(results)

  //return res.status(200).json(songs)
  return res.status(200).json(results)
}
