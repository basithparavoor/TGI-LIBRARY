import { supabase } from './supabaseClient.js';

// UI Elements
const tbody = document.getElementById('students-table-body');
const searchInput = document.getElementById('search-students');
const filterDept = document.getElementById('filter-dept');
const filterStatus = document.getElementById('filter-status');
const selectAllCb = document.getElementById('select-all');
const selectionCountBadge = document.getElementById('selection-count');
const rowsPerPageSelect = document.getElementById('rows-per-page');
const btnPrev = document.getElementById('btn-prev-page');
const btnNext = document.getElementById('btn-next-page');
const paginationInfo = document.getElementById('pagination-info');
const pageDisplay = document.getElementById('current-page-display');

// Modal Elements
const modalAddStudent = document.getElementById('modal-add-student');
const btnAddStudent = document.getElementById('btn-add-student');
const btnCloseModal = document.getElementById('btn-close-student-modal');
const btnCancelStudent = document.getElementById('btn-cancel-student');
const formAddStudent = document.getElementById('form-add-student');
const addDeptSelect = document.getElementById('add-student-dept');
const addClassSelect = document.getElementById('add-student-class');

let currentEditStudentId = null;

// Data State
let state = {
    allData: [],
    filteredData: [],
    selectedIds: new Set(),
    page: 1,
    limit: 25
};

// --- 1. MASTER DATA: DEPARTMENTS & CLASSES ---

async function loadDepartments() {
    if (!addDeptSelect) return;
    addDeptSelect.innerHTML = '<option value="">Select Department...</option>';
    
    const { data, error } = await supabase.from('departments').select('id, name').order('name');
    if (!error && data) {
        addDeptSelect.innerHTML += data.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    }
}

window.loadClassesForDept = async function(deptId) {
    if (!addClassSelect) return;
    addClassSelect.innerHTML = '<option value="">Select Class...</option>';
    if (!deptId) return;

    const { data, error } = await supabase.from('classes').select('id, name').eq('department_id', deptId).order('name');
    if (!error && data) {
        addClassSelect.innerHTML += data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
};

addDeptSelect?.addEventListener('change', (e) => loadClassesForDept(e.target.value));

// --- 2. FETCH, FILTER & RENDER ---

async function fetchStudents() {
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="padding: 2rem; text-align: center;">Loading...</td></tr>';
    
    const { data, error } = await supabase
        .from('students')
        .select(`*, departments(name), classes(name)`)
        .order('created_at', { ascending: false })
        .limit(1000);

    if (error) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--danger);">Failed to load students.</td></tr>';
        return;
    }

    state.allData = data || [];
    
    // Populate Department Filter dynamically
    const uniqueDepts = [...new Set(state.allData.map(s => s.department_id).filter(Boolean))];
    if (filterDept) {
        uniqueDepts.forEach(id => {
            const deptName = state.allData.find(s => s.department_id === id)?.departments?.name;
            if (deptName && !filterDept.querySelector(`option[value="${id}"]`)) {
                filterDept.innerHTML += `<option value="${id}">${deptName}</option>`;
            }
        });
    }

    applyFilters();
}

function applyFilters() {
    // Safely extract values using optional chaining to prevent null errors
    const query = searchInput?.value?.toLowerCase() || '';
    const deptId = filterDept?.value || '';
    const status = filterStatus?.value || '';

    state.filteredData = state.allData.filter(student => {
        const matchesSearch = !query || student.name.toLowerCase().includes(query) || student.student_id.toLowerCase().includes(query);
        const matchesDept = !deptId || student.department_id === deptId;
        const matchesStatus = !status || student.status === status;
        return matchesSearch && matchesDept && matchesStatus;
    });

    state.page = 1; 
    updateTable();
}

// Replace this block in students.js
function updateTable() {
    if (!tbody) return;
    
    const start = (state.page - 1) * state.limit;
    const end = start + state.limit;
    const paginatedItems = state.filteredData.slice(start, end);

    if (paginatedItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-secondary);">No records found.</td></tr>';
    } else {
        tbody.innerHTML = paginatedItems.map(student => {
            const isSelected = state.selectedIds.has(student.id);
            const deptName = student.departments?.name || 'No Dept';
            const className = student.classes?.name || 'No Class';
            
            return `
                <tr style="${isSelected ? 'background: rgba(37,99,235,0.05);' : ''}">
                    <td class="checkbox-cell" data-label="Select"><input type="checkbox" class="custom-checkbox row-checkbox" data-id="${student.id}" ${isSelected ? 'checked' : ''}></td>
                    <td data-label="Student Details">
                        <div style="font-weight: 500; color: var(--text-primary);">${student.name}</div>
                        <div style="font-size: 0.875rem; color: var(--text-secondary);">${student.place || 'No location'}</div>
                    </td>
                    <td data-label="Register No" style="color: var(--text-secondary); font-family: monospace;">${student.student_id}</td>
                    <td data-label="Dept & Class">
                        <div style="font-weight: 500;">${className}</div>
                        <div style="font-size: 0.875rem; color: var(--text-secondary);">${deptName}</div>
                    </td>
                    <td data-label="Status"><span class="badge badge-${student.status === 'ACTIVE' ? 'success' : 'danger'}">${student.status}</span></td>
                    <td data-label="Actions" style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                        <button class="btn btn-sm btn-primary" onclick="printLibraryCard('${student.name.replace(/'/g, "\\'")}', '${student.student_id}', '${className}')" title="Print ID"><i data-lucide="printer" style="width: 14px;"></i></button>
                        <button class="btn btn-sm btn-outline" onclick="window.editStudent('${student.id}')" title="Edit"><i data-lucide="edit" style="width: 14px;"></i></button>
                        <button class="btn btn-sm" style="color: var(--danger); border: 1px solid var(--danger); background: transparent;" onclick="window.deleteStudent('${student.id}', '${student.name.replace(/'/g, "\\'")}')" title="Delete"><i data-lucide="trash-2" style="width: 14px;"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    if (window.lucide) lucide.createIcons();
    updatePaginationUI();
    attachCheckboxListeners();
}

function updatePaginationUI() {
    const total = state.filteredData.length;
    const start = total === 0 ? 0 : ((state.page - 1) * state.limit) + 1;
    const end = Math.min(state.page * state.limit, total);
    
    if (paginationInfo) paginationInfo.innerText = `Showing ${start}-${end} of ${total}`;
    if (pageDisplay) pageDisplay.innerText = `Page ${state.page}`;
    
    if (btnPrev) btnPrev.disabled = state.page === 1;
    if (btnNext) btnNext.disabled = end >= total;
    
    if (selectAllCb) {
        const currentViewIds = state.filteredData.slice((state.page - 1) * state.limit, state.page * state.limit).map(s => s.id);
        selectAllCb.checked = currentViewIds.length > 0 && currentViewIds.every(id => state.selectedIds.has(id));
    }
}

function attachCheckboxListeners() {
    document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = e.target.getAttribute('data-id');
            if (e.target.checked) state.selectedIds.add(id);
            else state.selectedIds.delete(id);
            
            updateSelectionBadge();
            
            if (selectAllCb) {
                const currentViewIds = state.filteredData.slice((state.page - 1) * state.limit, state.page * state.limit).map(s => s.id);
                selectAllCb.checked = currentViewIds.every(cid => state.selectedIds.has(cid));
            }
        });
    });
}

selectAllCb?.addEventListener('change', (e) => {
    const currentViewIds = state.filteredData.slice((state.page - 1) * state.limit, state.page * state.limit).map(s => s.id);
    if (e.target.checked) currentViewIds.forEach(id => state.selectedIds.add(id));
    else currentViewIds.forEach(id => state.selectedIds.delete(id));
    
    updateTable();
    updateSelectionBadge();
});

function updateSelectionBadge() {
    if (!selectionCountBadge) return;
    if (state.selectedIds.size > 0) {
        selectionCountBadge.style.display = 'inline-block';
        selectionCountBadge.innerText = `${state.selectedIds.size} Selected`;
    } else {
        selectionCountBadge.style.display = 'none';
    }
}

// --- 3. EXPORTS ---
window.exportStudents = function(format) {
    const exportDataset = state.selectedIds.size > 0 
        ? state.allData.filter(s => state.selectedIds.has(s.id)) 
        : state.filteredData;
        
    if (exportDataset.length === 0) return window.app?.alert("No data to export.", "Export");

    if (format === 'csv') {
        const headers = ["Register No", "Name", "Department", "Class", "Location", "Status"];
        const csvRows = exportDataset.map(s => `"${s.student_id}","${s.name}","${s.departments?.name || ''}","${s.classes?.name || ''}","${s.place || ''}","${s.status}"`);
        
        const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Students_Export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    } else if (format === 'pdf') {
        window.print();
    }
};

// --- 4. EDIT & DELETE MODALS ---
window.editStudent = async function(id) {
    currentEditStudentId = id;
    document.getElementById('btn-submit-student').innerText = 'Update Member';
    document.querySelector('#modal-add-student h2').innerText = 'Edit Student Details';
    
    const { data: student, error } = await supabase.from('students').select('*').eq('id', id).single();
    if (error) return window.app?.alert("Could not fetch details.", "Error");

    document.getElementById('add-student-id').value = student.student_id;
    document.getElementById('add-student-name').value = student.name;
    document.getElementById('add-student-place').value = student.place || '';
    document.getElementById('portal-username').value = student.portal_username || '';
    
    if (student.department_id) {
        document.getElementById('add-student-dept').value = student.department_id;
        await loadClassesForDept(student.department_id);
    }
    if (student.class_id) document.getElementById('add-student-class').value = student.class_id;

    if (modalAddStudent) modalAddStudent.style.display = 'flex';
};

window.deleteStudent = function(id, name) {
    if (!window.app) return;
    window.app.confirm(`Delete "${name}"?`, "Delete Member", async () => {
        const { error } = await supabase.from('students').delete().eq('id', id);
        if (error) window.app.alert("Failed to delete student.", "Error");
        else fetchStudents();
    });
};

// --- 5. EVENTS & FORM SUBMISSION ---
let searchTimeout = null;
searchInput?.addEventListener('input', () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(applyFilters, 300); });
filterDept?.addEventListener('change', applyFilters);
filterStatus?.addEventListener('change', applyFilters);

btnPrev?.addEventListener('click', () => { if (state.page > 1) { state.page--; updateTable(); } });
btnNext?.addEventListener('click', () => { if (state.page * state.limit < state.filteredData.length) { state.page++; updateTable(); } });
rowsPerPageSelect?.addEventListener('change', (e) => { state.limit = parseInt(e.target.value); state.page = 1; updateTable(); });

const toggleModal = (show) => {
    if (!modalAddStudent) return;
    modalAddStudent.style.display = show ? 'flex' : 'none';
    if (!show) {
        formAddStudent?.reset();
        currentEditStudentId = null;
        const submitBtn = document.getElementById('btn-submit-student');
        const header = document.querySelector('#modal-add-student h2');
        if (submitBtn) submitBtn.innerText = 'Register Member';
        if (header) header.innerText = 'Register New Student';
        
        const photoPreview = document.getElementById('photo-preview');
        if (photoPreview) photoPreview.innerHTML = '<i data-lucide="camera" style="color: var(--text-secondary);"></i>';
        if (window.lucide) lucide.createIcons();
    }
};

btnAddStudent?.addEventListener('click', () => toggleModal(true));
btnCloseModal?.addEventListener('click', () => toggleModal(false));
btnCancelStudent?.addEventListener('click', () => toggleModal(false));

formAddStudent?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit-student');
    btnSubmit.innerText = 'Processing...';
    btnSubmit.disabled = true;

    const studentPayload = {
        name: document.getElementById('add-student-name').value.trim(),
        student_id: document.getElementById('add-student-id').value.trim(),
        place: document.getElementById('add-student-place').value.trim() || null,
        department_id: document.getElementById('add-student-dept').value || null,
        class_id: document.getElementById('add-student-class').value || null,
        portal_username: document.getElementById('portal-username').value.trim()
    };

    try {
        if (currentEditStudentId) {
            await supabase.from('students').update(studentPayload).eq('id', currentEditStudentId);
            window.app?.alert("Student updated successfully.", "Update Complete");
        } else {
            studentPayload.status = 'ACTIVE';
            await supabase.from('students').insert([studentPayload]);
            window.app?.alert("Student registered successfully!", "Registration Complete");
        }
        fetchStudents();
        toggleModal(false);
    } catch (err) {
        window.app?.alert("Failed to save student.", "Error");
    } finally {
        btnSubmit.innerText = 'Register Member';
        btnSubmit.disabled = false;
        currentEditStudentId = null;
    }
});

// --- INITIALIZE ---
document.addEventListener('DOMContentLoaded', () => {
    fetchStudents();
    loadDepartments();
});

// --- BULK IMPORT LOGIC (STUDENTS) ---
function initBulkImport() {
    const btnBulk = document.getElementById('btn-bulk-import');
    if (!btnBulk) return;

    const modalId = 'modal-bulk-students';
    const modalHTML = `
    <div id="${modalId}" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center; padding: 1rem;">
        <div class="card card-glass" style="width: 100%; max-width: 600px; position: relative;">
            <button onclick="document.getElementById('${modalId}').style.display='none'" style="position: absolute; right: 1rem; top: 1rem; background: transparent; border: none; cursor: pointer; color: var(--text-secondary);"><i data-lucide="x"></i></button>
            <h2 style="margin-bottom: 1rem;">Bulk Import Members</h2>
            <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1.5rem;">Download the template. Ensure 'Department' and 'Class' exactly match the names in your Master Data settings.</p>
            
            <button class="btn btn-outline" id="btn-download-template" style="margin-bottom: 1.5rem; width: 100%; justify-content: center;"><i data-lucide="download"></i> Download CSV Template</button>

            <div class="input-group">
                <label>Upload Filled CSV</label>
                <input type="file" id="file-upload-students" accept=".csv" style="padding: 0.5rem 0; width: 100%;">
            </div>

            <div style="margin-top: 2rem; display: flex; justify-content: flex-end; gap: 1rem;">
                <button class="btn btn-outline" onclick="document.getElementById('${modalId}').style.display='none'">Cancel</button>
                <button class="btn btn-primary" id="btn-process-bulk">Process Import</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    if (window.lucide) lucide.createIcons();

    btnBulk.addEventListener('click', () => {
        document.getElementById('file-upload-students').value = '';
        document.getElementById(modalId).style.display = 'flex';
    });

    document.getElementById('btn-download-template').addEventListener('click', () => {
        // Updated Template Headers
        const csvContent = "Register_No,Name,Location,Department,Class,Username\n";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "Students_Bulk_Template.csv";
        link.click();
    });

    document.getElementById('btn-process-bulk').addEventListener('click', async (e) => {
        const fileInput = document.getElementById('file-upload-students');
        if (!fileInput.files.length) return window.app?.alert("Please select a CSV file first.", "Error");
        
        const btn = e.target;
        btn.innerText = "Processing...";
        btn.disabled = true;

        try {
            // 1. Fetch Master Data for lookups
            const [{ data: depts }, { data: classes }] = await Promise.all([
                supabase.from('departments').select('id, name'),
                supabase.from('classes').select('id, name')
            ]);
            
            const deptMap = {}; if (depts) depts.forEach(d => deptMap[d.name.toLowerCase()] = d.id);
            const classMap = {}; if (classes) classes.forEach(c => classMap[c.name.toLowerCase()] = c.id);

            // 2. Parse CSV
            const reader = new FileReader();
            reader.onload = async (event) => {
                const lines = event.target.result.split('\n').filter(l => l.trim() !== '');
                if (lines.length < 2) throw new Error("The file is empty.");

                const headers = lines[0].split(',').map(h => h.trim());
                const payloads = [];

                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                    const row = headers.reduce((obj, header, index) => { obj[header] = values[index]; return obj; }, {});
                    
                    if (row.Register_No && row.Name) {
                        payloads.push({
                            student_id: row.Register_No,
                            name: row.Name,
                            place: row.Location || null,
                            department_id: row.Department ? (deptMap[row.Department.toLowerCase()] || null) : null,
                            class_id: row.Class ? (classMap[row.Class.toLowerCase()] || null) : null,
                            portal_username: row.Username || null,
                            status: 'ACTIVE'
                        });
                    }
                }

                if (!payloads.length) throw new Error("No valid data found in the CSV.");

                // 3. Insert Data
                const { error } = await supabase.from('students').insert(payloads);
                if (error) throw error;
                
                window.app?.alert(`Successfully imported ${payloads.length} members.`, "Import Complete");
                if (typeof fetchStudents === 'function') fetchStudents(); 
                document.getElementById(modalId).style.display = 'none';
            };
            reader.readAsText(fileInput.files[0]);
        } catch (err) {
            window.app?.alert(err.message || "Import failed. Ensure Register Numbers and Usernames are unique.", "Error");
        } finally {
            btn.innerText = "Process Import";
            btn.disabled = false;
        }
    });
}

document.addEventListener('DOMContentLoaded', initBulkImport);