const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DEFAULT_RANGE_DAYS = 7

const fromInput = document.getElementById('from')
const toInput = document.getElementById('to')
const loadButton = document.getElementById('load')
const statusEl = document.getElementById('status')
const totalsEl = document.getElementById('totals')
const heatmapHeadEl = document.getElementById('heatmap-head')
const heatmapBodyEl = document.getElementById('heatmap-body')
const typeSelect = document.getElementById('type')
const showSelect = document.getElementById('show')
const topHeadEl = document.getElementById('top-head')
const topBodyEl = document.getElementById('top-body')

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

function addCell (row, text, tag = 'td') {
  const cell = document.createElement(tag)
  cell.textContent = text
  row.appendChild(cell)
  return cell
}

async function fetchStats (params) {
  const query = new URLSearchParams({ from: fromInput.value, to: toInput.value, ...params })
  const response = await fetch(`/api/get-play-stats?${query}`)
  if (!response.ok) throw new Error(`Server returned ${response.status}: ${await response.text()}`)
  return response.json()
}

function renderTotals (summary) {
  totalsEl.innerHTML = ''
  const items = [
    ['Plays', summary.plays],
    ['Unique songs', summary.uniqueSongs],
    ['Unique artists', summary.uniqueArtists],
    ['Show stored at log time', summary.attribution.stored],
    ['Show from schedule', summary.attribution.schedule],
    ['No show found', summary.attribution.unattributed],
  ]
  for (const [label, value] of items) {
    const item = document.createElement('div')
    const number = document.createElement('strong')
    number.textContent = value.toLocaleString()
    item.appendChild(number)
    item.appendChild(document.createTextNode(label))
    totalsEl.appendChild(item)
  }
}

function renderHeatmap (byDayHour) {
  const counts = new Map(byDayHour.map(cell => [`${cell.day}-${cell.hour}`, cell.plays]))
  const max = Math.max(1, ...byDayHour.map(cell => cell.plays))

  heatmapHeadEl.innerHTML = ''
  const headRow = document.createElement('tr')
  addCell(headRow, '', 'th')
  for (let hour = 0; hour < 24; hour++) addCell(headRow, formatHour(hour), 'th')
  heatmapHeadEl.appendChild(headRow)

  heatmapBodyEl.innerHTML = ''
  DAY_NAMES.forEach((dayName, day) => {
    const row = document.createElement('tr')
    addCell(row, dayName.slice(0, 3), 'th')
    for (let hour = 0; hour < 24; hour++) {
      const plays = counts.get(`${day}-${hour}`) || 0
      const cell = addCell(row, plays || '')
      cell.title = `${dayName} ${formatHour(hour)}: ${plays} plays`
      cell.style.background = `rgba(30, 90, 160, ${plays / max})`
      if (plays / max > 0.5) cell.style.color = 'white'
    }
    heatmapBodyEl.appendChild(row)
  })
}

async function loadShowOptions () {
  const selected = showSelect.value
  const { shows } = await fetchStats({ view: 'shows' })
  showSelect.innerHTML = '<option value="">All shows</option><option value="unattributed">No show found</option>'
  for (const show of shows) {
    const option = document.createElement('option')
    option.value = show.showId
    option.textContent = `${show.title} (${DAY_NAMES[show.day]} ${formatHour(show.startHour)})${show.retired ? ' — retired' : ''}`
    showSelect.appendChild(option)
  }
  if ([...showSelect.options].some(option => option.value === selected)) showSelect.value = selected
}

async function loadTop () {
  const params = { view: 'top', type: typeSelect.value }
  if (showSelect.value) params.showId = showSelect.value
  const rows = await fetchStats(params)

  const columns = {
    song: [['Title', 'title'], ['Artist', 'artist'], ['Album', 'album'], ['Plays', 'plays']],
    artist: [['Artist', 'artist'], ['Songs', 'songs'], ['Plays', 'plays']],
    album: [['Artist', 'artist'], ['Album', 'album'], ['Songs', 'songs'], ['Plays', 'plays']],
  }[typeSelect.value]

  topHeadEl.innerHTML = ''
  const headRow = document.createElement('tr')
  addCell(headRow, '#', 'th')
  for (const [label] of columns) addCell(headRow, label, 'th')
  topHeadEl.appendChild(headRow)

  topBodyEl.innerHTML = ''
  rows.forEach((item, index) => {
    const row = document.createElement('tr')
    addCell(row, String(index + 1))
    for (const [, key] of columns) addCell(row, item[key] == null ? '—' : String(item[key]))
    topBodyEl.appendChild(row)
  })
}

async function loadAll () {
  statusEl.textContent = 'Loading…'
  loadButton.disabled = true
  try {
    const [summary] = await Promise.all([fetchStats({ view: 'summary' }), loadShowOptions()])
    renderTotals(summary)
    renderHeatmap(summary.byDayHour)
    await loadTop()
    statusEl.textContent = `Showing ${fromInput.value} through ${toInput.value} (Central time).`
  } catch (error) {
    console.error(error)
    statusEl.textContent = `Could not load plays. ${error.message}`
  } finally {
    loadButton.disabled = false
  }
}

async function reloadTop () {
  try {
    await loadTop()
  } catch (error) {
    console.error(error)
    statusEl.textContent = `Could not load top plays. ${error.message}`
  }
}

const today = new Date()
const rangeStart = new Date(today)
rangeStart.setDate(today.getDate() - (DEFAULT_RANGE_DAYS - 1))
fromInput.value = localDateString(rangeStart)
toInput.value = localDateString(today)

loadButton.addEventListener('click', loadAll)
typeSelect.addEventListener('change', reloadTop)
showSelect.addEventListener('change', reloadTop)
loadAll()
