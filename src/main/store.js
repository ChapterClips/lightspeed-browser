const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_DATA = {
  settings: {
    theme: 'system',
    homepage: 'lightspeed://newtab',
    searchEngine: 'https://www.google.com/search?q=%s'
  },
  profiles: [{ id: 'default', name: 'Default' }],
  activeProfile: 'default',
  bookmarks: [],
  history: [],
  downloads: [],
  extensions: []
};

class Store {
  constructor(userDataPath) {
    this.file = path.join(userDataPath, 'browser-data.json');
    this.data = structuredClone(DEFAULT_DATA);
    this.load();
  }

  load() {
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.data = {
        ...this.data,
        ...saved,
        settings: { ...this.data.settings, ...saved.settings }
      };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Could not read browser data:', error);
      }
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  addHistory(entry) {
    if (!entry.url || entry.url.startsWith('lightspeed://')) return;
    this.data.history.unshift(entry);
    this.data.history = this.data.history.slice(0, 1000);
    this.save();
  }

  addDownload(entry) {
    this.data.downloads.unshift(entry);
    this.data.downloads = this.data.downloads.slice(0, 200);
    this.save();
  }
}

module.exports = { Store };
