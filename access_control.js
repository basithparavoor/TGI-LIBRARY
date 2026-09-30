// access_control.js - Role-Based Access Control (RBAC) Governance Matrix
import { erp } from './erp_service.js';
import { showToast, playAudioChime } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    renderRbacMatrix();
    setupEventListeners();
});

const ROLE_LABELS = {
    'SUPER_ADMIN': { title: 'Super Administrator', badge: 'ROOT', color: 'var(--brand-primary)' },
    'INSTITUTION_HEAD': { title: 'Institution Chancellor / Head', badge: 'EXECUTIVE', color: 'var(--brand-accent)' },
    'CAMPUS_HEAD': { title: 'Campus Head / Dean', badge: 'DEAN', color: 'var(--color-warning)' },
    'TEACHER': { title: 'Professor / Teacher', badge: 'FACULTY', color: 'var(--color-success)' },
    'LIBRARIAN': { title: 'Librarian & Officers', badge: 'OFFICER', color: 'var(--brand-primary)' },
    'LAB_ADMIN': { title: 'Computer Lab Administrator', badge: 'ADMIN', color: 'var(--brand-accent)' },
    'EVENT_CONDUCTOR': { title: 'Event Hall Conductor', badge: 'CONDUCTOR', color: 'var(--color-warning)' },
    'STUDENT': { title: 'Student Member', badge: 'PATRON', color: 'var(--text-muted)' }
};

const PERMISSION_COLUMNS = [
    { key: 'can_view_all_campuses', label: 'All Campuses' },
    { key: 'can_manage_catalog', label: 'Book Catalog' },
    { key: 'can_manage_circulation', label: 'Circulation' },
    { key: 'can_manage_labs', label: 'Lab Tracker' },
    { key: 'can_take_attendance', label: 'Periods & Attendance' },
    { key: 'can_manage_events', label: 'Event Halls' },
    { key: 'can_approve_requests', label: 'Approvals' },
    { key: 'can_access_reports', label: 'Reports' }
];

function renderRbacMatrix() {
    const permissions = erp.getPermissions();
    const tbody = document.getElementById('rbac-tbody');

    document.getElementById('kpi-total-roles').innerText = permissions.length;

    tbody.innerHTML = permissions.map(p => {
        const meta = ROLE_LABELS[p.role] || { title: p.role, badge: 'ROLE', color: 'var(--text-muted)' };
        const isSuperAdmin = p.role === 'SUPER_ADMIN';

        const checkToggles = PERMISSION_COLUMNS.map(col => {
            const isChecked = isSuperAdmin ? true : !!p[col.key];
            const disabledAttr = isSuperAdmin ? 'disabled' : '';

            return `
                <td style="text-align: center;">
                    <label style="display: inline-flex; align-items: center; cursor: ${isSuperAdmin ? 'not-allowed' : 'pointer'};">
                        <input type="checkbox" class="rbac-toggle" data-role="${p.role}" data-key="${col.key}" ${isChecked ? 'checked' : ''} ${disabledAttr} style="width: 18px; height: 18px; accent-color: var(--brand-primary); cursor: pointer;">
                    </label>
                </td>
            `;
        }).join('');

        return `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="badge" style="background: rgba(59, 130, 246, 0.1); color: ${meta.color}; font-size: 0.65rem; font-weight: 800;">${meta.badge}</span>
                        <div>
                            <div style="font-weight: 700; color: var(--text-primary); font-size: 0.9rem;">${meta.title}</div>
                            <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted);">${p.role}</div>
                        </div>
                    </div>
                </td>
                ${checkToggles}
            </tr>
        `;
    }).join('');

    // Attach checkbox changes
    tbody.querySelectorAll('.rbac-toggle:not(:disabled)').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const role = e.target.dataset.role;
            const key = e.target.dataset.key;
            const value = e.target.checked;
            erp.updatePermission(role, key, value);
            playAudioChime('TAP');
            showToast(`Updated permission "${key}" for ${role}`, 'info');
        });
    });

    if (window.lucide) lucide.createIcons();
}

function setupEventListeners() {
    document.getElementById('btn-save-rbac')?.addEventListener('click', () => {
        playAudioChime('SUCCESS');
        showToast('RBAC Security Matrix successfully applied and enforced!', 'success');
    });

    document.getElementById('btn-reset-rbac')?.addEventListener('click', () => {
        if (confirm('Reset RBAC matrix back to default institutional policy?')) {
            localStorage.removeItem('erp_permissions');
            window.location.reload();
        }
    });
}
