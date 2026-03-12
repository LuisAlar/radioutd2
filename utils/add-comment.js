import mongoose from 'mongoose'
import newCentralTimezoneDate from '../utils/new-central-timezone-date'
import Comment from '../models/Comment'

module.exports = async (options) => {
  if (typeof options !== 'object' || typeof options.message !== 'string') {
    console.trace('Incorrect types')
    return
  }

  const comment = new Comment({
    name: options.name || null,
    email: options.email || null,
    phone: options.phone || null,
    message: options.message,
    date: newCentralTimezoneDate(),
  })

  try {
    await comment.save()
  } catch (err) {
    console.trace('Error saving comment')
    console.error(err)
    return
  }
}
