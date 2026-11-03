import mongoose from 'mongoose'
import newCentralTimezoneDate from '../utils/new-central-timezone-date'
import Show from '../models/Show'

module.exports = async (options) => {
  if (typeof options !== 'object' || typeof options.day !== 'number' || typeof options.startHour !== 'number' || typeof options.endHour !== 'number') {
    console.trace('Incorrect types')
    return
  }

  // Retire rather than delete, so past plays can still be attributed to the show
  try {
    await Show.updateOne({
      day: options.day,
      startHour: options.startHour,
      endHour: options.endHour,
      effectiveTo: null,
    }, {
      effectiveTo: newCentralTimezoneDate(),
    }).exec()
  } catch (err) {
    console.trace('Error retiring show')
    console.error(err)
  }
}
