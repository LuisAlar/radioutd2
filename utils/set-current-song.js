import mongoose from 'mongoose'
import CurrentSong from '../models/CurrentSong'

module.exports = async (options) => {
  if (typeof options !== 'object' || typeof options.title !== 'string' || typeof options.artist !== 'string' || typeof options.album !== 'string') {
    console.trace('Incorrect types')
    return
  }

  let song = null

  try {
    song = await CurrentSong.findOne().exec()
  } catch (err) {
    console.trace('Error finding current song')
    console.error(err)
  }

  // Creates song if it doesnt exist
  if (!song) {
    song = new CurrentSong({
      title: null,
      artist: null,
      album: null,
    })
  }

  // Adds the new song to the database
  song.title = options.title
  song.artist = options.artist
  song.album = options.album

  try {
    await song.save()
  } catch (err) {
    console.trace('Error saving current song')
    console.error(err)
    return
  }
}
