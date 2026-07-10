const page = document.body.dataset.page;
const $ = (selector) => document.querySelector(selector);

function navigate(url) {
  window.lightspeedPage.navigate(url);
}

// Curated backgrounds shipped with the browser. The key matches the file
// name in assets/backgrounds and the whitelist in the main process.
const BACKGROUNDS = [
  { key: 'fjord', label: 'Fjord' },
  { key: 'highlands', label: 'Highlands' },
  { key: 'valley', label: 'Valley' },
  { key: 'waterfall', label: 'Waterfall' },
  { key: 'basecamp', label: 'Base Camp' },
  { key: 'lake', label: 'Still Lake' },
  { key: 'storm', label: 'Storm' },
  { key: 'peaks', label: 'Peaks' }
];

function backgroundUrl(key) {
  return `../assets/backgrounds/${key}.jpg`;
}

function applyBackground(key) {
  const valid = BACKGROUNDS.some((bg) => bg.key === key);
  if (valid) {
    document.body.style.backgroundImage = `url("${backgroundUrl(key)}")`;
    document.body.classList.add('has-background');
  } else {
    document.body.style.backgroundImage = '';
    document.body.classList.remove('has-background');
  }
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function emptyMessage(container, text) {
  container.replaceChildren();
  const empty = document.createElement('div');
  empty.className = 'empty card';
  empty.textContent = text;
  container.append(empty);
}

function createItem(titleText, metaText, actions = []) {
  const item = document.createElement('div');
  item.className = 'item';
  const content = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'item-title';
  title.textContent = titleText;
  const meta = document.createElement('div');
  meta.className = 'item-meta';
  meta.textContent = metaText;
  content.append(title, meta);
  const actionBox = document.createElement('div');
  actionBox.className = 'item-actions';
  for (const action of actions) {
    const button = document.createElement('button');
    button.className = action.kind || 'secondary';
    button.textContent = action.label;
    button.addEventListener('click', action.run);
    actionBox.append(button);
  }
  item.append(content, actionBox);
  return item;
}

let currentBackground = null;

function renderNewTab(data) {
  currentBackground = data.settings?.background ?? null;
  applyBackground(currentBackground);
  const recent = $('#recent-list');
  const entries = data.history.slice(0, 6);
  if (!entries.length) {
    emptyMessage(recent, 'Your recently visited pages will appear here.');
    return;
  }
  recent.replaceChildren(...entries.map((entry) => createItem(entry.title, entry.url, [
    { label: 'Open', run: () => navigate(entry.url) }
  ])));
}

function renderBookmarks(data) {
  const list = $('#bookmarks-list');
  if (!data.bookmarks.length) {
    emptyMessage(list, 'No bookmarks yet. Use the star in the address bar to add one.');
    return;
  }
  list.replaceChildren(...data.bookmarks.map((bookmark) => createItem(
    bookmark.title || bookmark.url,
    bookmark.url,
    [
      { label: 'Open', run: () => navigate(bookmark.url) },
      {
        label: 'Remove',
        kind: 'danger',
        run: async () => {
          const bookmarks = await window.lightspeedPage.removeBookmark(bookmark.url);
          renderBookmarks({ ...data, bookmarks });
        }
      }
    ]
  )));
}

function renderHistory(data) {
  const list = $('#history-list');
  if (!data.history.length) {
    emptyMessage(list, 'No browsing history in this profile.');
    return;
  }
  list.replaceChildren(...data.history.map((entry) => createItem(
    entry.title || entry.url,
    `${entry.url} · ${formatDate(entry.visitedAt)}`,
    [{ label: 'Open', run: () => navigate(entry.url) }]
  )));
}

function renderDownloads(data) {
  const list = $('#downloads-list');
  if (!data.downloads.length) {
    emptyMessage(list, 'Downloaded files will appear here.');
    return;
  }
  list.replaceChildren(...data.downloads.map((download) => {
    const size = download.totalBytes
      ? `${Math.round((download.receivedBytes / download.totalBytes) * 100)}%`
      : download.state;
    return createItem(download.filename, `${size} · ${download.state}`, [
      {
        label: 'Open',
        run: () => window.lightspeedPage.openDownload(download.path)
      },
      {
        label: 'Show in folder',
        run: () => window.lightspeedPage.showDownload(download.path)
      }
    ]);
  }));
}

function renderSettings(data) {
  $('#theme').value = data.settings.theme;
  $('#homepage').value = data.settings.homepage;
  const profiles = $('#profiles');
  profiles.replaceChildren();
  for (const profile of data.profiles) {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = profile.name;
    option.selected = profile.id === data.activeProfile;
    profiles.append(option);
  }
}

function renderAbout(data) {
  $('#app-version').textContent = data.versions.app;
  $('#electron-version').textContent = data.versions.electron;
  $('#chromium-version').textContent = data.versions.chrome;
  $('#node-version').textContent = data.versions.node;
}

function render(data) {
  if (page === 'newtab') renderNewTab(data);
  if (page === 'bookmarks') renderBookmarks(data);
  if (page === 'history') renderHistory(data);
  if (page === 'downloads') renderDownloads(data);
  if (page === 'settings') renderSettings(data);
  if (page === 'about') renderAbout(data);
}

document.querySelectorAll('[data-navigate]').forEach((element) => {
  element.addEventListener('click', () => navigate(element.dataset.navigate));
});

$('#search-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  navigate($('#search-input').value);
});

$('#clear-history')?.addEventListener('click', async () => {
  await window.lightspeedPage.clearHistory();
  renderHistory({ history: [] });
});

$('#theme')?.addEventListener('change', (event) => {
  window.lightspeedPage.setTheme(event.target.value);
});

$('#save-homepage')?.addEventListener('click', async () => {
  $('#homepage').value = await window.lightspeedPage.setHomepage($('#homepage').value);
});

$('#profiles')?.addEventListener('change', (event) => {
  window.lightspeedPage.switchProfile(event.target.value);
});

$('#add-profile')?.addEventListener('click', async () => {
  const name = prompt('Profile name');
  if (name) await window.lightspeedPage.createProfile(name);
});

$('#load-extension')?.addEventListener('click', () => window.lightspeedPage.loadExtension());

// ---- New-tab music player (bundled royalty-free tracks) ----
const MUSIC = [
  { key: 'track1', name: 'Nightfall' },
  { key: 'track2', name: 'Momentum' },
  { key: 'track3', name: 'Skyline' },
  { key: 'track4', name: 'Afterglow' },
  { key: 'track5', name: 'Voyager' }
];
const MUSIC_ICONS = {
  play: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5.5v13l11-6.5z"/></svg>',
  pause: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5.5" width="4" height="13" rx="1"/><rect x="13.5" y="5.5" width="4" height="13" rx="1"/></svg>',
  prev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5.5h2.2v13H7zM19 5.5v13l-9-6.5z"/></svg>',
  next: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M14.8 5.5H17v13h-2.2zM5 5.5v13l9-6.5z"/></svg>'
};

function setupMusicPlayer() {
  const audio = $('#music-audio');
  if (!audio) return;
  const listEl = $('#music-list');
  const titleEl = $('#music-title');
  const playBtn = $('#music-play');
  let current = -1;

  $('#music-prev').innerHTML = MUSIC_ICONS.prev;
  $('#music-next').innerHTML = MUSIC_ICONS.next;
  playBtn.innerHTML = MUSIC_ICONS.play;

  function refresh() {
    playBtn.innerHTML = audio.paused ? MUSIC_ICONS.play : MUSIC_ICONS.pause;
    playBtn.title = audio.paused ? 'Play' : 'Pause';
    listEl.querySelectorAll('.music-track').forEach((el, i) => {
      el.classList.toggle('active', i === current);
    });
    titleEl.textContent = current >= 0 ? MUSIC[current].name : 'Pick a track to play';
  }

  function load(index, play = true) {
    current = (index + MUSIC.length) % MUSIC.length;
    audio.src = `../assets/music/${MUSIC[current].key}.mp3`;
    if (play) audio.play().catch(() => {});
    refresh();
  }

  listEl.replaceChildren(...MUSIC.map((track, i) => {
    const btn = document.createElement('button');
    btn.className = 'music-track';
    btn.type = 'button';
    btn.textContent = track.name;
    btn.addEventListener('click', () => {
      if (i === current) audio.paused ? audio.play() : audio.pause();
      else load(i);
    });
    return btn;
  }));

  playBtn.addEventListener('click', () => {
    if (current < 0) load(0);
    else if (audio.paused) audio.play(); else audio.pause();
  });
  $('#music-prev').addEventListener('click', () => load(current < 0 ? 0 : current - 1));
  $('#music-next').addEventListener('click', () => load(current < 0 ? 0 : current + 1));
  $('#music-volume').addEventListener('input', (e) => { audio.volume = Number(e.target.value); });
  audio.volume = Number($('#music-volume').value);
  audio.addEventListener('play', refresh);
  audio.addEventListener('pause', refresh);
  audio.addEventListener('ended', () => load(current + 1));
  refresh();
}

function buildBackgroundGrid() {
  const grid = $('#bg-grid');
  if (!grid) return;

  async function choose(key) {
    currentBackground = await window.lightspeedPage.setBackground(key);
    applyBackground(currentBackground);
    buildBackgroundGrid();
  }

  const tiles = [];

  const none = document.createElement('button');
  none.type = 'button';
  none.className = 'bg-tile bg-tile-none' + (currentBackground ? '' : ' active');
  none.textContent = 'None';
  none.addEventListener('click', () => choose(null));
  tiles.push(none);

  for (const bg of BACKGROUNDS) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'bg-tile' + (currentBackground === bg.key ? ' active' : '');
    tile.style.backgroundImage = `url("${backgroundUrl(bg.key)}")`;
    tile.title = bg.label;
    const caption = document.createElement('span');
    caption.textContent = bg.label;
    tile.append(caption);
    tile.addEventListener('click', () => choose(bg.key));
    tiles.push(tile);
  }

  grid.replaceChildren(...tiles);
}

const bgButton = $('#bg-button');
if (bgButton) {
  const picker = $('#bg-picker');
  const openPicker = () => {
    buildBackgroundGrid();
    picker.hidden = false;
  };
  const closePicker = () => {
    picker.hidden = true;
  };
  bgButton.addEventListener('click', openPicker);
  $('#bg-close')?.addEventListener('click', closePicker);
  picker.addEventListener('click', (event) => {
    if (event.target === picker) closePicker();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !picker.hidden) closePicker();
  });
}

setupMusicPlayer();

window.lightspeedPage.onData(render);
window.lightspeedPage.requestData();
