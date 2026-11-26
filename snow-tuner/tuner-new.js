/* Radio UTD tuner — redesigned UI.
 * Keeps all behaviour of the previous tuner (index.a786fc7a.js):
 *  - stream play/pause + Media Session (lock-screen controls & metadata)
 *  - volume control (hidden on iOS, where audio.volume is read-only)
 *  - polling the current show (30s) and current song (15s), paused while the tab is hidden
 *  - show name/host/description/icon, per-show background images and colours
 *  - song history (now a gliding ticker in the top bar)
 *  - scrolling of long song titles/artists/albums
 *  - sending comments to the DJ (now from the chat button in the top-left)
 */
(function () {
  'use strict'

  const API_BASE_URL = 'https://radioutd2-pied.vercel.app/api'
  const SHOW_UPDATE_DELAY_MS = 30e3
  const SONG_UPDATE_DELAY_MS = 15e3
  const SCROLL_STEP_MS = 5e3
  const GLIDE_PX_PER_SEC = 45
  const EMPTY_IMG_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='
  const VOLUME_STORAGE_KEY = 'radioutd-tuner-volume'

  const $ = (id) => document.getElementById(id)

  const audioEl = $('audio')
  const playPauseEl = $('play-button')
  const playIcon = $('play-button-play-icon')
  const pauseIcon = $('play-button-pause-icon')

  const showCardEl = $('show-card')
  const showBgEl = $('show-bg')
  const showIconEl = $('show-info-icon')
  const showNameEl = $('show-name')
  const showHostEl = $('show-host')
  const showDescriptionEl = $('show-desc')

  const songTitleEl = $('song-title')
  const songArtistEl = $('song-artist')
  const songAlbumEl = $('song-album')
  const albumWrapEl = $('np-right')

  const historyTrackEl = $('history-track')
  const historyListEl = $('history-list')

  const chatToggleEl = $('chat-toggle')
  const commentPanelEl = $('comment-panel')
  const commentInputEl = $('comment-input')
  const commentSubmitEl = $('comment-submit')
  const commentCountEl = $('comment-count')
  const commentStatusEl = $('comment-status')

  const volumeWrapEl = $('volume-wrap')
  const volumeEl = $('volume-slider')
  const volumeReadoutEl = $('volume-readout')
  const muteButtonEl = $('mute-button')
  const volumeOnIcon = $('volume-on-icon')
  const volumeOffIcon = $('volume-off-icon')

  // Show state used by Media Session metadata
  let currentShow = { title: null, host: null, iconUrl: null }

  /* ------------------------------------------------------------------ */
  /* Utilities                                                          */
  /* ------------------------------------------------------------------ */

  function isIos () {
    return ['iPad Simulator', 'iPhone Simulator', 'iPod Simulator', 'iPad', 'iPhone', 'iPod'].includes(navigator.platform) ||
      (navigator.userAgent.includes('Mac') && 'ontouchend' in document)
  }

  function debounce (fn, wait) {
    let t = null
    return function () {
      const args = arguments
      clearTimeout(t)
      t = setTimeout(() => fn.apply(this, args), wait)
    }
  }

  function storageGet (key) {
    try { return window.localStorage.getItem(key) } catch (e) { return null }
  }
  function storageSet (key, value) {
    try { window.localStorage.setItem(key, value) } catch (e) { /* private mode etc. */ }
  }

  async function fetchJson (path) {
    let res = null
    try {
      res = await fetch(`${API_BASE_URL}/${path}`)
    } catch (err) {
      console.error(err)
    }
    if (!res || !res.ok) return null
    try {
      return await res.json()
    } catch (err) {
      console.error(err)
      return null
    }
  }

  /* ------------------------------------------------------------------ */
  /* Playback                                                           */
  /* ------------------------------------------------------------------ */

  let isPlaying = false

  function setIsPlaying (playing) {
    isPlaying = playing
    playIcon.style.display = playing ? 'none' : 'block'
    pauseIcon.style.display = playing ? 'block' : 'none'
    playPauseEl.setAttribute('aria-label', playing ? 'Pause' : 'Play')
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
    }
  }

  function play () {
    const p = audioEl.play()
    if (p && p.catch) p.catch((err) => console.error(err))
  }

  setIsPlaying(false)
  audioEl.addEventListener('play', () => setIsPlaying(true))
  audioEl.addEventListener('pause', () => setIsPlaying(false))

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', play)
    navigator.mediaSession.setActionHandler('pause', () => audioEl.pause())
  }

  playPauseEl.addEventListener('click', () => {
    if (isPlaying) audioEl.pause()
    else play()
  })

  document.addEventListener('keydown', (e) => {
    // Space toggles playback, unless the user is typing or on a control
    if (e.code !== 'Space') return
    const tag = (e.target.tagName || '').toLowerCase()
    if (['textarea', 'input', 'button', 'a'].includes(tag) || e.target.getAttribute('role') === 'slider') return
    e.preventDefault()
    playPauseEl.click()
  })

  /* ------------------------------------------------------------------ */
  /* Volume slider                                                      */
  /* ------------------------------------------------------------------ */

  let volume = 100 // 0-100
  let muted = false
  let lastNonZeroVolume = 100

  function renderVolume () {
    const shown = muted ? 0 : volume
    volumeEl.value = String(Math.round(shown))
    volumeEl.style.setProperty('--fill', `${shown}%`)
    volumeEl.classList.toggle('muted', muted)
    volumeReadoutEl.textContent = muted ? 'Muted' : `${Math.round(volume)}%`
    volumeEl.setAttribute('aria-valuetext', muted ? 'Muted' : `${Math.round(volume)}%`)
    const silent = muted || volume === 0
    volumeOnIcon.style.display = silent ? 'none' : 'block'
    volumeOffIcon.style.display = silent ? 'block' : 'none'
    muteButtonEl.setAttribute('aria-label', muted ? 'Unmute' : 'Mute')
  }

  function setVolume (value) {
    volume = Math.max(0, Math.min(100, value))
    if (volume > 0) lastNonZeroVolume = volume
    muted = false
    audioEl.volume = volume / 100
    renderVolume()
    storageSet(VOLUME_STORAGE_KEY, String(Math.round(volume)))
  }

  function toggleMute () {
    if (muted || volume === 0) {
      setVolume(volume === 0 ? lastNonZeroVolume : volume)
    } else {
      muted = true
      audioEl.volume = 0
      renderVolume()
    }
  }

  volumeEl.addEventListener('input', () => setVolume(parseFloat(volumeEl.value)))
  muteButtonEl.addEventListener('click', toggleMute)

  if (isIos()) {
    // iOS ignores audio.volume; the hardware buttons control it instead.
    volumeWrapEl.style.display = 'none'
  } else {
    const saved = parseInt(storageGet(VOLUME_STORAGE_KEY), 10)
    setVolume(Number.isFinite(saved) ? saved : 100)
  }

  /* ------------------------------------------------------------------ */
  /* Show (centre box) + show image                                     */
  /* ------------------------------------------------------------------ */

  const bgMediaQuery = window.matchMedia('(orientation: portrait) and (max-width: 960px)')
  let curBgHorizontalUrl = null
  let curBgVerticalUrl = null
  let curBgMode = bgMediaQuery.matches ? 'vertical' : 'horizontal'

  // Load the image first so a broken URL never leaves an empty dark box.
  let bgRequestId = 0
  function displayBgs () {
    const url = curBgMode === 'horizontal'
      ? (curBgHorizontalUrl || curBgVerticalUrl || currentShow.iconUrl)
      : (curBgVerticalUrl || curBgHorizontalUrl || currentShow.iconUrl)

    // The small round icon is redundant when the icon itself fills the box.
    const iconIsBg = !!url && url === currentShow.iconUrl
    showIconEl.classList.toggle('empty', !currentShow.iconUrl || iconIsBg)

    const requestId = ++bgRequestId
    if (!url) {
      showCardEl.classList.remove('has-bg')
      showBgEl.style.backgroundImage = 'none'
      return
    }
    if (showBgEl.dataset.url === url && showCardEl.classList.contains('has-bg')) return

    const img = new Image()
    img.onload = () => {
      if (requestId !== bgRequestId) return
      showBgEl.dataset.url = url
      showBgEl.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`
      showCardEl.classList.add('has-bg')
    }
    img.onerror = () => {
      if (requestId !== bgRequestId) return
      showCardEl.classList.remove('has-bg')
      showBgEl.style.backgroundImage = 'none'
      showIconEl.classList.toggle('empty', !currentShow.iconUrl || iconIsBg)
    }
    img.src = url
  }

  const onBgModeChange = (e) => {
    curBgMode = e.matches ? 'vertical' : 'horizontal'
    displayBgs()
  }
  if (bgMediaQuery.addEventListener) bgMediaQuery.addEventListener('change', onBgModeChange)
  else bgMediaQuery.addListener(onBgModeChange)

  function setShowIcon (url) {
    showIconEl.src = url || EMPTY_IMG_SRC
  }

  function setShowColors (light, dark) {
    const root = document.documentElement.style
    if (light) root.setProperty('--show-light', light)
    else root.removeProperty('--show-light')
    if (dark) root.setProperty('--show-dark', dark)
    else root.removeProperty('--show-dark')
  }

  function updateShow (show) {
    showNameEl.textContent = show.title || '[Unknown title]'
    showHostEl.textContent = show.host ? `with ${show.host}` : '[Unknown host]'
    showDescriptionEl.textContent = (show.description || '').trim()
    showDescriptionEl.style.display = showDescriptionEl.textContent ? '' : 'none'
    setShowIcon(show.iconUrl)
    currentShow = { title: show.title || null, host: show.host || null, iconUrl: show.iconUrl || null }

    curBgHorizontalUrl = show.bgHorizontalUrl || null
    curBgVerticalUrl = show.bgVerticalUrl || null
    displayBgs()
    setShowColors(show.colorLight, show.colorDark)
  }

  function displayUnknownShow () {
    showNameEl.textContent = 'Shuffle'
    showHostEl.textContent = '[No host]'
    showDescriptionEl.textContent = "No DJ is on-air right now, so you're listening to our off-air playlist."
    showDescriptionEl.style.display = ''
    setShowIcon(null)
    currentShow = { title: null, host: null, iconUrl: null }
    curBgHorizontalUrl = null
    curBgVerticalUrl = null
    displayBgs()
    setShowColors(null, null)
  }

  /* ------------------------------------------------------------------ */
  /* Song history — gliding ticker                                      */
  /* ------------------------------------------------------------------ */

  let lastHistoryKey = null

  function buildHistoryItem (song) {
    const item = document.createElement('div')
    item.className = 'history-item'

    const title = document.createElement('span')
    title.className = 'h-title'
    title.textContent = song.title || '[Unknown song]'
    item.appendChild(title)

    if (song.artist) {
      const artist = document.createElement('span')
      artist.className = 'h-artist'
      artist.textContent = song.artist
      item.appendChild(artist)
    }

    return item
  }

  function setHistoryMessage (text) {
    historyTrackEl.classList.remove('gliding')
    historyTrackEl.innerHTML = ''
    const msg = document.createElement('div')
    msg.className = 'history-empty'
    msg.textContent = text
    historyTrackEl.appendChild(msg)
    historyListEl.innerHTML = ''
    lastHistoryKey = null
  }

  function updateSongHistory (songs) {
    if (!Array.isArray(songs) || songs.length === 0) {
      setHistoryMessage('No songs played yet this show.')
      return
    }

    // Only rebuild when the list actually changes, so the glide doesn't restart every poll.
    const key = JSON.stringify(songs.map((s) => [s.title, s.artist, s.date]))
    if (key === lastHistoryKey) return
    lastHistoryKey = key

    historyTrackEl.classList.remove('gliding')
    historyTrackEl.innerHTML = ''

    // Two identical groups: animating by -50% loops seamlessly.
    const groupA = document.createElement('div')
    groupA.className = 'history-group'
    for (const song of songs) groupA.appendChild(buildHistoryItem(song))
    const groupB = groupA.cloneNode(true)
    groupB.setAttribute('aria-hidden', 'true')
    historyTrackEl.append(groupA, groupB)

    // Screen-reader friendly list (the ticker itself is decorative motion).
    historyListEl.innerHTML = ''
    for (const song of songs) {
      const li = document.createElement('li')
      li.textContent = `${song.artist ? song.artist + ' - ' : ''}${song.title || '[Unknown song]'}`
      historyListEl.appendChild(li)
    }

    // Constant speed regardless of how many songs there are.
    requestAnimationFrame(() => {
      const width = groupA.getBoundingClientRect().width
      const seconds = Math.max(12, width / GLIDE_PX_PER_SEC)
      historyTrackEl.style.setProperty('--glide-duration', `${seconds}s`)
      historyTrackEl.classList.add('gliding')
    })
  }

  function displayUnknownSongHistory () {
    setHistoryMessage('Song history is unavailable right now.')
  }

  /* ------------------------------------------------------------------ */
  /* Current song                                                       */
  /* ------------------------------------------------------------------ */

  function updateMediaSession (song) {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return
    const meta = {
      title: song.title || '[Unknown song]',
      artist: song.artist || '[Unknown artist]',
      album: song.album || '[Unknown album]',
    }
    if (currentShow.host) {
      meta.album = `${currentShow.title || 'Radio UTD'} with ${currentShow.host} | Radio UTD`
    }
    if (currentShow.iconUrl) {
      meta.artwork = [{ src: currentShow.iconUrl }]
    }
    navigator.mediaSession.metadata = new MediaMetadata(meta)
  }

  function updateSong (song) {
    const changed = songTitleEl.textContent !== (song.title || '[Unknown song]') ||
      songArtistEl.textContent !== (song.artist || '[Unknown artist]')

    songTitleEl.textContent = song.title || '[Unknown song]'
    songArtistEl.textContent = song.artist || '[Unknown artist]'
    songAlbumEl.textContent = song.album || ''
    albumWrapEl.classList.toggle('empty', !song.album)
    updateMediaSession(song)

    if (changed) restartScroll()
  }

  function displayUnknownSongs () {
    songTitleEl.textContent = '[Unknown song]'
    songArtistEl.textContent = '[Unknown artist]'
    songAlbumEl.textContent = ''
    albumWrapEl.classList.add('empty')
  }

  /* ------------------------------------------------------------------ */
  /* Polling (paused while the tab is hidden)                           */
  /* ------------------------------------------------------------------ */

  async function pollShow () {
    if (document.hidden) {
      window.setTimeout(pollShow, SHOW_UPDATE_DELAY_MS)
      return
    }
    const data = await fetchJson('get-current-show')
    window.setTimeout(pollShow, SHOW_UPDATE_DELAY_MS)
    if (data && data.show) {
      updateShow(data.show)
      updateSongHistory(data.songs)
    } else {
      displayUnknownShow()
      displayUnknownSongHistory()
    }
  }

  async function pollSong () {
    if (document.hidden) {
      window.setTimeout(pollSong, SONG_UPDATE_DELAY_MS)
      return
    }
    const data = await fetchJson('get-current-song')
    window.setTimeout(pollSong, SONG_UPDATE_DELAY_MS)
    if (data) updateSong(data)
    else displayUnknownSongs()
  }

  window.setTimeout(pollShow, 0)
  window.setTimeout(pollSong, 0)

  /* ------------------------------------------------------------------ */
  /* Long title/artist/album scrolling (same 4-step cycle as before)    */
  /* ------------------------------------------------------------------ */

  const scrollEls = [songTitleEl, songArtistEl, songAlbumEl]
  let scrollState = 0
  let scrollTimeout = null

  function applyScroll (el) {
    const overflow = el.getBoundingClientRect().width - el.parentNode.getBoundingClientRect().width
    if (overflow > 0) {
      el.style.transition = `${SCROLL_STEP_MS}ms linear`
      el.style.transform = `translateX(-${overflow}px)`
    } else {
      el.style.transform = 'none'
    }
  }

  function scrollTick () {
    scrollTimeout = window.setTimeout(scrollTick, SCROLL_STEP_MS)
    scrollState = (scrollState + 1) % 4
    if (scrollState === 1) {
      scrollEls.forEach(applyScroll)
    } else if (scrollState === 3) {
      scrollEls.forEach((el) => { el.style.transform = 'none' })
    }
  }

  function cancelScroll () {
    if (scrollTimeout !== null) {
      window.clearTimeout(scrollTimeout)
      scrollTimeout = null
    }
    scrollState = 0
    scrollEls.forEach((el) => {
      el.style.transition = 'none'
      el.style.transform = 'none'
    })
  }

  function startScroll () {
    if (scrollTimeout === null) scrollTimeout = window.setTimeout(scrollTick, SCROLL_STEP_MS)
  }

  function restartScroll () {
    cancelScroll()
    startScroll()
  }

  const debouncedStartScroll = debounce(startScroll, 500)
  window.addEventListener('resize', () => {
    cancelScroll()
    debouncedStartScroll()
  })
  startScroll()

  /* ------------------------------------------------------------------ */
  /* Chat button + comments                                             */
  /* ------------------------------------------------------------------ */

  function setCommentStatus (text, kind) {
    commentStatusEl.textContent = text
    commentStatusEl.className = kind || ''
  }

  function openChat () {
    commentPanelEl.classList.add('open')
    chatToggleEl.setAttribute('aria-expanded', 'true')
    setTimeout(() => commentInputEl.focus(), 50)
  }

  function closeChat (returnFocus) {
    commentPanelEl.classList.remove('open')
    chatToggleEl.setAttribute('aria-expanded', 'false')
    if (returnFocus) chatToggleEl.focus()
  }

  chatToggleEl.addEventListener('click', (e) => {
    e.stopPropagation()
    if (commentPanelEl.classList.contains('open')) closeChat(false)
    else openChat()
  })

  // Close when clicking elsewhere or pressing Escape
  document.addEventListener('click', (e) => {
    if (commentPanelEl.classList.contains('open') && !commentPanelEl.contains(e.target)) closeChat(false)
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && commentPanelEl.classList.contains('open')) closeChat(true)
  })

  function updateCount () {
    commentCountEl.textContent = `${commentInputEl.value.length} / ${commentInputEl.maxLength}`
  }
  commentInputEl.addEventListener('input', () => {
    updateCount()
    if (commentStatusEl.textContent) setCommentStatus('')
  })

  async function submitComment () {
    const message = commentInputEl.value.trim()
    if (!message) {
      setCommentStatus('Comment is empty! Please write something before sending.', 'error')
      commentInputEl.focus()
      return
    }

    commentSubmitEl.disabled = true
    setCommentStatus('Sending…')

    let ok = false
    try {
      const res = await fetch(`${API_BASE_URL}/add-comment?message=${encodeURIComponent(message)}`)
      ok = res.ok
    } catch (err) {
      console.error(err)
    }

    commentSubmitEl.disabled = false
    if (ok) {
      commentInputEl.value = ''
      updateCount()
      setCommentStatus('Thank you for your valuable comment!', 'ok')
    } else {
      // Keep the text so the listener can retry.
      setCommentStatus('Unable to submit comment. Please check your internet connection and try again later.', 'error')
    }
  }

  commentSubmitEl.addEventListener('click', submitComment)
  commentInputEl.addEventListener('keydown', (e) => {
    // Ctrl/Cmd+Enter sends
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      submitComment()
    }
  })
  updateCount()
})()
