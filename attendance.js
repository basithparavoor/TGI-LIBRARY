import { erp } from './erp_service.js';
import { hardware } from './hardware.js';
import { supabase } from './supabaseClient.js';

let activePeriodId = null;
let currentClassStudents = [];
let qrScanner = null;

// UI Elements
const sessionsContainer = document.getElementById('period-sessions-container');
const activeBadge = document.getElementById('active-periods-badge');
const periodTitle = document.getElementById('current-period-title');
const periodSubtitle = document.getElementById('current-period-subtitle');
const rosterActions = document.getElementById('roster-actions-bar');
const terminalRow = document.getElementById('terminal-input-row');
const rosterList = document.getElementById('attendance-roster-list');
const campusText = document.getElementById('attendance-campus-text');

// Modal Elements
const modalPeriod = document.getElementById('modal-period');
const btnStartPeriod = document.getElementById('btn-start-period');
const formPeriod = document.getElementById('form-period');

function getActiveCampusName() {
    const campusId = erp.getActiveCampusId();
    if (campusId === 'ALL') return 'Global Institutional View';
    const c = erp.getCampuses().find(item => item.id === campusId);
    return c ? c.name : 'Main Campus';
}

// 1. Render Periods List
function renderPeriodSessions() {
    const campusId = erp.getActiveCampusId();
    const periods = erp.getPeriodSessions(campusId);

    if (campusText) campusText.innerText = getActiveCampusName();
    if (activeBadge) activeBadge.innerText = `${periods.length} Sessions`;

    if (periods.length === 0) {
        sessionsContainer.innerHTML = `<div class="card card-glass" style="padding: 2.5rem 1rem; text-align: center; color: var(--text-muted);">No active period sessions scheduled for today. Click "Schedule / Start Period" to begin.</div>`;
        return;
    }

    sessionsContainer.innerHTML = periods.map(p => {
        const isSelected = p.id === activePeriodId;
        const isLibrary = p.facility_type === 'LIBRARY';
        const percent = p.total_students > 0 ? Math.round((p.present_count / p.total_students) * 100) : 0;

        return `
            <div class="card card-glass card-interactive" style="cursor: pointer; padding: 1.25rem; border-left: 4px solid ${isLibrary ? 'var(--brand-primary)' : 'var(--accent-violet)'}; ${isSelected ? 'background: rgba(59,130,246,0.08); border-color: var(--brand-primary);' : ''}" onclick="window.selectPeriodSession('${p.id}')">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 2px;">
                            <span class="badge ${isLibrary ? 'badge-brand' : 'badge-info'}" style="font-size: 0.65rem;">${p.facility_type.replace('_', ' ')}</span>
                            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">${p.class_name}</span>
                        </div>
                        <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin: 0;">${p.period_name}</h3>
                    </div>
                    <span class="badge ${p.status === 'ACTIVE' ? 'badge-success' : 'badge-brand'}" style="font-size: 0.65rem;">${p.status}</span>
                </div>

                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
                    Teacher: <strong>${p.teacher_name}</strong> • ${p.topic || 'Class Session'}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
                    <span style="color: var(--text-muted);">Attendance: <strong style="color: var(--text-primary);">${p.present_count || 0} / ${p.total_students || 0}</strong></span>
                    <span style="font-weight: 700; color: ${percent >= 75 ? 'var(--success)' : 'var(--danger)'};">${percent}% Present</span>
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

// 2. Select a Period and Load Class Roster
window.selectPeriodSession = async function(sessionId) {
    activePeriodId = sessionId;
    renderPeriodSessions();

    const period = erp.getPeriodSessions('ALL').find(p => p.id === sessionId);
    if (!period) return;

    periodTitle.innerText = `${period.class_name} - ${period.period_name}`;
    periodSubtitle.innerText = `Facility: ${period.facility_type.replace('_', ' ')} • In-Charge: ${period.teacher_name}`;
    rosterActions.style.display = 'flex';
    terminalRow.style.display = 'block';

    rosterList.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i data-lucide="loader-2" class="animate-spin"></i> Loading class roster...</div>`;
    if (window.lucide) lucide.createIcons();

    // Fetch students from Supabase or ERP directory
    try {
        const { data: students } = await supabase
            .from('students')
            .select('id, name, student_id, place')
            .limit(50);

        currentClassStudents = (students && students.length > 0) ? students : [
            { id: 'st-1', name: 'Alexander Pierce', student_id: 'REG-2026-001' },
            { id: 'st-2', name: 'Sophia Bennett', student_id: 'REG-2026-002' },
            { id: 'st-3', name: 'Liam Zhang', student_id: 'REG-2026-003' },
            { id: 'st-4', name: 'Aarav Patel', student_id: 'REG-2026-004' },
            { id: 'st-5', name: 'Emma Watson', student_id: 'REG-2026-005' }
        ];

        renderRosterList();
    } catch (e) {
        renderRosterList();
    }
};

function renderRosterList() {
    if (!activePeriodId) return;
    const existingAttendance = erp.getPeriodAttendance(activePeriodId);
    const attendanceMap = new Map();
    existingAttendance.forEach(a => attendanceMap.set(a.student_id, a));

    rosterList.innerHTML = currentClassStudents.map(st => {
        const record = attendanceMap.get(st.student_id);
        const currentStatus = record ? record.status : 'ABSENT';
        const checkinMethod = record ? record.checkin_method : '';

        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); gap: 0.75rem;">
                <div>
                    <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">${st.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">${st.student_id} ${checkinMethod ? '• ' + checkinMethod : ''}</div>
                </div>

                <div style="display: flex; gap: 0.35rem;">
                    <button class="btn btn-sm ${currentStatus === 'PRESENT' ? 'btn-success' : 'btn-outline'}" onclick="window.setStudentStatus('${st.student_id}', '${st.name.replace(/'/g, "\\'")}', 'PRESENT')">
                        <i data-lucide="check" style="width: 12px;"></i> Present
                    </button>
                    <button class="btn btn-sm ${currentStatus === 'LATE' ? 'btn-warning' : 'btn-outline'}" onclick="window.setStudentStatus('${st.student_id}', '${st.name.replace(/'/g, "\\'")}', 'LATE')">
                        Late
                    </button>
                    <button class="btn btn-sm ${currentStatus === 'ABSENT' ? 'btn-danger' : 'btn-outline'}" onclick="window.setStudentStatus('${st.student_id}', '${st.name.replace(/'/g, "\\'")}', 'ABSENT')">
                        Absent
                    </button>
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

window.setStudentStatus = function(studentId, studentName, status, method = 'MANUAL') {
    if (!activePeriodId) return;
    erp.recordStudentAttendance(activePeriodId, studentId, studentName, status, method);
    if (status === 'PRESENT' && window.app?.playBeep) window.app.playBeep('scan');
    renderRosterList();
    renderPeriodSessions();
};

// Mark Single via Input
document.getElementById('btn-mark-single-present')?.addEventListener('click', () => {
    const input = document.getElementById('attendance-student-input');
    const studentId = input.value.trim();
    if (!studentId || !activePeriodId) return;

    const student = currentClassStudents.find(s => s.student_id.toLowerCase() === studentId.toLowerCase() || s.name.toLowerCase().includes(studentId.toLowerCase()));
    const name = student ? student.name : studentId;

    window.setStudentStatus(studentId, name, 'PRESENT', 'TERMINAL');
    window.app.toast(`Marked ${name} as PRESENT.`, "success", "Attendance Logged");
    input.value = '';
});

document.getElementById('attendance-student-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-mark-single-present').click();
});

// Mark All Present
document.getElementById('btn-mark-all-present')?.addEventListener('click', () => {
    if (!activePeriodId) return;
    currentClassStudents.forEach(st => {
        erp.recordStudentAttendance(activePeriodId, st.student_id, st.name, 'PRESENT', 'ROSTER_BULK');
    });
    window.app.toast("Marked all students as PRESENT for this period.", "success", "Roster Updated");
    renderRosterList();
    renderPeriodSessions();
});

// NFC Tap Attendance
document.getElementById('btn-nfc-attendance')?.addEventListener('click', async () => {
    if (!activePeriodId) return window.app.toast("Please select an active class period first.", "warning", "Select Period");
    window.app.toast("Hold student NFC smartcard near terminal...", "info", "NFC Attendance Ready", 3000);

    await hardware.startNfcScan(
        (payload) => {
            const student = currentClassStudents.find(s => s.student_id === payload || s.name.toLowerCase().includes(payload.toLowerCase()));
            const name = student ? student.name : payload;
            window.setStudentStatus(payload, name, 'PRESENT', 'NFC');
            window.app.toast(`NFC Verified: ${name} marked PRESENT.`, "success", "Smartcard Attendance");
        },
        (err) => {
            window.app.toast(err.message, "warning", "NFC Notice");
        }
    );
});

// Camera Scanner Attendance
document.getElementById('btn-camera-attendance')?.addEventListener('click', () => {
    if (!activePeriodId) return window.app.toast("Please select an active class period first.", "warning", "Select Period");
    const modal = document.getElementById('att-scanner-modal');
    modal.classList.add('active');

    if (!qrScanner) {
        qrScanner = new Html5QrcodeScanner("att-reader", { fps: 10, qrbox: { width: 240, height: 120 } }, false);
    }
    qrScanner.render((text) => {
        const student = currentClassStudents.find(s => s.student_id === text || s.name.toLowerCase().includes(text.toLowerCase()));
        const name = student ? student.name : text;
        window.setStudentStatus(text, name, 'PRESENT', 'QR');
        window.app.toast(`QR Verified: ${name} marked PRESENT.`, "success", "QR Attendance");
        modal.classList.remove('active');
        qrScanner.clear().catch(e => {});
    });
});

// Start Period Modal
btnStartPeriod?.addEventListener('click', () => modalPeriod.classList.add('active'));
modalPeriod?.querySelectorAll('.close-period-modal').forEach(b => b.addEventListener('click', () => modalPeriod.classList.remove('active')));

formPeriod?.addEventListener('submit', (e) => {
    e.preventDefault();
    const newPeriod = {
        facility_type: document.getElementById('period-facility').value,
        period_name: document.getElementById('period-slot-name').value.trim(),
        department_name: document.getElementById('period-dept').value,
        class_name: document.getElementById('period-class').value.trim(),
        teacher_name: document.getElementById('period-teacher').value.trim(),
        topic: document.getElementById('period-topic').value.trim() || 'Class Study',
        total_students: 45,
        present_count: 0
    };

    const saved = erp.createPeriodSession(newPeriod);
    window.app.toast(`Started period: ${saved.period_name} for ${saved.class_name}.`, "success", "Period Launched");
    modalPeriod.classList.remove('active');
    formPeriod.reset();
    renderPeriodSessions();
    window.selectPeriodSession(saved.id);
});

window.addEventListener('campusChanged', () => {
    activePeriodId = null;
    renderPeriodSessions();
});

document.addEventListener('DOMContentLoaded', () => {
    renderPeriodSessions();
    const periods = erp.getPeriodSessions(erp.getActiveCampusId());
    if (periods.length > 0) {
        window.selectPeriodSession(periods[0].id);
    }
});
