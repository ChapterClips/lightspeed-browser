const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lightspeedPage', {
  requestData: () => ipcRenderer.invoke('internal:get-data'),
  onData: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('internal:data', listener);
    return () => ipcRenderer.removeListener('internal:data', listener);
  },
  navigate: (url) => ipcRenderer.send('internal:navigate', url),
  removeBookmark: (url) => ipcRenderer.invoke('internal:remove-bookmark', url),
  clearHistory: () => ipcRenderer.invoke('browser:clear-history'),
  setTheme: (theme) => ipcRenderer.invoke('browser:set-theme', theme),
  setHomepage: (homepage) => ipcRenderer.invoke('browser:set-homepage', homepage),
  setBackground: (background) => ipcRenderer.invoke('browser:set-background', background),
  createProfile: (name) => ipcRenderer.invoke('browser:create-profile', name),
  switchProfile: (id) => ipcRenderer.invoke('browser:switch-profile', id),
  loadExtension: () => ipcRenderer.invoke('browser:load-extension'),
  openDownload: (filePath) => ipcRenderer.invoke('browser:open-download', filePath),
  showDownload: (filePath) => ipcRenderer.invoke('browser:show-download', filePath)
});
