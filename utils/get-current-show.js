import mongoose from 'mongoose'
import newCentralTimezoneDate from '../utils/new-central-timezone-date'
import Show from '../models/Show'

module.exports = async () => {
  const date = newCentralTimezoneDate()
  const day = date.getDay()
  const hour = date.getHours()

  let result = null

  try {
    result = await Show.findOne({
      'day': day,
      'startHour': { $lte: hour },
      'endHour': { $gt: hour },
    }).exec()
  } catch (err) {
    console.trace('Error finding current show')
    console.error(err)
  }

  return result
}
