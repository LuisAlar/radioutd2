import dbConnect from '../utils/db-connect'
import addShow from '../utils/add-show'

const MGMT_PASSWORD = process.env.MGMT_PASSWORD

export default async function handler (req, res) {
  if (req.method !== 'GET') {
    console.trace('add-show only supports GET method')
    res.status(500).send('This endpoint only supports GET method')
    return
  }

  if (!req.query || typeof req.query.password !== 'string' || typeof req.query.title !== 'string' || typeof req.query.host !== 'string' || typeof req.query.description !== 'string' || typeof req.query.iconUrl !== 'string' || typeof req.query.bgHorizontalUrl !== 'string' || typeof req.query.bgVerticalUrl !== 'string' || typeof req.query.colorDark !== 'string' || typeof req.query.colorLight !== 'string' || typeof req.query.day !== 'string' || typeof req.query.startHour !== 'string' || typeof req.query.endHour !== 'string') {
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

  await addShow({
    title: req.query.title,
    host: req.query.host,
    description: req.query.description,
    iconUrl: req.query.iconUrl,
    bgHorizontalUrl: req.query.bgHorizontalUrl,
    bgVerticalUrl: req.query.bgVerticalUrl,
    colorDark: req.query.colorDark,
    colorLight: req.query.colorLight,
    day,
    startHour,
    endHour,
  })

  res.status(200).send('OK')
}
