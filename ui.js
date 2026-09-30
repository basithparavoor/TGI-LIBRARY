import { supabase } from './supabaseClient.js';

// Global UI state
let cmdOverlay = null;
let cmdInput = null;
let cmdResults = null;
let activePaletteIndex = -1;

// --- AUDIO SYNTHESIS FEEDBACK (No external files needed) ---
function playSynthSound(type = 'success') {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        if (type === 'success' || type === 'scan') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
            osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1); // E6
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
            osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
            osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.25);
        }
    } catch (e) {
        // Audio might be blocked until user interaction
    }
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

    // Notify components like Chart.js if they need to update colors
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: newTheme } }));
}

function updateThemeIcon(theme) {
    const iconBtn = document.getElementById('theme-toggle');
    if (iconBtn && window.lucide) {
        iconBtn.innerHTML = `<i data-lucide="${theme === 'light' ? 'moon' : 'sun'}" style="width: 18px; height: 18px;"></i>`;
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
        <div style="padding: 0.5rem 1rem; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Quick Navigation</div>
        <div class="cmd-item" onclick="window.location.href='circulation.html'"><i data-lucide="repeat"></i> <div><div style="font-weight: 600;">Circulation Desk</div><div style="font-size: 0.75rem; color: var(--text-secondary);">Issue or return books instantly</div></div></div>
        <div class="cmd-item" onclick="window.location.href='books.html'"><i data-lucide="book-open"></i> <div><div style="font-weight: 600;">Book Catalogue</div><div style="font-size: 0.75rem; color: var(--text-secondary);">Browse, search & manage books</div></div></div>
        <div class="cmd-item" onclick="window.location.href='students.html'"><i data-lucide="users"></i> <div><div style="font-weight: 600;">Student Members</div><div style="font-size: 0.75rem; color: var(--text-secondary);">Member directory & card printer</div></div></div>
        <div class="cmd-item" onclick="window.location.href='inventory.html'"><i data-lucide="scan-line"></i> <div><div style="font-weight: 600;">Inventory Audit</div><div style="font-size: 0.75rem; color: var(--text-secondary);">Reconcile physical library shelves</div></div></div>
        <div class="cmd-item" onclick="window.location.href='inspect.html'"><i data-lucide="microscope"></i> <div><div style="font-weight: 600;">Universal Inspector</div><div style="font-size: 0.75rem; color: var(--text-secondary);">Inspect barcodes for books, racks & shelves</div></div></div>
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
    cmdResults.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-secondary);"><i data-lucide="loader-2" class="animate-spin" style="width: 24px; height: 24px; margin-bottom: 0.5rem;"></i><div>Searching library records...</div></div>`;
    if (window.lucide) lucide.createIcons();

    try {
        const [booksRes, studentsRes] = await Promise.all([
            supabase.from('books').select('id, title, author, isbn').or(`title.ilike.%${query}%,author.ilike.%${query}%,isbn.ilike.%${query}%`).limit(4),
            supabase.from('students').select('id, name, student_id, place').or(`name.ilike.%${query}%,student_id.ilike.%${query}%`).limit(4)
        ]);

        let html = '';
        if (booksRes.data && booksRes.data.length > 0) {
            html += `<div style="padding: 0.5rem 1rem; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Books</div>`;
            booksRes.data.forEach(book => {
                html += `
                    <div class="cmd-item" onclick="window.location.href='books.html?search=${encodeURIComponent(book.title)}'">
                        <i data-lucide="book"></i>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: var(--text-primary);">${book.title}</div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary);">${book.author} ${book.isbn ? '• ISBN: ' + book.isbn : ''}</div>
                        </div>
                        <span class="badge" style="font-size: 0.65rem; background: var(--bg-muted);">Book</span>
                    </div>`;
            });
        }

        if (studentsRes.data && studentsRes.data.length > 0) {
            html += `<div style="padding: 0.5rem 1rem; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.5rem;">Students</div>`;
            studentsRes.data.forEach(student => {
                html += `
                    <div class="cmd-item" onclick="window.location.href='students.html?search=${encodeURIComponent(student.name)}'">
                        <i data-lucide="user"></i>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: var(--text-primary);">${student.name}</div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary);">ID: ${student.student_id} ${student.place ? '• ' + student.place : ''}</div>
                        </div>
                        <span class="badge badge-brand" style="font-size: 0.65rem;">Member</span>
                    </div>`;
            });
        }

        if (!html) {
            html = `<div style="padding: 2.5rem 1rem; text-align: center; color: var(--text-secondary);">
                <i data-lucide="search-x" style="width: 32px; height: 32px; margin-bottom: 0.5rem; opacity: 0.6;"></i>
                <div>No records found for "<strong>${query}</strong>"</div>
            </div>`;
        }

        cmdResults.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    } catch (error) {
        cmdResults.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--danger);">Search error occurred.</div>`;
    }
}

// --- GLOBAL NOTIFICATION & TOAST SYSTEM ---
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
        if (duration > 0) {
            setTimeout(dismiss, duration);
        }
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

        overlay.querySelector('.confirm-btn')?.addEventListener('click', () => {
            close();
            if (onConfirm) onConfirm();
        });

        overlay.querySelector('.cancel-btn')?.addEventListener('click', () => {
            close();
            if (onCancel) onCancel();
        });
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

// --- PRINT LIBRARY ID CARD MODAL UTILITY ---
window.printLibraryCard = function(name, studentId, className = 'Member') {
    let modal = document.getElementById('modal-id-card-print');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-id-card-print';
        modal.className = 'app-dialog-overlay';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="app-dialog" style="max-width: 420px; display: flex; flex-direction: column; align-items: center; text-align: center;">
            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700;">Library Member Card</h3>
                <button class="btn btn-ghost btn-icon close-id-card"><i data-lucide="x" style="width: 18px; height: 18px;"></i></button>
            </div>

            <!-- Authentic ID Card Element -->
            <div id="printable-card-container" style="padding: 10px; background: transparent;">
                <div class="id-card-preview" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 14px; border: 1px solid rgba(255,255,255,0.2); width: 330px; height: 200px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.4); color: white; position: relative;">
                    <!-- Card Top -->
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 24px; height: 24px; border-radius: 6px; background: #3b82f6; display: flex; align-items: center; justify-content: center;">
                                <i data-lucide="library" style="width: 14px; height: 14px; color: white;"></i>
                            </div>
                            <span style="font-weight: 800; font-size: 0.85rem; letter-spacing: 0.5px;">TGI LIBRARY</span>
                        </div>
                        <span style="font-size: 0.65rem; font-weight: 700; background: rgba(59,130,246,0.3); color: #93c5fd; padding: 2px 8px; border-radius: 999px;">STUDENT ID</span>
                    </div>

                    <!-- Card Body -->
                    <div style="display: flex; gap: 12px; align-items: center; margin: 4px 0;">
                        <div style="width: 52px; height: 52px; border-radius: 50%; background: #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; font-weight: 800; color: white; border: 2px solid rgba(255,255,255,0.4); flex-shrink: 0;">
                            ${name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style="font-weight: 700; font-size: 0.95rem; line-height: 1.2;">${name}</div>
                            <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 2px;">ID: <span style="font-family: monospace; color: #e2e8f0; font-weight: 600;">${studentId}</span></div>
                            <div style="font-size: 0.7rem; color: #60a5fa; font-weight: 500;">${className}</div>
                        </div>
                    </div>

                    <!-- Card Bottom Barcode -->
                    <div style="background: white; border-radius: 6px; padding: 4px; display: flex; justify-content: center; align-items: center;">
                        <svg id="id-card-barcode-svg" style="width: 100%; height: 36px;"></svg>
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 0.75rem; width: 100%; margin-top: 1.5rem;">
                <button class="btn btn-outline" style="flex: 1;" onclick="document.getElementById('modal-id-card-print').classList.remove('active')">Close</button>
                <button class="btn btn-primary" style="flex: 1;" onclick="window.print()"><i data-lucide="printer" style="width: 16px; height: 16px;"></i> Print Card</button>
            </div>
        </div>
    `;

    modal.classList.add('active');
    if (window.lucide) lucide.createIcons();

    modal.querySelector('.close-id-card')?.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    // Render Barcode
    if (window.JsBarcode) {
        JsBarcode("#id-card-barcode-svg", studentId, {
            format: "CODE128",
            width: 1.5,
            height: 30,
            displayValue: false,
            margin: 0
        });
    }
};

// --- MOBILE BOTTOM NAVIGATION INJECTION ---
function injectMobileBottomNav() {
    if (document.querySelector('.mobile-bottom-nav')) return;

    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const nav = document.createElement('div');
    nav.className = 'mobile-bottom-nav';
    nav.innerHTML = `
        <ul>
            <li><a href="index.html" class="${currentPath === 'index.html' || currentPath === '' ? 'active' : ''}"><i data-lucide="layout-dashboard"></i><span>Home</span></a></li>
            <li><a href="circulation.html" class="${currentPath === 'circulation.html' ? 'active' : ''}"><i data-lucide="repeat"></i><span>Desk</span></a></li>
            <li><a href="books.html" class="${currentPath === 'books.html' ? 'active' : ''}"><i data-lucide="book-open"></i><span>Books</span></a></li>
            <li><a href="students.html" class="${currentPath === 'students.html' ? 'active' : ''}"><i data-lucide="users"></i><span>Members</span></a></li>
            <li><a href="#" id="mobile-bottom-menu-trigger"><i data-lucide="menu"></i><span>More</span></a></li>
        </ul>
    `;
    document.body.appendChild(nav);

    document.getElementById('mobile-bottom-menu-trigger')?.addEventListener('click', (e) => {
        e.preventDefault();
        const sidebar = document.getElementById('sidebar-container');
        const overlay = document.getElementById('mobile-sidebar-overlay');
        if (sidebar && overlay) {
            sidebar.classList.add('open');
            overlay.classList.add('active');
        }
    });
}

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

                // Populate User Data
                setTimeout(() => {
                    if (window.currentUser) {
                        const nameEl = document.getElementById('topbar-user-name');
                        const roleEl = document.getElementById('topbar-user-role');
                        const avatarEl = document.getElementById('topbar-user-avatar');
                        
                        if (nameEl) nameEl.innerText = window.currentUser.name || window.currentUser.email.split('@')[0];
                        if (roleEl) roleEl.innerText = window.currentUser.role || 'Super Admin';
                        if (avatarEl) avatarEl.innerText = (window.currentUser.name || window.currentUser.email).charAt(0).toUpperCase();
                    }
                }, 400);
            }
        } catch (e) {
            console.warn("Could not load topbar.html", e);
        }
    }

    // 4. Inject Mobile Bottom Nav
    injectMobileBottomNav();

    // 5. Command Palette bindings
    cmdOverlay = document.getElementById('command-overlay');
    cmdInput = document.getElementById('global-search-input');
    cmdResults = document.getElementById('command-results');
    
    cmdOverlay?.addEventListener('click', (e) => {
        if (e.target === cmdOverlay) window.toggleCommandPalette();
    });

    const dashboardSearch = document.getElementById('command-input');
    dashboardSearch?.addEventListener('focus', (e) => {
        e.target.blur();
        window.toggleCommandPalette();
    });

    setupPaletteSearch();

    if (window.lucide) lucide.createIcons();
});