import allowCors from '../../utils/allow-cors'
import dbConnect from '../../utils/db-connect'
import addComment from '../../utils/add-comment'

export default async function handler (req, res) {
  if (allowCors(req, res)) {
    return
  }

  if (req.method !== 'GET') {
    console.trace('add-comment only supports GET method')
    res.status(500).send('This endpoint only supports GET method')
    return
  }

  if (!req.query || typeof req.query.message !== 'string') {
    console.trace('Invalid query parameters')
    return res.status(400).send('Invalid query parameters')
  }

  await dbConnect()

  await addComment(req.query)

  res.status(200).send('OK')
}
