const { app, BrowserWindow, Tray, Menu, ipcMain, clipboard, nativeImage } = require('electron');
const path = require('path');
const Store = require('electron-store').default;

const store = new Store({
  defaults: {
    notes: [],
    clipboardHistory: [],
    windowBounds: { width: 900, height: 700 }
  }
});

let mainWindow;
let tray;
let clipboardWatcher;
let lastClipboardText = '';

function createWindow() {
  const { width, height } = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 600,
    minHeight: 500,
    frame: false,
    backgroundColor: '#0a0a0a',
    icon: path.join(__dirname, 'icon.png'),
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
  // Create a simple 16x16 tray icon
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
      label: 'Öffnen',
      click: () => mainWindow.show()
    },
    { type: 'separator' },
    {
      label: 'Beenden',
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

  clipboardWatcher = setInterval(() => {
    const currentText = clipboard.readText();
    if (currentText && currentText !== lastClipboardText) {
      lastClipboardText = currentText;

      const history = store.get('clipboardHistory') || [];
      const entry = {
        id: Date.now().toString(),
        text: currentText,
        timestamp: new Date().toISOString()
      };

      // Add to front, limit to 200 entries
      history.unshift(entry);
      if (history.length > 200) history.length = 200;
      store.set('clipboardHistory', history);

      // Notify renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('clipboard-update', entry);
      }
    }
  }, 800);
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
