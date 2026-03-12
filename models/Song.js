import mongoose from 'mongoose'

const songSchema = new mongoose.Schema({
  title: String,
  artist: String,
  album: String,
})

export default mongoose.models.Song || mongoose.model('Song', songSchema)
