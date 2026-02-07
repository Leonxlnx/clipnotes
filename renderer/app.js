// ===========================
// ClipNotes — App Logic
// ===========================

// State
let currentTab = 'notes';
let editingNote = null;
let searchQuery = '';

// DOM Elements
const tabs = document.querySelectorAll('.tab');
const panels = {
    notes: document.getElementById('panel-notes'),
    clipboard: document.getElementById('panel-clipboard')
};
const searchInput = document.getElementById('search-input');
const notesList = document.getElementById('notes-list');
const clipboardList = document.getElementById('clipboard-list');
const noteEditor = document.getElementById('note-editor');
const noteTitle = document.getElementById('note-title');
const noteContent = document.getElementById('note-content');
const clipBadge = document.getElementById('clip-badge');
const clipCount = document.getElementById('clip-count');

// Window Controls
document.getElementById('btn-minimize').addEventListener('click', () => window.api.minimize());
document.getElementById('btn-maximize').addEventListener('click', () => window.api.maximize());
document.getElementById('btn-close').addEventListener('click', () => window.api.close());

// Tab Switching
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        currentTab = target;

        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        Object.values(panels).forEach(p => p.classList.remove('active'));
        panels[target].classList.add('active');

        // Reset badge when viewing clipboard
        if (target === 'clipboard') {
            clipBadge.style.display = 'none';
            clipBadge.textContent = '0';
        }

        searchInput.value = '';
        searchQuery = '';
        refresh();
    });
});

// Search
searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    refresh();
});

// ---- Notes ----
document.getElementById('btn-new-note').addEventListener('click', () => {
    editingNote = {
        id: Date.now().toString(),
        title: '',
        content: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    showEditor();
});

document.getElementById('btn-back').addEventListener('click', hideEditor);

document.getElementById('btn-save').addEventListener('click', async () => {
    if (!editingNote) return;

    editingNote.title = noteTitle.value.trim() || 'Unbenannte Notiz';
    editingNote.content = noteContent.value;
    editingNote.updatedAt = new Date().toISOString();

    await window.api.saveNote(editingNote);
    hideEditor();
    showToast('Notiz gespeichert ✓');
    loadNotes();
});

function showEditor() {
    noteTitle.value = editingNote.title;
    noteContent.value = editingNote.content;
    noteEditor.style.display = 'flex';
    notesList.style.display = 'none';
    document.querySelector('#panel-notes .panel-header').style.display = 'none';
    noteTitle.focus();
}

function hideEditor() {
    editingNote = null;
    noteEditor.style.display = 'none';
    notesList.style.display = 'flex';
    document.querySelector('#panel-notes .panel-header').style.display = 'flex';
}

async function loadNotes() {
    const notes = await window.api.getNotes();
    renderNotes(notes);
}

function renderNotes(notes) {
    const filtered = notes.filter(n =>
        !searchQuery ||
        n.title.toLowerCase().includes(searchQuery) ||
        n.content.toLowerCase().includes(searchQuery)
    );

    if (filtered.length === 0) {
        notesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <div class="empty-text">${searchQuery ? 'Keine Ergebnisse' : 'Noch keine Notizen.<br>Erstelle deine erste Notiz!'}</div>
      </div>
    `;
        return;
    }

    notesList.innerHTML = filtered.map(note => `
    <div class="note-card" data-id="${note.id}">
      <div class="note-card-title">${escapeHtml(note.title || 'Unbenannte Notiz')}</div>
      <div class="note-card-preview">${escapeHtml(note.content.substring(0, 120)) || 'Leer...'}</div>
      <div class="note-card-meta">
        <span class="note-card-date">${formatDate(note.updatedAt)}</span>
        <button class="btn-icon danger" data-delete="${note.id}" title="Löschen">🗑</button>
      </div>
    </div>
  `).join('');

    // Event listeners
    notesList.querySelectorAll('.note-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.dataset.delete) return;
            const note = notes.find(n => n.id === card.dataset.id);
            if (note) {
                editingNote = { ...note };
                showEditor();
            }
        });
    });

    notesList.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await window.api.deleteNote(btn.dataset.delete);
            showToast('Notiz gelöscht');
            loadNotes();
        });
    });
}

// ---- Clipboard ----
async function loadClipboard() {
    const history = await window.api.getClipboard();
    renderClipboard(history);
}

function renderClipboard(history) {
    const filtered = history.filter(e =>
        !searchQuery || e.text.toLowerCase().includes(searchQuery)
    );

    clipCount.textContent = `${filtered.length} Einträge`;

    if (filtered.length === 0) {
        clipboardList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-text">${searchQuery ? 'Keine Ergebnisse' : 'Clipboard ist leer.<br>Kopiere etwas mit Ctrl+C!'}</div>
      </div>
    `;
        return;
    }

    clipboardList.innerHTML = filtered.map(entry => `
    <div class="clip-entry" data-id="${entry.id}">
      <div class="clip-text" data-copy="${escapeAttr(entry.text)}" title="Klicken zum Kopieren">${escapeHtml(entry.text.substring(0, 300))}${entry.text.length > 300 ? '...' : ''}</div>
      <div class="clip-meta">
        <span class="clip-time">${formatTime(entry.timestamp)}</span>
        <div class="clip-actions">
          <button class="btn-icon" data-recopy="${escapeAttr(entry.text)}" title="Kopieren">📋</button>
          <button class="btn-icon danger" data-clipdel="${entry.id}" title="Löschen">✕</button>
        </div>
      </div>
    </div>
  `).join('');

    // Copy back
    clipboardList.querySelectorAll('[data-copy]').forEach(el => {
        el.addEventListener('click', async () => {
            await window.api.copyToClipboard(el.dataset.copy);
            showToast('In Clipboard kopiert ✓');
        });
    });

    clipboardList.querySelectorAll('[data-recopy]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await window.api.copyToClipboard(btn.dataset.recopy);
            showToast('In Clipboard kopiert ✓');
        });
    });

    // Delete entry
    clipboardList.querySelectorAll('[data-clipdel]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await window.api.deleteClipboardEntry(btn.dataset.clipdel);
            loadClipboard();
        });
    });
}

// Clear all clipboard
document.getElementById('btn-clear-clip').addEventListener('click', async () => {
    if (confirm('Alle Clipboard-Einträge löschen?')) {
        await window.api.clearClipboard();
        loadClipboard();
        showToast('Clipboard geleert');
    }
});

// Live clipboard updates
window.api.onClipboardUpdate((entry) => {
    if (currentTab !== 'clipboard') {
        const count = parseInt(clipBadge.textContent || '0') + 1;
        clipBadge.textContent = count;
        clipBadge.style.display = 'inline-block';
    }
    loadClipboard();
});

// ---- Utilities ----
function refresh() {
    if (currentTab === 'notes') loadNotes();
    else loadClipboard();
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;

    if (diff < 60000) return 'Gerade eben';
    if (diff < 3600000) return `vor ${Math.floor(diff / 60000)} Min.`;
    if (diff < 86400000) return `vor ${Math.floor(diff / 3600000)} Std.`;

    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) +
        ' · ' + d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

// Toast
function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+N = New note
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        document.getElementById('btn-new-note').click();
    }
    // Ctrl+F = Focus search
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
    }
    // Escape = Close editor or clear search
    if (e.key === 'Escape') {
        if (noteEditor.style.display !== 'none') {
            hideEditor();
        } else {
            searchInput.value = '';
            searchQuery = '';
            refresh();
        }
    }
});

// Initial load
loadNotes();
loadClipboard();
