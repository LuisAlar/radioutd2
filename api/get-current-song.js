import allowCors from '../utils/allow-cors'
import dbConnect from '../utils/db-connect'
import getCurrentSong from '../utils/get-current-song'
import setCdnCache from '../utils/set-cdn-cache'

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

  setCdnCache(res, 15)
  return res.status(200).json(await getCurrentSong())
}
