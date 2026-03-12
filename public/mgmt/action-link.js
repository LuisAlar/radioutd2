const passwordEl = document.getElementById('password')
const titleEl = document.getElementById('title')
const linkEl = document.getElementById('link')

async function loadActionLink () {
  const response = await fetch('/api/get-action-link')
  if (!response.ok) {
    console.error(`Response error: ${response.status} - ${response.statusText}`)
    window.alert('Failed to fetch from server.')
    return
  }

  const parsed = await response.json()

  if (parsed && parsed.title && parsed.link) {
    titleEl.value = parsed.title
    linkEl.value = parsed.link
  } else {
    titleEl.value = ''
    linkEl.value = ''
  }
}

async function setActionLink (title, link, password) {
  const nullEverything = !title || !link

  const response = await fetch('/api/set-action-link', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: nullEverything ? null : title,
      link: nullEverything ? null : link,
      password
    }),
  })

  if (response.ok) {
    window.alert('Action link updated successfully!')
  } else {
    console.error(`Response error: ${response.status} - ${response.statusText}`)
    window.alert('Failed to fetch from server. Make sure you have entered the correct password.')
  }
}

document.getElementById('submit').addEventListener('click', () => {
  const title = titleEl.value.trim()
  const link = linkEl.value.trim()
  const password = passwordEl.value
  setActionLink(title, link, password)
})

loadActionLink()
