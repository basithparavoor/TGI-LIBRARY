import { supabase } from './supabaseClient.js';
// Assuming issueBook is imported from our earlier circulation.js
import { issueBook } from './circulation.js'; 

// Settings (Should ideally be fetched from a 'settings' table in DB)
const FINE_PER_DAY = 5.00; 

// --- ISSUE FORM HANDLER ---
document.getElementById('form-issue')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const studentId = document.getElementById('issue-student-id').value.trim();
    const barcode = document.getElementById('issue-book-barcode').value.trim();
    const statusDiv = document.getElementById('issue-status');

    statusDiv.style.color = 'var(--text-secondary)';
    statusDiv.innerText = 'Processing...';

    const result = await issueBook(barcode, studentId);
    
    if (result.success) {
        statusDiv.style.color = 'var(--success)';
        statusDiv.innerText = `✓ ${result.message}`;
        e.target.reset();
        document.getElementById('issue-student-id').focus(); // Ready for next scan
    } else {
        statusDiv.style.color = 'var(--danger)';
        statusDiv.innerText = `✗ Error: ${result.message}`;
    }
});

// --- RETURN FORM HANDLER ---
document.getElementById('form-return')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const barcode = document.getElementById('return-book-barcode').value.trim();
    const statusDiv = document.getElementById('return-status');

    statusDiv.style.color = 'var(--text-secondary)';
    statusDiv.innerText = 'Processing return...';

    const result = await processReturn(barcode);
    
    if (result.success) {
        statusDiv.style.color = 'var(--success)';
        let msg = `✓ Returned successfully.`;
        if (result.fine > 0) msg += ` (Fine generated: ₹${result.fine})`;
        statusDiv.innerText = msg;
        e.target.reset();
        document.getElementById('return-book-barcode').focus();
    } else {
        statusDiv.style.color = 'var(--danger)';
        statusDiv.innerText = `✗ Error: ${result.message}`;
    }
});

// --- CORE RETURN LOGIC ---
async function processReturn(barcode) {
    try {
        // 1. Find the active loan for this book copy
        const { data: loanData, error: loanErr } = await supabase
            .from('loans')
            .select(`
                id, due_date, student_id,
                book_copies!inner(id, barcode, status)
            `)
            .eq('book_copies.barcode', barcode)
            .eq('status', 'ACTIVE')
            .single();

        if (loanErr || !loanData) throw new Error("No active loan found for this barcode.");

        // 2. Calculate Overdue & Fine
        const now = new Date();
        const dueDate = new Date(loanData.due_date);
        let fineAmount = 0;

        if (now > dueDate) {
            // Calculate difference in milliseconds, convert to full days
            const diffTime = Math.abs(now - dueDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            fineAmount = diffDays * FINE_PER_DAY;
        }

        // 3. Mark Loan as Returned
        const { error: updateLoanErr } = await supabase
            .from('loans')
            .update({ 
                status: 'RETURNED', 
                returned_at: now.toISOString() 
            })
            .eq('id', loanData.id);
        if (updateLoanErr) throw updateLoanErr;

        // 4. Mark Book Copy as Available
        const { error: updateCopyErr } = await supabase
            .from('book_copies')
            .update({ status: 'AVAILABLE' })
            .eq('id', loanData.book_copies.id);
        if (updateCopyErr) throw updateCopyErr;

        // 5. Generate Fine Record if applicable
        if (fineAmount > 0) {
            const { error: fineErr } = await supabase
                .from('fines')
                .insert([{
                    loan_id: loanData.id,
                    student_id: loanData.student_id,
                    amount: fineAmount,
                    status: 'UNPAID'
                }]);
            if (fineErr) console.error("Failed to generate fine record:", fineErr);
        }

        return { success: true, fine: fineAmount };
    } catch (err) {
        console.error("Return Error:", err);
        return { success: false, message: err.message };
    }
}