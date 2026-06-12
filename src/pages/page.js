const page = document.body.dataset.page;
const $ = (selector) => document.querySelector(selector);

function navigate(url) {
  window.lightspeedPage.navigate(url);
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

function renderNewTab(data) {
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

window.lightspeedPage.onData(render);
window.lightspeedPage.requestData();
