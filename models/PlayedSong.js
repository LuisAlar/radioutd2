import mongoose from 'mongoose'

const playedSongSchema = new mongoose.Schema({
  songId: mongoose.ObjectId,
  showId: mongoose.ObjectId,
  date: Date,
})

export default mongoose.models.PlayedSong || mongoose.model('PlayedSong', playedSongSchema)
