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
  // Schedule history: a show is on the schedule from effectiveFrom until effectiveTo.
  // Missing effectiveFrom means it predates history tracking; missing effectiveTo means it is still active.
  effectiveFrom: Date,
  effectiveTo: Date,
})

export default mongoose.models.Show || mongoose.model('Show', showSchema)
