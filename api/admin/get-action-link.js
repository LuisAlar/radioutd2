import allowCors from '../../utils/allow-cors'
import dbConnect from '../../utils/db-connect'
import getActionLink from '../../utils/get-action-link'

export default async function handler (req, res) {
  if (allowCors(req, res)) {
    return
  }

  if (req.method !== 'GET') {
    console.trace('get-action-link only supports GET method')
    res.status(500).send('This endpoint only supports GET method')
    return
  }

  await dbConnect()

  return res.status(200).json(await getActionLink())
}
