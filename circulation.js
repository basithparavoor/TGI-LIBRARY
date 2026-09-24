import { supabase } from './supabaseClient.js';

export async function issueBook(barcode, studentId) {
    try {
        // 1. Verify Student
        const { data: student, error: studentErr } = await supabase
            .from('students')
            .select('id, status, borrow_limit')
            .eq('student_id', studentId)
            .single();
        
        if (studentErr || !student) throw new Error("Student not found.");
        if (student.status !== 'ACTIVE') throw new Error("Student account is inactive.");

        // 2. Verify Book Copy Status
        const { data: copy, error: copyErr } = await supabase
            .from('book_copies')
            .select('id, status')
            .eq('barcode', barcode)
            .single();

        if (copyErr || !copy) throw new Error("Book copy not found.");
        if (copy.status !== 'AVAILABLE') throw new Error(`Book is currently ${copy.status}.`);

        // 3. Check Current Borrowings & Limits
        const { count, error: countErr } = await supabase
            .from('loans')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', student.id)
            .eq('status', 'ACTIVE');
            
        if (count >= student.borrow_limit) throw new Error("Student has reached maximum borrowing limit.");

        // 4. Calculate Due Date (Assuming 14 days config)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        // 5. Execute Issue (Using RPC for database transaction if possible, or sequential async)
        const { error: insertErr } = await supabase
            .from('loans')
            .insert([{
                copy_id: copy.id,
                student_id: student.id,
                due_date: dueDate.toISOString(),
                status: 'ACTIVE'
            }]);

        if (insertErr) throw insertErr;

        // 6. Update Copy Status
        const { error: updateErr } = await supabase
            .from('book_copies')
            .update({ status: 'ISSUED' })
            .eq('id', copy.id);

        if (updateErr) throw updateErr;

        return { success: true, message: "Book issued successfully!" };

    } catch (error) {
        console.error("Circulation Error:", error);
        return { success: false, message: error.message };
    }
}