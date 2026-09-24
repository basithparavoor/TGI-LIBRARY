import { supabase } from './supabaseClient.js';

// --- UI Elements: Table & Pagination ---
const tbody = document.getElementById('books-table-body');
const searchInput = document.getElementById('search-books');
const filterCategory = document.getElementById('filter-category');
const selectAllCb = document.getElementById('select-all');
const selectionCountBadge = document.getElementById('selection-count');
const rowsPerPageSelect = document.getElementById('rows-per-page');
const btnPrev = document.getElementById('btn-prev-page');
const btnNext = document.getElementById('btn-next-page');
const paginationInfo = document.getElementById('pagination-info');
const pageDisplay = document.getElementById('current-page-display');

// --- UI Elements: Modal & Form ---
const modalAddBook = document.getElementById('modal-add-book');
const btnOpenModal = document.getElementById('btn-add-book');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelAdd = document.getElementById('btn-cancel-add');
const formAddBook = document.getElementById('form-add-book');
const addCategorySelect = document.getElementById('add-category');
const addPublisherSelect = document.getElementById('add-publisher');
const addShelfSelect = document.getElementById('add-shelf');
const addRackSelect = document.getElementById('add-rack');

let currentEditBookId = null;

// --- Data State ---
let state = {
    allData: [],
    filteredData: [],
    selectedIds: new Set(),
    page: 1,
    limit: 25
};

// --- 1. MASTER DATA ---
async function loadMasterData() {
    try {
        const { data: categories } = await supabase.from('categories').select('id, name').order('name');
        if (categories) {
            const options = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            if (filterCategory) filterCategory.innerHTML += options;
            if (addCategorySelect) addCategorySelect.innerHTML += options;
        }

        const { data: publishers } = await supabase.from('publishers').select('id, name').order('name');
        if (publishers && addPublisherSelect) {
            addPublisherSelect.innerHTML += publishers.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        }

        const { data: shelves } = await supabase.from('shelves').select('id, name').order('name');
        if (shelves && addShelfSelect) {
            addShelfSelect.innerHTML += shelves.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        }
    } catch (error) {
        console.error("Error loading master data:", error);
    }
}

window.loadRacksForShelf = async function(shelfId) {
    if (!addRackSelect) return;
    addRackSelect.innerHTML = '<option value="">Select Rack...</option>';
    if (!shelfId) return;

    const { data: racks } = await supabase.from('racks').select('id, name').eq('shelf_id', shelfId).order('name');
    if (racks) {
        addRackSelect.innerHTML += racks.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    }
};

// --- 2. FETCH & STATE MANAGEMENT ---
async function fetchBooks() {
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="padding: 2rem; text-align: center;">Loading...</td></tr>';
    
    const { data, error } = await supabase
        .from('books')
        .select(`id, title, author, isbn, price, edition, category_id, publisher_id, categories(name), book_copies(id, status)`)
        .order('created_at', { ascending: false })
        .limit(1000);

    if (error) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--danger);">Failed to load data.</td></tr>';
        return;
    }

    state.allData = data || [];
    applyFilters();
}

function applyFilters() {
    const query = searchInput?.value?.toLowerCase() || '';
    const catId = filterCategory?.value || '';

    state.filteredData = state.allData.filter(book => {
        const matchesSearch = !query || 
            book.title.toLowerCase().includes(query) || 
            book.author.toLowerCase().includes(query) || 
            (book.isbn && book.isbn.includes(query));
            
        const matchesCat = !catId || book.category_id === catId;
        return matchesSearch && matchesCat;
    });

    state.page = 1; 
    updateTable();
}

// Replace this block in books.js
function updateTable() {
    if (!tbody) return;
    
    const start = (state.page - 1) * state.limit;
    const end = start + state.limit;
    const paginatedItems = state.filteredData.slice(start, end);

    if (paginatedItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-secondary);">No records found.</td></tr>';
    } else {
        tbody.innerHTML = paginatedItems.map(book => {
            const totalCopies = book.book_copies?.length || 0;
            const availCopies = book.book_copies?.filter(c => c.status === 'AVAILABLE').length || 0;
            const isSelected = state.selectedIds.has(book.id);
            
            return `
                <tr style="${isSelected ? 'background: rgba(37,99,235,0.05);' : ''}">
                    <td class="checkbox-cell" data-label="Select"><input type="checkbox" class="custom-checkbox row-checkbox" data-id="${book.id}" ${isSelected ? 'checked' : ''}></td>
                    <td data-label="Title & Author">
                        <div style="font-weight: 500; color: var(--text-primary);">${book.title}</div>
                        <div style="font-size: 0.875rem; color: var(--text-secondary);">${book.author}</div>
                    </td>
                    <td data-label="ISBN" style="color: var(--text-secondary); font-family: monospace;">${book.isbn || 'N/A'}</td>
                    <td data-label="Category"><span class="badge" style="background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-secondary);">${book.categories?.name || 'Uncategorized'}</span></td>
                    <td data-label="Copies">
                        <span style="color: ${availCopies > 0 ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">${availCopies}</span> 
                        <span style="color: var(--text-secondary); font-size: 0.875rem;">/ ${totalCopies}</span>
                    </td>
                    <td data-label="Actions" style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                        <button class="btn btn-sm btn-outline" onclick="window.editBook('${book.id}')" title="Edit"><i data-lucide="edit" style="width: 14px;"></i></button>
                        <button class="btn btn-sm" style="color: var(--danger); border: 1px solid var(--danger); background: transparent;" onclick="window.deleteBook('${book.id}', '${book.title.replace(/'/g, "\\'")}')" title="Delete"><i data-lucide="trash-2" style="width: 14px;"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    if (window.lucide) lucide.createIcons();
    updatePaginationUI();
    attachCheckboxListeners();
}

function updatePaginationUI() {
    const total = state.filteredData.length;
    const start = total === 0 ? 0 : ((state.page - 1) * state.limit) + 1;
    const end = Math.min(state.page * state.limit, total);
    
    if (paginationInfo) paginationInfo.innerText = `Showing ${start}-${end} of ${total}`;
    if (pageDisplay) pageDisplay.innerText = `Page ${state.page}`;
    
    if (btnPrev) btnPrev.disabled = state.page === 1;
    if (btnNext) btnNext.disabled = end >= total;
    
    if (selectAllCb) {
        const currentViewIds = state.filteredData.slice((state.page - 1) * state.limit, state.page * state.limit).map(b => b.id);
        selectAllCb.checked = currentViewIds.length > 0 && currentViewIds.every(id => state.selectedIds.has(id));
    }
}

// --- 4. SELECTION LOGIC ---
function attachCheckboxListeners() {
    document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = e.target.getAttribute('data-id');
            if (e.target.checked) state.selectedIds.add(id);
            else state.selectedIds.delete(id);
            updateSelectionBadge();
            
            if (selectAllCb) {
                const currentViewIds = state.filteredData.slice((state.page - 1) * state.limit, state.page * state.limit).map(b => b.id);
                selectAllCb.checked = currentViewIds.every(cid => state.selectedIds.has(cid));
            }
        });
    });
}

selectAllCb?.addEventListener('change', (e) => {
    const currentViewIds = state.filteredData.slice((state.page - 1) * state.limit, state.page * state.limit).map(b => b.id);
    if (e.target.checked) currentViewIds.forEach(id => state.selectedIds.add(id));
    else currentViewIds.forEach(id => state.selectedIds.delete(id));
    updateTable(); 
    updateSelectionBadge();
});

function updateSelectionBadge() {
    if (!selectionCountBadge) return;
    if (state.selectedIds.size > 0) {
        selectionCountBadge.style.display = 'inline-block';
        selectionCountBadge.innerText = `${state.selectedIds.size} Selected`;
    } else {
        selectionCountBadge.style.display = 'none';
    }
}

// --- 5. EXPORT LOGIC ---
window.exportData = function(format) {
    const exportDataset = state.selectedIds.size > 0 
        ? state.allData.filter(b => state.selectedIds.has(b.id)) 
        : state.filteredData;
        
    if (exportDataset.length === 0) return window.app?.alert("No data to export.", "Export");

    if (format === 'csv') {
        const headers = ["Title", "Author", "ISBN", "Category", "Price", "Total Copies"];
        const csvRows = exportDataset.map(b => {
            return `"${b.title}","${b.author}","${b.isbn || ''}","${b.categories?.name || ''}","${b.price || 0}","${b.book_copies?.length || 0}"`;
        });
        
        const csvContent = [headers.join(','), ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Catalogue_Export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    } 
    else if (format === 'pdf') {
        window.print();
    }
};

// --- 6. EDIT & DELETE ---
window.editBook = async function(id) {
    currentEditBookId = id;
    document.getElementById('btn-submit-book').innerText = 'Update Book';
    document.querySelector('#modal-add-book h2').innerText = 'Edit Book';
    
    const { data: book, error } = await supabase.from('books').select('*').eq('id', id).single();
    if (error) return window.app?.alert("Could not fetch book details.", "Error");

    document.getElementById('add-title').value = book.title;
    document.getElementById('add-author').value = book.author;
    document.getElementById('add-isbn').value = book.isbn || '';
    document.getElementById('add-price').value = book.price || '';
    document.getElementById('add-edition').value = book.edition || '';
    if (book.category_id) document.getElementById('add-category').value = book.category_id;
    if (book.publisher_id) document.getElementById('add-publisher').value = book.publisher_id;
    
    document.getElementById('add-copies').parentElement.style.display = 'none';
    document.getElementById('add-shelf').parentElement.style.display = 'none';
    document.getElementById('add-rack').parentElement.style.display = 'none';
    
    if (modalAddBook) modalAddBook.style.display = 'flex';
};

window.deleteBook = function(id, title) {
    if (!window.app) return;
    window.app.confirm(`Delete "${title}"? All physical copies will be removed.`, "Delete Book", async () => {
        await supabase.from('book_copies').delete().eq('book_id', id);
        await supabase.from('books').delete().eq('id', id);
        fetchBooks();
    });
};

// --- 7. MODAL & FORM SUBMISSION ---
const toggleModal = (show) => {
    if (!modalAddBook) return;
    modalAddBook.style.display = show ? 'flex' : 'none';
    if (!show) {
        formAddBook?.reset();
        currentEditBookId = null;
        
        const submitBtn = document.getElementById('btn-submit-book');
        const header = document.querySelector('#modal-add-book h2');
        if (submitBtn) submitBtn.innerText = 'Save Book & Generate Barcodes';
        if (header) header.innerText = 'Add New Book to Catalogue';
        
        document.getElementById('add-copies').parentElement.style.display = 'block';
        document.getElementById('add-shelf').parentElement.style.display = 'block';
        document.getElementById('add-rack').parentElement.style.display = 'block';
    }
};

btnOpenModal?.addEventListener('click', () => toggleModal(true));
btnCloseModal?.addEventListener('click', () => toggleModal(false));
btnCancelAdd?.addEventListener('click', () => toggleModal(false));

formAddBook?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit-book');
    btnSubmit.innerText = 'Processing...';
    btnSubmit.disabled = true;

    try {
        let categoryId = document.getElementById('add-category').value;
        let publisherId = document.getElementById('add-publisher').value;

        if (categoryId.startsWith('NEW_')) {
            const { data } = await supabase.from('categories').insert([{ name: categoryId.replace('NEW_', '') }]).select().single();
            categoryId = data.id;
        }
        if (publisherId.startsWith('NEW_')) {
            const { data } = await supabase.from('publishers').insert([{ name: publisherId.replace('NEW_', '') }]).select().single();
            publisherId = data.id;
        }

        const bookPayload = {
            title: document.getElementById('add-title').value.trim(),
            author: document.getElementById('add-author').value.trim(),
            isbn: document.getElementById('add-isbn').value.trim() || null,
            category_id: categoryId || null,
            publisher_id: publisherId || null,
            price: parseFloat(document.getElementById('add-price').value) || 0.00,
            edition: document.getElementById('add-edition').value.trim() || null
        };

        if (currentEditBookId) {
            await supabase.from('books').update(bookPayload).eq('id', currentEditBookId);
            window.app?.alert("Book updated successfully.", "Update Complete");
        } else {
            const { data: bookData } = await supabase.from('books').insert([bookPayload]).select().single();
            const numCopies = parseInt(document.getElementById('add-copies').value) || 1;
            const copiesToInsert = [];
            for (let i = 0; i < numCopies; i++) {
                copiesToInsert.push({
                    book_id: bookData.id,
                    barcode: `ATH-B-${Date.now().toString().slice(-6)}-${i + 1}`,
                    status: 'AVAILABLE',
                    shelf_id: document.getElementById('add-shelf').value || null,
                    rack_id: document.getElementById('add-rack').value || null
                });
            }
            await supabase.from('book_copies').insert(copiesToInsert);
            window.app?.alert(`Added "${bookPayload.title}" and generated ${numCopies} barcode(s).`, "Book Added");
        }
        
        fetchBooks();
        toggleModal(false);

    } catch (err) {
        console.error(err);
        window.app?.alert("Failed to process request.", "Error");
    } finally {
        btnSubmit.innerText = 'Save Book';
        btnSubmit.disabled = false;
        currentEditBookId = null;
    }
});

// --- 8. INITIALIZE ---
let searchTimeout = null;
searchInput?.addEventListener('input', () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(applyFilters, 300); });
filterCategory?.addEventListener('change', applyFilters);

btnPrev?.addEventListener('click', () => { if (state.page > 1) { state.page--; updateTable(); } });
btnNext?.addEventListener('click', () => { if (state.page * state.limit < state.filteredData.length) { state.page++; updateTable(); } });
rowsPerPageSelect?.addEventListener('change', (e) => { state.limit = parseInt(e.target.value); state.page = 1; updateTable(); });

document.addEventListener('DOMContentLoaded', async () => {
    await loadMasterData();
    await fetchBooks(); 
});

// --- BULK IMPORT LOGIC (BOOKS) ---
function initBulkImportBooks() {
    const btnBulk = document.getElementById('btn-bulk-import');
    if (!btnBulk) return;

    const modalId = 'modal-bulk-books';
    const modalHTML = `
    <div id="${modalId}" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center; padding: 1rem;">
        <div class="card card-glass" style="width: 100%; max-width: 600px; position: relative;">
            <button onclick="document.getElementById('${modalId}').style.display='none'" style="position: absolute; right: 1rem; top: 1rem; background: transparent; border: none; cursor: pointer; color: var(--text-secondary);"><i data-lucide="x"></i></button>
            <h2 style="margin-bottom: 1rem;">Bulk Import Catalogue</h2>
            <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1.5rem;">New Categories and Publishers will be created automatically if they don't exist. Shelf and Rack names must match Master Data.</p>
            
            <button class="btn btn-outline" id="btn-download-template-books" style="margin-bottom: 1.5rem; width: 100%; justify-content: center;"><i data-lucide="download"></i> Download CSV Template</button>

            <div class="input-group">
                <label>Upload Filled CSV</label>
                <input type="file" id="file-upload-books" accept=".csv" style="padding: 0.5rem 0; width: 100%;">
            </div>

            <div style="margin-top: 2rem; display: flex; justify-content: flex-end; gap: 1rem;">
                <button class="btn btn-outline" onclick="document.getElementById('${modalId}').style.display='none'">Cancel</button>
                <button class="btn btn-primary" id="btn-process-bulk-books">Process Import</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    if (window.lucide) lucide.createIcons();

    btnBulk.addEventListener('click', () => {
        document.getElementById('file-upload-books').value = '';
        document.getElementById(modalId).style.display = 'flex';
    });

    document.getElementById('btn-download-template-books').addEventListener('click', () => {
        // Updated Template Headers
        const csvContent = "Title,Author,ISBN,Price,Edition,Category,Publisher,Shelf,Rack,Copies\n";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "Books_Bulk_Template.csv";
        link.click();
    });

    document.getElementById('btn-process-bulk-books').addEventListener('click', async (e) => {
        const fileInput = document.getElementById('file-upload-books');
        if (!fileInput.files.length) return window.app?.alert("Please select a CSV file first.", "Error");
        
        const btn = e.target;
        btn.innerText = "Processing... (Do not close)";
        btn.disabled = true;

        try {
            // 1. Fetch Master Data for lookups
            const [{ data: cats }, { data: pubs }, { data: shelves }, { data: racks }] = await Promise.all([
                supabase.from('categories').select('id, name'),
                supabase.from('publishers').select('id, name'),
                supabase.from('shelves').select('id, name'),
                supabase.from('racks').select('id, name')
            ]);

            const catMap = {}; if (cats) cats.forEach(c => catMap[c.name.toLowerCase()] = c.id);
            const pubMap = {}; if (pubs) pubs.forEach(p => pubMap[p.name.toLowerCase()] = p.id);
            const shelfMap = {}; if (shelves) shelves.forEach(s => shelfMap[s.name.toLowerCase()] = s.id);
            const rackMap = {}; if (racks) racks.forEach(r => rackMap[r.name.toLowerCase()] = r.id);

            // 2. Parse CSV
            const reader = new FileReader();
            reader.onload = async (event) => {
                const lines = event.target.result.split('\n').filter(l => l.trim() !== '');
                if (lines.length < 2) {
                    btn.innerText = "Process Import"; btn.disabled = false;
                    return window.app?.alert("The file is empty.", "Error");
                }

                const headers = lines[0].split(',').map(h => h.trim());
                const booksToProcess = [];

                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                    const row = headers.reduce((obj, header, index) => { obj[header] = values[index]; return obj; }, {});
                    
                    if (row.Title) {
                        // Dynamically create Category if missing
                        let catId = row.Category ? catMap[row.Category.toLowerCase()] : null;
                        if (row.Category && !catId) {
                            const { data } = await supabase.from('categories').insert([{ name: row.Category }]).select().single();
                            if (data) { catId = data.id; catMap[row.Category.toLowerCase()] = catId; }
                        }
                        
                        // Dynamically create Publisher if missing
                        let pubId = row.Publisher ? pubMap[row.Publisher.toLowerCase()] : null;
                        if (row.Publisher && !pubId) {
                            const { data } = await supabase.from('publishers').insert([{ name: row.Publisher }]).select().single();
                            if (data) { pubId = data.id; pubMap[row.Publisher.toLowerCase()] = pubId; }
                        }

                        booksToProcess.push({
                            title: row.Title,
                            author: row.Author || 'Unknown',
                            isbn: row.ISBN || null,
                            price: parseFloat(row.Price) || 0,
                            edition: row.Edition || null,
                            category_id: catId,
                            publisher_id: pubId,
                            _shelfId: row.Shelf ? (shelfMap[row.Shelf.toLowerCase()] || null) : null,
                            _rackId: row.Rack ? (rackMap[row.Rack.toLowerCase()] || null) : null,
                            _copies: parseInt(row.Copies) || 1
                        });
                    }
                }

                if (!booksToProcess.length) {
                    btn.innerText = "Process Import"; btn.disabled = false;
                    return window.app?.alert("No valid books found in CSV.", "Error");
                }

                // 3. Insert Books & Auto-Generate Copies Sequentially
                let successCount = 0;
                for (let b of booksToProcess) {
                    const copiesCount = b._copies;
                    const c_shelfId = b._shelfId;
                    const c_rackId = b._rackId;
                    
                    delete b._copies; 
                    delete b._shelfId; 
                    delete b._rackId;

                    const { data: bookData, error } = await supabase.from('books').insert([b]).select().single();
                    
                    if (!error && bookData) {
                        const copiesToInsert = [];
                        for (let j = 0; j < copiesCount; j++) {
                            copiesToInsert.push({
                                book_id: bookData.id,
                                barcode: `ATH-B-${Date.now().toString().slice(-6)}-${j + 1}`,
                                status: 'AVAILABLE',
                                shelf_id: c_shelfId,
                                rack_id: c_rackId
                            });
                        }
                        await supabase.from('book_copies').insert(copiesToInsert);
                        successCount++;
                    }
                }
                
                document.getElementById(modalId).style.display = 'none';
                window.app?.alert(`Successfully imported ${successCount} books and generated their physical copies with location tracking.`, "Import Complete");
                if (typeof fetchBooks === 'function') fetchBooks(); 
                
                btn.innerText = "Process Import";
                btn.disabled = false;
            };
            reader.readAsText(fileInput.files[0]);
        } catch (err) {
            btn.innerText = "Process Import";
            btn.disabled = false;
            window.app?.alert("A database error occurred during setup.", "Error");
        }
    });
}

document.addEventListener('DOMContentLoaded', initBulkImportBooks);