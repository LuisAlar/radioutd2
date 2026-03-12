import mongoose from 'mongoose'
import ActionLink from '../models/ActionLink'

module.exports = async (options) => {
  if ((options.title !== null && typeof options.title !== 'string') || (options.link !== null && typeof options.link !== 'string')) {
    console.trace('Incorrect types')
    return
  }

  let link = null

  try {
    link = await ActionLink.findOne().exec()
  } catch (err) {
    console.trace('Error finding action link')
    console.error(err)
  }

  if (!link) {
    link = new ActionLink({
      title: null,
      link: null,
    })
  }

  link.title = options.title
  link.link = options.link

  try {
    await link.save()
  } catch (err) {
    console.trace('Error saving action link')
    console.error(err)
    return
  }
}
