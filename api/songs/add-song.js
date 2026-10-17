import dbConnect from '../../utils/db-connect'
import addSong from '../../utils/add-song'
import setCurrentSong from '../../utils/set-current-song'

const AUTOMATION_PASSWORD = process.env.AUTOMATION_PASSWORD

export default async function handler (req, res) {
  if (req.method !== 'GET') {
    console.trace('add-song only supports GET method')
    res.status(500).send('This endpoint only supports GET method')
    return
  }

  if (!req.query || typeof req.query.password !== 'string' || typeof req.query.title !== 'string' || typeof req.query.artist !== 'string' || typeof req.query.album !== 'string') {
    console.trace('Invalid query parameters')
    return res.status(400).send('Invalid query parameters')
  }

  if (req.query.password !== AUTOMATION_PASSWORD) {
    console.trace('Invalid authentication')
    return res.status(401).send('Invalid authentication')
  }

  await dbConnect()

  //
  // TODO: If req.query.assetType is not song, then either:
  // - Skip logging the asset
  // - Update a flag that indicates "No song is playing"
  //

  await setCurrentSong(req.query)
  await addSong(req.query)

  res.status(200).send('OK')
}
