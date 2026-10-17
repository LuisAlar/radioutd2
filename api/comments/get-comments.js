import dbConnect from '../../utils/db-connect'
import getComments from '../../utils/get-comments'

const DJ_PASSWORD = process.env.DJ_PASSWORD

export default async function handler (req, res) {
  if (req.method !== 'GET') {
    console.trace('get-comments only supports GET method')
    res.status(500).send('This endpoint only supports GET method')
    return
  }

  if (typeof req.query.password !== 'string') {
    console.trace('Invalid query parameters')
    return res.status(400).send('Invalid query parameters')
  }

  if (req.query.password !== DJ_PASSWORD) {
    console.trace('Invalid authentication')
    return res.status(401).send('Invalid authentication')
  }

  await dbConnect()

  return res.status(200).json(await getComments())
}
