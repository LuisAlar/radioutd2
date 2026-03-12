import dbConnect from '../utils/db-connect'
import getShows from '../utils/get-shows'

export default async function handler (req, res) {
  if (req.method !== 'GET') {
    console.trace('get-shows only supports GET method')
    res.status(500).send('This endpoint only supports GET method')
    return
  }

  await dbConnect()

  return res.status(200).json(await getShows())
}
