import { supabase } from './supabaseClient.js';
import { erp } from './erp_service.js';
import { shortcuts, DEFAULT_SHORTCUTS } from './shortcuts.js';
import { hardware } from './hardware.js';

const settingsForm = document.getElementById('settings-form');
const btnSave = document.getElementById('btn-save-settings');

// --- TAB SWITCHING ---
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabPanels.forEach(panel => panel.style.display = 'none');
        button.classList.add('active');
        const targetId = button.getAttribute('data-target');
        const targetPanel = document.getElementById(targetId);
        if (targetPanel) {
            targetPanel.style.display = 'block';
            if (targetId === 'panel-shortcuts') {
                renderShortcutsGrid();
            }
        }
    });
});

// --- GENERAL SETTINGS ---
async function loadSettings() {
    try {
        const { data, error } = await supabase.from('library_settings').select('*');
        if (error) return;
        if (data) {
            data.forEach(setting => {
                if (setting.setting_key === 'loan_days') document.getElementById('setting-loan-days').value = setting.setting_value;
                if (setting.setting_key === 'fine_amount') document.getElementById('setting-fine-amount').value = setting.setting_value;
                if (setting.setting_key === 'max_books') document.getElementById('setting-max-books').value = setting.setting_value;
                if (setting.setting_key === 'max_renewals') document.getElementById('setting-max-renewals').value = setting.setting_value;
            });
        }
    } catch (err) {
        console.error("Error loading settings:", err);
    }
}

settingsForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const originalText = btnSave.innerHTML;
    btnSave.innerText = "Saving...";
    btnSave.disabled = true;

    const updates = [
        { setting_key: 'loan_days', setting_value: document.getElementById('setting-loan-days').value },
        { setting_key: 'fine_amount', setting_value: document.getElementById('setting-fine-amount').value },
        { setting_key: 'max_books', setting_value: document.getElementById('setting-max-books').value },
        { setting_key: 'max_renewals', setting_value: document.getElementById('setting-max-renewals').value }
    ];

    try {
        await supabase.from('library_settings').upsert(updates, { onConflict: 'setting_key' });
        window.app.toast("Circulation rules saved successfully.", "success", "Settings Saved");
    } catch (err) {
        window.app.toast("Error saving settings.", "error", "Save Failed");
    } finally {
        btnSave.innerHTML = originalText;
        btnSave.disabled = false;
    }
});

// --- HIERARCHICAL MASTER DATA ---
async function loadHierarchicalData() {
    const acaTree = document.getElementById('tree-academic');
    const locTree = document.getElementById('tree-locations');

    try {
        const { data: depts, error: deptErr } = await supabase
            .from('departments')
            .select('id, name, classes(id, name)')
            .order('name');

        if (!deptErr && acaTree) {
            if (!depts || depts.length === 0) {
                acaTree.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No departments added yet.</div>`;
            } else {
                acaTree.innerHTML = depts.map(dept => `
                    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--bg-muted); border-bottom: 1px solid var(--border-color);">
                            <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">${dept.name}</span>
                            <div style="display: flex; gap: 0.35rem;">
                                <button class="btn btn-outline btn-sm" onclick="window.addChildEntity('Class', 'classes', 'department_id', '${dept.id}')" title="Add Class" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">
                                    <i data-lucide="plus" style="width: 12px;"></i> Class
                                </button>
                                <button class="btn btn-ghost btn-sm" onclick="window.editEntity('departments', '${dept.id}', '${dept.name.replace(/'/g, "\\'")}')" title="Edit" style="padding: 0.2rem 0.4rem;">
                                    <i data-lucide="edit-3" style="width: 14px;"></i>
                                </button>
                                <button class="btn btn-ghost btn-sm" style="color: var(--danger); padding: 0.2rem 0.4rem;" onclick="window.deleteEntity('departments', '${dept.id}', '${dept.name.replace(/'/g, "\\'")}')" title="Delete">
                                    <i data-lucide="trash-2" style="width: 14px;"></i>
                                </button>
                            </div>
                        </div>
                        <div style="padding: 0.5rem 1rem; display: flex; flex-direction: column; gap: 0.35rem;">
                            ${dept.classes && dept.classes.length ? dept.classes.map(cls => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.25rem 0; font-size: 0.85rem;">
                                    <span style="display: flex; align-items: center; gap: 0.4rem; color: var(--text-primary);">
                                        <i data-lucide="corner-down-right" style="width: 14px; color: var(--brand-primary);"></i> ${cls.name}
                                    </span>
                                    <div style="display: flex; gap: 0.2rem;">
                                        <button class="btn btn-ghost btn-sm" style="padding: 0.15rem 0.35rem; color: var(--text-muted);" onclick="window.editEntity('classes', '${cls.id}', '${cls.name.replace(/'/g, "\\'")}')">
                                            <i data-lucide="edit" style="width: 12px;"></i>
                                        </button>
                                        <button class="btn btn-ghost btn-sm" style="padding: 0.15rem 0.35rem; color: var(--danger);" onclick="window.deleteEntity('classes', '${cls.id}', '${cls.name.replace(/'/g, "\\'")}')">
                                            <i data-lucide="x" style="width: 12px;"></i>
                                        </button>
                                    </div>
                                </div>
                            `).join('') : '<span style="font-size: 0.75rem; color: var(--text-muted);">No classes assigned yet.</span>'}
                        </div>
                    </div>
                `).join('');
            }
        }

        const { data: shelves, error: shelfErr } = await supabase
            .from('shelves')
            .select('id, name, racks(id, name)')
            .order('name');

        if (!shelfErr && locTree) {
            if (!shelves || shelves.length === 0) {
                locTree.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No shelves created yet.</div>`;
            } else {
                locTree.innerHTML = shelves.map(shelf => `
                    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--bg-muted); border-bottom: 1px solid var(--border-color);">
                            <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">${shelf.name}</span>
                            <div style="display: flex; gap: 0.35rem;">
                                <button class="btn btn-outline btn-sm" onclick="window.addChildEntity('Rack', 'racks', 'shelf_id', '${shelf.id}')" title="Add Rack" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">
                                    <i data-lucide="plus" style="width: 12px;"></i> Rack
                                </button>
                                <button class="btn btn-ghost btn-sm" onclick="window.editEntity('shelves', '${shelf.id}', '${shelf.name.replace(/'/g, "\\'")}')" title="Edit" style="padding: 0.2rem 0.4rem;">
                                    <i data-lucide="edit-3" style="width: 14px;"></i>
                                </button>
                                <button class="btn btn-ghost btn-sm" style="color: var(--danger); padding: 0.2rem 0.4rem;" onclick="window.deleteEntity('shelves', '${shelf.id}', '${shelf.name.replace(/'/g, "\\'")}')" title="Delete">
                                    <i data-lucide="trash-2" style="width: 14px;"></i>
                                </button>
                            </div>
                        </div>
                        <div style="padding: 0.5rem 1rem; display: flex; flex-direction: column; gap: 0.35rem;">
                            ${shelf.racks && shelf.racks.length ? shelf.racks.map(rack => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.25rem 0; font-size: 0.85rem;">
                                    <span style="display: flex; align-items: center; gap: 0.4rem; color: var(--text-primary);">
                                        <i data-lucide="corner-down-right" style="width: 14px; color: var(--brand-primary);"></i> ${rack.name}
                                    </span>
                                    <div style="display: flex; gap: 0.2rem;">
                                        <button class="btn btn-ghost btn-sm" style="padding: 0.15rem 0.35rem; color: var(--text-muted);" onclick="window.editEntity('racks', '${rack.id}', '${rack.name.replace(/'/g, "\\'")}')">
                                            <i data-lucide="edit" style="width: 12px;"></i>
                                        </button>
                                        <button class="btn btn-ghost btn-sm" style="padding: 0.15rem 0.35rem; color: var(--danger);" onclick="window.deleteEntity('racks', '${rack.id}', '${rack.name.replace(/'/g, "\\'")}')">
                                            <i data-lucide="x" style="width: 12px;"></i>
                                        </button>
                                    </div>
                                </div>
                            `).join('') : '<span style="font-size: 0.75rem; color: var(--text-muted);">No racks assigned yet.</span>'}
                        </div>
                    </div>
                `).join('');
            }
        }
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error("Master data hierarchy load error:", e);
    }
}

window.addParentEntity = function(label, table) {
    window.app.prompt(`Enter name for new ${label}:`, `Add ${label}`, async (val) => {
        if (val && val.trim()) {
            await supabase.from(table).insert([{ name: val.trim() }]);
            window.app.toast(`Added ${label} "${val.trim()}".`, "success", "Entity Created");
            loadHierarchicalData();
        }
    });
};

window.addChildEntity = function(label, table, foreignKey, parentId) {
    window.app.prompt(`Enter name for new ${label}:`, `Add ${label}`, async (val) => {
        if (val && val.trim()) {
            const payload = { name: val.trim() };
            payload[foreignKey] = parentId;
            await supabase.from(table).insert([payload]);
            window.app.toast(`Added ${label} "${val.trim()}".`, "success", "Entity Created");
            loadHierarchicalData();
        }
    });
};

window.editEntity = function(table, id, currentName) {
    window.app.prompt(`Enter updated name for "${currentName}":`, `Edit Name`, async (val) => {
        if (val && val.trim() && val.trim() !== currentName) {
            await supabase.from(table).update({ name: val.trim() }).eq('id', id);
            window.app.toast("Name updated successfully.", "success", "Updated");
            loadHierarchicalData();
        }
    });
};

window.deleteEntity = function(table, id, name) {
    window.app.confirm(`Delete "${name}"? Any sub-items will also be removed.`, `Delete Item`, async () => {
        await supabase.from(table).delete().eq('id', id);
        window.app.toast(`"${name}" deleted.`, "info", "Deleted");
        loadHierarchicalData();
    });
};

// --- INSTITUTIONAL SUB-CAMPUSES ---
function loadCampuses() {
    const tbody = document.getElementById('campuses-tbody');
    if (!tbody) return;

    const campuses = erp.getCampuses();
    if (campuses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding: 2rem; text-align: center; color: var(--text-muted);">No campuses registered yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = campuses.map(c => `
        <tr>
            <td style="font-family: var(--font-mono); font-weight: 700; color: var(--brand-primary);">${c.code}</td>
            <td style="font-weight: 700; color: var(--text-primary);">${c.name}</td>
            <td>${c.city || 'Bangalore'}</td>
            <td style="font-weight: 600;">${c.head_name || 'Dean Office'}</td>
            <td style="font-size: 0.85rem; color: var(--text-muted);">${c.email || 'campus@tgi.edu'}</td>
            <td style="font-size: 0.85rem;">${c.phone || '+91 80 0000 0000'}</td>
            <td>
                <div style="display: flex; gap: 0.25rem;">
                    <button class="btn btn-ghost btn-sm" style="padding: 0.2rem 0.4rem;" title="Edit Campus" onclick="window.editCampus('${c.id}')">
                        <i data-lucide="edit-3" style="width: 14px;"></i>
                    </button>
                    <button class="btn btn-ghost btn-sm" style="color: var(--danger); padding: 0.2rem 0.4rem;" title="Delete Campus" onclick="window.deleteCampus('${c.id}', '${c.name.replace(/'/g, "\\'")}')">
                        <i data-lucide="trash-2" style="width: 14px;"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    if (window.lucide) lucide.createIcons();
}

const modalCampus = document.getElementById('modal-campus');
const formCampus = document.getElementById('form-campus');

document.getElementById('btn-add-campus')?.addEventListener('click', () => {
    document.getElementById('modal-campus-title').innerText = 'Register Institutional Campus';
    document.getElementById('camp-id').value = '';
    formCampus.reset();
    modalCampus.classList.add('active');
});

modalCampus?.querySelectorAll('.close-campus-modal').forEach(b => b.addEventListener('click', () => modalCampus.classList.remove('active')));

window.editCampus = function(id) {
    const c = erp.getCampuses().find(item => item.id === id);
    if (!c) return;

    document.getElementById('modal-campus-title').innerText = 'Edit Institutional Campus';
    document.getElementById('camp-id').value = c.id;
    document.getElementById('camp-code').value = c.code || '';
    document.getElementById('camp-city').value = c.city || '';
    document.getElementById('camp-name').value = c.name || '';
    document.getElementById('camp-head').value = c.head_name || '';
    document.getElementById('camp-email').value = c.email || '';
    document.getElementById('camp-phone').value = c.phone || '';

    modalCampus.classList.add('active');
};

window.deleteCampus = function(id, name) {
    window.app.confirm(`Are you sure you want to delete campus "${name}"?`, "Delete Campus", () => {
        erp.deleteCampus(id);
        window.app.toast(`Campus "${name}" deleted.`, "info", "Campus Removed");
        loadCampuses();
    });
};

formCampus?.addEventListener('submit', (e) => {
    e.preventDefault();
    const campId = document.getElementById('camp-id').value;
    const campusData = {
        id: campId || undefined,
        code: document.getElementById('camp-code').value.trim().toUpperCase(),
        name: document.getElementById('camp-name').value.trim(),
        city: document.getElementById('camp-city').value.trim(),
        head_name: document.getElementById('camp-head').value.trim(),
        email: document.getElementById('camp-email').value.trim(),
        phone: document.getElementById('camp-phone').value.trim()
    };

    erp.saveCampus(campusData);
    window.app.toast(`Campus "${campusData.name}" ${campId ? 'updated' : 'registered'} successfully!`, 'success', campId ? 'Campus Updated' : 'Campus Added');
    modalCampus.classList.remove('active');
    formCampus.reset();
    loadCampuses();
});

// ==========================================================================
// KEYBOARD SHORTCUTS REBINDING & HARDWARE DIAGNOSTIC
// ==========================================================================
let activeCategoryFilter = 'ALL';
let currentRecordingActionId = null;
let capturedKeyCombo = '';

function renderShortcutsGrid() {
    const container = document.getElementById('shortcuts-grid-container');
    if (!container) return;

    const allShortcuts = shortcuts.getShortcuts();
    const filtered = allShortcuts.filter(s => activeCategoryFilter === 'ALL' || s.category === activeCategoryFilter);

    container.innerHTML = filtered.map(s => {
        const isModified = s.currentKey !== s.defaultKey;
        return `
            <div class="shortcut-card">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                        <span class="badge" style="font-size: 0.65rem; background: var(--bg-muted); color: var(--text-muted);">${s.category}</span>
                        ${isModified ? '<span class="badge badge-brand" style="font-size: 0.65rem;">Customized</span>' : ''}
                    </div>
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">${s.name}</div>
                    <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.25rem; line-height: 1.35;">${s.description}</div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; border-top: 1px solid var(--border-color);">
                    <div style="display: flex; gap: 0.25rem;">
                        ${shortcuts.renderKbdBadges(s.currentKey)}
                    </div>
                    <div style="display: flex; gap: 0.35rem;">
                        <button class="btn btn-outline btn-sm btn-rebind-key" data-id="${s.id}" data-name="${s.name}" style="padding: 0.25rem 0.55rem; font-size: 0.75rem;">
                            <i data-lucide="edit-3" style="width: 12px;"></i> Assign
                        </button>
                        ${isModified ? `
                            <button class="btn btn-ghost btn-sm btn-reset-single-key" data-id="${s.id}" title="Reset to default (${s.defaultKey})" style="padding: 0.25rem 0.4rem; color: var(--text-muted);">
                                <i data-lucide="rotate-ccw" style="width: 12px;"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();

    // Attach Rebind Handlers
    container.querySelectorAll('.btn-rebind-key').forEach(btn => {
        btn.addEventListener('click', () => {
            openRebindModal(btn.dataset.id, btn.dataset.name);
        });
    });

    // Attach Single Reset Handlers
    container.querySelectorAll('.btn-reset-single-key').forEach(btn => {
        btn.addEventListener('click', () => {
            const def = DEFAULT_SHORTCUTS.find(d => d.id === btn.dataset.id);
            if (def) {
                shortcuts.rebind(btn.dataset.id, def.defaultKey);
                window.app.toast(`Reset to default: ${def.defaultKey}`, 'info', 'Shortcut Reset');
                renderShortcutsGrid();
            }
        });
    });
}

function openRebindModal(actionId, actionName) {
    currentRecordingActionId = actionId;
    capturedKeyCombo = '';

    const modal = document.getElementById('modal-rebind-recorder');
    const nameEl = document.getElementById('recorder-action-name');
    const boxEl = document.getElementById('recorder-captured-box');
    const confirmBtn = document.getElementById('btn-confirm-recording');

    nameEl.innerText = `Rebind: ${actionName}`;
    boxEl.innerHTML = `<em>Press any key combo on your keyboard...</em>`;
    confirmBtn.disabled = true;

    modal.classList.add('active');

    shortcuts.startRecording((combo) => {
        capturedKeyCombo = combo;
        boxEl.innerHTML = `<span style="color: var(--brand-primary); font-size: 1.4rem;">${combo}</span>`;
        confirmBtn.disabled = false;
        if (window.app?.playBeep) window.app.playBeep('scan');
    });
}

function closeRebindModal() {
    shortcuts.cancelRecording();
    document.getElementById('modal-rebind-recorder')?.classList.remove('active');
    currentRecordingActionId = null;
    capturedKeyCombo = '';
}

document.getElementById('btn-cancel-recording')?.addEventListener('click', closeRebindModal);

document.getElementById('btn-confirm-recording')?.addEventListener('click', () => {
    if (!currentRecordingActionId || !capturedKeyCombo) return;

    const res = shortcuts.rebind(currentRecordingActionId, capturedKeyCombo);
    if (!res.success) {
        window.app.toast(`Key combination "${capturedKeyCombo}" is already assigned to: ${res.conflict}`, 'warning', 'Shortcut Conflict');
        return;
    }

    window.app.toast(`Successfully bound to: ${capturedKeyCombo}`, 'success', 'Key Assigned');
    closeRebindModal();
    renderShortcutsGrid();
});

document.getElementById('btn-reset-shortcuts')?.addEventListener('click', () => {
    window.app.confirm('Reset all keyboard shortcuts to factory defaults?', 'Reset Keybindings', () => {
        shortcuts.resetDefaults();
        window.app.toast('All keyboard shortcuts restored to default configuration.', 'success', 'Defaults Restored');
        renderShortcutsGrid();
    });
});

// Category Filter Buttons
document.querySelectorAll('.shortcut-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.shortcut-filter-btn').forEach(b => {
            b.className = 'btn btn-outline btn-sm shortcut-filter-btn';
        });
        btn.className = 'btn btn-primary btn-sm shortcut-filter-btn';
        activeCategoryFilter = btn.dataset.cat;
        renderShortcutsGrid();
    });
});

// --- HARDWARE SCANNER LIVE TEST PAD ---
const scannerInput = document.getElementById('scanner-test-input');
const scannerResult = document.getElementById('scanner-test-result');

function handleScannerDiagnostic(code) {
    if (!code) return;
    const classified = hardware.classifyCode(code);
    
    scannerResult.style.display = 'block';
    scannerResult.innerHTML = `
        <div style="padding: 0.75rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem;">Input Code: <span style="font-family: var(--font-mono); color: var(--brand-primary);">${code}</span></div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">Latency: Fast Wedge Scan (<80ms) • Prefix: <strong>${classified.prefix || 'NONE'}</strong></div>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                <span class="badge badge-brand" style="font-size: 0.75rem;">${classified.type}</span>
                <button class="btn btn-primary btn-sm" onclick="window.hardware.showUniversalInspectorModal({ type: '${classified.type}', id: '${code}' }, 'TEST_PAD')">Inspect</button>
            </div>
        </div>
    `;

    if (window.app?.playBeep) window.app.playBeep('scan');
}

scannerInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleScannerDiagnostic(scannerInput.value.trim());
    }
});

document.getElementById('btn-test-nfc-tap')?.addEventListener('click', async () => {
    const supported = await hardware.isNfcSupported();
    if (supported) {
        window.app.toast('Tap NFC smartcard on device reader now...', 'info', 'NFC Active');
        hardware.startNfcScan((payload) => {
            scannerInput.value = payload;
            handleScannerDiagnostic(payload);
        });
    } else {
        // Fallback test card UID
        const mockUid = 'NFC-' + Math.floor(10000000 + Math.random() * 90000000);
        scannerInput.value = mockUid;
        handleScannerDiagnostic(mockUid);
        window.app.toast(`Simulated NFC UID generated: ${mockUid}`, 'info', 'Simulated NFC Tap');
    }
});

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadCampuses();
    loadHierarchicalData();
    renderShortcutsGrid();
});