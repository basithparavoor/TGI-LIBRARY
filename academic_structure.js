// academic_structure.js - Standalone Academic Infrastructure, Department, Degree & Class Section Suite
import { supabase } from './supabaseClient.js';
import { erp } from './erp_service.js';
import { showToast, playAudioChime } from './ui.js';

let departmentsList = [];
let programsList = [];
let classesList = [];

// Default Local Fallback Data
const DEFAULT_DEPTS = [
    { id: 'dept-cs', code: 'CS', name: 'Computer Science & Engineering', hod_name: 'Dr. Robert Oppenheim', email: 'hod.cs@tgi.edu', intake_capacity: 180 },
    { id: 'dept-me', code: 'ME', name: 'Mechanical & Automation Engineering', hod_name: 'Prof. Evelyn Reed', email: 'hod.me@tgi.edu', intake_capacity: 120 },
    { id: 'dept-ec', code: 'ECE', name: 'Electronics & Communication', hod_name: 'Dr. Sarah Connor', email: 'hod.ece@tgi.edu', intake_capacity: 120 },
    { id: 'dept-mgt', code: 'MGMT', name: 'School of Management Studies', hod_name: 'Prof. Dev Patel', email: 'hod.mgmt@tgi.edu', intake_capacity: 90 }
];

const DEFAULT_PROGRAMS = [
    { id: 'prog-1', code: 'BTECH-CSE', name: 'B.Tech Computer Science & Engineering', department_id: 'dept-cs', department_name: 'Computer Science & Engineering', degree_level: 'Undergraduate (UG)', duration_years: 4, credits: 160 },
    { id: 'prog-2', code: 'MTECH-AI', name: 'M.Tech Artificial Intelligence & Data Science', department_id: 'dept-cs', department_name: 'Computer Science & Engineering', degree_level: 'Postgraduate (PG)', duration_years: 2, credits: 80 },
    { id: 'prog-3', code: 'BTECH-ME', name: 'B.Tech Mechanical & Robotics', department_id: 'dept-me', department_name: 'Mechanical & Automation Engineering', degree_level: 'Undergraduate (UG)', duration_years: 4, credits: 160 },
    { id: 'prog-4', code: 'MBA-TECH', name: 'Master of Business Administration (Tech Management)', department_id: 'dept-mgt', department_name: 'School of Management Studies', degree_level: 'Postgraduate (PG)', duration_years: 2, credits: 96 }
];

const DEFAULT_CLASSES = [
    { id: 'cls-1', code: 'CS-A', name: 'CS-A 2026 Batch', department_id: 'dept-cs', department_name: 'Computer Science & Engineering', semester: 'Semester 4', mentor_name: 'Prof. Ananya Roy', room_no: 'Room 204 (CS Wing)', capacity: 60, enrolled_count: 58 },
    { id: 'cls-2', code: 'CS-B', name: 'CS-B 2026 Batch', department_id: 'dept-cs', department_name: 'Computer Science & Engineering', semester: 'Semester 4', mentor_name: 'Dr. Robert Oppenheim', room_no: 'Room 205 (CS Wing)', capacity: 60, enrolled_count: 56 },
    { id: 'cls-3', code: 'ME-A', name: 'ME-A 2026 Batch', department_id: 'dept-me', department_name: 'Mechanical & Automation Engineering', semester: 'Semester 4', mentor_name: 'Prof. Evelyn Reed', room_no: 'Workshop Hall 3', capacity: 60, enrolled_count: 52 },
    { id: 'cls-4', code: 'MBA-1', name: 'MBA Year 1', department_id: 'dept-mgt', department_name: 'School of Management Studies', semester: 'Semester 2', mentor_name: 'Prof. Dev Patel', room_no: 'Executive Room 101', capacity: 45, enrolled_count: 42 }
];

document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    initModals();
    await loadAllAcademicData();
    setupEventListeners();
});

// --- TAB SWITCHING ---
function initTabs() {
    const tabs = document.querySelectorAll('.structure-tab-btn');
    const panels = document.querySelectorAll('.tab-content-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.style.display = 'none');

            tab.classList.add('active');
            const target = document.getElementById(tab.dataset.tab);
            if (target) {
                target.style.display = 'block';
                if (tab.dataset.tab === 'tab-tree') renderHierarchyTree();
            }
        });
    });
}

// --- DATA LOADING & SUPABASE SYNC ---
async function loadAllAcademicData() {
    // 1. Departments
    try {
        const { data: dbDepts } = await supabase.from('departments').select('*').order('name');
        if (dbDepts && dbDepts.length > 0) {
            departmentsList = dbDepts.map(d => ({
                id: d.id,
                code: d.code || d.name.substring(0, 4).toUpperCase(),
                name: d.name,
                hod_name: d.hod_name || 'Department Chair',
                email: d.email || 'dept@tgi.edu',
                intake_capacity: d.intake_capacity || 120
            }));
        } else {
            departmentsList = JSON.parse(localStorage.getItem('erp_acad_departments') || JSON.stringify(DEFAULT_DEPTS));
        }
    } catch (e) {
        departmentsList = JSON.parse(localStorage.getItem('erp_acad_departments') || JSON.stringify(DEFAULT_DEPTS));
    }

    // 2. Degree Programs
    programsList = JSON.parse(localStorage.getItem('erp_acad_programs') || JSON.stringify(DEFAULT_PROGRAMS));

    // 3. Classes
    try {
        const { data: dbClasses } = await supabase.from('classes').select('*, departments(name)').order('name');
        if (dbClasses && dbClasses.length > 0) {
            classesList = dbClasses.map(c => ({
                id: c.id,
                code: c.code || c.name.split(' ')[0],
                name: c.name,
                department_id: c.department_id,
                department_name: c.departments?.name || 'General Department',
                semester: c.semester || 'Semester 1',
                mentor_name: c.mentor_name || 'Class Mentor',
                room_no: c.room_no || 'Room 101',
                capacity: c.capacity || 60,
                enrolled_count: c.enrolled_count || 45
            }));
        } else {
            classesList = JSON.parse(localStorage.getItem('erp_acad_classes') || JSON.stringify(DEFAULT_CLASSES));
        }
    } catch (e) {
        classesList = JSON.parse(localStorage.getItem('erp_acad_classes') || JSON.stringify(DEFAULT_CLASSES));
    }

    saveToLocalStorage();
    updateKpis();
    renderDepartmentsTable();
    renderProgramsTable();
    renderClassesTable();
    populateSelectDropdowns();
}

function saveToLocalStorage() {
    localStorage.setItem('erp_acad_departments', JSON.stringify(departmentsList));
    localStorage.setItem('erp_acad_programs', JSON.stringify(programsList));
    localStorage.setItem('erp_acad_classes', JSON.stringify(classesList));
}

function updateKpis() {
    const totalCapacity = departmentsList.reduce((acc, d) => acc + (parseInt(d.intake_capacity) || 0), 0);
    document.getElementById('kpi-total-depts').innerText = departmentsList.length;
    document.getElementById('kpi-total-programs').innerText = programsList.length;
    document.getElementById('kpi-total-classes').innerText = classesList.length;
    document.getElementById('kpi-total-capacity').innerText = `${totalCapacity.toLocaleString()} Seats`;
}

function populateSelectDropdowns() {
    const progDeptSelect = document.getElementById('prog-dept-select');
    const clsDeptSelect = document.getElementById('cls-dept-select');

    const optionsHtml = departmentsList.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');

    if (progDeptSelect) progDeptSelect.innerHTML = optionsHtml;
    if (clsDeptSelect) clsDeptSelect.innerHTML = optionsHtml;
}

// --- RENDER DEPARTMENTS TABLE ---
function renderDepartmentsTable() {
    const tbody = document.getElementById('departments-tbody');
    if (!tbody) return;

    if (departmentsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="padding: 2.5rem; text-align: center; color: var(--text-muted);">No academic departments configured yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = departmentsList.map(d => {
        const progCount = programsList.filter(p => p.department_id === d.id).length;
        const classCount = classesList.filter(c => c.department_id === d.id).length;

        return `
            <tr>
                <td style="font-family: var(--font-mono); font-weight: 700; color: var(--brand-primary);">${d.code}</td>
                <td style="font-weight: 700; color: var(--text-primary);">${d.name}</td>
                <td><strong>${d.hod_name}</strong></td>
                <td style="font-size: 0.85rem; color: var(--text-muted);">${d.email}</td>
                <td><span class="badge badge-brand">${progCount} Programs</span></td>
                <td><span class="badge badge-success">${classCount} Sections</span></td>
                <td style="font-family: var(--font-mono); font-weight: 700;">${d.intake_capacity} seats</td>
                <td style="text-align: right;">
                    <div style="display: flex; gap: 0.25rem; justify-content: flex-end;">
                        <button class="btn btn-ghost btn-sm" onclick="window.editDept('${d.id}')" title="Edit Department" style="padding: 0.2rem 0.4rem;">
                            <i data-lucide="edit-3" style="width: 14px;"></i>
                        </button>
                        <button class="btn btn-ghost btn-sm" style="color: var(--color-danger); padding: 0.2rem 0.4rem;" onclick="window.deleteDept('${d.id}', '${d.name.replace(/'/g, "\\'")}')" title="Delete Department">
                            <i data-lucide="trash-2" style="width: 14px;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

// --- RENDER PROGRAMS TABLE ---
function renderProgramsTable() {
    const tbody = document.getElementById('programs-tbody');
    if (!tbody) return;

    if (programsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding: 2.5rem; text-align: center; color: var(--text-muted);">No degree programs or courses registered yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = programsList.map(p => {
        const dept = departmentsList.find(d => d.id === p.department_id);
        const deptName = dept ? dept.name : (p.department_name || 'Academic Dept');

        return `
            <tr>
                <td style="font-family: var(--font-mono); font-weight: 700; color: var(--brand-accent);">${p.code}</td>
                <td style="font-weight: 700; color: var(--text-primary);">${p.name}</td>
                <td><span class="badge badge-brand">${deptName}</span></td>
                <td><span class="badge" style="background: rgba(139,92,246,0.1); color: var(--brand-accent);">${p.degree_level}</span></td>
                <td style="font-family: var(--font-mono); font-weight: 700;">${p.duration_years} Years</td>
                <td style="font-size: 0.85rem; color: var(--text-muted);">${p.credits || 120} Credits</td>
                <td style="text-align: right;">
                    <div style="display: flex; gap: 0.25rem; justify-content: flex-end;">
                        <button class="btn btn-ghost btn-sm" onclick="window.editProgram('${p.id}')" title="Edit Program" style="padding: 0.2rem 0.4rem;">
                            <i data-lucide="edit-3" style="width: 14px;"></i>
                        </button>
                        <button class="btn btn-ghost btn-sm" style="color: var(--color-danger); padding: 0.2rem 0.4rem;" onclick="window.deleteProgram('${p.id}', '${p.name.replace(/'/g, "\\'")}')" title="Delete Program">
                            <i data-lucide="trash-2" style="width: 14px;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

// --- RENDER CLASSES TABLE ---
function renderClassesTable() {
    const tbody = document.getElementById('classes-tbody');
    if (!tbody) return;

    if (classesList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="padding: 2.5rem; text-align: center; color: var(--text-muted);">No classroom cohorts configured yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = classesList.map(c => {
        const dept = departmentsList.find(d => d.id === c.department_id);
        const deptName = dept ? dept.name : (c.department_name || 'Academic Dept');

        return `
            <tr>
                <td style="font-family: var(--font-mono); font-weight: 700; color: var(--brand-primary);">${c.code}</td>
                <td style="font-weight: 700; color: var(--text-primary);">${c.name}</td>
                <td><span class="badge badge-brand">${deptName}</span></td>
                <td><span class="badge badge-success">${c.semester}</span></td>
                <td><strong>${c.mentor_name}</strong></td>
                <td style="font-size: 0.85rem; color: var(--text-muted);">${c.room_no}</td>
                <td style="font-family: var(--font-mono); font-weight: 700; color: var(--color-success);">${c.enrolled_count || c.capacity} / ${c.capacity}</td>
                <td style="text-align: right;">
                    <div style="display: flex; gap: 0.25rem; justify-content: flex-end;">
                        <button class="btn btn-ghost btn-sm" onclick="window.editClass('${c.id}')" title="Edit Class" style="padding: 0.2rem 0.4rem;">
                            <i data-lucide="edit-3" style="width: 14px;"></i>
                        </button>
                        <button class="btn btn-ghost btn-sm" style="color: var(--color-danger); padding: 0.2rem 0.4rem;" onclick="window.deleteClass('${c.id}', '${c.name.replace(/'/g, "\\'")}')" title="Delete Class">
                            <i data-lucide="trash-2" style="width: 14px;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

// --- RENDER HIERARCHY TREE MATRIX ---
function renderHierarchyTree() {
    const container = document.getElementById('academic-tree-container');
    if (!container) return;

    if (departmentsList.length === 0) {
        container.innerHTML = `<div style="padding: 3rem; text-align: center; color: var(--text-muted);">No departments configured to construct tree hierarchy.</div>`;
        return;
    }

    container.innerHTML = departmentsList.map(dept => {
        const deptsProgs = programsList.filter(p => p.department_id === dept.id);
        const deptsClasses = classesList.filter(c => c.department_id === dept.id);

        return `
            <div class="academic-node">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                        <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(59,130,246,0.1); color: var(--brand-primary); display: flex; align-items: center; justify-content: center; font-weight: 800;">
                            ${dept.code}
                        </div>
                        <div>
                            <div style="font-weight: 800; font-size: 1.05rem; color: var(--text-primary);">${dept.name}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">HOD: <strong>${dept.hod_name}</strong> • ${dept.email} • Intake: ${dept.intake_capacity} seats</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.35rem;">
                        <span class="badge badge-brand">${deptsProgs.length} Degree Streams</span>
                        <span class="badge badge-success">${deptsClasses.length} Classroom Batches</span>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
                    <!-- Programs sub-list -->
                    <div style="background: var(--bg-muted); border-radius: var(--radius-sm); padding: 0.75rem;">
                        <div style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: var(--brand-accent); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.35rem;">
                            <i data-lucide="graduation-cap" style="width: 13px;"></i> Degree Programs (${deptsProgs.length})
                        </div>
                        ${deptsProgs.length > 0 ? deptsProgs.map(p => `
                            <div style="padding: 0.4rem 0.5rem; margin-bottom: 0.35rem; background: var(--bg-card); border-radius: 4px; border: 1px solid var(--border-color); font-size: 0.8rem; display: flex; justify-content: space-between; align-items: center;">
                                <span><strong>${p.code}</strong>: ${p.name}</span>
                                <span style="font-size: 0.7rem; color: var(--text-muted);">${p.duration_years}y</span>
                            </div>
                        `).join('') : '<div style="font-size: 0.75rem; color: var(--text-muted);">No degree programs attached.</div>'}
                    </div>

                    <!-- Classes sub-list -->
                    <div style="background: var(--bg-muted); border-radius: var(--radius-sm); padding: 0.75rem;">
                        <div style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: var(--color-success); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.35rem;">
                            <i data-lucide="users" style="width: 13px;"></i> Classroom Cohorts (${deptsClasses.length})
                        </div>
                        ${deptsClasses.length > 0 ? deptsClasses.map(c => `
                            <div style="padding: 0.4rem 0.5rem; margin-bottom: 0.35rem; background: var(--bg-card); border-radius: 4px; border: 1px solid var(--border-color); font-size: 0.8rem; display: flex; justify-content: space-between; align-items: center;">
                                <span><strong>${c.code}</strong>: ${c.name} (${c.semester})</span>
                                <span class="badge badge-success" style="font-size: 0.65rem;">${c.enrolled_count || c.capacity} Seats</span>
                            </div>
                        `).join('') : '<div style="font-size: 0.75rem; color: var(--text-muted);">No class cohorts created.</div>'}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

// --- MODAL CONTROLS & CRUD OPERATIONS ---
function initModals() {
    // Dept Modal
    const modalDept = document.getElementById('modal-dept');
    document.getElementById('btn-open-dept-modal')?.addEventListener('click', () => {
        document.getElementById('modal-dept-title').innerText = 'Add Academic Department';
        document.getElementById('dept-id').value = '';
        document.getElementById('form-dept').reset();
        modalDept.classList.add('active');
    });
    modalDept?.querySelectorAll('.close-dept-modal').forEach(b => b.addEventListener('click', () => modalDept.classList.remove('active')));

    // Program Modal
    const modalProgram = document.getElementById('modal-program');
    document.getElementById('btn-open-program-modal')?.addEventListener('click', () => {
        document.getElementById('modal-program-title').innerText = 'Add Degree Program';
        document.getElementById('prog-id').value = '';
        document.getElementById('form-program').reset();
        populateSelectDropdowns();
        modalProgram.classList.add('active');
    });
    modalProgram?.querySelectorAll('.close-program-modal').forEach(b => b.addEventListener('click', () => modalProgram.classList.remove('active')));

    // Class Modal
    const modalClass = document.getElementById('modal-class');
    document.getElementById('btn-open-class-modal')?.addEventListener('click', () => {
        document.getElementById('modal-class-title').innerText = 'Add Classroom Section';
        document.getElementById('cls-id').value = '';
        document.getElementById('form-class').reset();
        populateSelectDropdowns();
        modalClass.classList.add('active');
    });
    modalClass?.querySelectorAll('.close-class-modal').forEach(b => b.addEventListener('click', () => modalClass.classList.remove('active')));

    // PDF Preview Modal
    const modalPdf = document.getElementById('modal-academic-pdf-preview');
    modalPdf?.querySelectorAll('.close-pdf-modal').forEach(b => b.addEventListener('click', () => modalPdf.classList.remove('active')));
}

// Department CRUD Form Handler
document.getElementById('form-dept')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('dept-id').value;
    const deptObj = {
        id: id || `dept-${Date.now()}`,
        code: document.getElementById('dept-code').value.trim().toUpperCase(),
        name: document.getElementById('dept-name').value.trim(),
        hod_name: document.getElementById('dept-hod').value.trim(),
        email: document.getElementById('dept-email').value.trim(),
        intake_capacity: parseInt(document.getElementById('dept-capacity').value) || 120
    };

    if (id) {
        const idx = departmentsList.findIndex(d => d.id === id);
        if (idx !== -1) departmentsList[idx] = deptObj;
    } else {
        departmentsList.push(deptObj);
    }

    try {
        await supabase.from('departments').upsert({ id: deptObj.id, name: deptObj.name, code: deptObj.code });
    } catch(err) {}

    saveToLocalStorage();
    updateKpis();
    renderDepartmentsTable();
    populateSelectDropdowns();
    document.getElementById('modal-dept').classList.remove('active');
    playAudioChime('SUCCESS');
    showToast(`Department "${deptObj.name}" saved!`, 'success');
});

// Program CRUD Form Handler
document.getElementById('form-program')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('prog-id').value;
    const deptId = document.getElementById('prog-dept-select').value;
    const dept = departmentsList.find(d => d.id === deptId);

    const progObj = {
        id: id || `prog-${Date.now()}`,
        code: document.getElementById('prog-code').value.trim().toUpperCase(),
        name: document.getElementById('prog-name').value.trim(),
        department_id: deptId,
        department_name: dept ? dept.name : 'Academic Department',
        degree_level: document.getElementById('prog-level').value,
        duration_years: parseInt(document.getElementById('prog-duration').value) || 4,
        credits: 120
    };

    if (id) {
        const idx = programsList.findIndex(p => p.id === id);
        if (idx !== -1) programsList[idx] = progObj;
    } else {
        programsList.push(progObj);
    }

    saveToLocalStorage();
    updateKpis();
    renderProgramsTable();
    document.getElementById('modal-program').classList.remove('active');
    playAudioChime('SUCCESS');
    showToast(`Degree Program "${progObj.name}" saved!`, 'success');
});

// Class Section CRUD Form Handler
document.getElementById('form-class')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('cls-id').value;
    const deptId = document.getElementById('cls-dept-select').value;
    const dept = departmentsList.find(d => d.id === deptId);

    const classObj = {
        id: id || `cls-${Date.now()}`,
        code: document.getElementById('cls-code').value.trim().toUpperCase(),
        name: document.getElementById('cls-name').value.trim(),
        department_id: deptId,
        department_name: dept ? dept.name : 'Academic Department',
        semester: document.getElementById('cls-sem').value.trim() || 'Semester 1',
        room_no: document.getElementById('cls-room').value.trim() || 'Room 101',
        mentor_name: document.getElementById('cls-mentor').value.trim() || 'Class Mentor',
        capacity: parseInt(document.getElementById('cls-capacity').value) || 60,
        enrolled_count: parseInt(document.getElementById('cls-capacity').value) || 60
    };

    if (id) {
        const idx = classesList.findIndex(c => c.id === id);
        if (idx !== -1) classesList[idx] = classObj;
    } else {
        classesList.push(classObj);
    }

    try {
        await supabase.from('classes').upsert({ id: classObj.id, name: classObj.name, department_id: classObj.department_id });
    } catch(err) {}

    saveToLocalStorage();
    updateKpis();
    renderClassesTable();
    document.getElementById('modal-class').classList.remove('active');
    playAudioChime('SUCCESS');
    showToast(`Class section "${classObj.name}" saved!`, 'success');
});

// Global Edit/Delete Functions
window.editDept = function(id) {
    const d = departmentsList.find(item => item.id === id);
    if (!d) return;
    document.getElementById('modal-dept-title').innerText = 'Edit Academic Department';
    document.getElementById('dept-id').value = d.id;
    document.getElementById('dept-code').value = d.code;
    document.getElementById('dept-name').value = d.name;
    document.getElementById('dept-hod').value = d.hod_name;
    document.getElementById('dept-email').value = d.email;
    document.getElementById('dept-capacity').value = d.intake_capacity;
    document.getElementById('modal-dept').classList.add('active');
};

window.deleteDept = function(id, name) {
    window.app.confirm(`Delete department "${name}" and unassign related programs?`, 'Delete Department', async () => {
        departmentsList = departmentsList.filter(d => d.id !== id);
        try { await supabase.from('departments').delete().eq('id', id); } catch(e) {}
        saveToLocalStorage();
        updateKpis();
        renderDepartmentsTable();
        populateSelectDropdowns();
        showToast(`Department "${name}" deleted.`, 'info');
    });
};

window.editProgram = function(id) {
    const p = programsList.find(item => item.id === id);
    if (!p) return;
    document.getElementById('modal-program-title').innerText = 'Edit Degree Program';
    document.getElementById('prog-id').value = p.id;
    document.getElementById('prog-code').value = p.code;
    document.getElementById('prog-name').value = p.name;
    document.getElementById('prog-dept-select').value = p.department_id;
    document.getElementById('prog-level').value = p.degree_level;
    document.getElementById('prog-duration').value = p.duration_years;
    document.getElementById('modal-program').classList.add('active');
};

window.deleteProgram = function(id, name) {
    window.app.confirm(`Delete degree program "${name}"?`, 'Delete Program', () => {
        programsList = programsList.filter(p => p.id !== id);
        saveToLocalStorage();
        updateKpis();
        renderProgramsTable();
        showToast(`Program "${name}" deleted.`, 'info');
    });
};

window.editClass = function(id) {
    const c = classesList.find(item => item.id === id);
    if (!c) return;
    document.getElementById('modal-class-title').innerText = 'Edit Classroom Section';
    document.getElementById('cls-id').value = c.id;
    document.getElementById('cls-code').value = c.code;
    document.getElementById('cls-name').value = c.name;
    document.getElementById('cls-dept-select').value = c.department_id;
    document.getElementById('cls-sem').value = c.semester;
    document.getElementById('cls-room').value = c.room_no;
    document.getElementById('cls-mentor').value = c.mentor_name;
    document.getElementById('cls-capacity').value = c.capacity;
    document.getElementById('modal-class').classList.add('active');
};

window.deleteClass = function(id, name) {
    window.app.confirm(`Delete class section "${name}"?`, 'Delete Class Section', async () => {
        classesList = classesList.filter(c => c.id !== id);
        try { await supabase.from('classes').delete().eq('id', id); } catch(e) {}
        saveToLocalStorage();
        updateKpis();
        renderClassesTable();
        showToast(`Class section "${name}" deleted.`, 'info');
    });
};

// --- REPORTS: PDF AUDIT REPORT & CSV EXPORT ---
function setupEventListeners() {
    // Top Entity Dropdown
    document.getElementById('btn-add-entity-dropdown')?.addEventListener('click', () => {
        const choice = prompt('Select Entity Type to Create:\n1: Academic Department\n2: Degree Program\n3: Class Section', '1');
        if (choice === '1') document.getElementById('btn-open-dept-modal')?.click();
        else if (choice === '2') document.getElementById('btn-open-program-modal')?.click();
        else if (choice === '3') document.getElementById('btn-open-class-modal')?.click();
    });

    // Generate PDF Audit Report Modal
    document.getElementById('btn-academic-pdf-report')?.addEventListener('click', () => {
        const inst = erp.getInstitutionProfile();
        document.getElementById('pdf-inst-name').innerText = inst.name || 'TGI INSTITUTION';
        document.getElementById('pdf-inst-tagline').innerText = inst.tagline || 'Office of Academic Affairs & Accreditation';
        document.getElementById('pdf-inst-code').innerText = inst.reg_code || 'TGI-ACAD-2026';
        document.getElementById('pdf-report-date').innerText = new Date().toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });

        const totalCapacity = departmentsList.reduce((acc, d) => acc + (parseInt(d.intake_capacity) || 0), 0);
        document.getElementById('pdf-summary-depts').innerText = departmentsList.length;
        document.getElementById('pdf-summary-progs').innerText = programsList.length;
        document.getElementById('pdf-summary-classes').innerText = classesList.length;
        document.getElementById('pdf-summary-intake').innerText = `${totalCapacity.toLocaleString()} Seats`;

        // Departments Table Body
        document.getElementById('pdf-depts-table-body').innerHTML = departmentsList.map(d => {
            const progCount = programsList.filter(p => p.department_id === d.id).length;
            const classCount = classesList.filter(c => c.department_id === d.id).length;
            return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 0.5rem; font-family: monospace; font-weight: bold; border: 1px solid #cbd5e1;">${d.code}</td>
                    <td style="padding: 0.5rem; font-weight: bold; border: 1px solid #cbd5e1;">${d.name}</td>
                    <td style="padding: 0.5rem; border: 1px solid #cbd5e1;">${d.hod_name}</td>
                    <td style="padding: 0.5rem; text-align: center; border: 1px solid #cbd5e1;">${progCount}</td>
                    <td style="padding: 0.5rem; text-align: center; border: 1px solid #cbd5e1;">${classCount}</td>
                    <td style="padding: 0.5rem; text-align: right; font-weight: bold; border: 1px solid #cbd5e1;">${d.intake_capacity}</td>
                </tr>
            `;
        }).join('');

        // Classes Table Body
        document.getElementById('pdf-classes-table-body').innerHTML = classesList.map(c => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 0.5rem; font-family: monospace; font-weight: bold; border: 1px solid #cbd5e1;">${c.code}</td>
                <td style="padding: 0.5rem; font-weight: bold; border: 1px solid #cbd5e1;">${c.name}</td>
                <td style="padding: 0.5rem; border: 1px solid #cbd5e1;">${c.department_name}</td>
                <td style="padding: 0.5rem; border: 1px solid #cbd5e1;">${c.mentor_name}</td>
                <td style="padding: 0.5rem; text-align: center; border: 1px solid #cbd5e1;">${c.room_no}</td>
                <td style="padding: 0.5rem; text-align: right; font-weight: bold; border: 1px solid #cbd5e1;">${c.enrolled_count || c.capacity} / ${c.capacity}</td>
            </tr>
        `).join('');

        document.getElementById('modal-academic-pdf-preview').classList.add('active');
        playAudioChime('SUCCESS');
    });

    // CSV Export
    document.getElementById('btn-academic-csv-export')?.addEventListener('click', () => {
        let csv = 'Entity_Type,Code,Name,Parent_Department,Leadership_Mentor,Room_Or_Level,Duration_Sem,Capacity_Seats\n';

        departmentsList.forEach(d => {
            csv += `"Department","${d.code}","${d.name}","-","${d.hod_name}","${d.email}","-",${d.intake_capacity}\n`;
        });

        programsList.forEach(p => {
            csv += `"Degree_Program","${p.code}","${p.name}","${p.department_name}","-","${p.degree_level}","${p.duration_years} Years",-\n`;
        });

        classesList.forEach(c => {
            csv += `"Class_Section","${c.code}","${c.name}","${c.department_name}","${c.mentor_name}","${c.room_no}","${c.semester}",${c.capacity}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Academic_Structure_Report_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        playAudioChime('SUCCESS');
        showToast('Academic structure matrix exported to CSV!', 'success');
    });
}
