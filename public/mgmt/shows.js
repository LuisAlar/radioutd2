const showsList = document.getElementById('shows')

async function loadShows () {
  showsList.innerHTML = ''
  const response = await fetch('/api/get-shows')
  const json = await response.json()
  for (const show of json) {
    insertShow(show)
  }
}

async function deleteShow (show) {
  const password = encodeURIComponent(window.prompt('Management password:'))
  const day = encodeURIComponent(show.day)
  const startHour = encodeURIComponent(show.startHour)
  const endHour = encodeURIComponent(show.endHour)
  await fetch(`/api/remove-show?password=${password}&day=${day}&startHour=${startHour}&endHour=${endHour}`)
  await loadShows()
}

function createImageUrlWrapper (url, width, height) {
  const iconUrl = document.createElement('div')
  const iconUrlImg = document.createElement('img')
  iconUrl.appendChild(iconUrlImg)
  iconUrlImg.width = width
  iconUrlImg.height = height
  iconUrlImg.src = url
  const iconUrlText = document.createElement('pre')
  iconUrl.appendChild(iconUrlText)
  iconUrlText.textContent = url
  return iconUrl
}

function insertShow (show) {
  const wrapper = document.createElement('li')
  showsList.appendChild(wrapper)
  const title = document.createElement('div')
  wrapper.appendChild(title)
  title.textContent = show.title
  const host = document.createElement('div')
  wrapper.appendChild(host)
  host.textContent = show.host
  const description = document.createElement('div')
  wrapper.appendChild(description)
  description.textContent = show.description
  wrapper.appendChild(createImageUrlWrapper(show.iconUrl, 96, 96))
  wrapper.appendChild(createImageUrlWrapper(show.bgHorizontalUrl, 200, 113))
  wrapper.appendChild(createImageUrlWrapper(show.bgVerticalUrl, 113, 200))
  const colorLight = document.createElement('div')
  wrapper.appendChild(colorLight)
  colorLight.textContent = `Light color: ${show.colorLight}`
  const colorDark = document.createElement('div')
  wrapper.appendChild(colorDark)
  colorDark.textContent = `Dark color: ${show.colorDark}`
  const dayAndHours = document.createElement('div')
  wrapper.appendChild(dayAndHours)
  dayAndHours.textContent = `Day: ${show.day} / Start Hour: ${show.startHour} / End Hour: ${show.endHour}`
  const deleteBtnWrap = document.createElement('div')
  wrapper.appendChild(deleteBtnWrap)
  const deleteBtn = document.createElement('button')
  deleteBtnWrap.appendChild(deleteBtn)
  deleteBtn.textContent = 'Delete'
  deleteBtn.addEventListener('click', () => {
    deleteShow(show)
  })
}

loadShows()
