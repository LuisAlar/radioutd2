const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DEFAULT_RANGE_DAYS = 28
const SOURCE_LABELS = { stored: 'Logged', schedule: 'Schedule' }

const fromInput = document.getElementById('from')
const toInput = document.getElementById('to')
const loadButton = document.getElementById('load')
const statusEl = document.getElementById('status')
const showsBodyEl = document.getElementById('shows-body')
const airingsTitleEl = document.getElementById('airings-title')
const airingsTableEl = document.getElementById('airings-table')
const airingsBodyEl = document.getElementById('airings-body')
const playlistTitleEl = document.getElementById('playlist-title')
const playlistTableEl = document.getElementById('playlist-table')
const playlistBodyEl = document.getElementById('playlist-body')

function localDateString (date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatHour (hour) {
  const suffix = hour < 12 || hour === 24 ? 'am' : 'pm'
  return `${hour % 12 === 0 ? 12 : hour % 12}${suffix}`
}

// Play dates are stored as Central wall-clock time in UTC, so format them in UTC to show Central time
function formatTime (value) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(new Date(value))
}

function formatCalendarDate (value) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

function addCell (row, text, className) {
  const cell = document.createElement('td')
  cell.textContent = text
  if (className) cell.className = className
  row.appendChild(cell)
}

function selectRow (body, row) {
  for (const other of body.querySelectorAll('tr.selected')) other.classList.remove('selected')
  row.classList.add('selected')
}

function hideDetails ({ keepAirings = false } = {}) {
  if (!keepAirings) {
    airingsTitleEl.hidden = true
    airingsTableEl.hidden = true
    airingsBodyEl.innerHTML = ''
  }
  playlistTitleEl.hidden = true
  playlistTableEl.hidden = true
  playlistBodyEl.innerHTML = ''
}

async function fetchStats (params) {
  const query = new URLSearchParams(params)
  const response = await fetch(`/api/get-play-stats?${query}`)
  if (!response.ok) throw new Error(`Server returned ${response.status}: ${await response.text()}`)
  return response.json()
}

async function loadPlaylist (show, airing) {
  playlistTitleEl.textContent = `${show.title} — ${formatCalendarDate(airing.date)}`
  playlistTitleEl.hidden = false
  playlistTableEl.hidden = false
  playlistBodyEl.innerHTML = ''
  statusEl.textContent = 'Loading playlist…'

  try {
    const plays = await fetchStats({ view: 'playlist', showId: show.showId, date: airing.date })
    for (const play of plays) {
      const row = document.createElement('tr')
      addCell(row, formatTime(play.date))
      addCell(row, play.title)
      addCell(row, play.artist)
      addCell(row, play.album)
      addCell(row, SOURCE_LABELS[play.attributionSource] || '—')
      playlistBodyEl.appendChild(row)
    }
    statusEl.textContent = `${plays.length} plays on ${formatCalendarDate(airing.date)}.`
  } catch (error) {
    console.error(error)
    statusEl.textContent = `Could not load playlist. ${error.message}`
  }
}

async function loadAirings (show) {
  hideDetails()
  airingsTitleEl.textContent = `${show.title} — days aired`
  airingsTitleEl.hidden = false
  airingsTableEl.hidden = false
  statusEl.textContent = 'Loading days aired…'

  try {
    const airings = await fetchStats({ view: 'airings', showId: show.showId, from: fromInput.value, to: toInput.value })
    for (const airing of airings) {
      const row = document.createElement('tr')
      row.className = 'clickable'
      addCell(row, formatCalendarDate(airing.date))
      addCell(row, String(airing.plays))
      addCell(row, formatTime(airing.firstPlay))
      addCell(row, formatTime(airing.lastPlay))
      row.addEventListener('click', () => {
        selectRow(airingsBodyEl, row)
        hideDetails({ keepAirings: true })
        loadPlaylist(show, airing)
      })
      airingsBodyEl.appendChild(row)
    }
    statusEl.textContent = airings.length === 0 ? 'No plays for this show in the selected range.' : `${airings.length} days with plays.`
  } catch (error) {
    console.error(error)
    statusEl.textContent = `Could not load days aired. ${error.message}`
  }
}

function insertShowRow (show, { slot, className }) {
  const row = document.createElement('tr')
  row.className = 'clickable'
  if (className) row.classList.add(className)
  addCell(row, show.title)
  addCell(row, show.host || '—')
  addCell(row, slot)
  addCell(row, String(show.plays), show.plays === 0 ? 'zero' : '')
  addCell(row, show.storedPlays == null ? '—' : String(show.storedPlays))
  addCell(row, String(show.uniqueSongs))
  addCell(row, String(show.airings))
  row.addEventListener('click', () => {
    selectRow(showsBodyEl, row)
    loadAirings(show)
  })
  showsBodyEl.appendChild(row)
}

async function loadShows () {
  showsBodyEl.innerHTML = ''
  hideDetails()
  statusEl.textContent = 'Loading…'
  loadButton.disabled = true

  try {
    const { shows, unattributed } = await fetchStats({ view: 'shows', from: fromInput.value, to: toInput.value })
    for (const show of shows) {
      const slot = `${DAY_NAMES[show.day]} ${formatHour(show.startHour)}–${formatHour(show.endHour)}${show.retired ? ' (retired)' : ''}`
      insertShowRow(show, { slot, className: show.retired ? 'retired' : '' })
    }
    if (unattributed.plays > 0) {
      insertShowRow({ ...unattributed, showId: 'unattributed', title: 'No show found', storedPlays: null }, { slot: 'Outside any scheduled show', className: 'unattributed' })
    }

    const totalPlays = shows.reduce((total, show) => total + show.plays, unattributed.plays)
    statusEl.textContent = `${totalPlays} plays from ${fromInput.value} through ${toInput.value} (Central time); ${unattributed.plays} could not be matched to a show.`
  } catch (error) {
    console.error(error)
    statusEl.textContent = `Could not load shows. ${error.message}`
  } finally {
    loadButton.disabled = false
  }
}

const today = new Date()
const rangeStart = new Date(today)
rangeStart.setDate(today.getDate() - (DEFAULT_RANGE_DAYS - 1))
fromInput.value = localDateString(rangeStart)
toInput.value = localDateString(today)

loadButton.addEventListener('click', loadShows)
loadShows()
