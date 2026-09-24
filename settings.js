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
        if(targetPanel) targetPanel.style.display = 'block';
    });
});

// --- GENERAL SETTINGS ---
async function loadSettings() {
    try {
        const { data, error } = await supabase.from('library_settings').select('*');
        if (error) return;
        data.forEach(setting => {
            if (setting.setting_key === 'loan_days') document.getElementById('setting-loan-days').value = setting.setting_value;
            if (setting.setting_key === 'fine_amount') document.getElementById('setting-fine-amount').value = setting.setting_value;
            if (setting.setting_key === 'max_books') document.getElementById('setting-max-books').value = setting.setting_value;
            if (setting.setting_key === 'max_renewals') document.getElementById('setting-max-renewals').value = setting.setting_value;
        });
    } catch (err) { console.error(err); }
}

settingsForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const originalText = btnSave.innerHTML;
    btnSave.innerHTML = "Saving...";
    btnSave.disabled = true;
    
    const updates = [
        { setting_key: 'loan_days', setting_value: document.getElementById('setting-loan-days').value },
        { setting_key: 'fine_amount', setting_value: document.getElementById('setting-fine-amount').value },
        { setting_key: 'max_books', setting_value: document.getElementById('setting-max-books').value },
        { setting_key: 'max_renewals', setting_value: document.getElementById('setting-max-renewals').value }
    ];

    try {
        await supabase.from('library_settings').upsert(updates, { onConflict: 'setting_key' });
        if (window.app) window.app.alert("Library rules updated.", "Saved");
    } catch (err) {
        if (window.app) window.app.alert("Error saving settings.", "Error");
    } finally {
        btnSave.innerHTML = originalText;
        btnSave.disabled = false;
    }
});

// --- HIERARCHICAL MASTER DATA ---
async function loadHierarchicalData() {
    const { data: depts, error: deptErr } = await supabase.from('departments').select('id, name, classes(id, name)').order('name');
    const acaTree = document.getElementById('tree-academic');
    
    if (!deptErr && acaTree) {
        acaTree.innerHTML = depts.length ? depts.map(dept => `
            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--bg-primary); border-bottom: 1px solid var(--border-color);">
                    <span style="font-weight: 600;">${dept.name}</span>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-outline btn-sm" onclick="addChildEntity('Class', 'classes', 'department_id', '${dept.id}')"><i data-lucide="plus" style="width: 14px;"></i> Class</button>
                        <button class="btn btn-outline btn-sm" onclick="editEntity('departments', '${dept.id}', '${dept.name}')"><i data-lucide="edit" style="width: 14px;"></i></button>
                        <button class="btn btn-sm" style="color: var(--danger); background: transparent; border: none;" onclick="deleteEntity('departments', '${dept.id}', '${dept.name}')"><i data-lucide="trash-2" style="width: 16px;"></i></button>
                    </div>
                </div>
                <div style="padding: 0.5rem 1rem; display: flex; flex-direction: column; gap: 0.25rem;">
                    ${dept.classes.length ? dept.classes.map(cls => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.25rem 0; font-size: 0.875rem;">
                            <span style="display: flex; align-items: center;"><i data-lucide="corner-down-right" style="width: 14px; color: var(--text-secondary); margin-right: 0.5rem;"></i>${cls.name}</span>
                            <div style="display: flex; gap: 0.25rem;">
                                <button class="btn btn-sm" style="color: var(--text-secondary); background: transparent; border: none; padding: 0;" onclick="editEntity('classes', '${cls.id}', '${cls.name}')"><i data-lucide="edit" style="width: 14px;"></i></button>
                                <button class="btn btn-sm" style="color: var(--danger); background: transparent; border: none; padding: 0;" onclick="deleteEntity('classes', '${cls.id}', '${cls.name}')"><i data-lucide="x" style="width: 14px;"></i></button>
                            </div>
                        </div>
                    `).join('') : '<span style="font-size: 0.75rem; color: var(--text-secondary);">No classes assigned.</span>'}
                </div>
            </div>
        `).join('') : '<div style="padding: 1rem; text-align: center; color: var(--text-secondary);">No departments found.</div>';
    }

    const { data: shelves, error: shelfErr } = await supabase.from('shelves').select('id, name, racks(id, name)').order('name');
    const locTree = document.getElementById('tree-locations');
    
    if (!shelfErr && locTree) {
        locTree.innerHTML = shelves.length ? shelves.map(shelf => `
            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--bg-primary); border-bottom: 1px solid var(--border-color);">
                    <span style="font-weight: 600;">${shelf.name}</span>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-outline btn-sm" onclick="addChildEntity('Rack', 'racks', 'shelf_id', '${shelf.id}')"><i data-lucide="plus" style="width: 14px;"></i> Rack</button>
                        <button class="btn btn-outline btn-sm" onclick="editEntity('shelves', '${shelf.id}', '${shelf.name}')"><i data-lucide="edit" style="width: 14px;"></i></button>
                        <button class="btn btn-sm" style="color: var(--danger); background: transparent; border: none;" onclick="deleteEntity('shelves', '${shelf.id}', '${shelf.name}')"><i data-lucide="trash-2" style="width: 16px;"></i></button>
                    </div>
                </div>
                <div style="padding: 0.5rem 1rem; display: flex; flex-direction: column; gap: 0.25rem;">
                    ${shelf.racks.length ? shelf.racks.map(rack => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.25rem 0; font-size: 0.875rem;">
                            <span style="display: flex; align-items: center;"><i data-lucide="corner-down-right" style="width: 14px; color: var(--text-secondary); margin-right: 0.5rem;"></i>${rack.name}</span>
                            <div style="display: flex; gap: 0.25rem;">
                                <button class="btn btn-sm" style="color: var(--text-secondary); background: transparent; border: none; padding: 0;" onclick="editEntity('racks', '${rack.id}', '${rack.name}')"><i data-lucide="edit" style="width: 14px;"></i></button>
                                <button class="btn btn-sm" style="color: var(--danger); background: transparent; border: none; padding: 0;" onclick="deleteEntity('racks', '${rack.id}', '${rack.name}')"><i data-lucide="x" style="width: 14px;"></i></button>
                            </div>
                        </div>
                    `).join('') : '<span style="font-size: 0.75rem; color: var(--text-secondary);">No racks assigned.</span>'}
                </div>
            </div>
        `).join('') : '<div style="padding: 1rem; text-align: center; color: var(--text-secondary);">No shelves found.</div>';
    }
    if (window.lucide) lucide.createIcons();
}

window.addParentEntity = function(label, table) {
    if (!window.app) return;
    window.app.prompt(`Enter name for new ${label}:`, `Add ${label}`, async (val) => {
        if (val && val.trim()) {
            await supabase.from(table).insert([{ name: val.trim() }]);
            loadHierarchicalData();
        }
    });
};

window.addChildEntity = function(label, table, foreignKey, parentId) {
    if (!window.app) return;
    window.app.prompt(`Enter name for new ${label}:`, `Add ${label}`, async (val) => {
        if (val && val.trim()) {
            const payload = { name: val.trim() };
            payload[foreignKey] = parentId;
            await supabase.from(table).insert([payload]);
            loadHierarchicalData();
        }
    });
};

window.editEntity = function(table, id, currentName) {
    if (!window.app) return;
    window.app.prompt(`Enter new name for "${currentName}":`, `Edit Name`, async (val) => {
        if (val && val.trim() && val.trim() !== currentName) {
            await supabase.from(table).update({ name: val.trim() }).eq('id', id);
            loadHierarchicalData();
        }
    });
};

window.deleteEntity = function(table, id, name) {
    if (!window.app) return;
    window.app.confirm(`Delete "${name}"?`, `Delete`, async () => {
        await supabase.from(table).delete().eq('id', id);
        loadHierarchicalData();
    });
};

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadHierarchicalData();
});