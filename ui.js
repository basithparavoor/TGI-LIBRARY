import { supabase } from './supabaseClient.js';

// Global UI state
const cmdOverlay = document.getElementById('command-overlay');
const cmdInput = document.getElementById('global-search-input');
const cmdResults = document.getElementById('command-results');
const dashboardSearch = document.getElementById('command-input'); 

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
}

function updateThemeIcon(theme) {
    const iconEl = document.querySelector('#theme-toggle i');
    if (iconEl && window.lucide) {
        iconEl.setAttribute('data-lucide', theme === 'light' ? 'moon' : 'sun');
        lucide.createIcons();
    }
}

// --- COMMAND PALETTE LOGIC ---
window.toggleCommandPalette = function() {
    if (cmdOverlay.style.display === 'none') {
        cmdOverlay.style.display = 'flex';
        cmdInput.value = '';
        setTimeout(() => cmdInput.focus(), 50);
    } else {
        cmdOverlay.style.display = 'none';
    }
}

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
    }
    if (e.key === 'Escape' && cmdOverlay.style.display === 'flex') {
        toggleCommandPalette();
    }
});

dashboardSearch?.addEventListener('focus', (e) => {
    e.target.blur();
    toggleCommandPalette();
});

cmdOverlay?.addEventListener('click', (e) => {
    if (e.target === cmdOverlay) toggleCommandPalette();
});

let searchTimeout = null;
cmdInput?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    if (query.length < 2) {
        cmdResults.innerHTML = `
            <div class="cmd-item" onclick="window.location.href='circulation.html'"><i data-lucide="repeat"></i> <span>Go to Circulation Desk</span></div>
            <div class="cmd-item" onclick="window.location.href='books.html'"><i data-lucide="book-plus"></i> <span>Add New Book</span></div>
        `;
        lucide.createIcons();
        return;
    }
    searchTimeout = setTimeout(() => performGlobalSearch(query), 300);
});

async function performGlobalSearch(query) {
    cmdResults.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--text-secondary);">Searching...</div>`;
    try {
        const [booksRes, studentsRes] = await Promise.all([
            supabase.from('books').select('id, title, author').ilike('title', `%${query}%`).limit(3),
            supabase.from('students').select('id, name, student_id').ilike('name', `%${query}%`).limit(3)
        ]);

        let html = '';
        if (booksRes.data?.length > 0) {
            html += `<div style="padding: 0.5rem 1rem; font-size: 0.75rem; font-weight: bold; color: var(--text-secondary); text-transform: uppercase;">Books</div>`;
            booksRes.data.forEach(book => {
                html += `<div class="cmd-item" onclick="window.location.href='books.html?id=${book.id}'"><i data-lucide="book"></i><div><div style="font-weight: 500;">${book.title}</div><div style="font-size: 0.8rem; color: var(--text-secondary);">${book.author}</div></div></div>`;
            });
        }
        if (studentsRes.data?.length > 0) {
            html += `<div style="padding: 0.5rem 1rem; font-size: 0.75rem; font-weight: bold; color: var(--text-secondary); text-transform: uppercase; margin-top: 0.5rem;">Students</div>`;
            studentsRes.data.forEach(student => {
                html += `<div class="cmd-item" onclick="window.location.href='students.html?id=${student.id}'"><i data-lucide="user"></i><div><div style="font-weight: 500;">${student.name}</div><div style="font-size: 0.8rem; color: var(--text-secondary);">ID: ${student.student_id}</div></div></div>`;
            });
        }
        if (!html) html = `<div style="padding: 1rem; text-align: center; color: var(--text-secondary);">No results found for "${query}"</div>`;
        cmdResults.innerHTML = html;
        lucide.createIcons();
    } catch (error) {
        cmdResults.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--danger);">Search failed.</div>`;
    }
}

// --- APP INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    initTheme(); // Set initial theme

    // 1. Create Mobile Overlay Element
    const mobileOverlay = document.createElement('div');
    mobileOverlay.id = 'mobile-sidebar-overlay';
    document.body.appendChild(mobileOverlay);

    // 2. Inject Sidebar
    const sidebarContainer = document.getElementById('sidebar-container');
    if (sidebarContainer) {
        const res = await fetch('sidebar.html');
        sidebarContainer.innerHTML = await res.text();
        
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        sidebarContainer.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('href') === currentPath) item.classList.add('active');
        });
    }

    // 3. Inject Topbar & Wire Events
    const topbarContainer = document.getElementById('topbar-container');
    if (topbarContainer) {
        const res = await fetch('topbar.html');
        topbarContainer.innerHTML = await res.text();
        
        // Mobile Menu Toggle Logic
        const menuBtn = document.getElementById('mobile-menu-btn');
        menuBtn?.addEventListener('click', () => {
            sidebarContainer.classList.add('open');
            mobileOverlay.classList.add('active');
        });

        mobileOverlay.addEventListener('click', () => {
            sidebarContainer.classList.remove('open');
            mobileOverlay.classList.remove('active');
        });

        // Theme Toggle
        document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
        
        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', async () => {
            await window.supabase.auth.signOut();
            window.location.href = 'login.html';
        });

        // Populate User Data
        setTimeout(() => {
            if (window.currentUser) {
                const nameEl = document.getElementById('topbar-user-name');
                const roleEl = document.getElementById('topbar-user-role');
                const avatarEl = document.getElementById('topbar-user-avatar');
                
                if(nameEl) nameEl.innerText = window.currentUser.name || window.currentUser.email.split('@')[0];
                if(roleEl) roleEl.innerText = window.currentUser.role;
                if(avatarEl) avatarEl.innerText = (window.currentUser.name || window.currentUser.email).charAt(0).toUpperCase();
            }
        }, 500);
    }
    
    if (window.lucide) lucide.createIcons();
});

// Add this anywhere inside ui.js

window.app = {
    dialog: function(options) {
        const overlay = document.createElement('div');
        overlay.className = 'app-dialog-overlay';
        
        const isPrompt = options.type === 'prompt';
        
        overlay.innerHTML = `
            <div class="app-dialog">
                <div class="app-dialog-header">${options.title || 'Message'}</div>
                <div class="app-dialog-message">${options.message || ''}</div>
                <input type="text" class="app-dialog-input" style="display: ${isPrompt ? 'block' : 'none'}; padding: 0.75rem; width: 100%; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-primary); color: var(--text-primary); outline: none;">
                <div class="app-dialog-actions">
                    ${options.type !== 'alert' ? `<button class="btn btn-outline cancel-btn">Cancel</button>` : ''}
                    <button class="btn btn-primary confirm-btn">${options.confirmText || 'OK'}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Trigger reflow for animation
        setTimeout(() => overlay.classList.add('active'), 10);
        
        const input = overlay.querySelector('.app-dialog-input');
        const confirmBtn = overlay.querySelector('.confirm-btn');
        const cancelBtn = overlay.querySelector('.cancel-btn');
        
        if (isPrompt) input.focus();

        const close = () => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
        };

        confirmBtn.addEventListener('click', () => {
            if (options.onConfirm) options.onConfirm(isPrompt ? input.value : true);
            close();
        });

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (options.onCancel) options.onCancel();
                close();
            });
        }
    },
    
    alert: (message, title = 'Alert') => window.app.dialog({ type: 'alert', title, message }),
    confirm: (message, title = 'Confirm', onConfirm) => window.app.dialog({ type: 'confirm', title, message, onConfirm }),
    prompt: (message, title = 'Input Required', onConfirm) => window.app.dialog({ type: 'prompt', title, message, onConfirm })
};

// Override native prompts in legacy code
window.promptNewEntity = function(type, selectId) {
    window.app.prompt(`Enter new ${type} name:`, `Add ${type}`, (val) => {
        if (val && val.trim() !== '') {
            const select = document.getElementById(selectId);
            const newOption = document.createElement('option');
            newOption.value = 'NEW_' + val.trim();
            newOption.text = val.trim();
            newOption.selected = true;
            select.add(newOption);
        }
    });
};