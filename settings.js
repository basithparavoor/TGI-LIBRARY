import { supabase } from './supabaseClient.js';

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
        if (targetPanel) targetPanel.style.display = 'block';
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
import { erp } from './erp_service.js';

function loadCampuses() {
    const tbody = document.getElementById('campuses-tbody');
    if (!tbody) return;

    const campuses = erp.getCampuses();
    if (campuses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-muted);">No campuses registered yet.</td></tr>`;
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
        </tr>
    `).join('');
}

document.getElementById('btn-add-campus')?.addEventListener('click', () => {
    const name = prompt('Enter Campus Full Name:');
    if (!name) return;
    const code = prompt('Enter Campus Code (e.g., MMC, TEC, NSC):', 'WEC');
    if (!code) return;
    const city = prompt('Enter Campus City / Region:', 'Bangalore');
    const headName = prompt('Enter Dean / Campus Head Full Name:', 'Dr. Sarah Connor');
    const email = prompt('Enter Official Contact Email:', `dean.${code.toLowerCase()}@tgi.edu`);

    erp.saveCampus({
        name,
        code: code.toUpperCase(),
        city: city || 'Bangalore',
        head_name: headName || 'Campus Dean',
        email: email || 'dean@tgi.edu',
        phone: '+91 80 2345 6789'
    });

    window.app.toast(`Campus "${name}" registered successfully!`, 'success', 'Campus Added');
    loadCampuses();
});

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadCampuses();
    loadHierarchicalData();
});