import mongoose from 'mongoose'
import PlayedSong from '../models/PlayedSong'

module.exports = async (songId, weekBegin, weekEnd) => {
  let result = null

  try {
    result = await PlayedSong.find({
      songId,
      date: {
          $gte: weekBegin,
          $lt: weekEnd
      }
    }).exec()
  } catch (err) {
    console.trace('Error counting song plays')
    console.error(err)
  }


  return result ? result.length : 0
}
