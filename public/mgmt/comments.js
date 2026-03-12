const commentsList = document.getElementById('comments')

let password = null

async function loadComments () {
  if (!password) {
    password = encodeURIComponent(window.prompt('DJ Password:'))
  }

  try {
    const response = await fetch(`/api/get-comments?password=${password}`)
    const json = await response.json()
    commentsList.innerHTML = ''
    for (const comment of json) {
      insertComment(comment)
    }
    window.setTimeout(loadComments, 15000)
  } catch (err) {
    console.error(err)
    window.alert('Unable to load comments. Make sure you enter the correct DJ (not management) password and check your network connection. Refresh the page to try again.')
  }
}

function insertComment (comment) {
  const wrapper = document.createElement('li')
  commentsList.appendChild(wrapper)
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

loadComments()
