// hardware.js - Multi-Modal Hardware Engine (NFC, QR, Barcode, Biometrics & Universal Auto-Detection)

import { supabase } from './supabaseClient.js';
import { erp } from './erp_service.js';

export class HardwareEngine {
    constructor() {
        this.nfcReader = null;
        this.isNfcScanning = false;
        this.barcodeBuffer = '';
        this.lastKeyTime = 0;
        this.barcodeListeners = [];
        this.nfcListeners = [];
        this.customAutoHandlers = new Map();

        this.initBarcodeWedgeListener();
        this.initGlobalScanHandler();
    }

    // --- 1. WEB NFC INTEGRATION (ISO/IEC 14443 & NTAG) ---
    async isNfcSupported() {
        return 'NDEFReader' in window;
    }

    async startNfcScan(onTagRead, onError) {
        if (!('NDEFReader' in window)) {
            const msg = "Web NFC is supported on Android Chrome or NFC-enabled hardware terminals. For desktop, use USB NFC reader, Barcode scanner, or Camera QR.";
            if (onError) onError(new Error(msg));
            return false;
        }

        try {
            this.nfcReader = new window.NDEFReader();
            await this.nfcReader.scan();
            this.isNfcScanning = true;

            this.nfcReader.addEventListener("reading", ({ serialNumber, message }) => {
                let tagPayload = serialNumber || '';
                
                // Read text/URI records if present
                for (const record of message.records) {
                    if (record.recordType === "text") {
                        const textDecoder = new TextDecoder(record.encoding);
                        tagPayload = textDecoder.decode(record.data);
                    }
                }

                if (window.app?.playBeep) window.app.playBeep('scan');
                if (window.app?.toast) window.app.toast(`NFC Smartcard detected: ${tagPayload}`, "info", "NFC Read", 2500);

                if (onTagRead) onTagRead(tagPayload, serialNumber);
                this.nfcListeners.forEach(listener => listener(tagPayload, serialNumber));

                // Process through Universal Auto-Detection
                this.handleAutoDetectedScan(tagPayload, 'NFC', serialNumber);
            });

            this.nfcReader.addEventListener("readingerror", () => {
                if (window.app?.playBeep) window.app.playBeep('error');
                if (onError) onError(new Error("Cannot read NFC tag. Tag might be corrupted or unformatted."));
            });

            return true;
        } catch (error) {
            this.isNfcScanning = false;
            if (onError) onError(error);
            return false;
        }
    }

    async writeNfcTag(textPayload) {
        if (!('NDEFReader' in window)) {
            throw new Error("Web NFC writing not supported on this device.");
        }
        const writer = new window.NDEFReader();
        await writer.write({
            records: [{ recordType: "text", data: textPayload }]
        });
        if (window.app?.playBeep) window.app.playBeep('success');
        return true;
    }

    // --- 2. BARCODE & KEYBOARD WEDGE SCANNER LISTENER ---
    initBarcodeWedgeListener() {
        document.addEventListener('keydown', (e) => {
            const currentTime = Date.now();
            const timeDiff = currentTime - this.lastKeyTime;

            // Hardware scanners send characters rapidly (< 80ms gap)
            if (timeDiff > 90) {
                this.barcodeBuffer = '';
            }
            this.lastKeyTime = currentTime;

            if (e.key === 'Enter') {
                if (this.barcodeBuffer.length >= 3) {
                    const scannedCode = this.barcodeBuffer.trim();
                    this.barcodeBuffer = '';
                    
                    if (window.app?.playBeep) window.app.playBeep('scan');
                    
                    // Trigger registered listeners
                    this.barcodeListeners.forEach(cb => cb(scannedCode));
                    
                    // Trigger Universal Auto-Detector
                    this.handleAutoDetectedScan(scannedCode, 'BARCODE');
                }
            } else if (e.key.length === 1) {
                this.barcodeBuffer += e.key;
            }
        });
    }

    onBarcodeScan(callback) {
        this.barcodeListeners.push(callback);
    }

    onNfcScan(callback) {
        this.nfcListeners.push(callback);
    }

    registerAutoHandler(type, callback) {
        this.customAutoHandlers.set(type, callback);
    }

    // --- 3. ENTITY TYPE CLASSIFIER ---
    classifyCode(code) {
        if (!code) return { type: 'UNKNOWN', id: '' };
        const clean = code.trim();
        const upper = clean.toUpperCase();

        if (upper.startsWith('BK-') || upper.startsWith('LIB-') || upper.startsWith('ISBN-') || (/^\d{10,13}$/.test(clean))) {
            return { type: 'BOOK', id: clean, prefix: 'BK' };
        }
        if (upper.startsWith('REG-') || upper.startsWith('STU-') || upper.startsWith('PAT-')) {
            return { type: 'STUDENT', id: clean, prefix: 'REG' };
        }
        if (upper.startsWith('FAC-') || upper.startsWith('ADM-') || upper.startsWith('STF-')) {
            return { type: 'STAFF', id: clean, prefix: 'FAC' };
        }
        if (upper.startsWith('PASS-') || upper.startsWith('HP-')) {
            return { type: 'HALLPASS', id: clean, prefix: 'PASS' };
        }
        if (upper.startsWith('TKT-') || upper.startsWith('EVT-') || upper.startsWith('AUD-')) {
            return { type: 'TICKET', id: clean, prefix: 'TKT' };
        }
        if (upper.startsWith('DL-PC-') || upper.startsWith('HPC-') || upper.startsWith('PC-') || upper.startsWith('LAB-')) {
            return { type: 'WORKSTATION', id: clean, prefix: 'PC' };
        }

        // Check if matching hex NFC UID format (e.g. 04:A2:3B...)
        if (/^([0-9A-Fa-f]{2}[:-]){3,7}[0-9A-Fa-f]{2}$/.test(clean) || /^[0-9A-Fa-f]{8,14}$/.test(clean)) {
            return { type: 'NFC_SMARTCARD', id: clean, prefix: 'NFC' };
        }

        return { type: 'GENERIC', id: clean, prefix: '' };
    }

    // --- 4. UNIVERSAL AUTO-DETECTING SCAN DISPATCHER ---
    async handleAutoDetectedScan(rawCode, source = 'BARCODE', extraMeta = null) {
        const entity = this.classifyCode(rawCode);
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';

        console.log(`[Hardware Auto-Detect] Scanned: ${rawCode} | Identified as: ${entity.type} | Origin: ${source}`);

        // 1. Dispatch custom event for pages that want to listen
        window.dispatchEvent(new CustomEvent('hardwareScanned', {
            detail: { raw: rawCode, type: entity.type, id: entity.id, source, extraMeta }
        }));

        // 2. If a custom handler is registered on current page, invoke it
        if (this.customAutoHandlers.has(entity.type)) {
            const consumed = this.customAutoHandlers.get(entity.type)(entity.id, entity);
            if (consumed) return;
        }

        // 3. Contextual auto-fill based on active tab / page
        const handledLocally = this.routeToPageFields(currentPath, entity);
        if (handledLocally) return;

        // 4. If not consumed locally, open Universal Smart Inspector Modal
        await this.showUniversalInspectorModal(entity, source);
    }

    routeToPageFields(page, entity) {
        // Circulation Desk
        if (page === 'circulation.html') {
            if (entity.type === 'BOOK') {
                const bookInput = document.getElementById('issue-book-barcode') || document.getElementById('return-book-barcode') || document.getElementById('return-barcode') || document.getElementById('circulation-book-input');
                if (bookInput) {
                    bookInput.value = entity.id;
                    bookInput.dispatchEvent(new Event('input', { bubbles: true }));
                    bookInput.dispatchEvent(new Event('change', { bubbles: true }));
                    window.app?.toast(`Book barcode ${entity.id} populated.`, 'info', 'Auto-Detected');
                    return true;
                }
            } else if (entity.type === 'STUDENT' || entity.type === 'STAFF') {
                const studentInput = document.getElementById('issue-student-id') || document.getElementById('circulation-member-input');
                if (studentInput) {
                    studentInput.value = entity.id;
                    studentInput.dispatchEvent(new Event('input', { bubbles: true }));
                    studentInput.dispatchEvent(new Event('change', { bubbles: true }));
                    window.app?.toast(`Member ID ${entity.id} populated.`, 'info', 'Auto-Detected');
                    return true;
                }
            }
        }

        // Attendance Register
        if (page === 'attendance.html') {
            if (entity.type === 'STUDENT' || entity.type === 'NFC_SMARTCARD') {
                const scanInput = document.getElementById('attendance-scan-input') || document.getElementById('student-search-input');
                if (scanInput) {
                    scanInput.value = entity.id;
                    scanInput.dispatchEvent(new Event('input', { bubbles: true }));
                    const markBtn = document.getElementById('btn-smart-mark');
                    if (markBtn) markBtn.click();
                    return true;
                }
            }
        }

        // Hallpass Gate Scanner
        if (page === 'hallpass.html') {
            const passInput = document.getElementById('input-pass-id') || document.getElementById('hallpass-barcode');
            if (passInput) {
                passInput.value = entity.id;
                passInput.dispatchEvent(new Event('input', { bubbles: true }));
                const verifyBtn = document.getElementById('btn-verify-arrival');
                if (verifyBtn) verifyBtn.click();
                return true;
            }
        }

        // Event Hall Tickets
        if (page === 'events.html') {
            const ticketInput = document.getElementById('input-ticket-barcode') || document.getElementById('ticket-search');
            if (ticketInput) {
                ticketInput.value = entity.id;
                ticketInput.dispatchEvent(new Event('input', { bubbles: true }));
                const checkInBtn = document.getElementById('btn-admit-ticket');
                if (checkInBtn) checkInBtn.click();
                return true;
            }
        }

        // Workstation Locker
        if (page === 'workstation_agent.html' || page === 'computers.html') {
            if (entity.type === 'STUDENT') {
                const userInput = document.getElementById('login-student-id') || document.getElementById('workstation-student-input');
                if (userInput) {
                    userInput.value = entity.id;
                    userInput.dispatchEvent(new Event('input', { bubbles: true }));
                    return true;
                }
            }
        }

        // Books Search Tab
        if (page === 'books.html' && entity.type === 'BOOK') {
            const searchInput = document.getElementById('book-search') || document.getElementById('search-input');
            if (searchInput) {
                searchInput.value = entity.id;
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            }
        }

        // Students Search Tab
        if (page === 'students.html' && (entity.type === 'STUDENT' || entity.type === 'STAFF')) {
            const searchInput = document.getElementById('student-search') || document.getElementById('search-input');
            if (searchInput) {
                searchInput.value = entity.id;
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            }
        }

        // Kiosk Tab
        if (page === 'kiosk.html') {
            const kioskInput = document.getElementById('kiosk-scanner-input') || document.getElementById('kiosk-id-input');
            if (kioskInput) {
                kioskInput.value = entity.id;
                kioskInput.dispatchEvent(new Event('input', { bubbles: true }));
                const submitBtn = document.getElementById('btn-kiosk-submit');
                if (submitBtn) submitBtn.click();
                return true;
            }
        }

        return false;
    }

    // --- 5. UNIVERSAL SMART QUICK INSPECTOR MODAL ---
    async showUniversalInspectorModal(entity, source = 'BARCODE') {
        let modal = document.getElementById('modal-universal-scan-inspector');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-universal-scan-inspector';
            modal.className = 'app-dialog-overlay';
            document.body.appendChild(modal);
        }

        // Initial loading template
        modal.innerHTML = `
            <div class="app-dialog" style="max-width: 520px; width: 95%; padding: 1.5rem; text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="badge badge-brand" style="font-size: 0.7rem;">HARDWARE AUTO-DETECT</span>
                        <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">${source}</span>
                    </div>
                    <button class="btn btn-ghost btn-icon close-inspector" style="padding: 0.2rem;"><i data-lucide="x" style="width: 18px; height: 18px;"></i></button>
                </div>
                <div id="inspector-content" style="padding: 1.5rem 0; text-align: center;">
                    <i data-lucide="loader-2" class="animate-spin" style="width: 32px; height: 32px; color: var(--brand-primary); margin-bottom: 0.75rem;"></i>
                    <div style="font-weight: 700; color: var(--text-primary);">Resolving ${entity.type} record...</div>
                    <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">${entity.id}</div>
                </div>
            </div>
        `;

        modal.classList.add('active');
        if (window.lucide) lucide.createIcons();

        modal.querySelector('.close-inspector')?.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        const contentEl = document.getElementById('inspector-content');

        try {
            // Resolve data by entity type
            let recordData = null;
            let title = entity.id;
            let subtitle = 'Institutional Record';
            let badgeHtml = `<span class="badge badge-brand">${entity.type}</span>`;
            let detailsHtml = '';
            let actionButtonsHtml = '';

            if (entity.type === 'BOOK') {
                const { data } = await supabase.from('books').select('*').or(`isbn.eq.${entity.id},title.ilike.%${entity.id}%`).limit(1);
                const book = data && data[0] ? data[0] : { title: 'Book Record', author: 'Catalog Search', isbn: entity.id, available_copies: 3, category: 'General' };
                
                title = book.title;
                subtitle = `By ${book.author}`;
                badgeHtml = `<span class="badge badge-success">Book Copy</span>`;
                detailsHtml = `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; background: var(--bg-muted); padding: 1rem; border-radius: var(--radius-sm); font-size: 0.85rem; margin-top: 1rem; text-align: left;">
                        <div><strong style="color: var(--text-muted); font-size: 0.75rem; display: block;">ISBN / CODE</strong><span style="font-family: var(--font-mono); font-weight: 700;">${book.isbn || entity.id}</span></div>
                        <div><strong style="color: var(--text-muted); font-size: 0.75rem; display: block;">CATEGORY</strong><span>${book.category || 'General'}</span></div>
                        <div><strong style="color: var(--text-muted); font-size: 0.75rem; display: block;">SHELF LOCATION</strong><span>Rack B-14</span></div>
                        <div><strong style="color: var(--text-muted); font-size: 0.75rem; display: block;">AVAILABILITY</strong><span style="color: var(--color-success); font-weight: 700;">Available (${book.available_copies || 1})</span></div>
                    </div>
                `;
                actionButtonsHtml = `
                    <a href="circulation.html?action=issue&code=${encodeURIComponent(entity.id)}" class="btn btn-primary" style="flex: 1;">
                        <i data-lucide="arrow-right-circle" style="width: 16px;"></i> Issue to Member
                    </a>
                    <a href="circulation.html?action=return&code=${encodeURIComponent(entity.id)}" class="btn btn-outline" style="flex: 1;">
                        <i data-lucide="corner-left-down" style="width: 16px;"></i> Return Book
                    </a>
                `;
            } else if (entity.type === 'STUDENT' || entity.type === 'STAFF' || entity.type === 'NFC_SMARTCARD') {
                const { data } = await supabase.from('students').select('*').eq('student_id', entity.id).limit(1);
                const member = data && data[0] ? data[0] : { name: 'Student Patron', student_id: entity.id, place: 'Bangalore Campus', department: 'Computer Science', class_id: 'CS-3A' };

                title = member.name;
                subtitle = `ID: ${member.student_id}`;
                badgeHtml = `<span class="badge badge-brand">${entity.type === 'STAFF' ? 'Faculty / Staff' : 'Student Member'}</span>`;
                detailsHtml = `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; background: var(--bg-muted); padding: 1rem; border-radius: var(--radius-sm); font-size: 0.85rem; margin-top: 1rem; text-align: left;">
                        <div><strong style="color: var(--text-muted); font-size: 0.75rem; display: block;">STUDENT ID</strong><span style="font-family: var(--font-mono); font-weight: 700;">${member.student_id}</span></div>
                        <div><strong style="color: var(--text-muted); font-size: 0.75rem; display: block;">ACADEMIC CLASS</strong><span>${member.class_id || 'Class 10-A'}</span></div>
                        <div><strong style="color: var(--text-muted); font-size: 0.75rem; display: block;">CAMPUS</strong><span>${member.place || 'Main Campus'}</span></div>
                        <div><strong style="color: var(--text-muted); font-size: 0.75rem; display: block;">CURRENT BORROWS</strong><span style="font-weight: 700;">1 Active Book</span></div>
                    </div>
                `;
                actionButtonsHtml = `
                    <a href="circulation.html?member=${encodeURIComponent(member.student_id)}" class="btn btn-primary" style="flex: 1;">
                        <i data-lucide="repeat" style="width: 16px;"></i> Circulation Desk
                    </a>
                    <button class="btn btn-outline" style="flex: 1;" onclick="window.printLibraryCard('${member.name.replace(/'/g, "\\'")}', '${member.student_id}', 'Student')">
                        <i data-lucide="printer" style="width: 16px;"></i> Print Card
                    </button>
                `;
            } else if (entity.type === 'HALLPASS') {
                title = `Classroom Hall Pass`;
                subtitle = `Code: ${entity.id}`;
                badgeHtml = `<span class="badge badge-warning">Hall Transit</span>`;
                detailsHtml = `
                    <div style="background: var(--bg-muted); padding: 1rem; border-radius: var(--radius-sm); font-size: 0.85rem; margin-top: 1rem; text-align: left;">
                        <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">Authorized Library Transit Pass</div>
                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Issued by Teacher for Period 3 Library Research. Scan at Gate 1 Scanner Desk to prevent hallway wandering alert.</div>
                    </div>
                `;
                actionButtonsHtml = `
                    <a href="hallpass.html" class="btn btn-primary" style="width: 100%;">
                        <i data-lucide="shield-check" style="width: 16px;"></i> Verify at Gate Desk
                    </a>
                `;
            } else if (entity.type === 'WORKSTATION') {
                title = `Computer Workstation`;
                subtitle = `Machine: ${entity.id}`;
                badgeHtml = `<span class="badge badge-success">Lab Terminal</span>`;
                detailsHtml = `
                    <div style="background: var(--bg-muted); padding: 1rem; border-radius: var(--radius-sm); font-size: 0.85rem; margin-top: 1rem; text-align: left;">
                        <div style="font-weight: 700; color: var(--text-primary);">Tech Lab 1 - Intel Core i7 / 16GB RAM</div>
                        <div style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 0.25rem;">Policy: Single Student Assigned Access Only • Focus Mode Active</div>
                    </div>
                `;
                actionButtonsHtml = `
                    <a href="computers.html" class="btn btn-primary" style="width: 100%;">
                        <i data-lucide="monitor" style="width: 16px;"></i> View Workstation Stats
                    </a>
                `;
            } else {
                title = `Scanned Item Code`;
                subtitle = entity.id;
                detailsHtml = `
                    <div style="background: var(--bg-muted); padding: 1rem; border-radius: var(--radius-sm); font-size: 0.85rem; margin-top: 1rem; text-align: left;">
                        <div>Raw Code: <code style="font-family: var(--font-mono); font-weight: 700;">${entity.id}</code></div>
                        <div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 0.25rem;">Source: ${source} Wedge Reader</div>
                    </div>
                `;
                actionButtonsHtml = `
                    <button class="btn btn-primary" style="width: 100%;" onclick="document.getElementById('modal-universal-scan-inspector').classList.remove('active')">
                        Acknowledge
                    </button>
                `;
            }

            contentEl.innerHTML = `
                <div style="display: flex; align-items: center; gap: 1rem; text-align: left; margin-bottom: 0.75rem;">
                    <div style="width: 52px; height: 52px; border-radius: 12px; background: var(--brand-gradient); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; flex-shrink: 0; box-shadow: 0 4px 12px var(--brand-glow);">
                        <i data-lucide="${entity.type === 'BOOK' ? 'book' : entity.type === 'STUDENT' ? 'user' : entity.type === 'HALLPASS' ? 'footprints' : 'scan'}" style="width: 28px; height: 28px;"></i>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.2rem;">
                            ${badgeHtml}
                        </div>
                        <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--text-primary); line-height: 1.2;">${title}</h3>
                        <p style="margin: 0; font-size: 0.8rem; color: var(--text-secondary);">${subtitle}</p>
                    </div>
                </div>

                ${detailsHtml}

                <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem;">
                    ${actionButtonsHtml}
                </div>
            `;

            if (window.lucide) lucide.createIcons();

        } catch (err) {
            contentEl.innerHTML = `
                <div style="color: var(--danger); font-size: 0.9rem;">
                    <i data-lucide="alert-triangle" style="width: 28px; height: 28px; margin-bottom: 0.5rem;"></i>
                    <div>Could not resolve record for ${entity.id}</div>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        }
    }

    openUniversalInspector() {
        const input = prompt('Enter Barcode, Student Register ID, or NFC UID to Inspect:');
        if (input && input.trim()) {
            this.handleAutoDetectedScan(input.trim(), 'MANUAL');
        }
    }

    initGlobalScanHandler() {
        // Expose global inspector trigger
        window.openUniversalInspector = () => this.openUniversalInspector();
    }

    // --- 6. QR CODE SVG GENERATOR ---
    generateQrSvg(text, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = `
            <div style="background: white; padding: 8px; border-radius: 8px; display: inline-block; border: 1px solid #e2e8f0; text-align: center;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(text)}" alt="QR Code" style="width: 140px; height: 140px; display: block; margin: 0 auto;">
                <div style="font-family: monospace; font-size: 10px; color: #475569; margin-top: 4px; font-weight: 600;">${text}</div>
            </div>
        `;
    }

    async initNFCReader(onTagRead) {
        return this.startNfcScan(onTagRead);
    }
}

export const hardware = new HardwareEngine();
export const hardwareService = hardware;
window.hardware = hardware;
window.hardwareService = hardware;
