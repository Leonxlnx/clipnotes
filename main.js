const { app, BrowserWindow, Tray, Menu, ipcMain, clipboard, nativeImage } = require('electron');
const path = require('path');
const Store = require('electron-store').default;

const store = new Store({
  defaults: {
    notes: [],
    clipboardHistory: [],
    windowBounds: { width: 920, height: 720 }
  }
});

let mainWindow;
let tray;
let clipboardWatcher;
let lastClipboardText = '';

// Create a teal clipboard icon as a 32x32 data-URI PNG
function createAppIcon(size = 32) {
  // Generate a simple icon via canvas in nativeImage
  const canvas = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256">
    <rect width="256" height="256" rx="48" fill="#0f0f0f"/>
    <rect x="60" y="60" width="136" height="160" rx="16" fill="none" stroke="#4fd1c5" stroke-width="12"/>
    <rect x="90" y="40" width="76" height="36" rx="10" fill="#0f0f0f" stroke="#4fd1c5" stroke-width="12"/>
    <line x1="90" y1="120" x2="166" y2="120" stroke="#4fd1c5" stroke-width="8" stroke-linecap="round" opacity="0.7"/>
    <line x1="90" y1="150" x2="150" y2="150" stroke="#4fd1c5" stroke-width="8" stroke-linecap="round" opacity="0.5"/>
    <line x1="90" y1="180" x2="135" y2="180" stroke="#4fd1c5" stroke-width="8" stroke-linecap="round" opacity="0.3"/>
  </svg>`;

  const svgBuffer = Buffer.from(canvas);
  return nativeImage.createFromBuffer(svgBuffer);
}

function createWindow() {
  const { width, height } = store.get('windowBounds');

  const iconPath = path.join(__dirname, 'icon.ico');

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 640,
    minHeight: 520,
    frame: false,
    backgroundColor: '#0a0a0a',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('resize', () => {
    const { width, height } = mainWindow.getBounds();
    store.set('windowBounds', { width, height });
  });

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });
}

function createTray() {
  // Simple 16x16 tray icon
  const icon = nativeImage.createFromBuffer(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAARklEQVQ4y2NkYPj/n4EKgJGRkYGBgYHh////DAwMDAz///9nZGBg+M/IyMhADcDEQCVANQNGDRg1YNSA4WAAMwM1Ex0Amv0PN1gvUSYAAAAASUVORK5CYII=',
      'base64'
    )
  );

  tray = new Tray(icon);
  tray.setToolTip('ClipNotes');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open',
      click: () => mainWindow.show()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        mainWindow.destroy();
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => mainWindow.show());
}

function startClipboardWatcher() {
  lastClipboardText = clipboard.readText();
  let lastAddedTime = 0;

  clipboardWatcher = setInterval(() => {
    const currentText = clipboard.readText();
    if (!currentText || currentText === lastClipboardText) return;

    // Debounce: ignore if last addition was less than 1s ago
    const now = Date.now();
    if (now - lastAddedTime < 1000) return;

    lastClipboardText = currentText;

    const history = store.get('clipboardHistory') || [];

    // Dedup: skip if the most recent entry has the exact same text
    if (history.length > 0 && history[0].text === currentText) return;

    const entry = {
      id: now.toString(),
      text: currentText,
      timestamp: new Date().toISOString()
    };

    lastAddedTime = now;

    // Add to front, limit to 200 entries
    history.unshift(entry);
    if (history.length > 200) history.length = 200;
    store.set('clipboardHistory', history);

    // Notify renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('clipboard-update', entry);
    }
  }, 1200);
}

// IPC Handlers — Notes
ipcMain.handle('get-notes', () => store.get('notes'));

ipcMain.handle('save-note', (_, note) => {
  const notes = store.get('notes');
  const idx = notes.findIndex(n => n.id === note.id);
  if (idx >= 0) {
    notes[idx] = note;
  } else {
    notes.unshift(note);
  }
  store.set('notes', notes);
  return notes;
});

ipcMain.handle('delete-note', (_, id) => {
  const notes = store.get('notes').filter(n => n.id !== id);
  store.set('notes', notes);
  return notes;
});

// IPC Handlers — Clipboard
ipcMain.handle('get-clipboard', () => store.get('clipboardHistory'));

ipcMain.handle('copy-to-clipboard', (_, text) => {
  clipboard.writeText(text);
  lastClipboardText = text; // prevent re-adding
});

ipcMain.handle('delete-clipboard-entry', (_, id) => {
  const history = store.get('clipboardHistory').filter(e => e.id !== id);
  store.set('clipboardHistory', history);
  return history;
});

ipcMain.handle('clear-clipboard', () => {
  store.set('clipboardHistory', []);
  return [];
});

// IPC Handlers — Window
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});
ipcMain.on('window-close', () => mainWindow.hide());

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  createTray();
  startClipboardWatcher();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
