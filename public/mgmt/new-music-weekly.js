const NUM_WEEKS_BEFORE_EXPIRATION = 8
//const NUM_WEEKS_TO_CHECK_FOR = 2

const fileInput = document.getElementById('file')
const sheetNameEl = document.getElementById('sheet-name')
const albumsListEl = document.getElementById('albums-list')

let titleToPromoter = null

function getExpirationDate () {
  const date = new Date()
  date.setDate(date.getDate() - NUM_WEEKS_BEFORE_EXPIRATION * 7)
  date.setHours(0, 0, 0, 0)
  return date
}

function compareSheets (sheet1, sheet2) {
  if (sheet1 === null && sheet2 !== null) {
    return 1 // Sheet 2
  } else if (sheet1 !== null && sheet2 === null) {
    return -1 // Sheet 1
  } else if (sheet1 === null && sheet2 === null) {
    return 0 // Equal
  }

  const s1Parts = sheet1.split(/\s+/g)
  const s2Parts = sheet2.split(/\s+/g)
  const s1Name = s1Parts[0].trim().toLowerCase(), s1Year = parseInt(s1Parts[1].trim())
  const s2Name = s2Parts[0].trim().toLowerCase(), s2Year = parseInt(s2Parts[1].trim())

  if (s2Year > s1Year) {
    return 1 // Sheet 2
  } else if (s1Year > s2Year) {
    return -1 // Sheet 1
  } else {
    if (s1Name === 'spring' && s2Name === 'fall') {
      return 1 // Sheet 2
    } else if (s2Name === 'spring' && s1Name === 'fall') {
      return -1 // Sheet 1
    } else {
      return 0 // Equal
    }
  }
}

function mostRecentSheetName (sheets) {
  let curMostRecentSheetName = null
  for (const sheetName in sheets) {
    if (compareSheets(curMostRecentSheetName, sheetName) > 0) {
      curMostRecentSheetName = sheetName
    }
  }
  return curMostRecentSheetName
}

function parseSheetDate (str, sheetName) {
  const parts = str.split(/\.|\//gi)
  if (parts.length !== 2 && parts.length !== 3) {
    console.error(`Failed to parse date: ${str}`)
    return null
  }
  parts[0] = parseInt(parts[0])
  parts[1] = parseInt(parts[1])
  if (parts.length < 3) {
    //parts[2] = new Date().getFullYear()
    parts[2] = sheetName.split(" ")[1]
  } else {
    parts[2] = parseInt(parts[2])
  }
  if (isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    console.error(`Failed to parse date: ${str}`)
    return null
  }
  if (parts[2] < 2000) {
    parts[2] += 2000
  }
  const date = new Date()
  date.setMonth(parts[0] - 1)
  date.setDate(parts[1])
  date.setFullYear(parts[2])
  date.setHours(0, 0, 0, 0)
  return date
}

function parseWorkbook (workbook) {
  const sheetName = mostRecentSheetName(workbook.Sheets)
  if (!sheetName) {
    window.alert('Failed to find most recent sheet. Make sure your sheets are named \"[Fall|Spring] [Year]\", for example: \"Fall 2021\".')
    return null
  }

  const sheetJson = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName])
  if (!sheetJson || sheetJson.length === 0) {
    window.alert('Failed to parse spreadsheet.')
    return null
  }

  const out = []

  const expirationDate = getExpirationDate()
  let curDate = null
  titleToPromoter = new Map()
  for (const row of sheetJson) {
    if (row.Date) {
      row.Date = row.Date.toString()
      const dateStr = row.Date.trim()
      if (dateStr.length > 0 && /^[0-9,.]*$/.test(dateStr)) {
        curDate = parseSheetDate(row.Date, sheetName)
      }
    }
    if (row.Album && row.Artist) {
      row.Album = row.Album.toString()
      row.Artist = row.Artist.toString()


      if (!curDate) {
        window.alert('Missing date. Make sure you have a column labeled \"Date\".')
        return null
      } else if (curDate < expirationDate) {
        console.log(`Skipping expired row: ${row.Artist} - ${row.Album}`)
        continue
      }
      titleToPromoter.set(`${row.Artist.trim()}-${row.Album.trim()}`, row.Promoter)
      out.push({
        date: curDate,
        artist: row.Artist,
        album: row.Album,
      })
    }
  }

  if (out.length === 0) {
    window.alert('No album rows found. Make sure you have columns labeled \"Artist\" and \"Album\".')
    return null
  }

  return {
    sheet: sheetName,
    rows: out,
  }
}

function createTd (text, isBold, isWeekRow) {
  const td = document.createElement('td')
  td.textContent = text
  if (isBold) {
    td.style.fontWeight = 700
  }
  if (isWeekRow){
    td.colSpan = 6
  }
  return td
}

function updateList (albums) {
  console.log(albums)
  var count = 1
  for (let i = 0; i < albums.length; ++i) {
    //if((albums[i+1].id.includes("Week of"))){
    //  continue
    //}

    //const album = albums[i]
    const tr = document.createElement('tr')
    albumsListEl.appendChild(tr)

    if(albums[i].id.includes("Week of")){
      tr.appendChild(createTd(albums[i].id, true, true))
      count = 1
      continue
    }

    tr.appendChild(createTd(count++, true))
    tr.appendChild(createTd(albums[i].artist))
    tr.appendChild(createTd(albums[i].album))
    //tr.appendChild(createTd(albums[i].title))
    tr.appendChild(createTd(titleToPromoter.get(`${albums[i].artist.trim()}-${albums[i].album.trim()}`)))
    tr.appendChild(createTd(albums[i].numPlays))

  }
}

async function post (parsed) {
  const response = await fetch('/api/match-new-music-per-week', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(parsed),
  })
  if (!response.ok) {
    console.error(`Response error: ${response.status} - ${response.statusText}`)
    window.alert('Failed to fetch from server.')
    return
  }
  const albums = await response.json()

  const sortedAlbums = sortAlbumsByWeek(albums)

  updateList(sortedAlbums)
}

function sortAlbumsByWeek (albumsInput){

  let finalSortedAlbums = [];

  let tempSort = [];

  let weekIndexes = [];

  for(let i = 0; i < albumsInput.length; i++){
    if(albumsInput[i].id.includes("Week of")){
      weekIndexes.push(i);
    }
  }

  for(let j = 0; j < weekIndexes.length; j++){

    let endOfWeekIndex;

    if(j+1 >= weekIndexes.length){
      endOfWeekIndex = albumsInput.length - 1;
    }
    else{
      endOfWeekIndex = weekIndexes[j+1] - 1;
    }


    for(let k = weekIndexes[j] + 1; k <= endOfWeekIndex; k++){
      tempSort.push(albumsInput[k]);
    }

    tempSort.sort((a, b) => {
      // Opposite return values of usual since we want descending order
      if (a.numPlays < b.numPlays) {
        return 1
      } else if (a.numPlays > b.numPlays) {
        return -1
      } else {
        return 0
      }
    })

    finalSortedAlbums.push(albumsInput[weekIndexes[j]]);
    finalSortedAlbums = finalSortedAlbums.concat(tempSort);

    tempSort = [];

  }



  return finalSortedAlbums;
}

function handleWorkbook (workbook) {
  const parsed = parseWorkbook(workbook)
  sheetNameEl.textContent = parsed.sheet
  if (parsed) {
    post(parsed)
  } else {
    window.alert('Failed to parse workbook')
    return
  }
}

function loadFile (file) {
  const reader = new FileReader()
  reader.addEventListener('load', event => {
    const data = new Uint8Array(event.target.result)
    const workbook = XLSX.read(data, {
      type: 'array',
    })
    handleWorkbook(workbook)
  })
  reader.readAsArrayBuffer(file)
}

fileInput.addEventListener('change', event => {
  sheetNameEl.textContent = ''
  albumsListEl.innerHTML = ''

  if (event.target.files.length > 0) {
    loadFile(event.target.files[0])
  }
})
