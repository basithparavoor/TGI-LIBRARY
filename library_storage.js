// library_storage.js - Standalone Physical Library Storage, Wings, Shelves & Racks Architecture Suite
import { supabase } from './supabaseClient.js';
import { erp } from './erp_service.js';
import { showToast, playAudioChime } from './ui.js';

let wingsList = [];
let shelvesList = [];
let racksList = [];

// Default Local Fallback Data
const DEFAULT_WINGS = [
    { id: 'wing-north', code: 'WING-N', name: 'North Reference Wing', floor: '1st Floor (East)', primary_focus: 'Computer Science & AI', max_capacity: 6000 },
    { id: 'wing-central', code: 'WING-C', name: 'Central Stack Room', floor: 'Ground Floor', primary_focus: 'Core Engineering & Technology', max_capacity: 12000 },
    { id: 'wing-south', code: 'WING-S', name: 'South Reading Annex', floor: '2nd Floor', primary_focus: 'Periodicals & Management', max_capacity: 4000 }
];

const DEFAULT_SHELVES = [
    { id: 'shelf-1', code: 'SH-01', name: 'CS Software Engineering', wing_id: 'wing-north', wing_name: 'North Reference Wing', genre: 'Algorithms & Software Dev', tiers: 5, capacity: 600 },
    { id: 'shelf-2', code: 'SH-02', name: 'AI & Machine Learning', wing_id: 'wing-north', wing_name: 'North Reference Wing', genre: 'Artificial Intelligence & Neural Nets', tiers: 5, capacity: 550 },
    { id: 'shelf-3', code: 'SH-03', name: 'Mechanical Thermodynamics', wing_id: 'wing-central', wing_name: 'Central Stack Room', genre: 'Fluid Dynamics & Robotics', tiers: 6, capacity: 800 },
    { id: 'shelf-4', code: 'SH-04', name: 'Business Leadership & Finance', wing_id: 'wing-south', wing_name: 'South Reading Annex', genre: 'MBA Case Studies & Finance', tiers: 4, capacity: 450 }
];

const DEFAULT_RACKS = [
    { id: 'rack-1', code: 'RK-101', name: 'Tier 1 - Algorithms & Data Structs', shelf_id: 'shelf-1', shelf_name: 'CS Software Engineering', row_level: 'Row A (Top)', max_slots: 100, stored_books: 88 },
    { id: 'rack-2', code: 'RK-102', name: 'Tier 2 - Systems & Compilers', shelf_id: 'shelf-1', shelf_name: 'CS Software Engineering', row_level: 'Row B (Middle)', max_slots: 100, stored_books: 65 },
    { id: 'rack-3', code: 'RK-201', name: 'Tier 1 - Deep Learning & LLMs', shelf_id: 'shelf-2', shelf_name: 'AI & Machine Learning', row_level: 'Row A (Top)', max_slots: 90, stored_books: 82 },
    { id: 'rack-4', code: 'RK-301', name: 'Tier 1 - Kinematics & CAD', shelf_id: 'shelf-3', shelf_name: 'Mechanical Thermodynamics', row_level: 'Row A (Top)', max_slots: 120, stored_books: 95 }
];

document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    initModals();
    await loadAllStorageData();
    setupEventListeners();
});

// --- TAB SWITCHING ---
function initTabs() {
    const tabs = document.querySelectorAll('.storage-tab-btn');
    const panels = document.querySelectorAll('.tab-content-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.style.display = 'none');

            tab.classList.add('active');
            const target = document.getElementById(tab.dataset.tab);
            if (target) {
                target.style.display = 'block';
                if (tab.dataset.tab === 'tab-visualizer') renderCapacityVisualizer();
            }
        });
    });
}

// --- DATA LOADING & SUPABASE SYNC ---
async function loadAllStorageData() {
    // 1. Wings
    wingsList = JSON.parse(localStorage.getItem('erp_storage_wings') || JSON.stringify(DEFAULT_WINGS));

    // 2. Shelves
    try {
        const { data: dbShelves } = await supabase.from('shelves').select('*').order('name');
        if (dbShelves && dbShelves.length > 0) {
            shelvesList = dbShelves.map(s => ({
                id: s.id,
                code: s.code || s.name.substring(0, 5).toUpperCase(),
                name: s.name,
                wing_id: s.wing_id || 'wing-north',
                wing_name: s.wing_name || 'North Reference Wing',
                genre: s.genre || 'General Library Collection',
                tiers: s.tiers || 5,
                capacity: s.capacity || 500
            }));
        } else {
            shelvesList = JSON.parse(localStorage.getItem('erp_storage_shelves') || JSON.stringify(DEFAULT_SHELVES));
        }
    } catch (e) {
        shelvesList = JSON.parse(localStorage.getItem('erp_storage_shelves') || JSON.stringify(DEFAULT_SHELVES));
    }

    // 3. Racks
    try {
        const { data: dbRacks } = await supabase.from('racks').select('*, shelves(name)').order('name');
        if (dbRacks && dbRacks.length > 0) {
            racksList = dbRacks.map(r => ({
                id: r.id,
                code: r.code || r.name.split(' ')[0],
                name: r.name,
                shelf_id: r.shelf_id,
                shelf_name: r.shelves?.name || 'General Shelf',
                row_level: r.row_level || 'Tier 1',
                max_slots: r.max_slots || 80,
                stored_books: r.stored_books || 45
            }));
        } else {
            racksList = JSON.parse(localStorage.getItem('erp_storage_racks') || JSON.stringify(DEFAULT_RACKS));
        }
    } catch (e) {
        racksList = JSON.parse(localStorage.getItem('erp_storage_racks') || JSON.stringify(DEFAULT_RACKS));
    }

    saveToLocalStorage();
    updateKpis();
    renderWingsTable();
    renderShelvesTable();
    renderRacksTable();
    populateSelectDropdowns();
}

function saveToLocalStorage() {
    localStorage.setItem('erp_storage_wings', JSON.stringify(wingsList));
    localStorage.setItem('erp_storage_shelves', JSON.stringify(shelvesList));
    localStorage.setItem('erp_storage_racks', JSON.stringify(racksList));
}

function updateKpis() {
    const totalSlots = racksList.reduce((acc, r) => acc + (parseInt(r.max_slots) || 0), 0);
    const totalStored = racksList.reduce((acc, r) => acc + (parseInt(r.stored_books) || 0), 0);
    const percentage = totalSlots > 0 ? Math.round((totalStored / totalSlots) * 100) : 0;

    document.getElementById('kpi-total-wings').innerText = wingsList.length;
    document.getElementById('kpi-total-shelves').innerText = shelvesList.length;
    document.getElementById('kpi-total-racks').innerText = racksList.length;
    document.getElementById('kpi-storage-utilization').innerText = `${percentage}% (${totalStored.toLocaleString()} / ${totalSlots.toLocaleString()})`;
}

function populateSelectDropdowns() {
    const shelfWingSelect = document.getElementById('shelf-wing-select');
    const rackShelfSelect = document.getElementById('rack-shelf-select');

    if (shelfWingSelect) {
        shelfWingSelect.innerHTML = wingsList.map(w => `<option value="${w.id}">${w.name} (${w.code})</option>`).join('');
    }
    if (rackShelfSelect) {
        rackShelfSelect.innerHTML = shelvesList.map(s => `<option value="${s.id}">${s.name} (${s.code})</option>`).join('');
    }
}

// --- RENDER WINGS TABLE ---
function renderWingsTable() {
    const tbody = document.getElementById('wings-tbody');
    if (!tbody) return;

    if (wingsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding: 2.5rem; text-align: center; color: var(--text-muted);">No storage wings or rooms registered yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = wingsList.map(w => {
        const shelfCount = shelvesList.filter(s => s.wing_id === w.id).length;

        return `
            <tr>
                <td style="font-family: var(--font-mono); font-weight: 700; color: var(--brand-accent);">${w.code}</td>
                <td style="font-weight: 700; color: var(--text-primary);">${w.name}</td>
                <td><span class="badge badge-brand">${w.floor}</span></td>
                <td>${w.primary_focus}</td>
                <td><span class="badge badge-success">${shelfCount} Shelves</span></td>
                <td style="font-family: var(--font-mono); font-weight: 700;">${w.max_capacity?.toLocaleString()} vols</td>
                <td style="text-align: right;">
                    <div style="display: flex; gap: 0.25rem; justify-content: flex-end;">
                        <button class="btn btn-ghost btn-sm" onclick="window.editWing('${w.id}')" title="Edit Wing" style="padding: 0.2rem 0.4rem;">
                            <i data-lucide="edit-3" style="width: 14px;"></i>
                        </button>
                        <button class="btn btn-ghost btn-sm" style="color: var(--color-danger); padding: 0.2rem 0.4rem;" onclick="window.deleteWing('${w.id}', '${w.name.replace(/'/g, "\\'")}')" title="Delete Wing">
                            <i data-lucide="trash-2" style="width: 14px;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

// --- RENDER SHELVES TABLE ---
function renderShelvesTable() {
    const tbody = document.getElementById('shelves-tbody');
    if (!tbody) return;

    if (shelvesList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="padding: 2.5rem; text-align: center; color: var(--text-muted);">No book shelves configured yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = shelvesList.map(s => {
        const wing = wingsList.find(w => w.id === s.wing_id);
        const wingName = wing ? wing.name : (s.wing_name || 'Main Stacks');
        const rackCount = racksList.filter(r => r.shelf_id === s.id).length;

        return `
            <tr>
                <td style="font-family: var(--font-mono); font-weight: 700; color: var(--brand-accent);">${s.code}</td>
                <td style="font-weight: 700; color: var(--text-primary);">${s.name}</td>
                <td><span class="badge badge-brand">${wingName}</span></td>
                <td>${s.genre}</td>
                <td><span class="badge badge-success">${s.tiers} Tiers</span></td>
                <td><span class="badge" style="background: rgba(139,92,246,0.1); color: var(--brand-accent);">${rackCount} Racks</span></td>
                <td style="font-family: var(--font-mono); font-weight: 700;">${s.capacity} vols</td>
                <td style="text-align: right;">
                    <div style="display: flex; gap: 0.25rem; justify-content: flex-end;">
                        <button class="btn btn-ghost btn-sm" onclick="window.editShelf('${s.id}')" title="Edit Shelf" style="padding: 0.2rem 0.4rem;">
                            <i data-lucide="edit-3" style="width: 14px;"></i>
                        </button>
                        <button class="btn btn-ghost btn-sm" style="color: var(--color-danger); padding: 0.2rem 0.4rem;" onclick="window.deleteShelf('${s.id}', '${s.name.replace(/'/g, "\\'")}')" title="Delete Shelf">
                            <i data-lucide="trash-2" style="width: 14px;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

// --- RENDER RACKS TABLE ---
function renderRacksTable() {
    const tbody = document.getElementById('racks-tbody');
    if (!tbody) return;

    if (racksList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="padding: 2.5rem; text-align: center; color: var(--text-muted);">No rack compartments registered yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = racksList.map(r => {
        const shelf = shelvesList.find(s => s.id === r.shelf_id);
        const shelfName = shelf ? shelf.name : (r.shelf_name || 'General Shelf');
        const pct = r.max_slots > 0 ? Math.round((r.stored_books / r.max_slots) * 100) : 0;
        let badgeColor = 'var(--color-success)';
        if (pct > 75) badgeColor = 'var(--color-warning)';
        if (pct > 90) badgeColor = 'var(--color-danger)';

        return `
            <tr>
                <td style="font-family: var(--font-mono); font-weight: 700; color: var(--brand-primary);">${r.code}</td>
                <td style="font-weight: 700; color: var(--text-primary);">${r.name}</td>
                <td><span class="badge badge-brand">${shelfName}</span></td>
                <td>${r.row_level}</td>
                <td style="font-family: var(--font-mono); font-weight: 700;">${r.stored_books} vols</td>
                <td style="font-family: var(--font-mono); color: var(--text-muted);">${r.max_slots} slots</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-weight: 800; font-size: 0.8rem; color: ${badgeColor};">${pct}%</span>
                        <div class="capacity-bar-bg" style="width: 60px;">
                            <div class="capacity-bar-fill" style="width: ${pct}%; background: ${badgeColor};"></div>
                        </div>
                    </div>
                </td>
                <td style="text-align: right;">
                    <div style="display: flex; gap: 0.25rem; justify-content: flex-end;">
                        <button class="btn btn-ghost btn-sm" onclick="window.editRack('${r.id}')" title="Edit Rack" style="padding: 0.2rem 0.4rem;">
                            <i data-lucide="edit-3" style="width: 14px;"></i>
                        </button>
                        <button class="btn btn-ghost btn-sm" style="color: var(--color-danger); padding: 0.2rem 0.4rem;" onclick="window.deleteRack('${r.id}', '${r.name.replace(/'/g, "\\'")}')" title="Delete Rack">
                            <i data-lucide="trash-2" style="width: 14px;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

// --- RENDER LIVE CAPACITY VISUALIZER ---
function renderCapacityVisualizer() {
    const container = document.getElementById('storage-visualizer-container');
    if (!container) return;

    if (shelvesList.length === 0) {
        container.innerHTML = `<div style="padding: 3rem; text-align: center; color: var(--text-muted);">No shelves configured to visualize.</div>`;
        return;
    }

    container.innerHTML = shelvesList.map(shelf => {
        const racks = racksList.filter(r => r.shelf_id === shelf.id);
        const totalSlots = racks.reduce((acc, r) => acc + (parseInt(r.max_slots) || 0), 0) || shelf.capacity;
        const totalStored = racks.reduce((acc, r) => acc + (parseInt(r.stored_books) || 0), 0);
        const pct = totalSlots > 0 ? Math.round((totalStored / totalSlots) * 100) : 0;

        let statusBadge = '<span class="badge badge-success">Optimal Space</span>';
        let barColor = 'var(--color-success)';
        if (pct >= 75 && pct < 90) {
            statusBadge = '<span class="badge badge-warning">High Occupancy</span>';
            barColor = 'var(--color-warning)';
        } else if (pct >= 90) {
            statusBadge = '<span class="badge badge-danger">Near Full (Reallocate)</span>';
            barColor = 'var(--color-danger)';
        }

        return `
            <div class="storage-card">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.2rem;">
                            <span class="badge" style="font-family: var(--font-mono); background: rgba(139,92,246,0.1); color: var(--brand-accent);">${shelf.code}</span>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">${shelf.wing_name}</span>
                        </div>
                        <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--text-primary);">${shelf.name}</h4>
                        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.15rem;">${shelf.genre}</div>
                    </div>
                    ${statusBadge}
                </div>

                <div style="margin: 1rem 0;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 700;">
                        <span>Capacity Occupancy</span>
                        <span style="color: ${barColor};">${pct}% (${totalStored} / ${totalSlots} vols)</span>
                    </div>
                    <div class="capacity-bar-bg" style="height: 10px;">
                        <div class="capacity-bar-fill" style="width: ${pct}%; background: ${barColor};"></div>
                    </div>
                </div>

                <div style="border-top: 1px solid var(--border-color); padding-top: 0.75rem; display: flex; flex-direction: column; gap: 0.35rem;">
                    <div style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted);">
                        Rack Compartments (${racks.length})
                    </div>
                    ${racks.length > 0 ? racks.map(r => `
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; padding: 0.25rem 0.5rem; background: var(--bg-muted); border-radius: 4px;">
                            <span><strong>${r.code}</strong>: ${r.name}</span>
                            <span style="font-family: var(--font-mono);">${r.stored_books} / ${r.max_slots}</span>
                        </div>
                    `).join('') : '<div style="font-size: 0.75rem; color: var(--text-muted);">No racks registered under this shelf.</div>'}
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

// --- MODAL CONTROLS & CRUD OPERATIONS ---
function initModals() {
    // Wing Modal
    const modalWing = document.getElementById('modal-wing');
    document.getElementById('btn-open-wing-modal')?.addEventListener('click', () => {
        document.getElementById('modal-wing-title').innerText = 'Add Storage Wing';
        document.getElementById('wing-id').value = '';
        document.getElementById('form-wing').reset();
        modalWing.classList.add('active');
    });
    modalWing?.querySelectorAll('.close-wing-modal').forEach(b => b.addEventListener('click', () => modalWing.classList.remove('active')));

    // Shelf Modal
    const modalShelf = document.getElementById('modal-shelf');
    document.getElementById('btn-open-shelf-modal')?.addEventListener('click', () => {
        document.getElementById('modal-shelf-title').innerText = 'Add Book Shelf';
        document.getElementById('shelf-id').value = '';
        document.getElementById('form-shelf').reset();
        populateSelectDropdowns();
        modalShelf.classList.add('active');
    });
    modalShelf?.querySelectorAll('.close-shelf-modal').forEach(b => b.addEventListener('click', () => modalShelf.classList.remove('active')));

    // Rack Modal
    const modalRack = document.getElementById('modal-rack');
    document.getElementById('btn-open-rack-modal')?.addEventListener('click', () => {
        document.getElementById('modal-rack-title').innerText = 'Add Rack Compartment';
        document.getElementById('rack-id').value = '';
        document.getElementById('form-rack').reset();
        populateSelectDropdowns();
        modalRack.classList.add('active');
    });
    modalRack?.querySelectorAll('.close-rack-modal').forEach(b => b.addEventListener('click', () => modalRack.classList.remove('active')));

    // PDF Preview Modal
    const modalPdf = document.getElementById('modal-storage-pdf-preview');
    modalPdf?.querySelectorAll('.close-pdf-modal').forEach(b => b.addEventListener('click', () => modalPdf.classList.remove('active')));
}

// Wing Form Submit
document.getElementById('form-wing')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('wing-id').value;
    const wingObj = {
        id: id || `wing-${Date.now()}`,
        code: document.getElementById('wing-code').value.trim().toUpperCase(),
        name: document.getElementById('wing-name').value.trim(),
        floor: document.getElementById('wing-floor').value.trim() || 'Ground Floor',
        primary_focus: document.getElementById('wing-focus').value.trim() || 'General Stacks',
        max_capacity: parseInt(document.getElementById('wing-capacity').value) || 5000
    };

    if (id) {
        const idx = wingsList.findIndex(w => w.id === id);
        if (idx !== -1) wingsList[idx] = wingObj;
    } else {
        wingsList.push(wingObj);
    }

    saveToLocalStorage();
    updateKpis();
    renderWingsTable();
    populateSelectDropdowns();
    document.getElementById('modal-wing').classList.remove('active');
    playAudioChime('SUCCESS');
    showToast(`Storage Wing "${wingObj.name}" saved!`, 'success');
});

// Shelf Form Submit
document.getElementById('form-shelf')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('shelf-id').value;
    const wingId = document.getElementById('shelf-wing-select').value;
    const wing = wingsList.find(w => w.id === wingId);

    const shelfObj = {
        id: id || `shelf-${Date.now()}`,
        code: document.getElementById('shelf-code').value.trim().toUpperCase(),
        name: document.getElementById('shelf-name').value.trim(),
        wing_id: wingId,
        wing_name: wing ? wing.name : 'Main Storage Wing',
        genre: document.getElementById('shelf-genre').value.trim() || 'General Literature',
        tiers: parseInt(document.getElementById('shelf-tiers').value) || 5,
        capacity: parseInt(document.getElementById('shelf-capacity').value) || 500
    };

    if (id) {
        const idx = shelvesList.findIndex(s => s.id === id);
        if (idx !== -1) shelvesList[idx] = shelfObj;
    } else {
        shelvesList.push(shelfObj);
    }

    try {
        await supabase.from('shelves').upsert({ id: shelfObj.id, name: shelfObj.name });
    } catch (err) {}

    saveToLocalStorage();
    updateKpis();
    renderShelvesTable();
    populateSelectDropdowns();
    document.getElementById('modal-shelf').classList.remove('active');
    playAudioChime('SUCCESS');
    showToast(`Book Shelf "${shelfObj.name}" saved!`, 'success');
});

// Rack Form Submit
document.getElementById('form-rack')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('rack-id').value;
    const shelfId = document.getElementById('rack-shelf-select').value;
    const shelf = shelvesList.find(s => s.id === shelfId);

    const rackObj = {
        id: id || `rack-${Date.now()}`,
        code: document.getElementById('rack-code').value.trim().toUpperCase(),
        name: document.getElementById('rack-name').value.trim(),
        shelf_id: shelfId,
        shelf_name: shelf ? shelf.name : 'General Shelf',
        row_level: document.getElementById('rack-row').value.trim() || 'Row A',
        max_slots: parseInt(document.getElementById('rack-capacity').value) || 80,
        stored_books: parseInt(document.getElementById('rack-count').value) || 0
    };

    if (id) {
        const idx = racksList.findIndex(r => r.id === id);
        if (idx !== -1) racksList[idx] = rackObj;
    } else {
        racksList.push(rackObj);
    }

    try {
        await supabase.from('racks').upsert({ id: rackObj.id, name: rackObj.name, shelf_id: rackObj.shelf_id });
    } catch (err) {}

    saveToLocalStorage();
    updateKpis();
    renderRacksTable();
    document.getElementById('modal-rack').classList.remove('active');
    playAudioChime('SUCCESS');
    showToast(`Rack compartment "${rackObj.name}" saved!`, 'success');
});

// Global Edit/Delete Functions
window.editWing = function(id) {
    const w = wingsList.find(item => item.id === id);
    if (!w) return;
    document.getElementById('modal-wing-title').innerText = 'Edit Storage Wing';
    document.getElementById('wing-id').value = w.id;
    document.getElementById('wing-code').value = w.code;
    document.getElementById('wing-name').value = w.name;
    document.getElementById('wing-floor').value = w.floor;
    document.getElementById('wing-focus').value = w.primary_focus;
    document.getElementById('wing-capacity').value = w.max_capacity;
    document.getElementById('modal-wing').classList.add('active');
};

window.deleteWing = function(id, name) {
    window.app.confirm(`Delete storage wing "${name}" and unassign child shelves?`, 'Delete Wing', () => {
        wingsList = wingsList.filter(w => w.id !== id);
        saveToLocalStorage();
        updateKpis();
        renderWingsTable();
        populateSelectDropdowns();
        showToast(`Storage Wing "${name}" deleted.`, 'info');
    });
};

window.editShelf = function(id) {
    const s = shelvesList.find(item => item.id === id);
    if (!s) return;
    document.getElementById('modal-shelf-title').innerText = 'Edit Book Shelf';
    document.getElementById('shelf-id').value = s.id;
    document.getElementById('shelf-code').value = s.code;
    document.getElementById('shelf-name').value = s.name;
    document.getElementById('shelf-wing-select').value = s.wing_id;
    document.getElementById('shelf-genre').value = s.genre;
    document.getElementById('shelf-tiers').value = s.tiers;
    document.getElementById('shelf-capacity').value = s.capacity;
    document.getElementById('modal-shelf').classList.add('active');
};

window.deleteShelf = function(id, name) {
    window.app.confirm(`Delete shelf "${name}"?`, 'Delete Shelf', async () => {
        shelvesList = shelvesList.filter(s => s.id !== id);
        try { await supabase.from('shelves').delete().eq('id', id); } catch(e) {}
        saveToLocalStorage();
        updateKpis();
        renderShelvesTable();
        populateSelectDropdowns();
        showToast(`Shelf "${name}" deleted.`, 'info');
    });
};

window.editRack = function(id) {
    const r = racksList.find(item => item.id === id);
    if (!r) return;
    document.getElementById('modal-rack-title').innerText = 'Edit Rack Compartment';
    document.getElementById('rack-id').value = r.id;
    document.getElementById('rack-code').value = r.code;
    document.getElementById('rack-name').value = r.name;
    document.getElementById('rack-shelf-select').value = r.shelf_id;
    document.getElementById('rack-row').value = r.row_level;
    document.getElementById('rack-capacity').value = r.max_slots;
    document.getElementById('rack-count').value = r.stored_books;
    document.getElementById('modal-rack').classList.add('active');
};

window.deleteRack = function(id, name) {
    window.app.confirm(`Delete rack compartment "${name}"?`, 'Delete Rack', async () => {
        racksList = racksList.filter(r => r.id !== id);
        try { await supabase.from('racks').delete().eq('id', id); } catch(e) {}
        saveToLocalStorage();
        updateKpis();
        renderRacksTable();
        showToast(`Rack "${name}" deleted.`, 'info');
    });
};

// --- REPORTS: PDF AUDIT REPORT & CSV EXPORT ---
function setupEventListeners() {
    // Top Entity Dropdown
    document.getElementById('btn-add-storage-dropdown')?.addEventListener('click', () => {
        const choice = prompt('Select Storage Unit to Create:\n1: Storage Wing / Room\n2: Book Shelf\n3: Rack Compartment', '2');
        if (choice === '1') document.getElementById('btn-open-wing-modal')?.click();
        else if (choice === '2') document.getElementById('btn-open-shelf-modal')?.click();
        else if (choice === '3') document.getElementById('btn-open-rack-modal')?.click();
    });

    // Generate PDF Shelf Audit Report Modal
    document.getElementById('btn-storage-pdf-report')?.addEventListener('click', () => {
        const inst = erp.getInstitutionProfile();
        document.getElementById('pdf-storage-inst-name').innerText = inst.name || 'TGI INSTITUTION';
        document.getElementById('pdf-storage-inst-tagline').innerText = inst.tagline || 'Library Infrastructure & Storage Logistics';
        document.getElementById('pdf-storage-inst-code').innerText = inst.reg_code || 'TGI-STR-2026';
        document.getElementById('pdf-storage-report-date').innerText = new Date().toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });

        const totalSlots = racksList.reduce((acc, r) => acc + (parseInt(r.max_slots) || 0), 0);
        const totalStored = racksList.reduce((acc, r) => acc + (parseInt(r.stored_books) || 0), 0);
        const pct = totalSlots > 0 ? Math.round((totalStored / totalSlots) * 100) : 0;

        document.getElementById('pdf-summary-wings').innerText = wingsList.length;
        document.getElementById('pdf-summary-shelves').innerText = shelvesList.length;
        document.getElementById('pdf-summary-racks').innerText = racksList.length;
        document.getElementById('pdf-summary-util').innerText = `${pct}% (${totalStored} vols)`;

        // Shelves Table Body
        document.getElementById('pdf-shelves-table-body').innerHTML = shelvesList.map(s => {
            const wing = wingsList.find(w => w.id === s.wing_id);
            const wingName = wing ? wing.name : (s.wing_name || 'Main Stacks');
            return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 0.5rem; font-family: monospace; font-weight: bold; border: 1px solid #cbd5e1;">${s.code}</td>
                    <td style="padding: 0.5rem; font-weight: bold; border: 1px solid #cbd5e1;">${s.name}</td>
                    <td style="padding: 0.5rem; border: 1px solid #cbd5e1;">${wingName}</td>
                    <td style="padding: 0.5rem; border: 1px solid #cbd5e1;">${s.genre}</td>
                    <td style="padding: 0.5rem; text-align: center; border: 1px solid #cbd5e1;">${s.tiers} Tiers</td>
                    <td style="padding: 0.5rem; text-align: right; font-weight: bold; border: 1px solid #cbd5e1;">${s.capacity} vols</td>
                </tr>
            `;
        }).join('');

        // Racks Table Body
        document.getElementById('pdf-racks-table-body').innerHTML = racksList.map(r => {
            const rPct = r.max_slots > 0 ? Math.round((r.stored_books / r.max_slots) * 100) : 0;
            return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 0.5rem; font-family: monospace; font-weight: bold; border: 1px solid #cbd5e1;">${r.code}</td>
                    <td style="padding: 0.5rem; font-weight: bold; border: 1px solid #cbd5e1;">${r.name}</td>
                    <td style="padding: 0.5rem; border: 1px solid #cbd5e1;">${r.shelf_name}</td>
                    <td style="padding: 0.5rem; border: 1px solid #cbd5e1;">${r.row_level}</td>
                    <td style="padding: 0.5rem; text-align: right; font-weight: bold; border: 1px solid #cbd5e1;">${r.stored_books} / ${r.max_slots}</td>
                    <td style="padding: 0.5rem; text-align: right; font-weight: bold; border: 1px solid #cbd5e1;">${rPct}%</td>
                </tr>
            `;
        }).join('');

        document.getElementById('modal-storage-pdf-preview').classList.add('active');
        playAudioChime('SUCCESS');
    });

    // CSV Export
    document.getElementById('btn-storage-csv-export')?.addEventListener('click', () => {
        let csv = 'Storage_Level,Code,Name,Location_Parent,Floor_Or_Tiers,Genre_Subject,Stored_Books_Count,Max_Capacity_Slots,Occupancy_Percent\n';

        wingsList.forEach(w => {
            csv += `"Storage_Wing","${w.code}","${w.name}","-","${w.floor}","${w.primary_focus}",-,"${w.max_capacity}",-\n`;
        });

        shelvesList.forEach(s => {
            csv += `"Book_Shelf","${s.code}","${s.name}","${s.wing_name}","${s.tiers} Tiers","${s.genre}",-,"${s.capacity}",-\n`;
        });

        racksList.forEach(r => {
            const pct = r.max_slots > 0 ? Math.round((r.stored_books / r.max_slots) * 100) : 0;
            csv += `"Rack_Compartment","${r.code}","${r.name}","${r.shelf_name}","${r.row_level}","-",${r.stored_books},${r.max_slots},"${pct}%"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Library_Storage_Matrix_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        playAudioChime('SUCCESS');
        showToast('Library storage matrix exported to CSV!', 'success');
    });
}
