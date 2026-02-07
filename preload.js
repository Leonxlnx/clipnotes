const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Notes
    getNotes: () => ipcRenderer.invoke('get-notes'),
    saveNote: (note) => ipcRenderer.invoke('save-note', note),
    deleteNote: (id) => ipcRenderer.invoke('delete-note', id),

    // Clipboard
    getClipboard: () => ipcRenderer.invoke('get-clipboard'),
    copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
    deleteClipboardEntry: (id) => ipcRenderer.invoke('delete-clipboard-entry', id),
    clearClipboard: () => ipcRenderer.invoke('clear-clipboard'),
    onClipboardUpdate: (callback) => ipcRenderer.on('clipboard-update', (_, entry) => callback(entry)),

    // Window
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close')
});
