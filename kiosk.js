// kiosk.js - Student Self-Service Lending & Smart Drop Box Return Kiosk
import { erp } from './erp_service.js';
import { hardware } from './hardware.js';
import { supabase } from './supabaseClient.js';
import { showToast, playAudioChime } from './ui.js';

let activeStudent = null;
let checkoutCart = [];

document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initNavigation();
    initHardwareReaders();
});

function initClock() {
    const clockEl = document.getElementById('kiosk-live-clock');
    const update = () => {
        clockEl.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    update();
    setInterval(update, 1000);
}

function initNavigation() {
    const homeView = document.getElementById('kiosk-home-view');
    const borrowView = document.getElementById('kiosk-borrow-view');
    const returnView = document.getElementById('kiosk-return-view');
    const accountView = document.getElementById('kiosk-account-view');

    function showView(view) {
        homeView.style.display = view === 'home' ? 'block' : 'none';
        borrowView.style.display = view === 'borrow' ? 'block' : 'none';
        returnView.style.display = view === 'return' ? 'block' : 'none';
        accountView.style.display = view === 'account' ? 'block' : 'none';

        if (view === 'borrow') {
            document.getElementById('borrow-step-card').style.display = 'block';
            document.getElementById('borrow-step-books').style.display = 'none';
            document.getElementById('kiosk-student-input').value = '';
            document.getElementById('kiosk-student-input').focus();
            checkoutCart = [];
            renderCart();
        } else if (view === 'return') {
            document.getElementById('kiosk-return-barcode-input').value = '';
            document.getElementById('kiosk-return-barcode-input').focus();
            document.getElementById('kiosk-return-feedback').style.display = 'none';
        } else if (view === 'account') {
            document.getElementById('kiosk-account-search-id').value = '';
            document.getElementById('kiosk-account-search-id').focus();
            document.getElementById('kiosk-account-results').style.display = 'none';
        }

        if (window.lucide) lucide.createIcons();
    }

    document.getElementById('btn-mode-borrow')?.addEventListener('click', () => showView('borrow'));
    document.getElementById('btn-mode-return')?.addEventListener('click', () => showView('return'));
    document.getElementById('btn-mode-account')?.addEventListener('click', () => showView('account'));

    document.querySelectorAll('.btn-kiosk-back').forEach(btn => {
        btn.addEventListener('click', () => showView('home'));
    });

    // Borrow Student ID Auth
    const studentInput = document.getElementById('kiosk-student-input');
    const btnAuthStudent = document.getElementById('btn-kiosk-auth-student');

    const handleStudentAuth = () => {
        const val = studentInput.value.trim();
        if (!val) {
            showToast('Please tap student card or enter Student ID', 'warning');
            return;
        }

        const students = JSON.parse(localStorage.getItem('erp_students') || '[]');
        const found = students.find(s => s.student_id?.toLowerCase() === val.toLowerCase() || s.nfc_tag_id?.toLowerCase() === val.toLowerCase() || s.barcode?.toLowerCase() === val.toLowerCase());
        
        activeStudent = found || {
            id: `s-${Date.now()}`,
            name: `Patron (${val})`,
            student_id: val,
            department: 'Academic Member'
        };

        document.getElementById('kiosk-student-info').innerText = `Student: ${activeStudent.name} (${activeStudent.student_id})`;
        document.getElementById('borrow-step-card').style.display = 'none';
        document.getElementById('borrow-step-books').style.display = 'block';
        document.getElementById('kiosk-book-barcode-input').focus();
        playAudioChime('SUCCESS');
        showToast(`Authenticated: ${activeStudent.name}`, 'success');
        if (window.lucide) lucide.createIcons();
    };

    btnAuthStudent?.addEventListener('click', handleStudentAuth);
    studentInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleStudentAuth();
    });

    // Add Book to Cart
    const bookInput = document.getElementById('kiosk-book-barcode-input');
    const btnAddBook = document.getElementById('btn-kiosk-add-book');

    const handleAddBook = () => {
        const barcode = bookInput.value.trim();
        if (!barcode) return;

        if (checkoutCart.find(b => b.barcode.toLowerCase() === barcode.toLowerCase())) {
            showToast('Book already scanned in this session', 'warning');
            bookInput.value = '';
            return;
        }

        const sampleTitle = getBookTitleFromBarcode(barcode);
        checkoutCart.push({
            barcode: barcode,
            title: sampleTitle,
            dueDate: new Date(Date.now() + 14 * 86400 * 1000).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
        });

        bookInput.value = '';
        bookInput.focus();
        playAudioChime('SUCCESS');
        renderCart();
    };

    btnAddBook?.addEventListener('click', handleAddBook);
    bookInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAddBook();
    });

    // Complete Borrow Session
    document.getElementById('btn-kiosk-finish-borrow')?.addEventListener('click', () => {
        if (checkoutCart.length === 0) {
            showToast('Please scan at least one book barcode', 'warning');
            return;
        }

        checkoutCart.forEach(item => {
            erp.selfCheckout(activeStudent.student_id, item.barcode);
        });

        playAudioChime('SUCCESS');
        alert(`✓ Lending Completed Successfully!\n\n${checkoutCart.length} books issued to ${activeStudent.name}.\nDue Date: 14 Days from today.\nEnjoy your reading!`);
        showView('home');
    });

    // Smart Return Drop Box
    const returnInput = document.getElementById('kiosk-return-barcode-input');
    const btnSubmitReturn = document.getElementById('btn-kiosk-submit-return');

    const handleReturn = () => {
        const barcode = returnInput.value.trim();
        if (!barcode) return;

        const res = erp.selfReturn(barcode);
        const title = getBookTitleFromBarcode(barcode);

        const fb = document.getElementById('kiosk-return-feedback');
        fb.style.display = 'block';
        fb.innerHTML = `
            <div style="font-size: 1.15rem; font-weight: 800; color: var(--color-success); margin-bottom: 0.25rem;">✓ Book Returned Successfully</div>
            <div style="font-weight: 700; color: var(--text-primary); font-size: 1rem;">${title}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">Barcode: <span style="font-family: var(--font-mono); font-weight: 700;">${barcode}</span> • Timestamp: ${res.returnedAt}</div>
            <div style="font-size: 0.8rem; color: var(--color-success); font-weight: 600; margin-top: 0.5rem;">Please place the book into the return slot. Thank you!</div>
        `;

        playAudioChime('SUCCESS');
        returnInput.value = '';
        returnInput.focus();
    };

    btnSubmitReturn?.addEventListener('click', handleReturn);
    returnInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleReturn();
    });

    // Account Status Lookup
    const accInput = document.getElementById('kiosk-account-search-id');
    const btnAccLookup = document.getElementById('btn-kiosk-lookup-account');

    const handleAccLookup = () => {
        const val = accInput.value.trim();
        if (!val) return;

        const loans = JSON.parse(localStorage.getItem('erp_kiosk_loans') || '[]');
        const myLoans = loans.filter(l => l.student_code?.toLowerCase() === val.toLowerCase() && l.status === 'ACTIVE');
        const resultsBox = document.getElementById('kiosk-account-results');
        resultsBox.style.display = 'block';

        resultsBox.innerHTML = `
            <div style="background: var(--bg-surface); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 1rem;">
                <div style="font-weight: 800; font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.25rem;">Active Borrowings (${myLoans.length})</div>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">Member ID: <strong style="font-family: var(--font-mono); color: var(--brand-primary);">${val}</strong></p>

                ${myLoans.length > 0 ? myLoans.map(l => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; border-radius: var(--radius-sm); background: var(--bg-card); border: 1px solid var(--border-color); margin-bottom: 0.5rem;">
                        <div>
                            <div style="font-weight: 700; font-size: 0.9rem;">${getBookTitleFromBarcode(l.barcode)}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">Barcode: ${l.barcode} • Borrowed: ${l.issue_date}</div>
                        </div>
                        <div style="text-align: right;">
                            <span class="badge badge-success" style="font-size: 0.72rem;">Due: ${l.due_date}</span>
                        </div>
                    </div>
                `).join('') : `
                    <div style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.85rem;">
                        No active book loans. Your library standing is clear!
                    </div>
                `}
            </div>
        `;
        playAudioChime('TAP');
    };

    btnAccLookup?.addEventListener('click', handleAccLookup);
    accInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAccLookup();
    });
}

function renderCart() {
    const list = document.getElementById('kiosk-cart-list');
    const count = document.getElementById('kiosk-cart-count');
    if (!list) return;

    count.innerText = `${checkoutCart.length} Item${checkoutCart.length === 1 ? '' : 's'}`;

    if (checkoutCart.length === 0) {
        list.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.85rem;">No books scanned yet.</div>`;
        return;
    }

    list.innerHTML = checkoutCart.map((item, idx) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); background: var(--bg-card); border: 1px solid var(--border-color); font-size: 0.85rem;">
            <div>
                <div style="font-weight: 700; color: var(--text-primary);">${item.title}</div>
                <div style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">Barcode: ${item.barcode}</div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="window.removeCartItem(${idx})" style="color: var(--color-danger); padding: 0.2rem 0.4rem;">
                &times;
            </button>
        </div>
    `).join('');
}

window.removeCartItem = function(idx) {
    checkoutCart.splice(idx, 1);
    renderCart();
};

function getBookTitleFromBarcode(barcode) {
    const books = JSON.parse(localStorage.getItem('erp_books') || '[]');
    const found = books.find(b => b.isbn === barcode || b.barcode === barcode);
    if (found) return found.title;
    return `Item / Resource [${barcode}]`;
}

function initHardwareReaders() {
    // Hardware NFC Tap Listener on kiosk
    hardware.startNfcScan((tagPayload) => {
        const studentInput = document.getElementById('kiosk-student-input');
        const accInput = document.getElementById('kiosk-account-search-id');

        if (document.getElementById('kiosk-borrow-view').style.display === 'block') {
            studentInput.value = tagPayload;
            document.getElementById('btn-kiosk-auth-student').click();
        } else if (document.getElementById('kiosk-account-view').style.display === 'block') {
            accInput.value = tagPayload;
            document.getElementById('btn-kiosk-lookup-account').click();
        } else {
            // Auto-open borrow view
            document.getElementById('btn-mode-borrow').click();
            studentInput.value = tagPayload;
            document.getElementById('btn-kiosk-auth-student').click();
        }
    });

    // Hardware USB barcode listener
    hardware.onBarcodeScan((scannedCode) => {
        if (document.getElementById('borrow-step-books').style.display === 'block') {
            document.getElementById('kiosk-book-barcode-input').value = scannedCode;
            document.getElementById('btn-kiosk-add-book').click();
        } else if (document.getElementById('kiosk-return-view').style.display === 'block') {
            document.getElementById('kiosk-return-barcode-input').value = scannedCode;
            document.getElementById('btn-kiosk-submit-return').click();
        }
    });
}
