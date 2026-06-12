const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lightspeed', {
  getState: () => ipcRenderer.invoke('browser:get-state'),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('browser:state', listener);
    return () => ipcRenderer.removeListener('browser:state', listener);
  },
  onDownload: (callback) => {
    const listener = (_event, item) => callback(item);
    ipcRenderer.on('download:updated', listener);
    return () => ipcRenderer.removeListener('download:updated', listener);
  },
  onFocusAddress: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('browser:focus-address', listener);
    return () => ipcRenderer.removeListener('browser:focus-address', listener);
  },
  newTab: (url) => ipcRenderer.send('browser:new-tab', url),
  activateTab: (id) => ipcRenderer.send('browser:activate-tab', id),
  closeTab: (id) => ipcRenderer.send('browser:close-tab', id),
  navigate: (url) => ipcRenderer.send('browser:navigate', url),
  back: () => ipcRenderer.send('browser:back'),
  forward: () => ipcRenderer.send('browser:forward'),
  reload: () => ipcRenderer.send('browser:reload'),
  stop: () => ipcRenderer.send('browser:stop'),
  home: () => ipcRenderer.send('browser:home'),
  toggleBookmark: () => ipcRenderer.invoke('browser:toggle-bookmark'),
  isBookmarked: () => ipcRenderer.invoke('browser:is-bookmarked'),
  createProfile: (name) => ipcRenderer.invoke('browser:create-profile', name),
  switchProfile: (id) => ipcRenderer.invoke('browser:switch-profile', id),
  loadExtension: () => ipcRenderer.invoke('browser:load-extension'),
  setTheme: (theme) => ipcRenderer.invoke('browser:set-theme', theme)
});
