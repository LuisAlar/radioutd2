import mongoose from 'mongoose'

const currentSongSchema = new mongoose.Schema({
  title: String,
  artist: String,
  album: String,
})

export default mongoose.models.CurrentSong || mongoose.model('CurrentSong', currentSongSchema)
