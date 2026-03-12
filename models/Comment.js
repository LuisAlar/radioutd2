import mongoose from 'mongoose'

const commentSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  message: String,
  date: Date,
})

export default mongoose.models.Comment || mongoose.model('Comment', commentSchema)
