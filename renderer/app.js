// ===========================
// ClipNotes — App Logic (Clean)
// ===========================

// Inject all SVG icons into the DOM
function initIcons() {
    const iconMap = {
        'titlebar-logo': Icons.logo,
        'icon-minimize': Icons.minimize,
        'icon-maximize': Icons.maximize,
        'icon-close': Icons.close,
        'tab-icon-notes': Icons.notes,
        'tab-icon-clipboard': Icons.clipboard,
        'search-icon': Icons.search,
        'icon-add': Icons.add,
        'icon-back': Icons.back,
        'icon-save': Icons.save,
        'icon-clear': Icons.clear
    };

    for (const [id, svg] of Object.entries(iconMap)) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = svg;
    }
}

initIcons();

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

    editingNote.title = noteTitle.value.trim() || 'Untitled Note';
    editingNote.content = noteContent.value;
    editingNote.updatedAt = new Date().toISOString();

    await window.api.saveNote(editingNote);
    hideEditor();
    showToast('Note saved');
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
        <div class="empty-icon">${Icons.empty_notes}</div>
        <div class="empty-text">${searchQuery ? 'No results' : 'No notes yet.<br>Create your first note!'}</div>
      </div>
    `;
        return;
    }

    notesList.innerHTML = filtered.map(note => `
    <div class="note-card" data-id="${note.id}">
      <div class="note-card-title">${escapeHtml(note.title || 'Untitled Note')}</div>
      <div class="note-card-preview">${escapeHtml(note.content.substring(0, 120)) || 'Empty...'}</div>
      <div class="note-card-meta">
        <span class="note-card-date">${formatDate(note.updatedAt)}</span>
        <button class="btn-icon danger" data-delete="${note.id}" title="Delete">${Icons.trash}</button>
      </div>
    </div>
  `).join('');

    // Event listeners
    notesList.querySelectorAll('.note-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('[data-delete]')) return;
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
            showToast('Note deleted');
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

    clipCount.textContent = `${filtered.length} entries`;

    if (filtered.length === 0) {
        clipboardList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${Icons.empty_clipboard}</div>
        <div class="empty-text">${searchQuery ? 'No results' : 'Clipboard is empty.<br>Copy something with Ctrl+C!'}</div>
      </div>
    `;
        return;
    }

    clipboardList.innerHTML = filtered.map(entry => `
    <div class="clip-entry" data-id="${entry.id}">
      <div class="clip-text" data-copy="${escapeAttr(entry.text)}" title="Click to copy">${escapeHtml(entry.text.substring(0, 300))}${entry.text.length > 300 ? '...' : ''}</div>
      <div class="clip-meta">
        <span class="clip-time">${formatTime(entry.timestamp)}</span>
        <div class="clip-actions">
          <button class="btn-icon" data-recopy="${escapeAttr(entry.text)}" title="Copy">${Icons.copy}</button>
          <button class="btn-icon danger" data-clipdel="${entry.id}" title="Delete">${Icons.trash}</button>
        </div>
      </div>
    </div>
  `).join('');

    // Copy back
    clipboardList.querySelectorAll('[data-copy]').forEach(el => {
        el.addEventListener('click', async () => {
            await window.api.copyToClipboard(el.dataset.copy);
            showToast('Copied');
        });
    });

    clipboardList.querySelectorAll('[data-recopy]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await window.api.copyToClipboard(btn.dataset.recopy);
            showToast('Copied');
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
    if (confirm('Delete all clipboard entries?')) {
        await window.api.clearClipboard();
        loadClipboard();
        showToast('Clipboard cleared');
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

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) +
        ' · ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
