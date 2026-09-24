import { supabase } from './supabaseClient.js';

const generateBtn = document.getElementById('btn-generate');
const exportCsvBtn = document.getElementById('btn-export-csv');
const reportTypeSelect = document.getElementById('report-type');
const thead = document.getElementById('report-thead');
const tbody = document.getElementById('report-tbody');

let currentReportData = []; 

generateBtn?.addEventListener('click', async () => {
    const type = reportTypeSelect.value;
    const originalBtnText = generateBtn.innerHTML;
    generateBtn.innerHTML = "Generating...";
    generateBtn.disabled = true;

    tbody.innerHTML = '<tr><td colspan="100%" style="padding: 2rem; text-align: center; color: var(--text-secondary);">Loading data...</td></tr>';
    
    try {
        if (type === 'overdue') {
            await loadOverdueReport();
        } else if (type === 'active_loans') {
            // Placeholder for active loans report
            tbody.innerHTML = '<tr><td colspan="100%" style="padding: 2rem; text-align: center; color: var(--text-secondary);">Active loans report under construction.</td></tr>';
        } else if (type === 'fines') {
            // Placeholder for fines report
            tbody.innerHTML = '<tr><td colspan="100%" style="padding: 2rem; text-align: center; color: var(--text-secondary);">Pending fines report under construction.</td></tr>';
        }
    } catch (error) {
        console.error("Report Error:", error);
        tbody.innerHTML = `<tr><td colspan="100%" style="padding: 2rem; text-align: center; color: var(--danger);">Failed to load report.</td></tr>`;
    } finally {
        generateBtn.innerHTML = originalBtnText;
        generateBtn.disabled = false;
        if (window.lucide) lucide.createIcons();
    }
});

async function loadOverdueReport() {
    const { data, error } = await supabase
        .from('loans')
        .select(`
            id, due_date,
            students(student_id, name, class),
            book_copies(barcode, books(title))
        `)
        .eq('status', 'ACTIVE')
        .lt('due_date', new Date().toISOString()) 
        .order('due_date', { ascending: true });

    if (error) throw error;
    
    currentReportData = data.map(row => ({
        "Student ID": row.students.student_id,
        "Name": row.students.name,
        "Class": row.students.class,
        "Book Title": row.book_copies.books.title,
        "Barcode": row.book_copies.barcode,
        "Due Date": new Date(row.due_date).toLocaleDateString(),
        "Days Overdue": Math.ceil((new Date() - new Date(row.due_date)) / (1000 * 60 * 60 * 24))
    }));

    renderTable(
        ["Student", "Book Title", "Barcode", "Due Date", "Days Overdue"],
        currentReportData
    );
}

function renderTable(headers, data) {
    // Render Headers
    thead.innerHTML = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
    
    // Render Rows
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${headers.length}" style="padding: 3rem; text-align: center; color: var(--text-secondary);">No records found.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(row => {
        return `<tr>
            <td>
                <div style="font-weight: 500; color: var(--text-primary);">${row["Name"]}</div>
                <div style="font-size: 0.875rem; color: var(--text-secondary);">${row["Student ID"]} • ${row["Class"] || 'N/A'}</div>
            </td>
            <td><div style="font-weight: 500;">${row["Book Title"]}</div></td>
            <td style="font-family: monospace; color: var(--text-secondary);">${row["Barcode"]}</td>
            <td>${row["Due Date"]}</td>
            <td><span class="badge badge-danger">${row["Days Overdue"]} Days</span></td>
        </tr>`;
    }).join('');
}

// --- CSV EXPORT LOGIC ---
exportCsvBtn?.addEventListener('click', () => {
    if (!currentReportData.length) return alert("No data to export. Please generate a report first.");
    
    // Use the raw data keys for the CSV headers
    const rawHeaders = Object.keys(currentReportData[0]);
    const csvContent = [
        rawHeaders.join(','), 
        ...currentReportData.map(row => rawHeaders.map(h => `"${row[h]}"`).join(',')) 
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Library_Report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});