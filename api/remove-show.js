import dbConnect from '../utils/db-connect'
import removeShow from '../utils/remove-show'

const MGMT_PASSWORD = process.env.MGMT_PASSWORD

export default async function handler (req, res) {
  if (req.method !== 'GET') {
    console.trace('remove-show only supports GET method')
    res.status(500).send('This endpoint only supports GET method')
    return
  }

  if (!req.query || typeof req.query.password !== 'string' || typeof req.query.day !== 'string' || typeof req.query.startHour !== 'string' || typeof req.query.endHour !== 'string') {
    console.trace('Invalid query parameters')
    return res.status(400).send('Invalid query parameters')
  }

  const day = parseInt(req.query.day)
  const startHour = parseInt(req.query.startHour)
  const endHour = parseInt(req.query.endHour)

  if (isNaN(day) || isNaN(startHour) || isNaN(endHour)) {
    console.trace('Invalid query parameters')
    return res.status(400).send('Invalid query parameters')
  }

  if (req.query.password !== MGMT_PASSWORD) {
    console.trace('Invalid authentication')
    return res.status(401).send('Invalid authentication')
  }

  await dbConnect()

  await removeShow({
    title: req.query.title,
    day,
    startHour,
    endHour,
  })

  res.status(200).send('OK')
}
