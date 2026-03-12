const passwordEl = document.getElementById('password')
const titleEl = document.getElementById('title')
const artistEl = document.getElementById('artist')
const albumEl = document.getElementById('album')

async function loadNowPlaying () {
  const response = await fetch('/api/get-current-song')
  if (!response.ok) {
    console.error(`Response error: ${response.status} - ${response.statusText}`)
    window.alert('Failed to fetch from server.')
    return
  }

  const parsed = await response.json()
  titleEl.value = parsed.title || ''
  artistEl.value = parsed.artist || ''
  albumEl.value = parsed.album || ''
}

async function setNowPlaying (title, artist, album, password) {
  const encodedTitle = encodeURIComponent(title)
  const encodedArtist = encodeURIComponent(artist)
  const encodedAlbum = encodeURIComponent(album)
  const encodedPassword = encodeURIComponent(password)
  const response = await fetch(`/api/add-song?title=${encodedTitle}&artist=${encodedArtist}&album=${encodedAlbum}&password=${encodedPassword}`)

  if (response.ok) {
    window.alert('Now playing updated successfully!')
  } else {
    console.error(`Response error: ${response.status} - ${response.statusText}`)
    window.alert('Failed to fetch from server. Make sure you have entered the correct password.')
  }
}

document.getElementById('submit').addEventListener('click', () => {
  const title = titleEl.value.trim()
  const artist = artistEl.value.trim()
  const album = albumEl.value.trim()
  const password = passwordEl.value
  setNowPlaying(title, artist, album, password)
})

loadNowPlaying()
