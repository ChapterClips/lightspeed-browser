const {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  session,
  dialog,
  shell,
  nativeTheme
} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { Store } = require('./store');

const TOOLBAR_HEIGHT = 122;
const MIN_CONTENT_HEIGHT = 100;
const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'file:', 'lightspeed:']);

let mainWindow;
let store;
let tabs = [];
let activeTabId = null;
let nextTabId = 1;

function currentProfile() {
  return store.data.profiles.find((profile) => profile.id === store.data.activeProfile)
    || store.data.profiles[0];
}

function profileSession(profileId = currentProfile().id) {
  return session.fromPartition(`persist:lightspeed-${profileId}`);
}

function internalPageUrl(page) {
  return pathToFileURL(path.join(__dirname, '..', 'pages', `${page}.html`)).toString();
}

function normalizeInput(input) {
  const value = String(input || '').trim();
  if (!value) return 'lightspeed://newtab';
  if (value.startsWith('lightspeed://')) return value;

  try {
    const parsed = new URL(value);
    if (ALLOWED_SCHEMES.has(parsed.protocol)) return parsed.toString();
  } catch {
    // Treat non-URLs as either hostnames or search terms.
  }

  if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/.*)?$/i.test(value)) {
    return `http://${value}`;
  }
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/i.test(value)) {
    return `https://${value}`;
  }
  return store.data.settings.searchEngine.replace('%s', encodeURIComponent(value));
}

function resolveUrl(url) {
  if (url === 'lightspeed://newtab') return internalPageUrl('newtab');
  if (url === 'lightspeed://about') return internalPageUrl('about');
  if (url === 'lightspeed://bookmarks') return internalPageUrl('bookmarks');
  if (url === 'lightspeed://history') return internalPageUrl('history');
  if (url === 'lightspeed://downloads') return internalPageUrl('downloads');
  if (url === 'lightspeed://settings') return internalPageUrl('settings');
  return normalizeInput(url);
}

function publicUrl(url) {
  const pages = ['newtab', 'about', 'bookmarks', 'history', 'downloads', 'settings'];
  for (const page of pages) {
    if (url === internalPageUrl(page)) return `lightspeed://${page}`;
  }
  return url;
}

function getActiveTab() {
  return tabs.find((tab) => tab.id === activeTabId);
}

function tabState(tab) {
  const contents = tab.view.webContents;
  return {
    id: tab.id,
    title: tab.title || 'New Tab',
    url: publicUrl(contents.getURL()) || tab.requestedUrl,
    loading: contents.isLoading(),
    canGoBack: contents.navigationHistory.canGoBack(),
    canGoForward: contents.navigationHistory.canGoForward(),
    favicon: tab.favicon || ''
  };
}

function sendState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('browser:state', {
    tabs: tabs.map(tabState),
    activeTabId,
    profile: currentProfile(),
    profiles: store.data.profiles,
    settings: store.data.settings
  });
}

function layoutViews() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const [width, height] = mainWindow.getContentSize();
  for (const tab of tabs) {
    tab.view.setBounds({
      x: 0,
      y: TOOLBAR_HEIGHT,
      width,
      height: Math.max(MIN_CONTENT_HEIGHT, height - TOOLBAR_HEIGHT)
    });
  }
}

function showActiveTab() {
  for (const tab of tabs) {
    tab.view.setVisible(tab.id === activeTabId);
  }
  sendState();
}

function sendInternalData(tab) {
  const url = publicUrl(tab.view.webContents.getURL());
  if (!url.startsWith('lightspeed://')) return;
  tab.view.webContents.send('internal:data', {
    page: url.slice('lightspeed://'.length),
    bookmarks: store.data.bookmarks,
    history: store.data.history,
    downloads: store.data.downloads,
    settings: store.data.settings,
    profiles: store.data.profiles,
    activeProfile: store.data.activeProfile,
    versions: {
      app: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node
    }
  });
}

function wireTab(tab) {
  const contents = tab.view.webContents;

  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = input.key.toLowerCase();
    const primary = input.control || input.meta;
    if (primary && key === 'l') {
      event.preventDefault();
      mainWindow.webContents.focus();
      mainWindow.webContents.send('browser:focus-address');
    } else if (primary && key === 't') {
      event.preventDefault();
      createTab();
    } else if (primary && key === 'w') {
      event.preventDefault();
      closeTab(tab.id);
    } else if (primary && key === 'r') {
      event.preventDefault();
      contents.reload();
    } else if (primary && key === 'h') {
      event.preventDefault();
      contents.loadURL(resolveUrl('lightspeed://history'));
    } else if (primary && key === 'j') {
      event.preventDefault();
      contents.loadURL(resolveUrl('lightspeed://downloads'));
    } else if (input.alt && key === 'arrowleft' && contents.navigationHistory.canGoBack()) {
      event.preventDefault();
      contents.navigationHistory.goBack();
    } else if (input.alt && key === 'arrowright' && contents.navigationHistory.canGoForward()) {
      event.preventDefault();
      contents.navigationHistory.goForward();
    }
  });

  contents.setWindowOpenHandler(({ url }) => {
    createTab(url, true);
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    const parsed = new URL(url);
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
      event.preventDefault();
    }
  });

  contents.on('page-title-updated', (_event, title) => {
    tab.title = title || 'New Tab';
    sendState();
  });

  contents.on('page-favicon-updated', (_event, favicons) => {
    tab.favicon = favicons[0] || '';
    sendState();
  });

  contents.on('did-start-loading', sendState);
  contents.on('did-stop-loading', () => {
    sendState();
    sendInternalData(tab);
  });

  contents.on('did-navigate', (_event, url) => {
    const visibleUrl = publicUrl(url);
    tab.requestedUrl = visibleUrl;
    store.addHistory({
      title: tab.title || visibleUrl,
      url: visibleUrl,
      visitedAt: new Date().toISOString()
    });
    sendState();
    sendInternalData(tab);
  });

  contents.on('did-navigate-in-page', (_event, url) => {
    tab.requestedUrl = publicUrl(url);
    sendState();
  });

  contents.on('render-process-gone', (_event, details) => {
    tab.title = `Crashed (${details.reason})`;
    sendState();
  });
}

function createTab(url = 'lightspeed://newtab', activate = true) {
  const id = nextTabId++;
  const view = new WebContentsView({
    webPreferences: {
      partition: `persist:lightspeed-${currentProfile().id}`,
      preload: path.join(__dirname, 'page-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  const tab = { id, view, title: 'New Tab', requestedUrl: url, favicon: '' };
  tabs.push(tab);
  mainWindow.contentView.addChildView(view);
  wireTab(tab);
  layoutViews();
  view.webContents.loadURL(resolveUrl(url));
  if (activate) activeTabId = id;
  showActiveTab();
  return id;
}

function closeTab(id) {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index === -1) return;
  const [tab] = tabs.splice(index, 1);
  mainWindow.contentView.removeChildView(tab.view);
  tab.view.webContents.close();

  if (!tabs.length) {
    createTab();
    return;
  }
  if (activeTabId === id) {
    activeTabId = tabs[Math.min(index, tabs.length - 1)].id;
  }
  showActiveTab();
}

function configureSession(ses) {
  if (ses.__lightspeedConfigured) return;
  ses.__lightspeedConfigured = true;

  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const safePermissions = new Set(['clipboard-sanitized-write', 'fullscreen', 'pointerLock']);
    if (safePermissions.has(permission)) {
      callback(true);
      return;
    }
    const parent = BrowserWindow.fromWebContents(webContents) || mainWindow;
    dialog.showMessageBox(parent, {
      type: 'question',
      title: 'Site permission',
      message: `${details.requestingUrl || webContents.getURL()} requests ${permission}.`,
      buttons: ['Deny', 'Allow'],
      defaultId: 0,
      cancelId: 0
    }).then(({ response }) => callback(response === 1));
  });

  ses.on('will-download', (_event, item) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const entry = {
      id,
      filename: item.getFilename(),
      url: item.getURL(),
      path: '',
      state: 'progressing',
      receivedBytes: 0,
      totalBytes: item.getTotalBytes(),
      startedAt: new Date().toISOString()
    };
    store.addDownload(entry);
    mainWindow?.webContents.send('download:updated', entry);

    item.on('updated', (_event, state) => {
      entry.state = state;
      entry.receivedBytes = item.getReceivedBytes();
      entry.totalBytes = item.getTotalBytes();
      entry.path = item.getSavePath();
      store.save();
      mainWindow?.webContents.send('download:updated', entry);
    });

    item.once('done', (_event, state) => {
      entry.state = state;
      entry.path = item.getSavePath();
      entry.receivedBytes = item.getReceivedBytes();
      store.save();
      mainWindow?.webContents.send('download:updated', entry);
    });
  });
}

async function loadSavedExtensions(ses) {
  for (const extensionPath of store.data.extensions) {
    try {
      await ses.extensions.loadExtension(extensionPath, { allowFileAccess: true });
    } catch (error) {
      console.error(`Could not load extension at ${extensionPath}:`, error.message);
    }
  }
}

async function switchProfile(profileId) {
  if (!store.data.profiles.some((profile) => profile.id === profileId)) return;
  for (const tab of [...tabs]) {
    mainWindow.contentView.removeChildView(tab.view);
    tab.view.webContents.close();
  }
  tabs = [];
  activeTabId = null;
  store.data.activeProfile = profileId;
  store.save();
  const ses = profileSession(profileId);
  configureSession(ses);
  await loadSavedExtensions(ses);
  createTab();
}

function registerIpc() {
  ipcMain.handle('browser:get-state', () => ({
    tabs: tabs.map(tabState),
    activeTabId,
    profile: currentProfile(),
    profiles: store.data.profiles,
    settings: store.data.settings
  }));
  ipcMain.on('browser:new-tab', (_event, url) => createTab(url));
  ipcMain.on('browser:activate-tab', (_event, id) => {
    if (tabs.some((tab) => tab.id === id)) {
      activeTabId = id;
      showActiveTab();
    }
  });
  ipcMain.on('browser:close-tab', (_event, id) => closeTab(id));
  ipcMain.on('browser:navigate', (_event, input) => {
    const tab = getActiveTab();
    if (tab) tab.view.webContents.loadURL(resolveUrl(input));
  });
  ipcMain.on('browser:back', () => {
    const history = getActiveTab()?.view.webContents.navigationHistory;
    if (history?.canGoBack()) history.goBack();
  });
  ipcMain.on('browser:forward', () => {
    const history = getActiveTab()?.view.webContents.navigationHistory;
    if (history?.canGoForward()) history.goForward();
  });
  ipcMain.on('browser:reload', () => getActiveTab()?.view.webContents.reload());
  ipcMain.on('browser:stop', () => getActiveTab()?.view.webContents.stop());
  ipcMain.on('browser:home', () => {
    getActiveTab()?.view.webContents.loadURL(resolveUrl(store.data.settings.homepage));
  });
  ipcMain.handle('browser:toggle-bookmark', () => {
    const tab = getActiveTab();
    if (!tab) return false;
    const url = publicUrl(tab.view.webContents.getURL());
    const existing = store.data.bookmarks.findIndex((bookmark) => bookmark.url === url);
    if (existing >= 0) {
      store.data.bookmarks.splice(existing, 1);
    } else {
      store.data.bookmarks.unshift({ title: tab.title, url, createdAt: new Date().toISOString() });
    }
    store.save();
    return existing < 0;
  });
  ipcMain.handle('browser:is-bookmarked', () => {
    const tab = getActiveTab();
    return Boolean(tab && store.data.bookmarks.some(
      (bookmark) => bookmark.url === publicUrl(tab.view.webContents.getURL())
    ));
  });
  ipcMain.handle('browser:create-profile', async (_event, name) => {
    const cleanName = String(name || '').trim().slice(0, 40);
    if (!cleanName) return null;
    const id = `${Date.now()}-${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    store.data.profiles.push({ id, name: cleanName });
    store.save();
    await switchProfile(id);
    return currentProfile();
  });
  ipcMain.handle('browser:switch-profile', (_event, id) => switchProfile(id));
  ipcMain.handle('browser:load-extension', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select an unpacked Chrome extension folder',
      properties: ['openDirectory']
    });
    if (result.canceled) return null;
    const extensionPath = result.filePaths[0];
    try {
      const extension = await profileSession().extensions.loadExtension(
        extensionPath,
        { allowFileAccess: true }
      );
      if (!store.data.extensions.includes(extensionPath)) {
        store.data.extensions.push(extensionPath);
        store.save();
      }
      return { id: extension.id, name: extension.name, path: extensionPath };
    } catch (error) {
      await dialog.showErrorBox('Extension could not be loaded', error.message);
      return null;
    }
  });
  ipcMain.handle('browser:set-theme', (_event, theme) => {
    if (!['system', 'light', 'dark'].includes(theme)) return;
    store.data.settings.theme = theme;
    nativeTheme.themeSource = theme;
    store.save();
    sendState();
  });
  ipcMain.handle('browser:set-homepage', (_event, homepage) => {
    store.data.settings.homepage = normalizeInput(homepage);
    store.save();
    return store.data.settings.homepage;
  });
  ipcMain.handle('browser:clear-history', () => {
    store.data.history = [];
    store.save();
    return true;
  });
  ipcMain.handle('browser:open-download', (_event, filePath) => {
    if (filePath && fs.existsSync(filePath)) shell.openPath(filePath);
  });
  ipcMain.handle('browser:show-download', (_event, filePath) => {
    if (filePath && fs.existsSync(filePath)) shell.showItemInFolder(filePath);
  });
  ipcMain.on('internal:navigate', (_event, url) => {
    getActiveTab()?.view.webContents.loadURL(resolveUrl(url));
  });
  ipcMain.handle('internal:get-data', () => {
    const tab = getActiveTab();
    if (tab) sendInternalData(tab);
  });
  ipcMain.handle('internal:remove-bookmark', (_event, url) => {
    store.data.bookmarks = store.data.bookmarks.filter((bookmark) => bookmark.url !== url);
    store.save();
    return store.data.bookmarks;
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Lightspeed Browser',
    backgroundColor: '#0b1020',
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.setMenuBarVisibility(false);
  await mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.on('resize', layoutViews);
  mainWindow.on('closed', () => {
    for (const tab of tabs) tab.view.webContents.close();
    tabs = [];
    mainWindow = null;
  });
  createTab();
}

app.setName('Lightspeed Browser');

app.whenReady().then(async () => {
  store = new Store(app.getPath('userData'));
  nativeTheme.themeSource = store.data.settings.theme;
  configureSession(profileSession());
  await loadSavedExtensions(profileSession());
  registerIpc();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
