import dbConnect from '../../utils/db-connect'
import setActionLink from '../../utils/set-action-link'

const DJ_PASSWORD = process.env.DJ_PASSWORD

export default async function handler (req, res) {
  if (req.method !== 'POST') {
    console.trace('set-action-link only supports POST method')
    res.status(500).send('This endpoint only supports POST method')
    return
  }

  if ((req.body.title !== null && typeof req.body.title !== 'string') || (req.body.link !== null && typeof req.body.link !== 'string') || typeof req.body.password !== 'string') {
    console.trace('Invalid body')
    res.status(400).send('Invalid body')
    return
  }

  if (req.body.password !== DJ_PASSWORD) {
    console.trace('Invalid authentication')
    res.status(401).send('Invalid authentication')
    return
  }

  await dbConnect()
  await setActionLink(req.body)
  
  res.status(200).send('OK')
}
