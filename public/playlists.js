const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
// The API caps one request at this many songs
const MAX_SONGS = 200

const introEl = document.getElementById('intro')
const searchInput = document.getElementById('search')
const statusEl = document.getElementById('status')
const showsEl = document.getElementById('shows')

function localDateString (date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Approximate semesters by month: Spring Jan–May, Summer Jun–Jul, Fall Aug–Dec
function currentSemester (today) {
  const year = today.getFullYear()
  const month = today.getMonth()
  if (month <= 4) return { name: `Spring ${year}`, start: new Date(year, 0, 1) }
  if (month <= 6) return { name: `Summer ${year}`, start: new Date(year, 5, 1) }
  return { name: `Fall ${year}`, start: new Date(year, 7, 1) }
}

function formatHour (hour) {
  const suffix = hour < 12 || hour === 24 ? 'am' : 'pm'
  return `${hour % 12 === 0 ? 12 : hour % 12}${suffix}`
}

// Play dates are stored as Central wall-clock time in UTC, so format them in UTC to show Central time
function formatDate (value) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(value))
}

function el (tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

const semester = currentSemester(new Date())
const range = { from: localDateString(semester.start), to: localDateString(new Date()) }

async function fetchStats (params) {
  const query = new URLSearchParams({ ...range, ...params })
  const response = await fetch(`/api/get-play-stats?${query}`)
  if (!response.ok) throw new Error(`Server returned ${response.status}`)
  return response.json()
}

async function loadSongs (show, container) {
  container.appendChild(el('p', 'note', 'Loading songs…'))
  try {
    const songs = await fetchStats({ view: 'top', type: 'song', showId: show.showId, limit: MAX_SONGS })
    container.lastChild.remove()

    const list = el('ol')
    for (const song of songs) {
      const item = el('li')
      const text = el('div', 'song-text')
      text.appendChild(el('div', 'song-title', song.title))
      text.appendChild(el('div', 'song-meta', [song.artist, song.album].filter(Boolean).join(' — ')))
      item.appendChild(text)
      const plays = song.plays === 1 ? 'Played once' : `Played ${song.plays} times`
      item.appendChild(el('div', 'song-plays', `${plays} · last ${formatDate(song.lastPlayed)}`))
      list.appendChild(item)
    }
    container.appendChild(list)
    if (songs.length === MAX_SONGS) {
      container.appendChild(el('p', 'note', `Showing the ${MAX_SONGS} most-played songs.`))
    }
  } catch (error) {
    console.error(error)
    container.lastChild.textContent = 'Could not load songs. Close and reopen this show to try again.'
    container.dataset.failed = 'true'
  }
}

function createShowCard (show) {
  const card = el('details', 'show')
  card.dataset.search = `${show.title} ${show.host || ''}`.toLowerCase()
  if (show.colorDark && CSS.supports('color', show.colorDark)) {
    card.style.setProperty('--show-color', show.colorDark)
  }

  const summary = el('summary')
  if (show.iconUrl) {
    const icon = el('img', 'icon')
    icon.src = show.iconUrl
    icon.alt = ''
    icon.loading = 'lazy'
    icon.addEventListener('error', () => icon.remove())
    summary.appendChild(icon)
  }

  const text = el('div', 'show-text')
  const title = el('div', 'show-title', show.title)
  if (show.retired) title.appendChild(el('span', 'badge', 'No longer on air'))
  text.appendChild(title)
  const slot = `${DAY_NAMES[show.day]}s ${formatHour(show.startHour)}–${formatHour(show.endHour)}`
  text.appendChild(el('div', 'show-meta', [show.host, slot].filter(Boolean).join(' · ')))
  summary.appendChild(text)

  summary.appendChild(el('span', 'count', show.uniqueSongs === 0 ? 'No songs yet' : `${show.uniqueSongs} ${show.uniqueSongs === 1 ? 'song' : 'songs'}`))
  if (show.uniqueSongs > 0) summary.appendChild(el('span', 'chevron', '›'))
  card.appendChild(summary)

  if (show.uniqueSongs === 0) {
    card.dataset.empty = 'true'
    summary.addEventListener('click', event => event.preventDefault())
    return card
  }

  const body = el('div', 'songs')
  if (show.description) body.appendChild(el('p', 'description', show.description))
  card.appendChild(body)

  // Songs are fetched the first time a show is opened (or again after a failure)
  let loaded = false
  card.addEventListener('toggle', () => {
    if (!card.open || (loaded && !body.dataset.failed)) return
    loaded = true
    delete body.dataset.failed
    if (body.lastChild && body.lastChild.className === 'note') body.lastChild.remove()
    loadSongs(show, body)
  })

  return card
}

function renderShows (shows) {
  showsEl.innerHTML = ''
  DAY_NAMES.forEach((dayName, day) => {
    const dayShows = shows.filter(show => show.day === day)
    if (dayShows.length === 0) return
    const section = el('section')
    section.appendChild(el('h2', 'day', dayName))
    for (const show of dayShows) section.appendChild(createShowCard(show))
    showsEl.appendChild(section)
  })
}

function applySearch () {
  const term = searchInput.value.trim().toLowerCase()
  let visible = 0
  for (const section of showsEl.querySelectorAll('section')) {
    let sectionVisible = 0
    for (const card of section.querySelectorAll('.show')) {
      const match = !term || card.dataset.search.includes(term)
      card.hidden = !match
      if (match) sectionVisible++
    }
    section.hidden = sectionVisible === 0
    visible += sectionVisible
  }
  statusEl.textContent = term && visible === 0 ? 'No shows match your search.' : ''
}

async function init () {
  introEl.textContent = `Songs played on Radio UTD shows during ${semester.name}. Select a show to see its songs.`
  try {
    const { shows } = await fetchStats({ view: 'shows' })
    renderShows(shows)
    statusEl.textContent = shows.length === 0 ? 'No shows found for this semester.' : ''
  } catch (error) {
    console.error(error)
    statusEl.textContent = 'Could not load shows. Please try again later.'
  }
}

searchInput.addEventListener('input', applySearch)
init()
