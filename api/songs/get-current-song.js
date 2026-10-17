import allowCors from '../../utils/allow-cors'
import dbConnect from '../../utils/db-connect'
import getCurrentSong from '../../utils/get-current-song'

export default async function handler (req, res) {
  if (allowCors(req, res)) {
    return
  }

  if (req.method !== 'GET') {
    console.trace('get-current-song only supports GET method')
    res.status(500).send('This endpoint only supports GET method')
    return
  }

  await dbConnect()

  return res.status(200).json(await getCurrentSong())
}
