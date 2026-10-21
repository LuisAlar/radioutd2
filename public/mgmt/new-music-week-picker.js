const NUM_WEEKS_BEFORE_EXPIRATION = 8

const fileInput = document.getElementById('file')
const weekSelect = document.getElementById('week')
const refreshButton = document.getElementById('refresh')
const sheetNameEl = document.getElementById('sheet-name')
const statusEl = document.getElementById('status')
const albumsListEl = document.getElementById('albums-list')

let parsedFile = null

function formatDate (date) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function localDateString (date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function populateWeeks () {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const currentSunday = new Date(today)
  currentSunday.setDate(today.getDate() - today.getDay())

  for (let offset = 1; offset <= NUM_WEEKS_BEFORE_EXPIRATION; offset++) {
    const start = new Date(currentSunday)
    start.setDate(start.getDate() - offset * 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const option = document.createElement('option')
    option.value = localDateString(start)
    option.textContent = `${formatDate(start)} – ${formatDate(end)}`
    weekSelect.appendChild(option)
  }
}

function parseDate (value, sheetName) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return null
    return new Date(parsed.y, parsed.m - 1, parsed.d)
  }

  const text = String(value).trim()
  const parts = text.split(/[./]/)
  if ((parts.length !== 2 && parts.length !== 3) || parts.some(part => !/^\d+$/.test(part))) return null

  const month = Number(parts[0])
  const day = Number(parts[1])
  let year = parts.length === 3 ? Number(parts[2]) : Number((sheetName.match(/(?:Spring|Fall)\s+(\d{4})/i) || [])[1])
  if (year < 100) year += 2000
  if (!month || month > 12 || !day || day > 31 || !year) return null

  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

function parseWorkbook (workbook) {
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('No worksheet found in the file.')

  const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })
  if (sheetRows.length === 0) throw new Error('The worksheet is empty.')

  const expiration = new Date()
  expiration.setHours(0, 0, 0, 0)
  expiration.setDate(expiration.getDate() - NUM_WEEKS_BEFORE_EXPIRATION * 7)

  let currentDate = null
  const rows = []
  for (const row of sheetRows) {
    if (row.Date !== '' && row.Date !== null && typeof row.Date !== 'undefined') {
      currentDate = parseDate(row.Date, sheetName)
    }

    if (row.Artist && row.Album) {
      if (!currentDate) throw new Error(`Could not read the date above ${row.Artist} – ${row.Album}.`)
      if (currentDate < expiration) continue
      rows.push({
        date: localDateString(currentDate),
        artist: String(row.Artist).trim(),
        album: String(row.Album).trim(),
        promoter: String(row.Promoter || '').trim(),
      })
    }
  }

  if (rows.length === 0) throw new Error('No album rows were found within the last eight weeks. Check for Date, Artist, and Album columns.')
  return { sheetName, rows }
}

function addCell (row, text, className) {
  const cell = document.createElement('td')
  cell.textContent = text
  if (className) cell.className = className
  row.appendChild(cell)
}

function renderResults (result) {
  albumsListEl.innerHTML = ''
  result.rows.forEach((album, index) => {
    const row = document.createElement('tr')
    addCell(row, String(index + 1))
    addCell(row, album.artist)
    addCell(row, album.album)
    addCell(row, album.promoter || '—')
    addCell(row, album.matched ? 'Matched in Songs' : 'No exact match', album.matched ? '' : 'unmatched')
    addCell(row, album.matched ? String(album.numPlays) : '—', album.numPlays === 0 ? 'zero' : '')
    albumsListEl.appendChild(row)
  })

  const zeroPlayCount = result.rows.filter(row => row.matched && row.numPlays === 0).length
  statusEl.textContent = `${result.rows.length} CSV albums checked for ${result.weekStart} through ${result.weekEnd}: ${result.matchedCount} matched in Songs, ${result.unmatchedCount} had no exact match, and ${zeroPlayCount} matched albums had zero plays.`
}

async function loadSelectedWeek () {
  if (!parsedFile) {
    statusEl.textContent = 'Choose a CSV or Excel file first.'
    return
  }

  albumsListEl.innerHTML = ''
  statusEl.textContent = 'Loading selected week…'
  refreshButton.disabled = true

  try {
    const response = await fetch('/api/match-new-music-per-week', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rows: parsedFile.rows, weekStart: weekSelect.value }),
    })

    if (!response.ok) throw new Error(`Server returned ${response.status}: ${await response.text()}`)
    renderResults(await response.json())
  } catch (error) {
    console.error(error)
    statusEl.textContent = `Could not load the selected week. ${error.message}`
  } finally {
    refreshButton.disabled = false
  }
}

function loadFile (file) {
  const reader = new FileReader()
  reader.addEventListener('load', event => {
    try {
      const workbook = XLSX.read(new Uint8Array(event.target.result), { type: 'array', cellDates: true })
      parsedFile = parseWorkbook(workbook)
      sheetNameEl.textContent = parsedFile.sheetName
      statusEl.textContent = `${parsedFile.rows.length} recent album rows loaded. Choose a week to check.`
      loadSelectedWeek()
    } catch (error) {
      console.error(error)
      parsedFile = null
      sheetNameEl.textContent = ''
      statusEl.textContent = error.message
    }
  })
  reader.addEventListener('error', () => {
    parsedFile = null
    statusEl.textContent = 'The selected file could not be read.'
  })
  reader.readAsArrayBuffer(file)
}

populateWeeks()
fileInput.addEventListener('change', event => {
  parsedFile = null
  sheetNameEl.textContent = ''
  albumsListEl.innerHTML = ''
  if (event.target.files.length > 0) loadFile(event.target.files[0])
})
weekSelect.addEventListener('change', loadSelectedWeek)
refreshButton.addEventListener('click', loadSelectedWeek)
