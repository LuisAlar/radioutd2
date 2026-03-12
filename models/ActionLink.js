import mongoose from 'mongoose'

const actionLinkSchema = new mongoose.Schema({
  title: String,
  link: String,
})

export default mongoose.models.ActionLink || mongoose.model('ActionLink', actionLinkSchema)
