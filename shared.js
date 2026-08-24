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

// ─────────────── Google Sheets Sync ───────────────
const API_URL = 'https://script.google.com/macros/s/AKfycbw5JtTxsj-1NifgJwuXdZxQDKw22haY8cojjrJtOeZjVios56FryydTCSrxhMa9qQoShA/exec'; // ← Replace with your deployed Apps Script URL
const TOKEN_KEY = 'lifeTrackerSecurityToken';

let appData = {
    todo: { tasks: {} },
    habits: { habits: [], completions: {} },
    expenses: { transactions: [] }
};
let syncInProgress = false;
let isLoadingFromCloud = false;
let lastLocalSave = null;

function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
function setToken(token) { localStorage.setItem(TOKEN_KEY, token); }

function updateSyncUI(state, text) {
    const dot = document.getElementById('syncDot');
    const txt = document.getElementById('syncText');
    if (dot) dot.className = 'sync-dot ' + state;
    if (txt) txt.textContent = text;
}

async function syncChangesToCloud(changes) {
    const token = getToken();
    if (!token || syncInProgress) return;
    syncInProgress = true;
    updateSyncUI('syncing', 'Syncing...');
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ token, changes })
        });
        const result = await response.json();
        if (result.error) {
            updateSyncUI('offline', 'Sync error');
        } else {
            updateSyncUI('online', 'Saved online');
        }
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
    
    // Don't load if we're already loading or syncing
    if (isLoadingFromCloud || syncInProgress) {
        return true;
    }
    
    isLoadingFromCloud = true;
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
            // Only update appData if we have local changes that haven't been synced yet
            // This prevents the cloud from overwriting unsynced local data
            const localData = localStorage.getItem('lifeTrackerLocal');
            if (!localData || syncInProgress) {
                appData = data;
            }
        }
        updateSyncUI('online', 'Online');
        return true;
    } catch (e) {
        console.warn('Load failed', e);
        updateSyncUI('offline', 'Offline');
        return false;
    } finally {
        isLoadingFromCloud = false;
    }
}

function saveData() {
    localStorage.setItem('lifeTrackerLocal', JSON.stringify(appData));
    lastLocalSave = Date.now();
}

// ─────────────── Change tracking helpers ───────────────
function queueUpsert(type, record) {
    const changes = {
        todo: { deleted: [], upserted: [] },
        habits: { deleted: [], upserted: [] },
        expenses: { deleted: [], upserted: [] }
    };
    changes[type].upserted.push(record);
    saveData(); // Save local first
    syncChangesToCloud(changes);
}

function queueDelete(type, id) {
    const changes = {
        todo: { deleted: [], upserted: [] },
        habits: { deleted: [], upserted: [] },
        expenses: { deleted: [], upserted: [] }
    };
    changes[type].deleted.push(id);
    saveData(); // Save local first
    syncChangesToCloud(changes);
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
    // First load from localStorage for instant display
    const local = localStorage.getItem('lifeTrackerLocal');
    if (local) {
        try { appData = JSON.parse(local); } catch (e) {}
    }
    
    // Then try to load from cloud (only if token exists)
    const token = getToken();
    if (token) {
        await loadFromCloud();
    }
    
    return true;
}