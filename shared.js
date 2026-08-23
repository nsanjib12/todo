// ─────────────── Theme Manager ───────────────
const THEME_KEY = 'lifeTrackerTheme';
const themeManager = {
    get() { return localStorage.getItem(THEME_KEY) || 'system'; },
    set(t) { localStorage.setItem(THEME_KEY, t); this.apply(); },
    apply() {
        const t = this.get();
        if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
        else if (t === 'light') document.documentElement.removeAttribute('data-theme');
        else {
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
        }
    }
};
themeManager.apply();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themeManager.get() === 'system') themeManager.apply();
});

// ─────────────── Google Sheets Sync with Change Tracking ───────────────
const API_URL = 'https://script.google.com/macros/s/AKfycbw5JtTxsj-1NifgJwuXdZxQDKw22haY8cojjrJtOeZjVios56FryydTCSrxhMa9qQoShA/exec';
const TOKEN_KEY = 'lifeTrackerSecurityToken';
const PENDING_CHANGES_KEY = 'lifeTrackerPendingChanges';

let appData = {
    todo: { tasks: {} },
    habits: { habits: [], completions: {} },
    expenses: { transactions: [] }
};

let pendingChanges = loadPendingChanges();
let syncInProgress = false;

function loadPendingChanges() {
    try {
        return JSON.parse(localStorage.getItem(PENDING_CHANGES_KEY)) || createEmptyChanges();
    } catch(e) {
        return createEmptyChanges();
    }
}

function createEmptyChanges() {
    return {
        todo: { deleted: [], upserted: [] },
        habits: { deleted: [], upserted: [] },
        expenses: { deleted: [], upserted: [] }
    };
}

function savePendingChanges() {
    localStorage.setItem(PENDING_CHANGES_KEY, JSON.stringify(pendingChanges));
}

function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
function setToken(token) { localStorage.setItem(TOKEN_KEY, token); }

function updateSyncUI(state, text) {
    const dot = document.getElementById('syncDot');
    const txt = document.getElementById('syncText');
    if (dot) dot.className = 'sync-dot ' + state;
    if (txt) txt.textContent = text;
}

async function syncToCloud() {
    const token = getToken();
    if (!token || syncInProgress) return;
    
    const hasChanges = Object.keys(pendingChanges).some(key => {
        const c = pendingChanges[key];
        return (c.deleted && c.deleted.length > 0) || (c.upserted && c.upserted.length > 0);
    });
    
    if (!hasChanges) return;
    
    syncInProgress = true;
    updateSyncUI('syncing', 'Syncing...');
    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ token, changes: pendingChanges })
        });
        pendingChanges = createEmptyChanges();
        savePendingChanges();
        updateSyncUI('online', 'Saved online');
    } catch (e) {
        console.warn('Sync failed', e);
        updateSyncUI('offline', 'Offline');
    } finally {
        syncInProgress = false;
    }
}

async function loadFromCloud() {
    const token = getToken();
    if (!token) {
        updateSyncUI('offline', 'Token required');
        return false;
    }
    updateSyncUI('syncing', 'Loading...');
    try {
        const resp = await fetch(`${API_URL}?token=${encodeURIComponent(token)}`);
        if (!resp.ok) throw new Error('Fetch failed');
        const data = await resp.json();
        if (data.error) {
            updateSyncUI('offline', 'Invalid token');
            return false;
        }
        if (data && data.todo) {
            appData = data;
        }
        updateSyncUI('online', 'Online');
        return true;
    } catch (e) {
        console.warn('Load failed', e);
        updateSyncUI('offline', 'Offline');
        return false;
    }
}

function saveData() {
    localStorage.setItem('lifeTrackerLocal', JSON.stringify(appData));
    syncToCloud();
}

// ─────────────── Change tracking helpers ───────────────
function queueUpsert(type, record) {
    // Remove any existing entry for same ID
    pendingChanges[type].upserted = pendingChanges[type].upserted.filter(r => r.id !== record.id);
    pendingChanges[type].upserted.push(record);
    savePendingChanges();
    syncToCloud();
}

function queueDelete(type, id) {
    pendingChanges[type].deleted.push(id);
    savePendingChanges();
    syncToCloud();
}

// ─────────────── Helpers ───────────────
function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function escapeHTML(s) {
    return s.replace(/[&<>"']/g, m => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    })[m]);
}

// ─────────────── Initialization ───────────────
async function initSync() {
    const local = localStorage.getItem('lifeTrackerLocal');
    if (local) {
        try { appData = JSON.parse(local); } catch (e) {}
    }
    await loadFromCloud();
    if (typeof render === 'function') render();
}