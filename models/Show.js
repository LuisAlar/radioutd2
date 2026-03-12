import mongoose from 'mongoose'

const showSchema = new mongoose.Schema({
  title: String,
  host: String,
  description: String,
  iconUrl: String,
  bgHorizontalUrl: String,
  bgVerticalUrl: String,
  colorDark: String,
  colorLight: String,
  day: Number,
  startHour: Number,
  endHour: Number,
})

export default mongoose.models.Show || mongoose.model('Show', showSchema)
