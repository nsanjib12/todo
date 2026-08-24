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
const API_URL = 'https://script.google.com/macros/s/AKfycbw5JtTxsj-1NifgJwuXdZxQDKw22haY8cojjrJtOeZjVios56FryydTCSrxhMa9qQoShA/exec'; // ← Replace with your Apps Script URL
const TOKEN_KEY = 'lifeTrackerSecurityToken';
const LOCAL_DATA_KEY = 'lifeTrackerLocal';

let appData = {
    todo: { tasks: {} },
    habits: { habits: [], completions: {} },
    expenses: { transactions: [] }
};

function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
function setToken(token) { localStorage.setItem(TOKEN_KEY, token); }

function updateSyncUI(state, text) {
    const dot = document.getElementById('syncDot');
    const txt = document.getElementById('syncText');
    if (dot) dot.className = 'sync-dot ' + state;
    if (txt) txt.textContent = text;
}

// Save data locally - ALWAYS works
function saveDataLocal() {
    localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(appData));
}

// Load data from local storage
function loadDataLocal() {
    const saved = localStorage.getItem(LOCAL_DATA_KEY);
    if (saved) {
        try {
            appData = JSON.parse(saved);
            return true;
        } catch(e) {
            console.warn('Failed to parse local data');
            return false;
        }
    }
    return false;
}

// Sync to Google Sheets (manual)
async function syncToCloud() {
    const token = getToken();
    if (!token) {
        updateSyncUI('offline', 'Token required');
        return false;
    }
    updateSyncUI('syncing', 'Syncing...');
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ token, data: appData })
        });
        const result = await response.json();
        if (result.error) {
            updateSyncUI('offline', 'Sync error');
            return false;
        }
        updateSyncUI('online', 'Saved online');
        return true;
    } catch (e) {
        console.warn('Sync failed', e);
        updateSyncUI('offline', 'Offline');
        return false;
    }
}

// Load from Google Sheets (manual)
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
            saveDataLocal();
        }
        updateSyncUI('online', 'Online');
        return true;
    } catch (e) {
        console.warn('Load failed', e);
        updateSyncUI('offline', 'Offline');
        return false;
    }
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
function initSync() {
    loadDataLocal();
    return true;
}