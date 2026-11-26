import mongoose from 'mongoose'
import Comment from '../models/Comment'

// Caps the response size: without this, every poll returned every comment ever
// stored (8,000+ docs, about 1.4 MB), which made this the biggest source of
// Fast Origin Transfer and Active CPU.
const MAX_COMMENTS = 50

// `since` (a Date, optional): only return comments newer than it, so polls after
// the first one usually return an empty list.
module.exports = async ({ since } = {}) => {
  let result = null

  try {
    result = await Comment.find(since ? { date: { $gt: since } } : {}, 'name email phone message date', {
      sort: {
        date: -1,
      },
      limit: MAX_COMMENTS,
    }).lean().exec()
  } catch (err) {
    console.trace('Error finding comments')
    console.error(err)
  }

  return result
}
