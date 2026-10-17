import dbConnect from '../../utils/db-connect'
import getSongsByArtistAlbum from '../../utils/get-songs-by-artist-album'
import getSongNumPlays from '../../utils/get-song-num-plays'

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

  const songs = []
  const artistAlbumMatches = await getSongsByArtistAlbum(req.body.rows)
  for (const match of artistAlbumMatches) {
    songs.push({
      id: match._id,
      title: match.title,
      artist: match.artist,
      album: match.album,
      numPlays: await getSongNumPlays(match._id),
    })
  }

  const artistAlbumNumPlays = new Map()
  for (const song of songs) {
    const pair = `${song.artist} / ${song.album}`
    let stored = artistAlbumNumPlays.get(pair)
    if (typeof stored !== 'undefined') {
      artistAlbumNumPlays.set(pair, {
        artist: stored.artist,
        album: stored.album,
        numPlays: stored.numPlays + song.numPlays,
      })
    } else {
      artistAlbumNumPlays.set(pair, {
        artist: song.artist,
        album: song.album,
        numPlays: song.numPlays,
      })
    }
  }

  const results = []
  for (const value of artistAlbumNumPlays.values()) {
    results.push(value)
  }
  return res.status(200).json(results)
}
