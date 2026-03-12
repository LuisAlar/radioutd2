import mongoose from 'mongoose'
import newCentralTimezoneDate from '../utils/new-central-timezone-date'
import Song from '../models/Song'
import PlayedSong from '../models/PlayedSong'
import getCurrentShow from '../utils/get-current-show'

module.exports = async (options) => {
  if (typeof options !== 'object' || typeof options.title !== 'string' || typeof options.artist !== 'string' || typeof options.album !== 'string') {
    console.trace('Incorrect types')
    return
  }

  const curShow = getCurrentShow()
  if (!curShow) {
    console.trace('Error finding currently playing show')
    return
  }

  let curSongId = null

  let existingSong = null
  
  try {
    existingSong = await Song.findOne({
      title: options.title,
      artist: options.artist,
      album: options.album,
    }).exec()
  } catch (err) {
    console.trace('Error checking for existing song')
    console.error(err)
    return
  }

  if (existingSong) {
    curSongId = existingSong._id
  } else {
    const newSong = new Song({
      title: options.title,
      artist: options.artist,
      album: options.album,
    })

    try {
      await newSong.save()
    } catch (err) {
      console.trace('Error saving new song')
      console.error(err)
      return
    }

    curSongId = newSong._id
  }

  const playedSong = new PlayedSong({
    songId: curSongId,
    showId: curShow._id,
    date: newCentralTimezoneDate(),
  })

  try {
    await playedSong.save()
  } catch (err) {
    console.trace('Error saving song play info')
    console.error(err)
    return
  }
}
