let currentDocId = null;
let debounceTimer;
let isMarkdownMode = false;
const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '_'
});

// Configure marked options
marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: false,
    sanitize: false
});

// Add these new functions at the top
function dismissBanner() {
    document.getElementById('update-banner').style.display = 'none';
    document.body.classList.remove('has-banner');
    localStorage.setItem('bannerDismissed', 'true');
}

function updateDocumentCount() {
    const docs = getAllDocuments();
    const count = Object.keys(docs).length;
    document.getElementById('document-count').textContent = count;
}

// Add this function to validate fonts
function applyFont(fontName) {
    const editor = document.getElementById('editor');
    const validFonts = [
        'Times New Roman', 'Georgia', 'Lora', 'Merriweather',
        'Arial', 'Helvetica', 'Inter',
        'Roboto Mono', 'Courier New'
    ];

    if (validFonts.includes(fontName)) {
        // First apply the execCommand for backward compatibility
        formatDoc('fontName', fontName);
        
        // Then force the font-family style directly
        editor.style.fontFamily = getFontWithFallback(fontName);
        
        // Also apply to any selected text if there's a selection
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const span = document.createElement('span');
            span.style.fontFamily = getFontWithFallback(fontName);
            range.surroundContents(span);
        }
    }
}

function getFontWithFallback(fontName) {
    const fallbacks = {
        'Times New Roman': '"Times New Roman", Times, serif',
        'Georgia': 'Georgia, serif',
        'Lora': '"Lora", Georgia, serif',
        'Merriweather': '"Merriweather", Georgia, serif',
        'Arial': 'Arial, "Helvetica Neue", sans-serif',
        'Helvetica': 'Helvetica, Arial, sans-serif',
        'Inter': '"Inter", system-ui, -apple-system, sans-serif',
        'Roboto Mono': '"Roboto Mono", "Courier New", monospace',
        'Courier New': '"Courier New", Courier, monospace'
    };
    return fallbacks[fontName] || fontName;
}

// Add new utility functions
function updateWordCount() {
    const text = document.getElementById('editor').innerText;
    const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    const charCount = text.length;
    
    document.getElementById('wordCount').textContent = wordCount;
    document.getElementById('charCount').textContent = charCount;
}

function printDocument() {
    const content = document.getElementById('editor').innerHTML;
    const printWindow = window.open('', '_blank');
    const title = getCurrentDocTitle();
    
    printWindow.document.write(`
        <html>
            <head>
                <title>${title}</title>
                <style>
                    body { font-family: ${document.getElementById('editor').style.fontFamily || 'serif'}; }
                    @media print {
                        body { margin: 1in; }
                    }
                </style>
            </head>
            <body>${content}</body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

function getCurrentDocTitle() {
    const docs = getAllDocuments();
    const doc = docs[currentDocId];
    return doc ? doc.title : 'Untitled Document';
}

// Add new utility functions
function insertImage() {
    document.getElementById('imageInput').click();
}

document.getElementById('imageInput').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (file) {
        try {
            await processImage(file);
        } catch (error) {
            notifications.error('Image Error', 'Failed to process image');
        }
    }
});

// Find and Replace functionality
function toggleFindReplace() {
    const dialog = document.getElementById('findReplaceDialog');
    dialog.style.display = dialog.style.display === 'none' ? 'block' : 'none';
    if (dialog.style.display === 'block') {
        document.getElementById('findText').focus();
    }
}

function findNext() {
    const searchText = document.getElementById('findText').value;
    if (!searchText) return;

    const sel = window.getSelection();
    const range = document.createRange();
    let currentNode = document.getElementById('editor');
    
    // Start after current selection if it exists
    if (sel.rangeCount > 0) {
        currentNode = sel.getRangeAt(0).endContainer;
    }

    const found = window.find(searchText);
    if (!found) {
        alert('No more matches found.');
    }
}

function replaceNext() {
    const searchText = document.getElementById('findText').value;
    const replaceText = document.getElementById('replaceText').value;
    
    if (window.getSelection().toString() === searchText) {
        formatDoc('insertText', replaceText);
        findNext();
    } else {
        findNext();
    }
}

function replaceAll() {
    const searchText = document.getElementById('findText').value;
    const replaceText = document.getElementById('replaceText').value;
    
    const content = document.getElementById('editor').innerHTML;
    const newContent = content.replace(new RegExp(searchText, 'g'), replaceText);
    document.getElementById('editor').innerHTML = newContent;
}

function updateDocStatus(status) {
    const docs = getAllDocuments();
    const doc = docs[currentDocId];
    if (doc) {
        doc.status = status;
        saveDocument(currentDocId, doc);
    }
}

// Initialize editor
document.addEventListener('DOMContentLoaded', function() {
    // Initialize banner state
    if (localStorage.getItem('bannerDismissed') === 'true') {
        document.getElementById('update-banner').style.display = 'none';
        document.body.classList.remove('has-banner');
    }
    // Load last opened document or create new one
    const lastOpenedId = localStorage.getItem('lastOpenedDoc');
    if (lastOpenedId) {
        loadDocument(lastOpenedId);
    } else {
        createNewDocument();
    }
    
    // Restore Markdown mode from localStorage
    const savedMarkdownMode = localStorage.getItem('markdownMode') === 'true';
    if (savedMarkdownMode) {
        toggleMarkdownMode();
    }
});

function createNewDocument() {
    const docs = getAllDocuments();
    if (Object.keys(docs).length >= 100) {
        notifications.error(
            'Limit Reached',
            'Maximum document limit (100) reached. Please delete some documents.',
            ERROR_CODES.STORAGE_FULL
        );
        return;
    }

    try {
        const docId = 'doc_' + Date.now();
        const newDoc = {
            id: docId,
            title: 'Untitled Document',
            content: '',
            font: 'Times New Roman',
            lastEdited: new Date().toISOString(),
            status: 'draft'
        };

        saveDocument(docId, newDoc);
        loadDocument(docId);
        toggleDocManager();
        notifications.success('Document Created', 'New document created successfully.');
    } catch (error) {
        notifications.error(
            'Creation Failed',
            'Failed to create new document. Please try again.',
            ERROR_CODES.UNKNOWN_ERROR
        );
        console.error('Create Error:', error);
    }
}

function getAllDocuments() {
    return JSON.parse(localStorage.getItem('documents') || '{}');
}

// Update document count when documents change
const originalSaveDocument = saveDocument;
saveDocument = function(docId, doc) {
    originalSaveDocument(docId, doc);
    updateDocumentCount();
}

function saveDocument(docId, doc) {
    try {
        const docs = getAllDocuments();
        docs[docId] = doc;
        localStorage.setItem('documents', JSON.stringify(docs));
        localStorage.setItem('lastOpenedDoc', docId);
        
        // Show minimal save indicator
        const notification = document.createElement('div');
        notification.className = 'notification minimal success';
        notification.setAttribute('data-tooltip', 'Document saved');
        notification.innerHTML = '<i class="fas fa-check notification-icon"></i>';
        
        const container = document.querySelector('.notifications-container');
        
        // Remove any existing save indicators
        container.querySelectorAll('.notification.minimal').forEach(n => n.remove());
        
        // Add new indicator
        container.appendChild(notification);
        
        // Remove after 2 seconds
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
        
    } catch (error) {
        notifications.error(
            'Save Failed',
            'Failed to save your document. Please try again.',
            ERROR_CODES.SAVE_ERROR
        );
        console.error('Save Error:', error);
    }
}

function loadDocument(docId) {
    try {
        const docs = getAllDocuments();
        const doc = docs[docId];
        if (doc) {
            currentDocId = docId;
            
            // Restore Markdown mode if it was saved with the document
            isMarkdownMode = doc.isMarkdown || false;
            const editor = document.getElementById('editor');
            
            // Load the appropriate content format
            if (isMarkdownMode) {
                editor.innerText = doc.originalContent || turndownService.turndown(doc.content);
                document.body.classList.add('markdown-mode');
                document.getElementById('markdownToggle').classList.add('active');
                
                setTimeout(() => {
                    notifications.info(
                        'Markdown Mode Active',
                        'This document was saved in Markdown mode. Press the Markdown button or Ctrl/Cmd + M to switch modes.',
                        5000
                    );
                }, 1000);
            } else {
                editor.innerHTML = doc.content;
                document.body.classList.remove('markdown-mode');
                document.getElementById('markdownToggle').classList.remove('active');
            }
            
            // Set the font in the selector and apply it
            if (doc.font) {
                const fontSelect = document.querySelector('select[title="Font"]');
                fontSelect.value = doc.font;
                document.getElementById('editor').style.fontFamily = getFontWithFallback(doc.font);
            }
            
            localStorage.setItem('lastOpenedDoc', docId);
            document.getElementById('docTitle').value = doc.title || 'Untitled Document';
            document.getElementById('docStatus').value = doc.status || 'draft';
            updateWordCount();
            notifications.info('Document Loaded', `Opened "${doc.title}"`);
        }
    } catch (error) {
        notifications.error(
            'Load Failed',
            'Failed to load the document. Please try again.',
            ERROR_CODES.LOAD_ERROR
        );
        console.error('Load Error:', error);
    }
}

// Update document count when documents change
const originalDeleteDocument = deleteDocument;
deleteDocument = function(docId, event) {
    originalDeleteDocument(docId, event);
    updateDocumentCount();
}

function deleteDocument(docId, event) {
    event.stopPropagation();
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
        const docs = getAllDocuments();
        delete docs[docId];
        localStorage.setItem('documents', JSON.stringify(docs));

        if (currentDocId === docId) {
            const remainingDocs = Object.keys(docs);
            if (remainingDocs.length > 0) {
                loadDocument(remainingDocs[0]);
            } else {
                createNewDocument();
            }
        }
        
        renderDocumentList();
        notifications.warning('Document Deleted', 'The document has been permanently deleted.');
    } catch (error) {
        notifications.error(
            'Delete Failed',
            'Failed to delete the document. Please try again.',
            ERROR_CODES.DELETE_ERROR
        );
        console.error('Delete Error:', error);
    }
}

function toggleDocManager() {
    const docManager = document.getElementById('docManager');
    const isVisible = docManager.style.display === 'block';
    docManager.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) renderDocumentList();
}

// Add document preview functions
function showDocumentPreview(docId) {
    const docs = getAllDocuments();
    const doc = docs[docId];
    if (!doc) return;

    const dialog = document.getElementById('docPreviewDialog');
    const previewTitle = dialog.querySelector('.preview-title');
    const previewMetadata = dialog.querySelector('.preview-metadata');
    const previewText = dialog.querySelector('.preview-text');

    // Set title
    previewTitle.textContent = doc.title || 'Untitled Document';

    // Set metadata
    const lastEdited = new Date(doc.lastEdited).toLocaleString();
    const wordCount = doc.content.trim().split(/\s+/).length;
    const charCount = doc.content.length;

    previewMetadata.innerHTML = `
        <div class="preview-metadata-item">
            <span class="preview-metadata-label">Status</span>
            <span>${doc.status || 'draft'}</span>
        </div>
        <div class="preview-metadata-item">
            <span class="preview-metadata-label">Last Edited</span>
            <span>${lastEdited}</span>
        </div>
        <div class="preview-metadata-item">
            <span class="preview-metadata-label">Font</span>
            <span>${doc.font || 'Default'}</span>
        </div>
        <div class="preview-metadata-item">
            <span class="preview-metadata-label">Word Count</span>
            <span>${wordCount} words</span>
        </div>
        <div class="preview-metadata-item">
            <span class="preview-metadata-label">Character Count</span>
            <span>${charCount} characters</span>
        </div>
    `;

    // Set preview text (first 200 characters)
    const plainText = doc.content.replace(/<[^>]*>/g, ' ');
    previewText.textContent = plainText.slice(0, 200) + (plainText.length > 200 ? '...' : '');

    // Show dialog
    dialog.classList.add('active');
}

function toggleDocPreview() {
    const dialog = document.getElementById('docPreviewDialog');
    dialog.classList.remove('active');
}

// Update renderDocumentList to include preview button
function renderDocumentList() {
    const docs = getAllDocuments();
    const docList = document.getElementById('docList');
    docList.innerHTML = '';

    Object.values(docs)
        .sort((a, b) => new Date(b.lastEdited) - new Date(a.lastEdited))
        .forEach(doc => {
            const div = document.createElement('div');
            div.className = 'doc-list-item';
            
            const date = new Date(doc.lastEdited).toLocaleString();
            div.innerHTML = `
                <div class="doc-info" onclick="loadDocument('${doc.id}'); toggleDocManager();">
                    <div class="doc-title">${doc.title}</div>
                    <div class="doc-date">Last edited: ${date}</div>
                </div>
                <div class="doc-actions">
                    <button class="doc-preview-trigger" onclick="event.stopPropagation(); showDocumentPreview('${doc.id}')" title="Show Details">
                        <i class="fa-solid fa-info-circle"></i>
                    </button>
                    <button class="delete-doc-btn" onclick="deleteDocument('${doc.id}', event)" title="Delete Document">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            docList.appendChild(div);
        });
}

// Close preview when clicking outside
document.addEventListener('click', function(e) {
    const dialog = document.getElementById('docPreviewDialog');
    if (dialog && !dialog.contains(e.target) && !e.target.closest('.doc-preview-trigger')) {
        dialog.classList.remove('active');
    }
});

// Add submenu management functions
function toggleSubmenu(menuId) {
    const menu = document.getElementById(menuId);
    const allSubmenus = document.querySelectorAll('.submenu');
    
    // Close other submenus
    allSubmenus.forEach(submenu => {
        if (submenu.id !== menuId) {
            submenu.classList.remove('active');
        }
    });
    
    // Toggle current submenu
    menu.classList.toggle('active');
}

// Close submenus when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('.toolbar-group') && !e.target.closest('.submenu')) {
        document.querySelectorAll('.submenu').forEach(menu => {
            menu.classList.remove('active');
        });
    }
});

// Add new insert functions
function insertTable() {
    const html = `
        <table style="width:100%; border-collapse: collapse; margin: 1rem 0;">
            <tr>
                <td style="border: 1px solid #ccc; padding: 8px;">Cell 1</td>
                <td style="border: 1px solid #ccc; padding: 8px;">Cell 2</td>
            </tr>
            <tr>
                <td style="border: 1px solid #ccc; padding: 8px;">Cell 3</td>
                <td style="border: 1px solid #ccc; padding: 8px;">Cell 4</td>
            </tr>
        </table>
    `;
    formatDoc('insertHTML', html);
}

function insertLink() {
    const url = prompt('Enter URL:', 'https://');
    if (url) {
        formatDoc('createLink', url);
    }
}

function insertHorizontalRule() {
    formatDoc('insertHorizontalRule');
}

// Add table functions
function insertCustomTable() {
    const rows = document.getElementById('tableRows').value;
    const cols = document.getElementById('tableCols').value;
    const border = document.getElementById('tableBorder').value;
    const padding = document.getElementById('tablePadding').value;
    const borderColor = document.getElementById('tableBorderColor').value;

    let html = `<table style="width:100%; border-collapse: collapse; margin: 1rem 0;">`;
    
    for (let i = 0; i < rows; i++) {
        html += '<tr>';
        for (let j = 0; j < cols; j++) {
            html += `<td style="border: ${border}px solid ${borderColor}; padding: ${padding}px;">Cell</td>`;
        }
        html += '</tr>';
    }
    html += '</table>';

    try {
        formatDoc('insertHTML', html);
        notifications.success('Table Inserted', 'Table has been added to your document.');
    } catch (error) {
        notifications.error(
            'Table Error',
            'Failed to insert table. Please try again.',
            ERROR_CODES.TABLE_ERROR
        );
        console.error('Table Error:', error);
    }
}

function addTableRow() {
    const selection = window.getSelection();
    const cell = selection.anchorNode.closest('td');
    if (!cell) return;

    const table = cell.closest('table');
    const row = cell.parentElement;
    const newRow = row.cloneNode(true);
    Array.from(newRow.cells).forEach(cell => cell.textContent = 'Cell');
    row.after(newRow);
}

function addTableColumn() {
    const selection = window.getSelection();
    const cell = selection.anchorNode.closest('td');
    if (!cell) return;

    const table = cell.closest('table');
    const colIndex = cell.cellIndex;
    
    Array.from(table.rows).forEach(row => {
        const newCell = row.insertCell(colIndex + 1);
        newCell.textContent = 'Cell';
        newCell.style = cell.style.cssText;
    });
}

function deleteTableRow() {
    const selection = window.getSelection();
    const cell = selection.anchorNode.closest('td');
    if (!cell) return;

    const row = cell.parentElement;
    if (row.parentElement.rows.length > 1) {
        row.remove();
    }
}

function deleteTableColumn() {
    const selection = window.getSelection();
    const cell = selection.anchorNode.closest('td');
    if (!cell) return;

    const table = cell.closest('table');
    const colIndex = cell.cellIndex;
    
    if (table.rows[0].cells.length > 1) {
        Array.from(table.rows).forEach(row => {
            row.deleteCell(colIndex);
        });
    }
}

function mergeTableCells() {
    document.execCommand('mergeTableCells', false);
}

// Add table cell selection handling
document.getElementById('editor').addEventListener('click', function(e) {
    const cell = e.target.closest('td');
    if (cell) {
        document.querySelectorAll('#editor td').forEach(td => td.classList.remove('selected'));
        cell.classList.add('selected');
    }
});

// Update auto-save functionality
document.getElementById('editor').addEventListener('input', function() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        const docs = getAllDocuments();
        const doc = docs[currentDocId];
        if (doc) {
            doc.content = this.innerHTML;
            doc.lastEdited = new Date().toISOString();
            doc.font = document.querySelector('select[title="Font"]').value;
            doc.fontFamily = this.style.fontFamily; // Store the full font-family string
            saveDocument(currentDocId, doc);
        }
    }, 1000);
    updateWordCount();
});

// Update font change handler
document.querySelector('select[title="Font"]').addEventListener('change', function() {
    applyFont(this.value);
    const docs = getAllDocuments();
    const doc = docs[currentDocId];
    if (doc) {
        doc.font = this.value;
        saveDocument(currentDocId, doc);
    }
});

// Format document function
function formatDoc(command, value = null) {
    document.execCommand(command, false, value);
}

// Prevent default keyboard shortcuts and implement custom ones
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key.toLowerCase()) {
            case 'b':
                e.preventDefault();
                formatDoc('bold');
                break;
            case 'i':
                e.preventDefault();
                formatDoc('italic');
                break;
            case 'u':
                e.preventDefault();
                formatDoc('underline');
                break;
            case 'p':
                e.preventDefault();
                printDocument();
                break;
            case 'k':
                e.preventDefault();
                toggleLinkDialog();
                break;
            case 'm':
                e.preventDefault();
                toggleMarkdownMode();
                break;
        }
    }
});

// Add this near the top with other functions
function toggleLogin() {
    // Placeholder for login functionality
    alert('Login functionality coming soon!');
}

// Toggle dropdown menu
document.getElementById('profile-button').addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('dropdown-menu').classList.toggle('show');
});

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.matches('.dropbtn')) {
        const dropdowns = document.getElementsByClassName('dropdown-content');
        for (const dropdown of dropdowns) {
            if (dropdown.classList.contains('show')) {
                dropdown.classList.remove('show');
            }
        }
    }
});

// Update document title
document.getElementById('docTitle').addEventListener('input', function() {
    const docs = getAllDocuments();
    const doc = docs[currentDocId];
    if (doc) {
        doc.title = this.value || 'Untitled Document';
        saveDocument(currentDocId, doc);
        renderDocumentList();
    }
});

// Close find/replace dialog when clicking outside
document.addEventListener('click', function(e) {
    const dialog = document.getElementById('findReplaceDialog');
    if (dialog && !dialog.contains(e.target) && !e.target.matches('button')) {
        dialog.style.display = 'none';
    }
});

// Add these new functions
function processImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                showImageEditor(canvas, img.width, img.height);
            };
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function showImageEditor(canvas, width, height) {
    const dialog = document.getElementById('imageEditorDialog');
    const editor = document.getElementById('imageEditor');
    editor.innerHTML = ''; // Clear previous content
    editor.appendChild(canvas);
    
    // Set initial crop area
    currentCrop = {
        x: 0,
        y: 0,
        width: width,
        height: height
    };
    
    dialog.classList.add('active');
    initializeCropper(canvas);
}

let cropper = null;

function initializeCropper(canvas) {
    if (cropper) {
        cropper.destroy();
    }
    
    cropper = new Cropper(canvas, {
        aspectRatio: NaN,
        viewMode: 1,
        autoCropArea: 1,
        cropBoxResizable: true,
        cropBoxMovable: true,
        dragMode: 'move',
        guides: true,
        ready: function() {
            // Enable buttons when cropper is ready
            document.querySelectorAll('.image-edit-btn').forEach(btn => btn.disabled = false);
        }
    });
}

function applyImageChanges() {
    if (!cropper) return;
    
    const canvas = cropper.getCroppedCanvas();
    if (!canvas) return;
    
    const maxWidth = 800; // Maximum width for inserted images
    const scaleFactor = maxWidth / canvas.width;
    
    if (scaleFactor < 1) {
        const scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = canvas.width * scaleFactor;
        scaledCanvas.height = canvas.height * scaleFactor;
        const ctx = scaledCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
        canvas = scaledCanvas;
    }
    
    insertImageToEditor(canvas.toDataURL());
    closeImageEditor();
}

function insertImageToEditor(dataUrl) {
    const img = `<img src="${dataUrl}" alt="Inserted image" style="max-width:100%;">`;
    formatDoc('insertHTML', img);
    updateWordCount();
}

function closeImageEditor() {
    const dialog = document.getElementById('imageEditorDialog');
    dialog.classList.remove('active');
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
}

// Add these new functions for link handling
function toggleLinkDialog() {
    const selection = window.getSelection();
    const selectedText = selection.toString();
    const existingLink = getSelectedLink();
    
    if (existingLink) {
        // If editing existing link
        document.getElementById('linkUrl').value = existingLink.href;
        document.getElementById('linkText').value = existingLink.textContent;
    } else {
        // If creating new link
        document.getElementById('linkUrl').value = 'https://';
        document.getElementById('linkText').value = selectedText;
    }
    
    // Show dialog
    const dialog = document.getElementById('linkDialog');
    dialog.style.display = 'block';
    document.getElementById('linkUrl').focus();
}

function getSelectedLink() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return null;
    
    const range = selection.getRangeAt(0);
    const ancestor = range.commonAncestorContainer;
    const link = ancestor.nodeType === 1 ? 
        ancestor.closest('a') : 
        ancestor.parentElement.closest('a');
        
    return link;
}

function insertLink() {
    const url = document.getElementById('linkUrl').value;
    const text = document.getElementById('linkText').value || url;

    if (!url) return;

    try {
        // Get current selection
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const existingLink = getSelectedLink();

        // If there's an existing link, update it
        if (existingLink) {
            existingLink.href = url;
            existingLink.textContent = text;
        } else {
            // Create new link
            const linkElement = document.createElement('a');
            linkElement.href = url;
            linkElement.textContent = text;
            linkElement.target = '_blank'; // Open in new tab
            linkElement.rel = 'noopener noreferrer'; // Security best practice
            
            // Replace selection with link
            range.deleteContents();
            range.insertNode(linkElement);
            
            // Move cursor after link
            const newRange = document.createRange();
            newRange.setStartAfter(linkElement);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }

        // Hide dialog
        toggleLinkDialog();
        
        // Update content
        document.getElementById('editor').dispatchEvent(new Event('input'));
    } catch (error) {
        console.error('Link insertion error:', error);
        notifications.error('Link Error', 'Failed to insert link. Please try again.');
    }
}

// Add link context menu
document.getElementById('editor').addEventListener('contextmenu', function(e) {
    const link = e.target.closest('a');
    if (link) {
        e.preventDefault();
        
        const menu = document.createElement('div');
        menu.className = 'link-context-menu';
        menu.style.position = 'fixed';
        menu.style.left = e.pageX + 'px';
        menu.style.top = e.pageY + 'px';
        menu.innerHTML = `
            <button onclick="window.open('${link.href}', '_blank')">
                <i class="fas fa-external-link-alt"></i> Open Link
            </button>
            <button onclick="editLink(this.closest('.link-context-menu').previousSibling)">
                <i class="fas fa-edit"></i> Edit Link
            </button>
            <button onclick="removeLink(this.closest('.link-context-menu').previousSibling)">
                <i class="fas fa-unlink"></i> Remove Link
            </button>
        `;
        
        // Remove existing context menus
        document.querySelectorAll('.link-context-menu').forEach(m => m.remove());
        
        // Insert new menu
        document.body.appendChild(menu);
        
        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!e.target.closest('.link-context-menu')) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 0);
    }
});

function editLink(link) {
    if (!link) return;
    
    document.getElementById('linkUrl').value = link.href;
    document.getElementById('linkText').value = link.textContent;
    
    // Select the link
    const range = document.createRange();
    range.selectNode(link);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    
    toggleLinkDialog();
}

function removeLink(link) {
    if (!link) return;
    
    const textNode = document.createTextNode(link.textContent);
    link.parentNode.replaceChild(textNode, link);
    
    // Update content
    document.getElementById('editor').dispatchEvent(new Event('input'));
}

// Update existing event listeners
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key.toLowerCase()) {
            // ...existing cases...
            case 'k':
                e.preventDefault();
                toggleLinkDialog();
                break;
        }
    }
});

// Close link dialog when clicking outside
document.addEventListener('click', function(e) {
    const dialog = document.getElementById('linkDialog');
    if (dialog && !dialog.contains(e.target) && !e.target.matches('button')) {
        dialog.style.display = 'none';
    }
});

// Replace the old insertLink function in toolbar click handlers
document.querySelector('button[title="Insert Link"]').onclick = toggleLinkDialog;

// Add these new link handling functions
function handleEditorInput(e) {
    const editor = document.getElementById('editor');
    
    if (isMarkdownMode && e.inputType !== 'insertFromPaste') {
        // Store cursor position
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const offset = range.startOffset;
        const node = range.startContainer;
        
        // Convert to HTML for preview
        const markdown = editor.innerText;
        const html = marked(markdown);
        
        // Only update if content actually changed
        if (editor.getAttribute('data-markdown') !== markdown) {
            editor.setAttribute('data-markdown', markdown);
            editor.innerHTML = markdown;
            
            // Restore cursor position
            try {
                const newRange = document.createRange();
                newRange.setStart(node, offset);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            } catch (err) {
                console.log('Could not restore cursor position');
            }
        }
    }
    
    // Existing URL detection code
    if (e.inputType === 'insertText' && e.data === ' ' || e.inputType === 'insertFromPaste') {
        // ...existing URL detection code...
    }
    
    // Handle regular auto-save
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        const docs = getAllDocuments();
        const doc = docs[currentDocId];
        if (doc) {
            doc.content = editor.innerHTML;
            doc.lastEdited = new Date().toISOString();
            doc.isMarkdown = isMarkdownMode;
            if (isMarkdownMode) {
                doc.originalContent = editor.innerText;
            }
            saveDocument(currentDocId, doc);
        }
    }, 1000);
    
    updateWordCount();
}

function insertLink() {
    const url = document.getElementById('linkUrl').value;
    const text = document.getElementById('linkText').value || url;

    if (!url.match(/^https?:\/\//i)) {
        notifications.warning('Invalid URL', 'URL must start with http:// or https://');
        return;
    }

    try {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const existingLink = getSelectedLink();

        if (existingLink) {
            existingLink.href = url;
            existingLink.textContent = text;
        } else {
            const link = document.createElement('a');
            link.href = url;
            link.textContent = text;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            
            range.deleteContents();
            range.insertNode(link);
            
            // Add a space after the link
            const space = document.createTextNode(' ');
            link.parentNode.insertBefore(space, link.nextSibling);
            
            // Move cursor after the space
            const newRange = document.createRange();
            newRange.setStartAfter(space);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }

        // Hide dialog
        const dialog = document.getElementById('linkDialog');
        dialog.style.display = 'none';
        
        // Update content
        document.getElementById('editor').dispatchEvent(new Event('input'));
        
        notifications.success('Link Inserted', 'Link has been added successfully.');
    } catch (error) {
        console.error('Link insertion error:', error);
        notifications.error('Link Error', 'Failed to insert link. Please try again.');
    }
}

// Update the editor event listeners
document.getElementById('editor').removeEventListener('input', handleEditorInput);
document.getElementById('editor').addEventListener('input', handleEditorInput);

// Handle paste events separately for better URL detection
document.getElementById('editor').addEventListener('paste', function(e) {
    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedText = clipboardData.getData('text');
    
    if (pastedText.match(/^https?:\/\//i)) {
        e.preventDefault();
        
        const link = document.createElement('a');
        link.href = pastedText;
        link.textContent = pastedText;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(link);
        
        // Add a space after the link
        const space = document.createTextNode(' ');
        link.parentNode.insertBefore(space, link.nextSibling);
        
        // Move cursor after the space
        const newRange = document.createRange();
        newRange.setStartAfter(space);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }
});

// Add these new Markdown functions
function toggleMarkdownMode() {
    const editor = document.getElementById('editor');
    const toggle = document.getElementById('markdownToggle');
    const currentContent = editor.innerHTML;
    
    try {
        if (!isMarkdownMode) {
            // Converting to Markdown mode
            const markdown = turndownService.turndown(currentContent);
            editor.innerText = markdown; // Use innerText to preserve line breaks
            document.body.classList.add('markdown-mode');
            toggle.classList.add('active');
            isMarkdownMode = true;
            
            notifications.info(
                'Markdown Mode Enabled',
                `
                You can now write using Markdown syntax. This mode will be saved with your document.
                Press the Markdown button again or use Ctrl/Cmd + M to switch back to rich text mode.
                <br><br>
                <strong>Tip:</strong> Basic Markdown syntax:
                <br>
                # Heading 1<br>
                ## Heading 2<br>
                **bold**<br>
                *italic*<br>
                - list item<br>
                \`code\`
                `,
                8000
            );
        } else {
            // Converting back to HTML mode
            const html = marked.parse(editor.innerText);
            editor.innerHTML = html;
            document.body.classList.remove('markdown-mode');
            toggle.classList.remove('active');
            isMarkdownMode = false;
            
            notifications.success(
                'Rich Text Mode Restored',
                'Your document has been converted back to rich text mode. This preference will be saved.',
                4000
            );
        }
        
        // Save the current mode with the document
        const docs = getAllDocuments();
        const doc = docs[currentDocId];
        if (doc) {
            doc.isMarkdown = isMarkdownMode;
            doc.content = editor.innerHTML;
            doc.originalContent = isMarkdownMode ? editor.innerText : editor.innerHTML;
            saveDocument(currentDocId, doc);
        }
        
        // Save the current mode preference
        localStorage.setItem('markdownMode', isMarkdownMode);
        
    } catch (error) {
        console.error('Markdown toggle error:', error);
        
        // Restore previous state
        editor.innerHTML = currentContent;
        isMarkdownMode = !isMarkdownMode; // Revert the mode
        document.body.classList.toggle('markdown-mode', isMarkdownMode);
        toggle.classList.toggle('active', isMarkdownMode);
        
        notifications.error(
            'Mode Switch Failed',
            'Failed to switch editor mode. Your content has been preserved. Error: ' + error.message,
            6000
        );
    }
}

// Modify handleEditorInput to handle Markdown preview
function handleEditorInput(e) {
    const editor = document.getElementById('editor');
    
    if (isMarkdownMode && e.inputType !== 'insertFromPaste') {
        // Store cursor position
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const offset = range.startOffset;
        const node = range.startContainer;
        
        // Convert to HTML for preview
        const markdown = editor.innerText;
        const html = marked(markdown);
        
        // Only update if content actually changed
        if (editor.getAttribute('data-markdown') !== markdown) {
            editor.setAttribute('data-markdown', markdown);
            editor.innerHTML = markdown;
            
            // Restore cursor position
            try {
                const newRange = document.createRange();
                newRange.setStart(node, offset);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            } catch (err) {
                console.log('Could not restore cursor position');
            }
        }
    }
    
    // Existing URL detection code
    if (e.inputType === 'insertText' && e.data === ' ' || e.inputType === 'insertFromPaste') {
        // ...existing URL detection code...
    }
    
    // Handle regular auto-save
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        const docs = getAllDocuments();
        const doc = docs[currentDocId];
        if (doc) {
            doc.content = editor.innerHTML;
            doc.lastEdited = new Date().toISOString();
            doc.isMarkdown = isMarkdownMode;
            if (isMarkdownMode) {
                doc.originalContent = editor.innerText;
            }
            saveDocument(currentDocId, doc);
        }
    }, 1000);
    
    updateWordCount();
}

// Modify paste event handler to handle Markdown
document.getElementById('editor').addEventListener('paste', function(e) {
    if (isMarkdownMode) {
        // For Markdown mode, just let the default paste happen
        return;
    }
    // ...existing paste handler code...
});