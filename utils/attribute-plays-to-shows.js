import Show from '../models/Show'

// Aggregation stages that attribute each PlayedSong to a show, adding
// `attributedShowId` and `attributionSource` ('stored', 'schedule', or null).
//
// A showId stored when the song was logged wins. Otherwise the show is looked up
// from the schedule that was in effect at the time of the play, so plays logged
// without a showId (or before schedule edits) can still be grouped by show.
//
// Play dates are stored as Central wall-clock time in the UTC fields (see
// new-central-timezone-date), so the UTC day and hour are the Central ones.
export default function attributePlaysToShows () {
  return [
    {
      $lookup: {
        from: Show.collection.name,
        let: {
          day: { $subtract: [{ $dayOfWeek: '$date' }, 1] },
          hour: { $hour: '$date' },
          date: '$date',
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$day', '$$day'] },
                  { $lte: ['$startHour', '$$hour'] },
                  { $gt: ['$endHour', '$$hour'] },
                  { $or: [{ $eq: [{ $ifNull: ['$effectiveFrom', null] }, null] }, { $lte: ['$effectiveFrom', '$$date'] }] },
                  { $or: [{ $eq: [{ $ifNull: ['$effectiveTo', null] }, null] }, { $gt: ['$effectiveTo', '$$date'] }] },
                ],
              },
            },
          },
          // If schedule entries overlap, prefer the most recently added one
          { $sort: { effectiveFrom: -1 } },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: 'scheduledShows',
      },
    },
    {
      $addFields: {
        attributedShowId: { $ifNull: ['$showId', { $arrayElemAt: ['$scheduledShows._id', 0] }] },
        attributionSource: {
          $cond: [
            { $ifNull: ['$showId', false] },
            'stored',
            { $cond: [{ $gt: [{ $size: '$scheduledShows' }, 0] }, 'schedule', null] },
          ],
        },
      },
    },
    { $project: { scheduledShows: 0 } },
  ]
}
