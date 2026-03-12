import mongoose from 'mongoose'
import Show from '../models/Show'

module.exports = async (options) => {
  if (typeof options !== 'object' || typeof options.day !== 'number' || typeof options.startHour !== 'number' || typeof options.endHour !== 'number') {
    console.trace('Incorrect types')
    return
  }

  try {
    await Show.deleteOne({
      day: options.day,
      startHour: options.startHour,
      endHour: options.endHour,
    }).exec()
  } catch (err) {
    console.trace('Error deleting show')
    console.error(err)
  }
}
