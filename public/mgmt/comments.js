const commentsList = document.getElementById('comments')

// Each poll runs a serverless function, so poll slowly and only while the tab is visible.
const POLL_DELAY_MS = 30000

let password = null
// Date of the newest comment shown; later polls only ask for comments after it
let newestDate = null
let pollTimeout = null
let loading = false
// Set after an error; the page must be refreshed to try again
let stopped = false

async function loadComments () {
  pollTimeout = null
  if (stopped || loading || document.hidden) {
    // Resumes from the visibilitychange listener below
    return
  }

  if (!password) {
    password = encodeURIComponent(window.prompt('DJ Password:'))
  }

  loading = true
  try {
    const since = newestDate ? `&since=${encodeURIComponent(newestDate)}` : ''
    const response = await fetch(`/api/get-comments?password=${password}${since}`)
    if (!response.ok) {
      throw new Error(`get-comments returned ${response.status}`)
    }
    const json = await response.json()
    // Comments arrive newest first; insert oldest first so the newest ends up on top
    for (const comment of json.slice().reverse()) {
      insertComment(comment)
    }
    if (json.length) {
      newestDate = json[0].date
    }
    pollTimeout = window.setTimeout(loadComments, POLL_DELAY_MS)
  } catch (err) {
    console.error(err)
    stopped = true
    window.alert('Unable to load comments. Make sure you enter the correct DJ (not management) password and check your network connection. Refresh the page to try again.')
  } finally {
    loading = false
  }
}

function insertComment (comment) {
  const wrapper = document.createElement('li')
  commentsList.prepend(wrapper)
  const name = document.createElement('div')
  wrapper.appendChild(name)
  name.textContent = comment.name
  const email = document.createElement('div')
  wrapper.appendChild(email)
  email.textContent = comment.email
  const phone = document.createElement('div')
  wrapper.appendChild(phone)
  phone.textContent = comment.phone
  const message = document.createElement('div')
  wrapper.appendChild(message)
  message.textContent = comment.message
  const date = document.createElement('div')
  wrapper.appendChild(date)
  date.textContent = comment.date
}

document.addEventListener('visibilitychange', () => {
  // Fetch right away when the DJ comes back to the tab, unless a poll is already queued
  if (!document.hidden && !loading && pollTimeout === null) {
    loadComments()
  }
})

loadComments()
