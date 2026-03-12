import mongoose from 'mongoose'
import Show from '../models/Show'

module.exports = async (options) => {
  if (typeof options !== 'object' || typeof options.title !== 'string' || typeof options.description !== 'string' || typeof options.host !== 'string' || typeof options.iconUrl !== 'string' || typeof options.bgHorizontalUrl !== 'string' || typeof options.bgVerticalUrl !== 'string' || typeof options.colorDark !== 'string' || typeof options.colorLight !== 'string' || typeof options.day !== 'number' || typeof options.startHour !== 'number' || typeof options.endHour !== 'number') {
    console.trace('Incorrect types')
    return
  }

  const show = new Show({
    title: options.title,
    description: options.description,
    host: options.host,
    iconUrl: options.iconUrl,
    bgHorizontalUrl: options.bgHorizontalUrl,
    bgVerticalUrl: options.bgVerticalUrl,
    colorDark: options.colorDark,
    colorLight: options.colorLight,
    day: options.day,
    startHour: options.startHour,
    endHour: options.endHour,
  })

  try {
    await show.save()
  } catch (err) {
    console.trace('Error saving show')
    console.error(err)
    return
  }
}
