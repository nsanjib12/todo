// ─────────────── Theme ───────────────
const THEME_KEY = 'lifeTrackerTheme';
function getTheme() { return localStorage.getItem(THEME_KEY) || 'system'; }
function applyTheme() {
    const t = getTheme();
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else if (t === 'light') document.documentElement.removeAttribute('data-theme');
    else {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.setAttribute('data-theme', 'dark');
        else document.documentElement.removeAttribute('data-theme');
    }
}
applyTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// ─────────────── JSONBlob Sync ───────────────
const JSONBLOB_API = 'https://jsonblob.com/api/jsonBlob';
const BLOB_ID_KEY = 'lifeTrackerBlobId';
let blobId = localStorage.getItem(BLOB_ID_KEY) || null;
let syncInProgress = false;
let appData = { todo: { tasks: {} }, habits: { habits: [], completions: {} }, expenses: { transactions: [] } };

function saveBlobId(id) { blobId = id; localStorage.setItem(BLOB_ID_KEY, id); }
async function createBlob(data) {
    const resp = await fetch(JSONBLOB_API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    if(!resp.ok) throw new Error('Create failed');
    return resp.headers.get('Location').split('/').pop();
}
async function fetchBlob(id) {
    const resp = await fetch(`${JSONBLOB_API}/${id}`);
    if(!resp.ok) throw new Error('Fetch failed');
    return await resp.json();
}
async function updateBlob(id, data) {
    await fetch(`${JSONBLOB_API}/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
}
async function syncToCloud() {
    if(!blobId || syncInProgress) return;
    syncInProgress = true;
    try { await updateBlob(blobId, appData); }
    catch(e) { console.warn('Sync failed', e); }
    finally { syncInProgress = false; }
}
async function loadFromCloud() {
    if(!blobId) return;
    try { appData = await fetchBlob(blobId); }
    catch(e) { console.warn('Load failed'); }
}
function saveData() { localStorage.setItem('lifeTrackerLocal', JSON.stringify(appData)); syncToCloud(); }

// ─────────────── Helpers ───────────────
function dateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function escapeHTML(s) { return s.replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]); }

// ─────────────── Init ───────────────
async function initSync() {
    const local = localStorage.getItem('lifeTrackerLocal');
    if(local) { try { appData = JSON.parse(local); } catch(e){} }
    if(blobId) {
        await loadFromCloud();
    } else {
        showFirstTimeModal();
        return;
    }
    saveData();
    if(typeof render === 'function') render();
}

function showFirstTimeModal() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `<div style="background:var(--card-bg,#fff);border-radius:14px;padding:24px;max-width:400px;width:90%;text-align:center;color:var(--text,#1e1e1e);">
        <h3>Welcome! 👋</h3><p style="margin:12px 0;">Do you have a recovery ID from another device?</p>
        <div id="modalChoice"><button class="small-btn" id="yesBtn" style="margin-right:8px;padding:8px 16px;border-radius:20px;border:1px solid #ddd;cursor:pointer;">Yes, I have an ID</button><button class="small-btn primary" id="noBtn" style="padding:8px 16px;border-radius:20px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer;">No, start fresh</button></div>
        <div id="modalInput" style="display:none; margin-top:10px;"><input type="text" id="modalRecoveryId" placeholder="Paste recovery ID" style="width:100%;padding:8px 12px;border-radius:20px;border:1px solid #ddd;font-size:0.85rem;margin-bottom:8px;"><button class="small-btn primary" id="loadBtn" style="padding:8px 16px;border-radius:20px;background:var(--accent);color:#fff;border:none;cursor:pointer;">Load</button><button class="small-btn" id="backBtn" style="margin-left:6px;padding:8px 16px;border-radius:20px;border:1px solid #ddd;cursor:pointer;">Back</button><div id="modalError" style="color:red;font-size:0.75rem;margin-top:6px;"></div></div>
    </div>`;
    document.body.appendChild(overlay);

    document.getElementById('yesBtn').onclick = () => { document.getElementById('modalChoice').style.display='none'; document.getElementById('modalInput').style.display='block'; };
    document.getElementById('noBtn').onclick = async () => {
        overlay.remove();
        try { blobId = await createBlob(appData); saveBlobId(blobId); }
        catch(e) { console.warn('Create failed'); }
        saveData();
        if(typeof render === 'function') render();
    };
    document.getElementById('backBtn').onclick = () => { document.getElementById('modalChoice').style.display='block'; document.getElementById('modalInput').style.display='none'; document.getElementById('modalError').textContent=''; };
    document.getElementById('loadBtn').onclick = async () => {
        const id = document.getElementById('modalRecoveryId').value.trim();
        if(!id) return;
        try {
            saveBlobId(id); await loadFromCloud(); saveData();
            overlay.remove();
            if(typeof render === 'function') render();
        } catch(e) { document.getElementById('modalError').textContent = 'Invalid ID or network error.'; }
    };
}

initSync();