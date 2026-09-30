import { supabase } from './supabaseClient.js';
import { erp } from './erp_service.js';
import { hardware } from './hardware.js';

// Global UI state
let cmdOverlay = null;
let cmdInput = null;
let cmdResults = null;
let activePaletteIndex = -1;

// --- AUDIO SYNTHESIS FEEDBACK ---
function playSynthSound(type = 'success') {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        if (type === 'success' || type === 'scan') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        } else if (type === 'error') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.25);
        }
    } catch (e) {}
}

// --- THEME MANAGEMENT ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: newTheme } }));
}

function updateThemeIcon(theme) {
    const iconBtn = document.getElementById('theme-toggle');
    if (iconBtn && window.lucide) {
        iconBtn.innerHTML = `<i data-lucide="${theme === 'light' ? 'moon' : 'sun'}" style="width: 16px; height: 16px;"></i>`;
        lucide.createIcons();
    }
}

// --- LIVE CLOCK ---
function startLiveClock() {
    const clockEl = document.getElementById('topbar-clock');
    if (!clockEl) return;
    const updateTime = () => {
        const now = new Date();
        clockEl.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    updateTime();
    setInterval(updateTime, 1000);
}

// --- COMMAND PALETTE LOGIC ---
window.toggleCommandPalette = function() {
    if (!cmdOverlay) {
        cmdOverlay = document.getElementById('command-overlay');
        cmdInput = document.getElementById('global-search-input');
        cmdResults = document.getElementById('command-results');
    }
    if (!cmdOverlay) return;

    if (cmdOverlay.style.display === 'none' || !cmdOverlay.style.display) {
        cmdOverlay.style.display = 'flex';
        cmdOverlay.classList.add('animate-fade-in');
        if (cmdInput) {
            cmdInput.value = '';
            setTimeout(() => cmdInput.focus(), 50);
        }
        activePaletteIndex = -1;
        renderDefaultPaletteItems();
    } else {
        cmdOverlay.style.display = 'none';
    }
};

function renderDefaultPaletteItems() {
    if (!cmdResults) return;
    cmdResults.innerHTML = `
        <div style="padding: 0.5rem 1rem; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Institutional Modules</div>
        <div class="cmd-item" onclick="window.location.href='index.html'"><i data-lucide="layout-dashboard"></i> <div><div style="font-weight: 600;">ERP Dashboard</div><div style="font-size: 0.75rem; color: var(--text-secondary);">Multi-campus institutional overview & live metrics</div></div></div>
        <div class="cmd-item" onclick="window.location.href='circulation.html'"><i data-lucide="repeat"></i> <div><div style="font-weight: 600;">Circulation Desk</div><div style="font-size: 0.75rem; color: var(--text-secondary);">NFC, QR, Barcode check-out & check-in</div></div></div>
        <div class="cmd-item" onclick="window.location.href='computers.html'"><i data-lucide="monitor"></i> <div><div style="font-weight: 600;">Computer Lab Workstation Tracker</div><div style="font-size: 0.75rem; color: var(--text-secondary);">Machine codes, user time analytics (day/week/month)</div></div></div>
        <div class="cmd-item" onclick="window.location.href='attendance.html'"><i data-lucide="calendar-check"></i> <div><div style="font-weight: 600;">Class Period & Lab Attendance</div><div style="font-size: 0.75rem; color: var(--text-secondary);">Teacher roll call & smart NFC period check-in</div></div></div>
        <div class="cmd-item" onclick="window.location.href='events.html'"><i data-lucide="ticket"></i> <div><div style="font-weight: 600;">Event Halls & Auditorium Bookings</div><div style="font-size: 0.75rem; color: var(--text-secondary);">Schedule events, conductor tickets & attendee scanner</div></div></div>
        <div class="cmd-item" onclick="window.location.href='campus_portal.html'"><i data-lucide="shield-check"></i> <div><div style="font-weight: 600;">Campus Heads & Dean Portal</div><div style="font-size: 0.75rem; color: var(--text-secondary);">Facility requests, approvals & executive oversight</div></div></div>
        <div class="cmd-item" onclick="window.location.href='reports.html'"><i data-lucide="bar-chart-3"></i> <div><div style="font-weight: 600;">Dynamic Report Engine</div><div style="font-size: 0.75rem; color: var(--text-secondary);">Cross-campus analytics, computer logs, attendance & PDF export</div></div></div>
        <div class="cmd-item" onclick="window.location.href='access_control.html'"><i data-lucide="lock"></i> <div><div style="font-weight: 600;">Access Control & RBAC Matrix</div><div style="font-size: 0.75rem; color: var(--text-secondary);">Manage granular role permissions and data governance</div></div></div>
    `;
    if (window.lucide) lucide.createIcons();
}

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        window.toggleCommandPalette();
    }
    if (e.key === 'Escape' && cmdOverlay && cmdOverlay.style.display === 'flex') {
        window.toggleCommandPalette();
    }
});

let searchTimeout = null;
function setupPaletteSearch() {
    if (!cmdInput) return;
    cmdInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        if (query.length < 2) {
            renderDefaultPaletteItems();
            return;
        }
        searchTimeout = setTimeout(() => performGlobalSearch(query), 250);
    });
}

async function performGlobalSearch(query) {
    if (!cmdResults) return;
    cmdResults.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-secondary);"><i data-lucide="loader-2" class="animate-spin" style="width: 24px; height: 24px; margin-bottom: 0.5rem;"></i><div>Searching records across all modules...</div></div>`;
    if (window.lucide) lucide.createIcons();

    try {
        const [booksRes, studentsRes] = await Promise.all([
            supabase.from('books').select('id, title, author, isbn').or(`title.ilike.%${query}%,author.ilike.%${query}%,isbn.ilike.%${query}%`).limit(3),
            supabase.from('students').select('id, name, student_id, place').or(`name.ilike.%${query}%,student_id.ilike.%${query}%`).limit(3)
        ]);

        const computers = erp.getComputers('ALL').filter(c => c.machine_code.toLowerCase().includes(query.toLowerCase()) || c.lab_name.toLowerCase().includes(query.toLowerCase())).slice(0, 3);
        const events = erp.getEvents('ALL').filter(e => e.title.toLowerCase().includes(query.toLowerCase()) || e.hall_name?.toLowerCase().includes(query.toLowerCase())).slice(0, 3);

        let html = '';
        if (booksRes.data && booksRes.data.length > 0) {
            html += `<div style="padding: 0.5rem 1rem; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Books</div>`;
            booksRes.data.forEach(book => {
                html += `
                    <div class="cmd-item" onclick="window.location.href='books.html?search=${encodeURIComponent(book.title)}'">
                        <i data-lucide="book"></i>
                        <div style="flex: 1;"><div style="font-weight: 600; color: var(--text-primary);">${book.title}</div><div style="font-size: 0.75rem; color: var(--text-secondary);">${book.author}</div></div>
                        <span class="badge badge-brand" style="font-size: 0.65rem;">Book</span>
                    </div>`;
            });
        }

        if (studentsRes.data && studentsRes.data.length > 0) {
            html += `<div style="padding: 0.5rem 1rem; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Students & Members</div>`;
            studentsRes.data.forEach(student => {
                html += `
                    <div class="cmd-item" onclick="window.location.href='students.html?search=${encodeURIComponent(student.name)}'">
                        <i data-lucide="user"></i>
                        <div style="flex: 1;"><div style="font-weight: 600; color: var(--text-primary);">${student.name}</div><div style="font-size: 0.75rem; color: var(--text-secondary);">ID: ${student.student_id}</div></div>
                        <span class="badge badge-success" style="font-size: 0.65rem;">Member</span>
                    </div>`;
            });
        }

        if (computers.length > 0) {
            html += `<div style="padding: 0.5rem 1rem; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Lab Workstations</div>`;
            computers.forEach(comp => {
                html += `
                    <div class="cmd-item" onclick="window.location.href='computers.html'">
                        <i data-lucide="monitor"></i>
                        <div style="flex: 1;"><div style="font-weight: 600; color: var(--text-primary);">${comp.machine_code} (${comp.lab_name})</div><div style="font-size: 0.75rem; color: var(--text-secondary);">${comp.specs}</div></div>
                        <span class="badge ${comp.status === 'AVAILABLE' ? 'badge-success' : 'badge-warning'}" style="font-size: 0.65rem;">${comp.status}</span>
                    </div>`;
            });
        }

        if (events.length > 0) {
            html += `<div style="padding: 0.5rem 1rem; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Events & Halls</div>`;
            events.forEach(ev => {
                html += `
                    <div class="cmd-item" onclick="window.location.href='events.html'">
                        <i data-lucide="ticket"></i>
                        <div style="flex: 1;"><div style="font-weight: 600; color: var(--text-primary);">${ev.title}</div><div style="font-size: 0.75rem; color: var(--text-secondary);">${ev.hall_name}</div></div>
                        <span class="badge badge-brand" style="font-size: 0.65rem;">Event</span>
                    </div>`;
            });
        }

        if (!html) {
            html = `<div style="padding: 2.5rem 1rem; text-align: center; color: var(--text-secondary);">No records found for "<strong>${query}</strong>"</div>`;
        }

        cmdResults.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    } catch (error) {
        cmdResults.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--danger);">Search error occurred.</div>`;
    }
}

// --- GLOBAL FLOATING TOASTS & DIALOGS ---
let toastContainer = null;
function ensureToastContainer() {
    if (!toastContainer) {
        toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            document.body.appendChild(toastContainer);
        }
    }
    return toastContainer;
}

window.app = {
    playBeep: playSynthSound,

    toast: function(message, type = 'info', title = '', duration = 4000) {
        const container = ensureToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const typeMap = {
            success: { icon: 'check-circle-2', color: 'var(--success)', defaultTitle: 'Success' },
            error: { icon: 'alert-circle', color: 'var(--danger)', defaultTitle: 'Error' },
            warning: { icon: 'alert-triangle', color: 'var(--warning)', defaultTitle: 'Warning' },
            info: { icon: 'info', color: 'var(--brand-primary)', defaultTitle: 'Notice' }
        };

        const config = typeMap[type] || typeMap.info;
        toast.style.setProperty('--toast-color', config.color);
        playSynthSound(type === 'error' ? 'error' : 'success');

        toast.innerHTML = `
            <i data-lucide="${config.icon}" class="toast-icon"></i>
            <div class="toast-content">
                <div class="toast-title">${title || config.defaultTitle}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close"><i data-lucide="x" style="width: 14px; height: 14px;"></i></button>
        `;

        container.appendChild(toast);
        if (window.lucide) lucide.createIcons();

        const dismiss = () => {
            toast.classList.add('toast-hiding');
            setTimeout(() => toast.remove(), 300);
        };

        toast.querySelector('.toast-close')?.addEventListener('click', dismiss);
        if (duration > 0) setTimeout(dismiss, duration);
    },

    alert: function(message, title = 'Notice') {
        window.app.toast(message, 'info', title);
    },

    confirm: function(message, title = 'Confirmation', onConfirm, onCancel) {
        const overlay = document.createElement('div');
        overlay.className = 'app-dialog-overlay';

        overlay.innerHTML = `
            <div class="app-dialog">
                <div class="app-dialog-header">${title}</div>
                <div class="app-dialog-message">${message}</div>
                <div class="app-dialog-actions">
                    <button class="btn btn-outline cancel-btn">Cancel</button>
                    <button class="btn btn-primary confirm-btn">Confirm</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add('active'), 10);

        const close = () => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
        };

        overlay.querySelector('.confirm-btn')?.addEventListener('click', () => { close(); if (onConfirm) onConfirm(); });
        overlay.querySelector('.cancel-btn')?.addEventListener('click', () => { close(); if (onCancel) onCancel(); });
    },

    prompt: function(message, title = 'Input Required', onConfirm) {
        const overlay = document.createElement('div');
        overlay.className = 'app-dialog-overlay';

        overlay.innerHTML = `
            <div class="app-dialog">
                <div class="app-dialog-header">${title}</div>
                <div class="app-dialog-message">${message}</div>
                <input type="text" class="app-dialog-input" style="padding: 0.75rem 1rem; width: 100%; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-muted); color: var(--text-primary); outline: none; margin-bottom: 1.5rem; font-size: 0.95rem;">
                <div class="app-dialog-actions">
                    <button class="btn btn-outline cancel-btn">Cancel</button>
                    <button class="btn btn-primary confirm-btn">Submit</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add('active'), 10);

        const input = overlay.querySelector('.app-dialog-input');
        input?.focus();

        const close = () => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
        };

        const submit = () => {
            const val = input.value;
            close();
            if (onConfirm) onConfirm(val);
        };

        overlay.querySelector('.confirm-btn')?.addEventListener('click', submit);
        input?.addEventListener('keypress', (e) => { if (e.key === 'Enter') submit(); });
        overlay.querySelector('.cancel-btn')?.addEventListener('click', close);
    }
};

// --- PRINT ID CARD MODAL UTILITY (STUDENT & STAFF) ---
window.printLibraryCard = function(name, idNumber, roleOrClass = 'Member', nfcTag = '', qrPayload = '') {
    let modal = document.getElementById('modal-id-card-print');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-id-card-print';
        modal.className = 'app-dialog-overlay';
        document.body.appendChild(modal);
    }

    const qrData = qrPayload || idNumber;

    modal.innerHTML = `
        <div class="app-dialog" style="max-width: 440px; display: flex; flex-direction: column; align-items: center; text-align: center;">
            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700;">Institutional Smart Card</h3>
                <button class="btn btn-ghost btn-icon close-id-card"><i data-lucide="x" style="width: 18px; height: 18px;"></i></button>
            </div>

            <!-- Authentic Smart Card -->
            <div id="printable-card-container" style="padding: 10px; background: transparent;">
                <div class="id-card-preview" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 14px; border: 1px solid rgba(255,255,255,0.2); width: 340px; height: 215px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.4); color: white; position: relative;">
                    <!-- Card Top -->
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 24px; height: 24px; border-radius: 6px; background: #3b82f6; display: flex; align-items: center; justify-content: center;">
                                <i data-lucide="building-2" style="width: 14px; height: 14px; color: white;"></i>
                            </div>
                            <span style="font-weight: 800; font-size: 0.85rem; letter-spacing: 0.5px;">TGI INSTITUTION</span>
                        </div>
                        <div style="display: flex; gap: 4px; align-items: center;">
                            <span style="font-size: 0.6rem; font-weight: 700; background: rgba(59,130,246,0.3); color: #93c5fd; padding: 2px 6px; border-radius: 4px;">NFC SMART</span>
                        </div>
                    </div>

                    <!-- Card Body -->
                    <div style="display: flex; gap: 12px; align-items: center; margin: 4px 0;">
                        <div style="width: 54px; height: 54px; border-radius: 50%; background: #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 1.35rem; font-weight: 800; color: white; border: 2px solid rgba(255,255,255,0.4); flex-shrink: 0;">
                            ${name.charAt(0).toUpperCase()}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 800; font-size: 0.95rem; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div>
                            <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 2px;">ID: <span style="font-family: monospace; color: #e2e8f0; font-weight: 700;">${idNumber}</span></div>
                            <div style="font-size: 0.7rem; color: #60a5fa; font-weight: 600;">${roleOrClass}</div>
                        </div>
                        <div style="width: 44px; height: 44px; background: white; padding: 2px; border-radius: 4px; flex-shrink: 0;">
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(qrData)}" alt="QR" style="width: 100%; height: 100%;">
                        </div>
                    </div>

                    <!-- Card Bottom Barcode -->
                    <div style="background: white; border-radius: 6px; padding: 3px; display: flex; justify-content: center; align-items: center;">
                        <svg id="id-card-barcode-svg" style="width: 100%; height: 32px;"></svg>
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 0.75rem; width: 100%; margin-top: 1.25rem;">
                <button class="btn btn-outline" style="flex: 1;" onclick="document.getElementById('modal-id-card-print').classList.remove('active')">Close</button>
                <button class="btn btn-primary" style="flex: 1;" onclick="window.print()"><i data-lucide="printer" style="width: 16px;"></i> Print Smartcard</button>
            </div>
        </div>
    `;

    modal.classList.add('active');
    if (window.lucide) lucide.createIcons();

    modal.querySelector('.close-id-card')?.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    if (window.JsBarcode) {
        JsBarcode("#id-card-barcode-svg", idNumber, {
            format: "CODE128",
            width: 1.4,
            height: 28,
            displayValue: false,
            margin: 0
        });
    }
};

// --- APP INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    startLiveClock();

    // 1. Mobile Overlay
    let mobileOverlay = document.getElementById('mobile-sidebar-overlay');
    if (!mobileOverlay) {
        mobileOverlay = document.createElement('div');
        mobileOverlay.id = 'mobile-sidebar-overlay';
        document.body.appendChild(mobileOverlay);
    }

    // 2. Inject Sidebar
    const sidebarContainer = document.getElementById('sidebar-container');
    if (sidebarContainer) {
        try {
            const res = await fetch('sidebar.html');
            if (res.ok) {
                sidebarContainer.innerHTML = await res.text();
                const currentPath = window.location.pathname.split('/').pop() || 'index.html';
                sidebarContainer.querySelectorAll('.nav-item').forEach(item => {
                    if (item.getAttribute('href') === currentPath) item.classList.add('active');
                });
            }
        } catch (e) {
            console.warn("Could not load sidebar.html", e);
        }
    }

    // 3. Inject Topbar
    const topbarContainer = document.getElementById('topbar-container');
    if (topbarContainer) {
        try {
            const res = await fetch('topbar.html');
            if (res.ok) {
                topbarContainer.innerHTML = await res.text();
                
                // Campus Switcher Selector
                const campusSelect = document.getElementById('topbar-campus-select');
                if (campusSelect) {
                    campusSelect.value = erp.getActiveCampusId();
                    campusSelect.addEventListener('change', (e) => {
                        erp.setActiveCampusId(e.target.value);
                        window.app.toast(`Switched active view to: ${e.target.options[e.target.selectedIndex].text}`, "info", "Campus Changed", 2500);
                    });
                }

                // NFC Scan Topbar Button
                document.getElementById('btn-nfc-tap-topbar')?.addEventListener('click', async () => {
                    window.app.toast("Scanning for NFC Smartcards / Badges...", "info", "NFC Reader Active", 3000);
                    await hardware.startNfcScan(
                        (payload) => {
                            window.app.toast(`NFC Badge Identified: ${payload}`, "success", "NFC Authenticated");
                        },
                        (err) => {
                            window.app.toast(err.message, "warning", "NFC Terminal");
                        }
                    );
                });

                // Mobile Menu Toggle
                const menuBtn = document.getElementById('mobile-menu-btn');
                menuBtn?.addEventListener('click', () => {
                    sidebarContainer?.classList.add('open');
                    mobileOverlay?.classList.add('active');
                });

                mobileOverlay?.addEventListener('click', () => {
                    sidebarContainer?.classList.remove('open');
                    mobileOverlay?.classList.remove('active');
                });

                // Theme Toggle
                document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

                // Logout
                document.getElementById('logout-btn')?.addEventListener('click', async () => {
                    window.app.confirm("Are you sure you want to sign out?", "Sign Out", async () => {
                        await supabase.auth.signOut();
                        window.location.href = 'login.html';
                    });
                });
            }
        } catch (e) {
            console.warn("Could not load topbar.html", e);
        }
    }

    // 4. Command Palette bindings
    cmdOverlay = document.getElementById('command-overlay');
    cmdInput = document.getElementById('global-search-input');
    cmdResults = document.getElementById('command-results');
    
    cmdOverlay?.addEventListener('click', (e) => {
        if (e.target === cmdOverlay) window.toggleCommandPalette();
    });

    setupPaletteSearch();

    // 5. Initialize Notification Center & Messenger Widget
    initNotificationDrawer();
    initMessengerWidget();

    if (window.lucide) lucide.createIcons();
});

// ==========================================================================
// NOTIFICATION CENTER SYSTEM
// ==========================================================================
let notifBackdrop = null;
let notifDrawer = null;
let activeNotifFilter = 'ALL';

function initNotificationDrawer() {
    // 1. Create Drawer Elements
    notifBackdrop = document.createElement('div');
    notifBackdrop.className = 'notification-drawer-backdrop';
    notifBackdrop.id = 'notif-backdrop';

    notifDrawer = document.createElement('div');
    notifDrawer.className = 'notification-drawer';
    notifDrawer.id = 'notif-drawer';

    notifDrawer.innerHTML = `
        <!-- Drawer Header -->
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface);">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(59,130,246,0.1); color: var(--brand-primary); display: flex; align-items: center; justify-content: center;">
                    <i data-lucide="bell" style="width: 16px; height: 16px;"></i>
                </div>
                <div>
                    <h3 style="font-size: 1.05rem; font-weight: 800; margin: 0; color: var(--text-primary);">Notifications</h3>
                    <div style="font-size: 0.72rem; color: var(--text-muted);" id="notif-unread-status">0 unread alerts</div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.35rem;">
                <button class="btn btn-ghost btn-icon" id="btn-broadcast-notif" title="Broadcast Announcement (Admin)" style="color: var(--brand-primary); padding: 0.3rem;">
                    <i data-lucide="megaphone" style="width: 16px; height: 16px;"></i>
                </button>
                <button class="btn btn-ghost btn-icon" id="btn-mark-all-read" title="Mark All Read" style="padding: 0.3rem;">
                    <i data-lucide="check-check" style="width: 16px; height: 16px;"></i>
                </button>
                <button class="btn btn-ghost btn-icon" id="btn-close-notif" style="padding: 0.3rem;">
                    <i data-lucide="x" style="width: 18px; height: 18px;"></i>
                </button>
            </div>
        </div>

        <!-- Filter Tabs -->
        <div style="display: flex; gap: 0.25rem; padding: 0.65rem 1rem; border-bottom: 1px solid var(--border-color); background: var(--bg-muted); overflow-x: auto;">
            <button class="notif-tab btn btn-primary btn-sm" data-filter="ALL" style="padding: 0.25rem 0.65rem; font-size: 0.72rem; border-radius: var(--radius-full);">All</button>
            <button class="notif-tab btn btn-outline btn-sm" data-filter="APPROVAL" style="padding: 0.25rem 0.65rem; font-size: 0.72rem; border-radius: var(--radius-full);">Approvals</button>
            <button class="notif-tab btn btn-outline btn-sm" data-filter="OVERDUE" style="padding: 0.25rem 0.65rem; font-size: 0.72rem; border-radius: var(--radius-full);">Overdues</button>
            <button class="notif-tab btn btn-outline btn-sm" data-filter="EVENT" style="padding: 0.25rem 0.65rem; font-size: 0.72rem; border-radius: var(--radius-full);">Events</button>
            <button class="notif-tab btn btn-outline btn-sm" data-filter="BROADCAST" style="padding: 0.25rem 0.65rem; font-size: 0.72rem; border-radius: var(--radius-full);">Broadcasts</button>
        </div>

        <!-- Notification Items List -->
        <div id="notif-items-list" style="flex: 1; overflow-y: auto;">
            <!-- Injected dynamically -->
        </div>

        <!-- Drawer Footer -->
        <div style="padding: 0.75rem 1.25rem; border-top: 1px solid var(--border-color); background: var(--bg-surface); display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-muted);">
            <span>TGI ERP Push Alerts</span>
            <span style="color: var(--color-success); font-weight: 700;">● Active</span>
        </div>
    `;

    document.body.appendChild(notifBackdrop);
    document.body.appendChild(notifDrawer);

    // Event listeners
    document.getElementById('btn-notifications-topbar')?.addEventListener('click', window.toggleNotifications);
    document.getElementById('btn-close-notif')?.addEventListener('click', window.toggleNotifications);
    notifBackdrop.addEventListener('click', window.toggleNotifications);

    document.getElementById('btn-mark-all-read')?.addEventListener('click', () => {
        erp.markAllNotificationsRead();
        renderNotificationItems();
        updateNotificationBadges();
        playSynthSound('success');
    });

    document.getElementById('btn-broadcast-notif')?.addEventListener('click', () => {
        const title = prompt('Broadcast Title:');
        if (!title) return;
        const msg = prompt('Broadcast Announcement Message:');
        if (!msg) return;

        erp.createNotification({
            title: title.trim(),
            message: msg.trim(),
            type: 'BROADCAST',
            campus_id: 'ALL'
        });

        playSynthSound('success');
        window.app.toast('Institutional broadcast announcement transmitted!', 'success', 'Broadcast Sent');
        renderNotificationItems();
        updateNotificationBadges();
    });

    // Tab Filters
    notifDrawer.querySelectorAll('.notif-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            notifDrawer.querySelectorAll('.notif-tab').forEach(t => {
                t.className = 'notif-tab btn btn-outline btn-sm';
                t.style.padding = '0.25rem 0.65rem';
                t.style.fontSize = '0.72rem';
                t.style.borderRadius = 'var(--radius-full)';
            });
            tab.className = 'notif-tab btn btn-primary btn-sm';
            tab.style.padding = '0.25rem 0.65rem';
            tab.style.fontSize = '0.72rem';
            tab.style.borderRadius = 'var(--radius-full)';
            activeNotifFilter = tab.dataset.filter;
            renderNotificationItems();
        });
    });

    // Global event listener for incoming notifications
    window.addEventListener('notificationReceived', () => {
        updateNotificationBadges();
        if (notifDrawer.classList.contains('active')) renderNotificationItems();
    });

    window.addEventListener('notificationsUpdated', () => {
        updateNotificationBadges();
        if (notifDrawer.classList.contains('active')) renderNotificationItems();
    });

    updateNotificationBadges();
}

window.toggleNotifications = function() {
    if (!notifDrawer || !notifBackdrop) return;
    const isActive = notifDrawer.classList.contains('active');

    if (isActive) {
        notifDrawer.classList.remove('active');
        notifBackdrop.classList.remove('active');
    } else {
        renderNotificationItems();
        updateNotificationBadges();
        notifDrawer.classList.add('active');
        notifBackdrop.classList.add('active');
        if (window.lucide) lucide.createIcons();
    }
};

function renderNotificationItems() {
    const listEl = document.getElementById('notif-items-list');
    if (!listEl) return;

    const allNotifs = erp.getNotifications();
    const filtered = allNotifs.filter(n => activeNotifFilter === 'ALL' || n.type === activeNotifFilter);

    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div style="padding: 4rem 1.5rem; text-align: center; color: var(--text-muted);">
                <i data-lucide="bell-off" style="width: 36px; height: 36px; opacity: 0.4; margin-bottom: 0.5rem;"></i>
                <div style="font-weight: 600; color: var(--text-primary);">No notifications in this filter</div>
                <p style="font-size: 0.8rem; margin-top: 0.25rem;">You are completely caught up!</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    const typeConfig = {
        'APPROVAL': { icon: 'shield-check', color: 'var(--brand-primary)', bg: 'rgba(59,130,246,0.1)' },
        'OVERDUE': { icon: 'alert-triangle', color: 'var(--color-danger)', bg: 'rgba(239,68,68,0.1)' },
        'EVENT': { icon: 'ticket', color: 'var(--brand-accent)', bg: 'rgba(139,92,246,0.1)' },
        'LAB_SESSION': { icon: 'monitor', color: 'var(--color-warning)', bg: 'rgba(245,158,11,0.1)' },
        'BROADCAST': { icon: 'megaphone', color: 'var(--color-success)', bg: 'rgba(16,185,129,0.1)' }
    };

    listEl.innerHTML = filtered.map(n => {
        const conf = typeConfig[n.type] || typeConfig.BROADCAST;
        const timeAgo = formatTimeAgo(n.timestamp);

        return `
            <div class="notification-item ${n.unread ? 'unread' : ''}" data-id="${n.id}" data-link="${n.link || ''}">
                <div style="width: 36px; height: 36px; border-radius: 8px; background: ${conf.bg}; color: ${conf.color}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <i data-lucide="${conf.icon}" style="width: 18px; height: 18px;"></i>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
                        <span style="font-weight: 700; font-size: 0.88rem; color: var(--text-primary);">${n.title}</span>
                        <span style="font-size: 0.7rem; color: var(--text-muted);">${timeAgo}</span>
                    </div>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0 0 0.4rem 0; line-height: 1.35;">
                        ${n.message}
                    </p>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="badge" style="background: ${conf.bg}; color: ${conf.color}; font-size: 0.65rem; padding: 0.1rem 0.4rem;">${n.type}</span>
                        <button class="btn-dismiss-notif" data-id="${n.id}" style="background: transparent; border: none; color: var(--text-muted); font-size: 0.72rem; cursor: pointer; padding: 0.2rem;">Dismiss</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Attach click handlers
    listEl.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-dismiss-notif')) return;
            const notifId = item.dataset.id;
            const link = item.dataset.link;
            erp.markNotificationRead(notifId);
            if (link && link !== 'dashboard') {
                window.location.href = link;
            } else {
                renderNotificationItems();
                updateNotificationBadges();
            }
        });
    });

    listEl.querySelectorAll('.btn-dismiss-notif').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            erp.deleteNotification(btn.dataset.id);
            renderNotificationItems();
            updateNotificationBadges();
        });
    });

    if (window.lucide) lucide.createIcons();
}

function updateNotificationBadges() {
    const unreadCount = erp.getUnreadNotificationCount();
    const topbarBadge = document.getElementById('topbar-notif-badge');
    const statusText = document.getElementById('notif-unread-status');

    if (topbarBadge) {
        topbarBadge.style.display = unreadCount > 0 ? 'block' : 'none';
    }
    if (statusText) {
        statusText.innerText = `${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}`;
    }
}

function formatTimeAgo(dateStr) {
    if (!dateStr) return 'Recently';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ==========================================================================
// PREMIUM ADMIN MESSENGER & HELPDESK WIDGET
// ==========================================================================
let messengerWindow = null;
let floatingBtn = null;
let activeChatChannelId = 'ch-admin';

function initMessengerWidget() {
    // 1. Floating Action Launcher Button
    floatingBtn = document.createElement('button');
    floatingBtn.className = 'floating-messenger-btn';
    floatingBtn.id = 'floating-messenger-btn';
    floatingBtn.title = 'Institutional Admin Messenger';
    floatingBtn.innerHTML = `
        <i data-lucide="message-square" style="width: 24px; height: 24px;"></i>
        <span style="position: absolute; top: 2px; right: 2px; width: 12px; height: 12px; border-radius: 50%; background: var(--color-success); border: 2px solid white;"></span>
    `;

    // 2. Chat Window Container
    messengerWindow = document.createElement('div');
    messengerWindow.className = 'messenger-window';
    messengerWindow.id = 'messenger-window';

    messengerWindow.innerHTML = `
        <!-- Messenger Header -->
        <div style="padding: 1rem 1.25rem; background: var(--brand-gradient); color: white; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
                <div style="width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-weight: 700;">
                    <i data-lucide="shield" style="width: 18px; height: 18px;" id="chat-header-icon"></i>
                </div>
                <div>
                    <div style="font-weight: 800; font-size: 0.95rem; line-height: 1.2;" id="chat-header-name">Admin Helpdesk</div>
                    <div style="font-size: 0.68rem; opacity: 0.9; display: flex; align-items: center; gap: 0.3rem;">
                        <span style="width: 6px; height: 6px; border-radius: 50%; background: #4ade80;"></span> Active • Executive Support
                    </div>
                </div>
            </div>
            <button class="btn btn-ghost btn-icon" id="btn-close-messenger" style="color: white; padding: 0.25rem;">
                <i data-lucide="x" style="width: 18px; height: 18px;"></i>
            </button>
        </div>

        <!-- Channels Switcher Bar -->
        <div style="display: flex; gap: 0.4rem; padding: 0.5rem 0.75rem; background: var(--bg-muted); border-bottom: 1px solid var(--border-color); overflow-x: auto;" id="chat-channels-bar">
            <!-- Injected dynamically -->
        </div>

        <!-- Chat Conversation Messages Container -->
        <div id="chat-messages-body" style="flex: 1; padding: 1rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; background: var(--bg-surface);">
            <!-- Injected dynamically -->
        </div>

        <!-- Quick Action Chips -->
        <div style="display: flex; gap: 0.35rem; padding: 0.4rem 0.75rem; background: var(--bg-surface); border-top: 1px solid var(--border-color); overflow-x: auto;">
            <button class="chat-chip btn btn-outline btn-sm" data-text="Request Lab Workstation Extension" style="padding: 0.2rem 0.5rem; font-size: 0.7rem; white-space: nowrap; border-radius: var(--radius-full);">⚡ Extend Lab Session</button>
            <button class="chat-chip btn btn-outline btn-sm" data-text="Book Renewal Inquiry" style="padding: 0.2rem 0.5rem; font-size: 0.7rem; white-space: nowrap; border-radius: var(--radius-full);">📚 Renew Book</button>
            <button class="chat-chip btn btn-outline btn-sm" data-text="Report Lost Smartcard / NFC" style="padding: 0.2rem 0.5rem; font-size: 0.7rem; white-space: nowrap; border-radius: var(--radius-full);">💳 NFC Issue</button>
        </div>

        <!-- Chat Input Bar -->
        <div style="padding: 0.75rem 1rem; background: var(--bg-card); border-top: 1px solid var(--border-color); display: flex; gap: 0.5rem; align-items: center;">
            <input type="text" id="messenger-input" placeholder="Type a message to admin..." style="flex: 1; padding: 0.6rem 0.85rem; border-radius: var(--radius-full); font-size: 0.85rem; border: 1px solid var(--border-color); background: var(--bg-muted); color: var(--text-primary); outline: none;">
            <button class="btn btn-primary btn-icon" id="btn-send-chat" style="width: 36px; height: 36px; border-radius: 50%; padding: 0;">
                <i data-lucide="send" style="width: 16px; height: 16px;"></i>
            </button>
        </div>
    `;

    document.body.appendChild(floatingBtn);
    document.body.appendChild(messengerWindow);

    // Event listeners
    floatingBtn.addEventListener('click', window.toggleMessenger);
    document.getElementById('btn-messenger-topbar')?.addEventListener('click', window.toggleMessenger);
    document.getElementById('btn-close-messenger')?.addEventListener('click', window.toggleMessenger);

    // Send chat listener
    const sendBtn = document.getElementById('btn-send-chat');
    const chatInput = document.getElementById('messenger-input');

    const handleSendMessage = () => {
        const text = chatInput.value.trim();
        if (!text) return;

        // Current user info fallback
        const userName = localStorage.getItem('user_name') || 'Student Member';
        const userId = localStorage.getItem('user_id') || 'REG-2026-001';

        erp.sendChatMessage(activeChatChannelId, userId, userName, 'STUDENT', text, true);
        chatInput.value = '';
        playSynthSound('success');
        renderChatMessages();

        // Simulate intelligent Admin / Helpdesk auto-reply after 1.2 seconds
        setTimeout(() => {
            simulateAdminResponse(text);
        }, 1200);
    };

    sendBtn?.addEventListener('click', handleSendMessage);
    chatInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSendMessage();
    });

    // Quick chips
    messengerWindow.querySelectorAll('.chat-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chatInput.value = chip.dataset.text;
            handleSendMessage();
        });
    });

    window.addEventListener('chatMessageSent', () => {
        if (messengerWindow.classList.contains('active')) renderChatMessages();
    });
}

window.toggleMessenger = function() {
    if (!messengerWindow) return;
    const isActive = messengerWindow.classList.contains('active');

    if (isActive) {
        messengerWindow.classList.remove('active');
    } else {
        messengerWindow.classList.add('active');
        renderChatChannels();
        renderChatMessages();
        setTimeout(() => document.getElementById('messenger-input')?.focus(), 100);
        if (window.lucide) lucide.createIcons();
    }
};

function renderChatChannels() {
    const bar = document.getElementById('chat-channels-bar');
    if (!bar) return;

    const channels = erp.getChatChannels();
    bar.innerHTML = channels.map(c => {
        const isSelected = c.id === activeChatChannelId;
        return `
            <button class="btn ${isSelected ? 'btn-primary' : 'btn-outline'} btn-sm chat-channel-btn" data-id="${c.id}" style="padding: 0.25rem 0.65rem; font-size: 0.72rem; white-space: nowrap; border-radius: var(--radius-full);">
                ${c.name.split(' ')[0]}
            </button>
        `;
    }).join('');

    bar.querySelectorAll('.chat-channel-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            activeChatChannelId = btn.dataset.id;
            const ch = channels.find(c => c.id === activeChatChannelId);
            if (ch) {
                document.getElementById('chat-header-name').innerText = ch.name;
            }
            renderChatChannels();
            renderChatMessages();
        });
    });
}

function renderChatMessages() {
    const body = document.getElementById('chat-messages-body');
    if (!body) return;

    const messages = erp.getChatMessages(activeChatChannelId);

    if (messages.length === 0) {
        body.innerHTML = `
            <div style="padding: 3rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.82rem;">
                <i data-lucide="message-square" style="width: 28px; height: 28px; opacity: 0.4; margin-bottom: 0.35rem;"></i>
                <div>Send a message to begin instant dialogue with the administrative desk.</div>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    body.innerHTML = messages.map(m => {
        const timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (m.is_outgoing) {
            return `
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                    <div class="chat-bubble-outgoing">${m.text}</div>
                    <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 0.15rem; display: flex; align-items: center; gap: 0.2rem;">
                        ${timeStr} <span>✓✓</span>
                    </div>
                </div>
            `;
        } else {
            return `
                <div style="display: flex; flex-direction: column; align-items: flex-start;">
                    <div style="font-size: 0.7rem; font-weight: 700; color: var(--brand-primary); margin-bottom: 0.15rem;">
                        ${m.sender_name} (${m.sender_role})
                    </div>
                    <div class="chat-bubble-incoming">${m.text}</div>
                    <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 0.15rem;">
                        ${timeStr}
                    </div>
                </div>
            `;
        }
    }).join('');

    body.scrollTop = body.scrollHeight;
}

function simulateAdminResponse(userPrompt) {
    const q = userPrompt.toLowerCase();
    let reply = "Your message has been acknowledged by the Executive Desk. We are processing your request.";

    if (q.includes('lab') || q.includes('extend') || q.includes('terminal')) {
        reply = "Session extended by 45 minutes on your current terminal. Please remember to scan your NFC smartcard upon check-out.";
    } else if (q.includes('book') || q.includes('renew')) {
        reply = "Your book loan has been renewed for an additional 14 days. No overdue penalty applied.";
    } else if (q.includes('card') || q.includes('nfc') || q.includes('lost')) {
        reply = "A replacement NFC Smartcard request has been logged. Please collect your new printed ID from the Chief Librarian counter.";
    } else if (q.includes('hall') || q.includes('event') || q.includes('symposium')) {
        reply = "Auditorium booking schedule reviewed. Your request is queued for Dean authorization in the Campus Portal.";
    }

    erp.sendChatMessage(activeChatChannelId, 'ADM-001', 'Dean Arthur Pendelton', 'ADMIN', reply, false);
    playSynthSound('success');
    renderChatMessages();
}

// Explicit named exports for ES module interoperability
export function showToast(message, type = 'info', title = '', duration = 4000) {
    window.app.toast(message, type, title, duration);
}

export function playAudioChime(type = 'success') {
    playSynthSound(type.toLowerCase());
}

export function printIdCard(opts = {}) {
    window.printLibraryCard(opts.name || 'Member', opts.id || 'ID-001', opts.role || 'Patron', opts.nfc || '', opts.barcode || opts.id);
}