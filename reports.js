import { supabase } from './supabaseClient.js';

const generateBtn = document.getElementById('btn-generate');
const exportCsvBtn = document.getElementById('btn-export-csv');
const reportTypeSelect = document.getElementById('report-type');
const thead = document.getElementById('report-thead');
const tbody = document.getElementById('report-tbody');
const kpiRow = document.getElementById('report-kpi-row');

let currentReportData = [];
let currentReportType = '';

generateBtn?.addEventListener('click', async () => {
    const type = reportTypeSelect.value;
    currentReportType = type;
    const originalBtnText = generateBtn.innerHTML;
    generateBtn.innerText = "Generating...";
    generateBtn.disabled = true;

    tbody.innerHTML = `
        <tr>
            <td colspan="100%" style="padding: 3rem; text-align: center; color: var(--text-muted);">
                <i data-lucide="loader-2" class="animate-spin" style="width: 28px; height: 28px; margin-bottom: 0.5rem;"></i>
                <div>Compiling report metrics...</div>
            </td>
        </tr>
    `;
    if (window.lucide) lucide.createIcons();
    
    try {
        if (type === 'overdue') {
            await loadOverdueReport();
        } else if (type === 'active_loans') {
            await loadActiveLoansReport();
        } else if (type === 'fines_ledger') {
            await loadFinesLedgerReport();
        } else if (type === 'category_summary') {
            await loadCategorySummaryReport();
        }
    } catch (error) {
        console.error("Report Generation Error:", error);
        tbody.innerHTML = `<tr><td colspan="100%" style="padding: 2.5rem; text-align: center; color: var(--danger);">Failed to generate report: ${error.message}</td></tr>`;
    } finally {
        generateBtn.innerHTML = originalBtnText;
        generateBtn.disabled = false;
        if (window.lucide) lucide.createIcons();
    }
});

// 1. Overdue Books Report
async function loadOverdueReport() {
    const { data, error } = await supabase
        .from('loans')
        .select(`
            id, due_date, created_at,
            students(student_id, name, place, departments(name), classes(name)),
            book_copies(barcode, books(title, author, price))
        `)
        .eq('status', 'ACTIVE')
        .lt('due_date', new Date().toISOString())
        .order('due_date', { ascending: true });

    if (error) throw error;

    const FINE_PER_DAY = 2.00;
    const now = new Date();

    currentReportData = (data || []).map(row => {
        const dueDate = new Date(row.due_date);
        const daysOverdue = Math.max(1, Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24)));
        const fineEst = daysOverdue * FINE_PER_DAY;

        return {
            "Student ID": row.students?.student_id || 'N/A',
            "Member Name": row.students?.name || 'Unknown',
            "Department": row.students?.departments?.name || 'General',
            "Class": row.students?.classes?.name || 'N/A',
            "Book Title": row.book_copies?.books?.title || 'Unknown Title',
            "Barcode": row.book_copies?.barcode || '—',
            "Due Date": dueDate.toLocaleDateString(),
            "Days Overdue": daysOverdue,
            "Est. Fine (₹)": fineEst.toFixed(2)
        };
    });

    const totalFines = currentReportData.reduce((acc, r) => acc + parseFloat(r["Est. Fine (₹)"]), 0);

    if (kpiRow) {
        kpiRow.style.display = 'grid';
        kpiRow.innerHTML = `
            <div class="card card-glass stat-card">
                <div>
                    <p style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 700; margin-bottom: 0.25rem;">Total Overdue Titles</p>
                    <h3 style="font-size: 1.85rem; font-weight: 800; color: var(--danger); margin: 0;">${currentReportData.length}</h3>
                </div>
                <div class="stat-icon-wrapper" style="background: rgba(239,68,68,0.1); color: var(--danger);"><i data-lucide="alert-triangle"></i></div>
            </div>
            <div class="card card-glass stat-card">
                <div>
                    <p style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 700; margin-bottom: 0.25rem;">Estimated Fines Outstanding</p>
                    <h3 style="font-size: 1.85rem; font-weight: 800; color: var(--warning); margin: 0;">₹${totalFines.toFixed(2)}</h3>
                </div>
                <div class="stat-icon-wrapper" style="background: rgba(245,158,11,0.1); color: var(--warning);"><i data-lucide="coins"></i></div>
            </div>
        `;
    }

    thead.innerHTML = `
        <tr>
            <th>Member Details</th>
            <th>Book Title</th>
            <th>Barcode</th>
            <th>Due Date</th>
            <th>Days Overdue</th>
            <th style="text-align: right;">Est. Fine</th>
        </tr>
    `;

    if (currentReportData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding: 3rem; text-align: center; color: var(--success); font-weight: 600;">✓ No overdue books! All issued books are within loan limits.</td></tr>`;
        return;
    }

    tbody.innerHTML = currentReportData.map(r => `
        <tr>
            <td data-label="Member Details">
                <div style="font-weight: 700; color: var(--text-primary);">${r["Member Name"]}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">${r["Student ID"]} • ${r["Class"]} (${r["Department"]})</div>
            </td>
            <td data-label="Book Title">
                <div style="font-weight: 600;">${r["Book Title"]}</div>
            </td>
            <td data-label="Barcode" style="font-family: var(--font-mono); font-size: 0.85rem;">${r["Barcode"]}</td>
            <td data-label="Due Date">${r["Due Date"]}</td>
            <td data-label="Days Overdue"><span class="badge badge-danger">${r["Days Overdue"]} Days</span></td>
            <td data-label="Est. Fine" style="text-align: right; font-weight: 700; color: var(--danger);">₹${r["Est. Fine (₹)"]}</td>
        </tr>
    `).join('');
}

// 2. Active Member Loans Report
async function loadActiveLoansReport() {
    const { data, error } = await supabase
        .from('loans')
        .select(`
            id, due_date, created_at,
            students(student_id, name, departments(name), classes(name)),
            book_copies(barcode, books(title, author))
        `)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false });

    if (error) throw error;

    currentReportData = (data || []).map(row => ({
        "Student ID": row.students?.student_id || 'N/A',
        "Member Name": row.students?.name || 'Unknown',
        "Class": row.students?.classes?.name || 'N/A',
        "Book Title": row.book_copies?.books?.title || 'Unknown Title',
        "Author": row.book_copies?.books?.author || 'Unknown',
        "Barcode": row.book_copies?.barcode || '—',
        "Issue Date": new Date(row.created_at).toLocaleDateString(),
        "Due Date": new Date(row.due_date).toLocaleDateString()
    }));

    if (kpiRow) {
        kpiRow.style.display = 'grid';
        kpiRow.innerHTML = `
            <div class="card card-glass stat-card">
                <div>
                    <p style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 700; margin-bottom: 0.25rem;">Total Active Loans</p>
                    <h3 style="font-size: 1.85rem; font-weight: 800; color: var(--brand-primary); margin: 0;">${currentReportData.length}</h3>
                </div>
                <div class="stat-icon-wrapper"><i data-lucide="book-up"></i></div>
            </div>
        `;
    }

    thead.innerHTML = `
        <tr>
            <th>Member</th>
            <th>Book Title & Author</th>
            <th>Accession Barcode</th>
            <th>Issue Date</th>
            <th>Due Date</th>
        </tr>
    `;

    if (currentReportData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding: 3rem; text-align: center; color: var(--text-muted);">No active loans found.</td></tr>`;
        return;
    }

    tbody.innerHTML = currentReportData.map(r => `
        <tr>
            <td data-label="Member">
                <div style="font-weight: 700;">${r["Member Name"]}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">${r["Student ID"]} • ${r["Class"]}</div>
            </td>
            <td data-label="Book Title">
                <div style="font-weight: 600;">${r["Book Title"]}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">${r["Author"]}</div>
            </td>
            <td data-label="Barcode" style="font-family: var(--font-mono); font-size: 0.85rem;">${r["Barcode"]}</td>
            <td data-label="Issue Date">${r["Issue Date"]}</td>
            <td data-label="Due Date"><span class="badge badge-brand">${r["Due Date"]}</span></td>
        </tr>
    `).join('');
}

// 3. Fines & Penalties Ledger Report
async function loadFinesLedgerReport() {
    let finesData = [];
    try {
        const { data, error } = await supabase
            .from('fines')
            .select(`
                id, amount, status, created_at,
                students(name, student_id)
            `)
            .order('created_at', { ascending: false });

        if (!error && data) finesData = data;
    } catch (e) {
        console.warn("Could not query fines table", e);
    }

    currentReportData = finesData.map(f => ({
        "Receipt ID": f.id.slice(0, 8).toUpperCase(),
        "Member Name": f.students?.name || 'Member',
        "Student ID": f.students?.student_id || 'N/A',
        "Amount (₹)": parseFloat(f.amount || 0).toFixed(2),
        "Date Assessed": new Date(f.created_at).toLocaleDateString(),
        "Status": f.status || 'UNPAID'
    }));

    const totalFinesSum = currentReportData.reduce((acc, f) => acc + parseFloat(f["Amount (₹)"]), 0);

    if (kpiRow) {
        kpiRow.style.display = 'grid';
        kpiRow.innerHTML = `
            <div class="card card-glass stat-card">
                <div>
                    <p style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 700; margin-bottom: 0.25rem;">Total Fines Assessed</p>
                    <h3 style="font-size: 1.85rem; font-weight: 800; color: var(--danger); margin: 0;">₹${totalFinesSum.toFixed(2)}</h3>
                </div>
                <div class="stat-icon-wrapper" style="background: rgba(239,68,68,0.1); color: var(--danger);"><i data-lucide="receipt"></i></div>
            </div>
            <div class="card card-glass stat-card">
                <div>
                    <p style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 700; margin-bottom: 0.25rem;">Ledger Entries</p>
                    <h3 style="font-size: 1.85rem; font-weight: 800; color: var(--text-primary); margin: 0;">${currentReportData.length}</h3>
                </div>
                <div class="stat-icon-wrapper"><i data-lucide="file-text"></i></div>
            </div>
        `;
    }

    thead.innerHTML = `
        <tr>
            <th>Receipt #</th>
            <th>Member</th>
            <th>Date Assessed</th>
            <th>Fine Amount</th>
            <th style="text-align: right;">Payment Status</th>
        </tr>
    `;

    if (currentReportData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding: 3rem; text-align: center; color: var(--text-muted);">No fine records logged in ledger.</td></tr>`;
        return;
    }

    tbody.innerHTML = currentReportData.map(f => `
        <tr>
            <td data-label="Receipt #" style="font-family: var(--font-mono); font-weight: 700;">#${f["Receipt ID"]}</td>
            <td data-label="Member">
                <div style="font-weight: 600;">${f["Member Name"]}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">${f["Student ID"]}</div>
            </td>
            <td data-label="Date">${f["Date Assessed"]}</td>
            <td data-label="Fine Amount" style="font-weight: 700; color: var(--danger);">₹${f["Amount (₹)"]}</td>
            <td data-label="Status" style="text-align: right;">
                <span class="badge ${f["Status"] === 'PAID' ? 'badge-success' : 'badge-danger'}">${f["Status"]}</span>
            </td>
        </tr>
    `).join('');
}

// 4. Category Summary Report
async function loadCategorySummaryReport() {
    const [{ data: categories }, { data: books }] = await Promise.all([
        supabase.from('categories').select('id, name'),
        supabase.from('books').select('id, category_id, book_copies(id, status)')
    ]);

    const catStats = {};
    if (categories) {
        categories.forEach(c => {
            catStats[c.id] = { name: c.name, titles: 0, totalCopies: 0, availCopies: 0 };
        });
    }

    catStats['uncat'] = { name: 'Uncategorized', titles: 0, totalCopies: 0, availCopies: 0 };

    if (books) {
        books.forEach(b => {
            const key = b.category_id && catStats[b.category_id] ? b.category_id : 'uncat';
            catStats[key].titles++;
            const total = b.book_copies?.length || 0;
            const avail = b.book_copies?.filter(c => c.status === 'AVAILABLE').length || 0;
            catStats[key].totalCopies += total;
            catStats[key].availCopies += avail;
        });
    }

    currentReportData = Object.values(catStats)
        .filter(c => c.titles > 0 || c.totalCopies > 0)
        .map(c => ({
            "Category Name": c.name,
            "Total Titles": c.titles,
            "Total Physical Copies": c.totalCopies,
            "Available Copies": c.availCopies,
            "Checked Out Copies": c.totalCopies - c.availCopies
        }));

    const totalTitles = currentReportData.reduce((acc, c) => acc + c["Total Titles"], 0);
    const totalCopies = currentReportData.reduce((acc, c) => acc + c["Total Physical Copies"], 0);

    if (kpiRow) {
        kpiRow.style.display = 'grid';
        kpiRow.innerHTML = `
            <div class="card card-glass stat-card">
                <div>
                    <p style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 700; margin-bottom: 0.25rem;">Total Catalog Titles</p>
                    <h3 style="font-size: 1.85rem; font-weight: 800; color: var(--brand-primary); margin: 0;">${totalTitles}</h3>
                </div>
                <div class="stat-icon-wrapper"><i data-lucide="book-open"></i></div>
            </div>
            <div class="card card-glass stat-card">
                <div>
                    <p style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 700; margin-bottom: 0.25rem;">Total Physical Volumes</p>
                    <h3 style="font-size: 1.85rem; font-weight: 800; color: var(--success); margin: 0;">${totalCopies}</h3>
                </div>
                <div class="stat-icon-wrapper" style="background: rgba(16,185,129,0.1); color: var(--success);"><i data-lucide="layers"></i></div>
            </div>
        `;
    }

    thead.innerHTML = `
        <tr>
            <th>Category Name</th>
            <th>Book Titles</th>
            <th>Total Copies</th>
            <th>In Stock (Available)</th>
            <th style="text-align: right;">Checked Out</th>
        </tr>
    `;

    tbody.innerHTML = currentReportData.map(c => `
        <tr>
            <td data-label="Category"><span class="badge badge-brand" style="font-size: 0.8rem;">${c["Category Name"]}</span></td>
            <td data-label="Titles" style="font-weight: 700;">${c["Total Titles"]} Titles</td>
            <td data-label="Total Copies">${c["Total Physical Copies"]}</td>
            <td data-label="Available"><span class="badge badge-success">${c["Available Copies"]}</span></td>
            <td data-label="Checked Out" style="text-align: right; font-weight: 600; color: var(--warning);">${c["Checked Out Copies"]}</td>
        </tr>
    `).join('');
}

// --- CSV EXPORT LOGIC ---
exportCsvBtn?.addEventListener('click', () => {
    if (!currentReportData.length) {
        return window.app?.toast("Please generate a report first before exporting.", "warning", "Export");
    }

    const rawHeaders = Object.keys(currentReportData[0]);
    const csvContent = [
        rawHeaders.join(','),
        ...currentReportData.map(row => rawHeaders.map(h => `"${(row[h] + '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Library_${currentReportType.toUpperCase()}_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.app?.toast("Report CSV downloaded successfully.", "success", "Export Complete");
});

document.addEventListener('DOMContentLoaded', () => {
    // Auto generate overdue report on load
    loadOverdueReport();
});