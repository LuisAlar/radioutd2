import mongoose from 'mongoose'
import Show from '../models/Show'

module.exports = async () => {
  let result = null

  try {
    result = await Show.find({ effectiveTo: null }, null, {
      sort: {
        day: 1,
        startHour: 1,
      },
    }).exec()
  } catch (err) {
    console.trace('Error finding shows')
    console.error(err)
  }

  return result
}
