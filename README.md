# Lightspeed Browser

Lightspeed Browser is a real multi-tab desktop browser application built with
[Electron](https://www.electronjs.org/). It has its own browser chrome, profiles,
new-tab page, bookmarks, history, downloads, settings, themes, and Windows installer.

> Electron embeds Chromium. This version does **not** fork, download, or compile the
> Chromium source tree, but web pages are still rendered by Electron's bundled
> Chromium engine.

## Included features

- Multiple live tabs using Electron `WebContentsView`
- Address/search bar, back, forward, reload, stop, and home controls
- Persistent bookmarks and browsing history
- Download tracking and open/show-in-folder actions
- Persistent profiles backed by separate Electron session partitions
- Light, dark, and system themes
- Custom Lightspeed new-tab and About pages
- Unpacked Chrome extension loading for APIs supported by Electron
- Context isolation, sandboxed renderers, strict preload APIs, and permission prompts
- NSIS Windows installer and portable `.exe` build targets

## Requirements

1. Windows 10 or 11, 64-bit
2. [Node.js LTS](https://nodejs.org/) and npm
3. Git, if you clone the repository
4. About 1 GB of free disk space for dependencies and build output

## Run from source

Open PowerShell in this folder:

```powershell
npm.cmd install
npm.cmd start
```

`npm.cmd` is used because some Windows PowerShell configurations block `npm.ps1`.

## Build a Windows installer

```powershell
npm.cmd install
npm.cmd run dist
```

The completed NSIS installer is written to:

```text
dist/Lightspeed-Browser-0.1.0-x64.exe
```

The installer lets the user choose an install directory and creates Start Menu
and desktop shortcuts.

To create a standalone portable executable instead:

```powershell
npm.cmd run dist:portable
```

The portable executable is written to:

```text
dist/Lightspeed-Browser-Portable-0.1.0-x64.exe
```

## Project structure

```text
lightspeed-browser/
├── build/
│   └── icon.png                 Windows installer/application icon
├── src/
│   ├── assets/
│   │   └── logo.svg             Scalable in-app Lightspeed logo
│   ├── main/
│   │   ├── main.js              Windows, tabs, navigation, sessions, IPC
│   │   ├── store.js             Persistent browser data
│   │   ├── preload.js           Secure browser-chrome API
│   │   └── page-preload.js      Secure internal-page API
│   ├── renderer/
│   │   ├── index.html           Tabs and toolbar markup
│   │   ├── styles.css           Browser chrome, light/dark styling
│   │   └── app.js               Browser chrome interactions
│   └── pages/
│       ├── newtab.html           Custom new-tab page
│       ├── about.html            About Lightspeed Browser
│       ├── bookmarks.html        Bookmark manager
│       ├── history.html          History manager
│       ├── downloads.html        Download manager
│       ├── settings.html         Theme/profile/homepage settings
│       ├── page.css              Shared internal-page design
│       └── page.js               Shared internal-page behavior
├── package.json                 Dependencies and installer configuration
└── README.md
```

## How the browser works

The main `BrowserWindow` renders only the trusted Lightspeed tab strip and toolbar.
Each web tab is a separate `WebContentsView` positioned below that toolbar. Tabs use
the active profile's persistent session partition, so cookies, cache, and logins are
separated by profile.

The browser chrome and internal pages have Node integration disabled. Their preload
scripts expose small allowlisted APIs through `contextBridge`; arbitrary websites
never receive those APIs.

Browser data is saved as `browser-data.json` under Electron's per-user application
data directory. Website cookies and storage live in Electron's profile partitions.

## Extensions

Open **Menu > Load unpacked extension** or **Settings > Extensions**, then select an
extension directory containing `manifest.json`.

Electron supports only a subset of the Chrome extension APIs. Chrome Web Store
installation, Chrome account sync, and extensions that depend on unsupported APIs
will not work. This is an Electron platform limitation, not a packaging problem.

## Branding

- Edit `src/assets/logo.svg` for the in-app logo.
- Replace `build/icon.png` with a square 512x512 or 1024x1024 PNG for the executable
  and installer icon.
- Change `productName`, `appId`, `executableName`, and installer options in
  `package.json`.

For production releases, use an original final logo and a Windows code-signing
certificate. Unsigned installers work, but Windows SmartScreen may warn users.

## Development checks

```powershell
npm.cmd run check
```

The command checks the JavaScript files for syntax errors. A full packaging run is
the final verification because it validates Electron and electron-builder together.

## Current scope

This is a functional browser foundation, not a drop-in replacement for every Google
Chrome service. Electron does not provide Chrome Sync, the Chrome Web Store, Safe
Browsing service credentials, DRM codecs, or Google's proprietary services by
default. Those require separate service integrations, licensing, and policy work.
