import mongoose from 'mongoose'
import Comment from '../models/Comment'

module.exports = async () => {
  let result = null

  try {
    result = await Comment.find({}, null, {
      sort: {
        date: -1,
      },
    }).exec()
  } catch (err) {
    console.trace('Error finding comments')
    console.error(err)
  }

  return result
}
