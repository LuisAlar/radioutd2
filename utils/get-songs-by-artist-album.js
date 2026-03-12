import mongoose from 'mongoose'
import Song from '../models/Song'

function makeQuery (artistAlbumPairs) {
  const query = {
    $or: [],
  }

  for (const pair of artistAlbumPairs) {
    query.$or.push({
      artist: pair.artist,
      album: pair.album,
    })
  }

  return query
}

module.exports = async (artistAlbumPairs) => {
  let result = null

  try {
    const query = makeQuery(artistAlbumPairs)
    result = await Song.find(query).exec()
  } catch (err) {
    console.trace('Error finding songs by artist/album')
    console.error(err)
  }

  return result
}
