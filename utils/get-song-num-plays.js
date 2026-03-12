import mongoose from 'mongoose'
import PlayedSong from '../models/PlayedSong'

module.exports = async (songId) => {
  let result = null

  try {
    result = await PlayedSong.find({
      songId,
    }).exec()
  } catch (err) {
    console.trace('Error counting song plays')
    console.error(err)
  }

  return result ? result.length : null
}
