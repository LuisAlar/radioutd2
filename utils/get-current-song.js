import mongoose from 'mongoose'
import CurrentSong from '../models/CurrentSong'

module.exports = async () => {
  let result = null

  try {
    result = await CurrentSong.findOne().exec()
  } catch (err) {
    console.trace('Error finding current song')
    console.error(err)
  }

  return result
}
