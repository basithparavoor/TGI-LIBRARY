import { supabase } from './supabaseClient.js';

// --- UI Elements ---
const tbody = document.getElementById('books-table-body');
const searchInput = document.getElementById('search-books');
const filterCategory = document.getElementById('filter-category');
const filterStatus = document.getElementById('filter-status');
const selectAllCb = document.getElementById('select-all');
const selectionCountBadge = document.getElementById('selection-count');
const btnBatchDelete = document.getElementById('btn-batch-delete');
const rowsPerPageSelect = document.getElementById('rows-per-page');
const btnPrev = document.getElementById('btn-prev-page');
const btnNext = document.getElementById('btn-next-page');
const paginationInfo = document.getElementById('pagination-info');
const pageDisplay = document.getElementById('current-page-display');
const totalCounter = document.getElementById('total-books-counter');

// --- Modal Elements ---
const modalAddBook = document.getElementById('modal-add-book');
const btnOpenModal = document.getElementById('btn-add-book');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelAdd = document.getElementById('btn-cancel-add');
const formAddBook = document.getElementById('form-add-book');
const modalTitle = document.getElementById('modal-book-title');
const addCategorySelect = document.getElementById('add-category');
const addPublisherSelect = document.getElementById('add-publisher');
const addShelfSelect = document.getElementById('add-shelf');
const addRackSelect = document.getElementById('add-rack');
const copiesSection = document.getElementById('copies-section');

let currentEditBookId = null;

// --- Data State ---
let state = {
    allData: [],
    filteredData: [],
    selectedIds: new Set(),
    page: 1,
    limit: 25
};

// --- 1. MASTER DATA LOADER ---
async function loadMasterData() {
    try {
        const [catsRes, pubsRes, shelvesRes] = await Promise.all([
            supabase.from('categories').select('id, name').order('name'),
            supabase.from('publishers').select('id, name').order('name'),
            supabase.from('shelves').select('id, name').order('name')
        ]);

        if (catsRes.data) {
            const options = catsRes.data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            if (filterCategory) filterCategory.innerHTML = '<option value="">All Categories</option>' + options;
            if (addCategorySelect) addCategorySelect.innerHTML = '<option value="">Select Category...</option>' + options;
        }

        if (pubsRes.data && addPublisherSelect) {
            addPublisherSelect.innerHTML = '<option value="">Select Publisher...</option>' + pubsRes.data.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        }

        if (shelvesRes.data && addShelfSelect) {
            addShelfSelect.innerHTML = '<option value="">Select Shelf...</option>' + shelvesRes.data.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
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

window.promptNewEntity = function(type, selectId) {
    window.app.prompt(`Enter new ${type} name:`, `Add New ${type}`, (name) => {
        if (name && name.trim()) {
            const select = document.getElementById(selectId);
            const opt = document.createElement('option');
            opt.value = 'NEW_' + name.trim();
            opt.text = name.trim() + ' (New)';
            opt.selected = true;
            select.add(opt);
        }
    });
};

// --- 2. FETCH BOOKS ---
async function fetchBooks() {
    if (!tbody) return;
    tbody.innerHTML = `
        <tr>
            <td colspan="6" style="padding: 3rem; text-align: center; color: var(--text-muted);">
                <i data-lucide="loader-2" class="animate-spin" style="width: 28px; height: 28px; margin-bottom: 0.5rem;"></i>
                <div>Fetching book catalogue...</div>
            </td>
        </tr>
    `;
    if (window.lucide) lucide.createIcons();

    try {
        const { data, error } = await supabase
            .from('books')
            .select(`
                id, title, author, isbn, price, edition, category_id, publisher_id,
                categories(name),
                publishers(name),
                book_copies(id, barcode, status, shelf_id, rack_id, shelves(name), racks(name))
            `)
            .order('created_at', { ascending: false })
            .limit(2000);

        if (error) throw error;

        state.allData = data || [];
        if (totalCounter) totalCounter.innerText = `${state.allData.length} Titles`;

        // Check for URL search parameter
        const urlParams = new URLSearchParams(window.location.search);
        const searchParam = urlParams.get('search');
        if (searchParam && searchInput) {
            searchInput.value = searchParam;
        }

        applyFilters();
    } catch (err) {
        console.error("Failed to fetch books:", err);
        tbody.innerHTML = `<tr><td colspan="6" style="padding: 3rem; text-align: center; color: var(--danger);">Failed to load books. Please check database connection.</td></tr>`;
    }
}

function applyFilters() {
    const query = searchInput?.value?.toLowerCase().trim() || '';
    const catId = filterCategory?.value || '';
    const statusFilter = filterStatus?.value || '';

    state.filteredData = state.allData.filter(book => {
        const matchesSearch = !query || 
            (book.title && book.title.toLowerCase().includes(query)) || 
            (book.author && book.author.toLowerCase().includes(query)) || 
            (book.isbn && book.isbn.toLowerCase().includes(query));

        const matchesCat = !catId || book.category_id === catId;

        let matchesStatus = true;
        const totalCopies = book.book_copies?.length || 0;
        const availCopies = book.book_copies?.filter(c => c.status === 'AVAILABLE').length || 0;

        if (statusFilter === 'available') {
            matchesStatus = availCopies > 0;
        } else if (statusFilter === 'checked_out') {
            matchesStatus = totalCopies > 0 && availCopies === 0;
        }

        return matchesSearch && matchesCat && matchesStatus;
    });

    state.page = 1;
    updateTable();
}

// --- 3. RENDER TABLE ---
function updateTable() {
    if (!tbody) return;

    const start = (state.page - 1) * state.limit;
    const end = start + state.limit;
    const paginatedItems = state.filteredData.slice(start, end);

    if (paginatedItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="padding: 3.5rem 1rem; text-align: center; color: var(--text-muted);">
                    <i data-lucide="book-x" style="width: 36px; height: 36px; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                    <div style="font-weight: 600; font-size: 1rem; color: var(--text-primary);">No books match your filters</div>
                    <p style="font-size: 0.85rem; margin-top: 0.25rem;">Try adjusting your search query or reset the category filters.</p>
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = paginatedItems.map(book => {
            const isSelected = state.selectedIds.has(book.id);
            const totalCopies = book.book_copies?.length || 0;
            const availCopies = book.book_copies?.filter(c => c.status === 'AVAILABLE').length || 0;
            const categoryName = book.categories?.name || 'General';
            const publisherName = book.publishers?.name || '';

            return `
                <tr style="${isSelected ? 'background: rgba(59,130,246,0.06);' : ''}">
                    <td class="checkbox-cell" data-label="Select">
                        <input type="checkbox" class="custom-checkbox row-checkbox" data-id="${book.id}" ${isSelected ? 'checked' : ''}>
                    </td>
                    <td data-label="Book Details">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(59,130,246,0.1); color: var(--brand-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <i data-lucide="book" style="width: 18px; height: 18px;"></i>
                            </div>
                            <div>
                                <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">${escapeHtml(book.title)}</div>
                                <div style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(book.author)} ${publisherName ? '• ' + escapeHtml(publisherName) : ''}</div>
                            </div>
                        </div>
                    </td>
                    <td data-label="ISBN / Edition">
                        <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-primary); font-weight: 500;">${book.isbn || '—'}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${book.edition || 'Standard Ed.'}</div>
                    </td>
                    <td data-label="Category">
                        <span class="badge badge-brand" style="font-size: 0.7rem;">${escapeHtml(categoryName)}</span>
                    </td>
                    <td data-label="Copies & Availability">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="badge ${availCopies > 0 ? 'badge-success' : 'badge-danger'}" style="font-size: 0.75rem;">
                                <span class="badge-dot"></span> ${availCopies} / ${totalCopies} Available
                            </span>
                            <button class="btn btn-ghost btn-sm" onclick="window.viewBookCopies('${book.id}')" title="View Physical Barcodes" style="padding: 0.2rem 0.4rem; font-size: 0.75rem; color: var(--brand-primary);">
                                <i data-lucide="qr-code" style="width: 14px;"></i> Barcodes
                            </button>
                        </div>
                    </td>
                    <td data-label="Actions" style="text-align: right;">
                        <div style="display: flex; gap: 0.4rem; justify-content: flex-end;">
                            <button class="btn btn-sm btn-outline" onclick="window.editBook('${book.id}')" title="Edit Metadata">
                                <i data-lucide="edit-3" style="width: 14px;"></i>
                            </button>
                            <button class="btn btn-sm btn-ghost" style="color: var(--danger);" onclick="window.deleteBook('${book.id}', '${escapeHtml(book.title).replace(/'/g, "\\'")}')" title="Delete Title">
                                <i data-lucide="trash-2" style="width: 14px;"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    if (window.lucide) lucide.createIcons();
    updatePaginationUI();
    attachCheckboxListeners();
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

// --- 4. CHECKBOXES & BATCH ACTIONS ---
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
        if (btnBatchDelete) btnBatchDelete.style.display = 'inline-flex';
    } else {
        selectionCountBadge.style.display = 'none';
        if (btnBatchDelete) btnBatchDelete.style.display = 'none';
    }
}

btnBatchDelete?.addEventListener('click', () => {
    const count = state.selectedIds.size;
    if (count === 0) return;

    window.app.confirm(`Permanently delete ${count} selected books and all their associated copies?`, "Batch Delete Books", async () => {
        const ids = Array.from(state.selectedIds);
        await supabase.from('book_copies').delete().in('book_id', ids);
        await supabase.from('books').delete().in('id', ids);
        state.selectedIds.clear();
        updateSelectionBadge();
        window.app.toast(`Deleted ${count} books successfully.`, 'success', 'Batch Deleted');
        fetchBooks();
    });
});

// --- 5. VIEW PHYSICAL COPIES & BARCODES MODAL ---
window.viewBookCopies = function(bookId) {
    const book = state.allData.find(b => b.id === bookId);
    if (!book) return;

    const modal = document.getElementById('modal-view-copies');
    const titleEl = document.getElementById('copies-modal-title');
    const subtitleEl = document.getElementById('copies-modal-subtitle');
    const listEl = document.getElementById('copies-list-container');

    titleEl.innerText = book.title;
    subtitleEl.innerText = `Author: ${book.author} • ${book.book_copies?.length || 0} Physical Copies`;

    if (!book.book_copies || book.book_copies.length === 0) {
        listEl.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);">No physical copies found for this book.</div>`;
    } else {
        listEl.innerHTML = book.book_copies.map((copy, index) => {
            const isAvail = copy.status === 'AVAILABLE';
            const location = copy.shelves?.name ? `${copy.shelves.name}${copy.racks?.name ? ' / ' + copy.racks.name : ''}` : 'General Shelves';

            return `
                <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-weight: 700; font-size: 0.95rem;">Copy #${index + 1}</span>
                            <span class="badge ${isAvail ? 'badge-success' : 'badge-warning'}" style="font-size: 0.7rem;">${copy.status}</span>
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
                            Barcode: <span style="font-family: var(--font-mono); font-weight: 600; color: var(--text-primary);">${copy.barcode}</span>
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                            Location: ${location}
                        </div>
                    </div>
                    <div>
                        <svg id="barcode-copy-svg-${copy.id}" style="height: 32px;"></svg>
                    </div>
                </div>
            `;
        }).join('');

        // Generate barcodes
        setTimeout(() => {
            if (window.JsBarcode) {
                book.book_copies.forEach(copy => {
                    JsBarcode(`#barcode-copy-svg-${copy.id}`, copy.barcode, {
                        format: "CODE128",
                        width: 1.4,
                        height: 28,
                        displayValue: false,
                        margin: 0
                    });
                });
            }
        }, 50);
    }

    modal.classList.add('active');
    if (window.lucide) lucide.createIcons();
};

// --- 6. EXPORT FUNCTIONS ---
window.exportData = function(format) {
    const exportDataset = state.selectedIds.size > 0 
        ? state.allData.filter(b => state.selectedIds.has(b.id)) 
        : state.filteredData;
        
    if (exportDataset.length === 0) return window.app?.toast("No books available to export.", "warning", "Export");

    if (format === 'csv') {
        const headers = ["Title", "Author", "ISBN", "Category", "Publisher", "Price", "Edition", "Total Copies", "Available Copies"];
        const csvRows = exportDataset.map(b => {
            const totalCopies = b.book_copies?.length || 0;
            const availCopies = b.book_copies?.filter(c => c.status === 'AVAILABLE').length || 0;
            return `"${(b.title || '').replace(/"/g, '""')}","${(b.author || '').replace(/"/g, '""')}","${b.isbn || ''}","${b.categories?.name || ''}","${b.publishers?.name || ''}","${b.price || 0}","${b.edition || ''}","${totalCopies}","${availCopies}"`;
        });
        
        const csvContent = [headers.join(','), ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Book_Catalogue_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        window.app.toast("CSV file downloaded successfully.", "success", "Export Ready");
    } else if (format === 'pdf') {
        window.print();
    }
};

// --- 7. EDIT & DELETE BOOK ---
window.editBook = async function(id) {
    currentEditBookId = id;
    document.getElementById('btn-submit-book').innerHTML = '<i data-lucide="save" style="width: 16px;"></i> Update Book';
    if (modalTitle) modalTitle.innerText = 'Edit Book Metadata';
    if (copiesSection) copiesSection.style.display = 'none';

    const { data: book, error } = await supabase.from('books').select('*').eq('id', id).single();
    if (error) return window.app?.toast("Could not fetch book details.", "error", "Error");

    document.getElementById('add-title').value = book.title;
    document.getElementById('add-author').value = book.author;
    document.getElementById('add-isbn').value = book.isbn || '';
    document.getElementById('add-price').value = book.price || '';
    document.getElementById('add-edition').value = book.edition || '';
    if (book.category_id) document.getElementById('add-category').value = book.category_id;
    if (book.publisher_id) document.getElementById('add-publisher').value = book.publisher_id;

    if (modalAddBook) {
        modalAddBook.classList.add('active');
        if (window.lucide) lucide.createIcons();
    }
};

window.deleteBook = function(id, title) {
    window.app.confirm(`Delete "${title}"? All associated physical copies and barcode labels will be removed.`, "Delete Book", async () => {
        await supabase.from('book_copies').delete().eq('book_id', id);
        await supabase.from('books').delete().eq('id', id);
        window.app.toast(`"${title}" deleted successfully.`, "success", "Deleted");
        fetchBooks();
    });
};

// --- 8. MODAL CONTROLS & SUBMISSION ---
const toggleModal = (show) => {
    if (!modalAddBook) return;
    if (show) {
        modalAddBook.classList.add('active');
    } else {
        modalAddBook.classList.remove('active');
        formAddBook?.reset();
        currentEditBookId = null;
        if (modalTitle) modalTitle.innerText = 'Add New Book to Catalogue';
        if (copiesSection) copiesSection.style.display = 'block';
        const submitBtn = document.getElementById('btn-submit-book');
        if (submitBtn) submitBtn.innerHTML = '<i data-lucide="save" style="width: 16px;"></i> Save Book & Generate Copies';
    }
    if (window.lucide) lucide.createIcons();
};

btnOpenModal?.addEventListener('click', () => toggleModal(true));
btnCloseModal?.addEventListener('click', () => toggleModal(false));
btnCancelAdd?.addEventListener('click', () => toggleModal(false));

formAddBook?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit-book');
    const originalText = btnSubmit.innerHTML;
    btnSubmit.innerText = 'Saving...';
    btnSubmit.disabled = true;

    try {
        let categoryId = document.getElementById('add-category').value;
        let publisherId = document.getElementById('add-publisher').value;

        // Auto-create category if new
        if (categoryId.startsWith('NEW_')) {
            const catName = categoryId.replace('NEW_', '');
            const { data: newCat } = await supabase.from('categories').insert([{ name: catName }]).select().single();
            if (newCat) categoryId = newCat.id;
        }

        // Auto-create publisher if new
        if (publisherId.startsWith('NEW_')) {
            const pubName = publisherId.replace('NEW_', '');
            const { data: newPub } = await supabase.from('publishers').insert([{ name: pubName }]).select().single();
            if (newPub) publisherId = newPub.id;
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
            window.app.toast(`"${bookPayload.title}" updated successfully.`, "success", "Book Updated");
        } else {
            const { data: bookData, error } = await supabase.from('books').insert([bookPayload]).select().single();
            if (error) throw error;

            const numCopies = parseInt(document.getElementById('add-copies').value) || 1;
            const shelfId = document.getElementById('add-shelf').value || null;
            const rackId = document.getElementById('add-rack').value || null;

            const copiesToInsert = [];
            const timestamp = Date.now().toString().slice(-6);

            for (let i = 0; i < numCopies; i++) {
                copiesToInsert.push({
                    book_id: bookData.id,
                    barcode: `ATH-B-${timestamp}-${i + 1}`,
                    status: 'AVAILABLE',
                    shelf_id: shelfId,
                    rack_id: rackId
                });
            }

            await supabase.from('book_copies').insert(copiesToInsert);
            window.app.toast(`Added "${bookPayload.title}" and generated ${numCopies} copy barcode(s).`, "success", "Book Added");
        }

        toggleModal(false);
        fetchBooks();
    } catch (err) {
        console.error(err);
        window.app.toast(err.message || "Failed to save book.", "error", "Save Failed");
    } finally {
        btnSubmit.innerHTML = originalText;
        btnSubmit.disabled = false;
        currentEditBookId = null;
    }
});

// --- 9. BULK IMPORT MODAL & PROCESSOR ---
function initBulkImportBooks() {
    const btnBulk = document.getElementById('btn-bulk-import');
    if (!btnBulk) return;

    let modal = document.getElementById('modal-bulk-books');
    if (!modal) {
        const modalHTML = `
            <div id="modal-bulk-books" class="app-dialog-overlay">
                <div class="app-dialog" style="max-width: 580px; text-align: left;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                        <h2 style="font-size: 1.25rem; font-weight: 800; margin: 0;">Bulk Import Catalogue</h2>
                        <button class="btn btn-ghost btn-icon close-bulk"><i data-lucide="x" style="width: 18px;"></i></button>
                    </div>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1.25rem;">Upload a CSV file. Categories and publishers will be matched or auto-created.</p>
                    
                    <button class="btn btn-outline" id="btn-download-template-books" style="margin-bottom: 1.5rem; width: 100%; justify-content: center;">
                        <i data-lucide="download" style="width: 16px;"></i> Download CSV Template
                    </button>

                    <div class="input-group">
                        <label>Upload Completed CSV</label>
                        <input type="file" id="file-upload-books" accept=".csv" style="padding: 0.6rem 0.8rem; width: 100%;">
                    </div>

                    <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 0.75rem;">
                        <button class="btn btn-outline close-bulk">Cancel</button>
                        <button class="btn btn-primary" id="btn-process-bulk-books"><i data-lucide="upload-cloud" style="width: 16px;"></i> Process Import</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('modal-bulk-books');
        if (window.lucide) lucide.createIcons();

        modal.querySelectorAll('.close-bulk').forEach(btn => {
            btn.addEventListener('click', () => modal.classList.remove('active'));
        });
    }

    btnBulk.addEventListener('click', () => {
        document.getElementById('file-upload-books').value = '';
        modal.classList.add('active');
    });

    document.getElementById('btn-download-template-books')?.addEventListener('click', () => {
        const csvContent = "Title,Author,ISBN,Price,Edition,Category,Publisher,Copies\nSample Book Title 1,Author Name,9780000000001,500,1st Ed,Science,Academic Press,3\nSample Book Title 2,Author Name,9780000000002,750,2nd Ed,General,University Press,2\n";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "Books_Catalogue_Template.csv";
        link.click();
    });

    document.getElementById('btn-process-bulk-books')?.addEventListener('click', async (e) => {
        const fileInput = document.getElementById('file-upload-books');
        if (!fileInput.files.length) return window.app?.toast("Please select a CSV file first.", "warning", "File Required");

        const btn = e.target;
        btn.innerText = "Processing...";
        btn.disabled = true;

        try {
            const [catsRes, pubsRes] = await Promise.all([
                supabase.from('categories').select('id, name'),
                supabase.from('publishers').select('id, name')
            ]);

            const catMap = {}; if (catsRes.data) catsRes.data.forEach(c => catMap[c.name.toLowerCase()] = c.id);
            const pubMap = {}; if (pubsRes.data) pubsRes.data.forEach(p => pubMap[p.name.toLowerCase()] = p.id);

            const reader = new FileReader();
            reader.onload = async (event) => {
                const lines = event.target.result.split('\n').filter(l => l.trim() !== '');
                if (lines.length < 2) throw new Error("The CSV file is empty.");

                const headers = lines[0].split(',').map(h => h.trim());
                let importedCount = 0;

                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                    const row = headers.reduce((obj, header, idx) => { obj[header] = values[idx]; return obj; }, {});

                    if (row.Title) {
                        let catId = row.Category ? catMap[row.Category.toLowerCase()] : null;
                        if (row.Category && !catId) {
                            const { data: newCat } = await supabase.from('categories').insert([{ name: row.Category }]).select().single();
                            if (newCat) { catId = newCat.id; catMap[row.Category.toLowerCase()] = catId; }
                        }

                        let pubId = row.Publisher ? pubMap[row.Publisher.toLowerCase()] : null;
                        if (row.Publisher && !pubId) {
                            const { data: newPub } = await supabase.from('publishers').insert([{ name: row.Publisher }]).select().single();
                            if (newPub) { pubId = newPub.id; pubMap[row.Publisher.toLowerCase()] = pubId; }
                        }

                        const { data: newBook } = await supabase.from('books').insert([{
                            title: row.Title,
                            author: row.Author || 'Unknown',
                            isbn: row.ISBN || null,
                            price: parseFloat(row.Price) || 0,
                            edition: row.Edition || null,
                            category_id: catId,
                            publisher_id: pubId
                        }]).select().single();

                        if (newBook) {
                            const copiesCount = parseInt(row.Copies) || 1;
                            const copies = [];
                            const ts = Date.now().toString().slice(-6);
                            for (let c = 0; c < copiesCount; c++) {
                                copies.push({
                                    book_id: newBook.id,
                                    barcode: `ATH-B-${ts}-${i}-${c + 1}`,
                                    status: 'AVAILABLE'
                                });
                            }
                            await supabase.from('book_copies').insert(copies);
                            importedCount++;
                        }
                    }
                }

                modal.classList.remove('active');
                window.app.toast(`Successfully imported ${importedCount} books with barcode copies.`, "success", "Import Complete");
                fetchBooks();
            };
            reader.readAsText(fileInput.files[0]);
        } catch (err) {
            window.app.toast(err.message || "Bulk import failed.", "error", "Import Error");
        } finally {
            btn.innerHTML = '<i data-lucide="upload-cloud" style="width: 16px;"></i> Process Import';
            btn.disabled = false;
        }
    });
}

// --- 10. EVENT LISTENERS & INIT ---
searchInput?.addEventListener('input', () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(applyFilters, 250); });
filterCategory?.addEventListener('change', applyFilters);
filterStatus?.addEventListener('change', applyFilters);

btnPrev?.addEventListener('click', () => { if (state.page > 1) { state.page--; updateTable(); } });
btnNext?.addEventListener('click', () => { if (state.page * state.limit < state.filteredData.length) { state.page++; updateTable(); } });
rowsPerPageSelect?.addEventListener('change', (e) => { state.limit = parseInt(e.target.value); state.page = 1; updateTable(); });

document.addEventListener('DOMContentLoaded', async () => {
    await loadMasterData();
    await fetchBooks();
    initBulkImportBooks();
});