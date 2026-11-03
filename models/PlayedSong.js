import mongoose from 'mongoose'

const playedSongSchema = new mongoose.Schema({
  songId: mongoose.ObjectId,
  showId: mongoose.ObjectId,
  date: Date,
})

playedSongSchema.index({ date: 1 })
playedSongSchema.index({ songId: 1, date: 1 })
playedSongSchema.index({ showId: 1, date: 1 })

export default mongoose.models.PlayedSong || mongoose.model('PlayedSong', playedSongSchema)
