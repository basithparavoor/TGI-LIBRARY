import { supabase } from './supabaseClient.js';

let html5QrcodeScanner = null;
let expectedBarcodes = new Set();
let scannedBarcodes = new Set();

const scanCountEl = document.getElementById('scan-count');
const expectedCountEl = document.getElementById('expected-count');
const progressBarEl = document.getElementById('audit-progress-bar');
const recentScansList = document.getElementById('recent-scans-list');
const btnStart = document.getElementById('btn-start-audit');
const btnStop = document.getElementById('btn-stop-audit');
const manualInput = document.getElementById('manual-audit-barcode');

// 1. Fetch Expected Inventory
async function loadExpectedInventory() {
    try {
        const { data, error } = await supabase
            .from('book_copies')
            .select('barcode')
            .eq('status', 'AVAILABLE');
            
        if (error) throw error;
        
        data.forEach(item => expectedBarcodes.add(item.barcode));
        expectedCountEl.innerText = expectedBarcodes.size;
        updateProgress();
    } catch (err) {
        console.error("Failed to load inventory:", err);
        expectedCountEl.innerText = "Error loading data";
    }
}

// 2. Handle a Scan Event
function processBarcode(barcode) {
    if (!barcode) return;
    
    // Play subtle beep sound for rapid feedback (optional but recommended for bulk scans)
    // new Audio('beep.mp3').play();

    if (!scannedBarcodes.has(barcode)) {
        scannedBarcodes.add(barcode);
        
        // Remove empty state message if present
        if (scannedBarcodes.size === 1) recentScansList.innerHTML = '';
        
        // Add to UI List
        const status = expectedBarcodes.has(barcode) ? 
            `<span style="color: var(--success);"><i data-lucide="check-circle" style="width: 14px;"></i> Verified</span>` : 
            `<span style="color: var(--warning);"><i data-lucide="alert-circle" style="width: 14px;"></i> Unknown</span>`;

        const itemHtml = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                <span style="font-family: monospace; font-weight: 500;">${barcode}</span>
                <span style="font-size: 0.75rem; font-weight: 600;">${status}</span>
            </div>
        `;
        recentScansList.insertAdjacentHTML('afterbegin', itemHtml);
        lucide.createIcons();
        
        // Update Stats
        scanCountEl.innerText = `${scannedBarcodes.size} Scanned`;
        updateProgress();
    }
    
    manualInput.value = '';
}

function updateProgress() {
    if (expectedBarcodes.size === 0) return;
    let matchCount = 0;
    scannedBarcodes.forEach(b => { if (expectedBarcodes.has(b)) matchCount++; });
    const percentage = Math.min((matchCount / expectedBarcodes.size) * 100, 100);
    progressBarEl.style.width = `${percentage}%`;
}

// 3. Scanner Controls
btnStart.addEventListener('click', () => {
    if (!html5QrcodeScanner) {
        // Use continuous mode, don't stop after first scan
        html5QrcodeScanner = new Html5QrcodeScanner("audit-reader", { 
            fps: 10, 
            qrbox: { width: 250, height: 100 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true
        }, false);
    }
    
    html5QrcodeScanner.render(
        (decodedText) => processBarcode(decodedText),
        (errorMessage) => { /* Ignore background errors */ }
    );
    
    btnStart.disabled = true;
    btnStop.disabled = false;
});

btnStop.addEventListener('click', () => {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear();
        btnStart.disabled = false;
        btnStop.disabled = true;
    }
});

// Manual Entry
document.getElementById('btn-add-manual').addEventListener('click', () => processBarcode(manualInput.value.trim()));
manualInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') processBarcode(manualInput.value.trim());
});

// 4. Reconcile (Generate Discrepancy)
document.getElementById('btn-reconcile').addEventListener('click', () => {
    const missing = [];
    expectedBarcodes.forEach(b => {
        if (!scannedBarcodes.has(b)) missing.push(b);
    });
    
    alert(`Inventory Audit Complete.\n\nTotal Expected: ${expectedBarcodes.size}\nTotal Scanned: ${scannedBarcodes.size}\nMissing Items: ${missing.length}\n\n(In production, this would update book statuses to 'MISSING' or generate a downloadable CSV).`);
});

document.addEventListener('DOMContentLoaded', loadExpectedInventory);