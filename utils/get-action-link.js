import mongoose from 'mongoose'
import ActionLink from '../models/ActionLink'

module.exports = async () => {
  let result = null

  try {
    result = await ActionLink.findOne().exec()
  } catch (err) {
    console.trace('Error finding action link')
    console.error(err)
  }

  return result
}
