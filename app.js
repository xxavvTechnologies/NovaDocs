let currentDocId = null;
// ...existing code...

function toggleSubmenu(menuId) {
    // Close all other submenus first
    document.querySelectorAll('.submenu').forEach(menu => {
        if (menu.id !== menuId) {
            menu.classList.remove('active');
        }
    });

    // Toggle the clicked submenu
    const menu = document.getElementById(menuId);
    menu.classList.toggle('active');

    // Update active states of toggle buttons
    if (menuId === 'tools-menu') {
        updateToolsMenuState();
    }
}

function updateToolsMenuState() {
    // Update button states based on active features
    const markdownBtn = document.querySelector('#tools-menu button[onclick*="toggleMarkdownMode"]');
    if (document.body.classList.contains('markdown-mode')) {
        markdownBtn.classList.add('active');
    } else {
        markdownBtn.classList.remove('active');
    }

    // Update other tool states as needed
    const commentBtn = document.querySelector('#tools-menu button[onclick*="toggleComments"]');
    if (document.getElementById('commentsPanel').classList.contains('active')) {
        commentBtn.classList.add('active');
    } else {
        commentBtn.classList.remove('active');
    }
    
    // Similar updates for other tools...
}

// Close submenus when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.submenu') && !e.target.closest('button[onclick*="toggleSubmenu"]')) {
        document.querySelectorAll('.submenu').forEach(menu => {
            menu.classList.remove('active');
        });
    }
});

// ...existing code...
// Keyboard shortcuts mapping (Google Docs compatible)
const SHORTCUTS = {
    'Ctrl/⌘ + B': 'Bold',
    'Ctrl/⌘ + I': 'Italic',
    'Ctrl/⌘ + U': 'Underline',
    'Ctrl/⌘ + K': 'Insert link',
    'Ctrl/⌘ + Alt + H': 'Clear formatting',
    'Ctrl/⌘ + Alt + M': 'Add comment',
    'Ctrl/⌘ + Alt + N': 'Clear comments',
    'Ctrl/⌘ + Alt + T': 'Insert table',
    'Ctrl/⌘ + Shift + V': 'Paste without formatting',
    'Alt + Shift + 5': 'Strikethrough',
    'Ctrl/⌘ + Shift + C': 'Word count',
    'Ctrl/⌘ + \\': 'Clear formatting',
    'Ctrl/⌘ + Shift + S': 'Save revision',
    'Ctrl/⌘ + Alt + Shift + H': 'Show revision history'
};

// Initialize comment system
let comments = [];
let suggestionMode = false;

function initCommentSystem() {
    document.execCommand('defaultParagraphSeparator', false, 'p');
    
    document.getElementById('editor').addEventListener('mouseup', () => {
        if (suggestionMode) {
            const selection = window.getSelection();
            if (!selection.isCollapsed) {
                addSuggestion(selection);
            }
        }
    });
}

function addSuggestion(selection) {
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.className = 'suggestion';
    span.dataset.author = 'Current User';
    span.dataset.time = new Date().toISOString();
    range.surroundContents(span);
}

function toggleSuggestionMode() {
    suggestionMode = !suggestionMode;
    const btn = document.getElementById('suggestionModeBtn');
    btn.classList.toggle('active');
    notifications.info(
        'Suggestion Mode', 
        suggestionMode ? 'Suggestion mode enabled' : 'Suggestion mode disabled'
    );
}

// Revision history system
let revisions = [];

function saveRevision() {
    const content = document.getElementById('editor').innerHTML;
    revisions.push({
        content,
        timestamp: new Date().toISOString(),
        author: 'Current User'
    });
    updateRevisionsList();
}

function updateRevisionsList() {
    const list = document.getElementById('revisionsList');
    list.innerHTML = revisions.map((rev, i) => `
        <div class="revision-item" onclick="restoreRevision(${i})">
            <div class="revision-header">
                <span class="revision-author">${rev.author}</span>
                <span class="revision-time">${new Date(rev.timestamp).toLocaleString()}</span>
            </div>
            <div class="revision-changes">
                Version ${revisions.length - i}
            </div>
        </div>
    `).join('');
}

function restoreRevision(index) {
    if (confirm('Restore this version? Current changes will be saved as a revision.')) {
        saveRevision(); // Save current state
        document.getElementById('editor').innerHTML = revisions[index].content;
        notifications.info('Revision Restored', 'Document restored to previous version');
    }
}

// Document outline system
function updateOutline() {
    const editor = document.getElementById('editor');
    const headers = editor.querySelectorAll('h1, h2, h3');
    const outlineList = document.getElementById('outlineList');
    
    outlineList.innerHTML = Array.from(headers).map(header => `
        <div class="outline-item outline-${header.tagName.toLowerCase()}" 
             onclick="scrollToHeader('${header.id || Math.random()}')">
            ${header.textContent}
        </div>
    `).join('');
}

function scrollToHeader(id) {
    const header = document.getElementById(id) || 
                  document.querySelector(`[data-id="${id}"]`);
    if (header) {
        header.scrollIntoView({ behavior: 'smooth' });
    }
}

// Reading stats system
function updateReadingStats() {
    const text = document.getElementById('editor').textContent;
    const wordCount = text.trim().split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200); // Average reading speed
    
    document.getElementById('wordCountDetail').textContent = `${wordCount} words`;
    document.getElementById('readingTime').textContent = `${readingTime} min read`;
}

// Panel toggles
function toggleComments() {
    document.getElementById('commentsPanel').classList.toggle('active');
}

function toggleHistory() {
    document.getElementById('historyPanel').classList.toggle('active');
}

function toggleOutline() {
    document.getElementById('outlinePanel').classList.toggle('active');
    updateOutline();
}

function toggleReadingStats() {
    document.getElementById('readingStats').classList.toggle('active');
    updateReadingStats();
}

// Keyboard shortcuts dialog
function showKeyboardShortcuts() {
    const dialog = document.getElementById('shortcutsDialog');
    const list = document.getElementById('shortcutsList');
    
    list.innerHTML = Object.entries(SHORTCUTS).map(([key, action]) => `
        <div class="shortcut-item">
            <span class="shortcut-action">${action}</span>
            <span class="shortcut-key">${key}</span>
        </div>
    `).join('');
    
    dialog.style.display = 'block';
}

function closeKeyboardShortcuts() {
    document.getElementById('shortcutsDialog').style.display = 'none';
}

// Initialize new features
document.addEventListener('DOMContentLoaded', () => {
    initCommentSystem();
    
    // Auto-save revision every 5 minutes
    setInterval(saveRevision, 5 * 60 * 1000);
    
    // Update outline and reading stats when content changes
    const editor = document.getElementById('editor');
    editor.addEventListener('input', () => {
        updateOutline();
        updateReadingStats();
    });
    
    // Initialize keyboard shortcuts
    document.addEventListener('keydown', handleShortcuts);
});

// Update the DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    if (localStorage.getItem('bannerDismissed4.0') === 'true') {
        document.getElementById('update-banner').style.display = 'none';
        document.body.classList.remove('has-banner');
    }

    const lastOpenedId = localStorage.getItem('lastOpenedDoc');
    if (lastOpenedId) {
        loadDocument(lastOpenedId);
    } else {
        createNewDocument();
    }

    const savedMarkdownMode = localStorage.getItem('markdownMode') === 'true';
    if (savedMarkdownMode) {
        toggleMarkdownMode();
    }

    updateToolbarState();
});

// Simplify the updateToolbarState function
function updateToolbarState() {
    // Only update button states based on current formatting
    const editor = document.getElementById('editor');
    
    // Update formatting buttons
    document.querySelector('button[title="Bold"]').classList.toggle('active', document.queryCommandState('bold'));
    document.querySelector('button[title="Italic"]').classList.toggle('active', document.queryCommandState('italic'));
    document.querySelector('button[title="Underline"]').classList.toggle('active', document.queryCommandState('underline'));
    
    // Update alignment buttons
    document.querySelector('button[title="Align Left"]').classList.toggle('active', document.queryCommandState('justifyLeft'));
    document.querySelector('button[title="Align Center"]').classList.toggle('active', document.queryCommandState('justifyCenter'));
    document.querySelector('button[title="Align Right"]').classList.toggle('active', document.queryCommandState('justifyRight'));

    // Disable formatting controls in Markdown mode
    const formattingControls = document.querySelectorAll('.toolbar button:not([title="Document"]), .toolbar select');
    formattingControls.forEach(control => {
        control.disabled = isMarkdownMode;
    });
}
let debounceTimer;
let isMarkdownMode = false;
let lastHtmlContent = ''; // Add this at the top with other state variables
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
    localStorage.setItem('bannerDismissed4.0', 'true');
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

    if (!validFonts.includes(fontName)) return;

    const fontFamily = getFontWithFallback(fontName);
    const selection = window.getSelection();

    if (!selection.rangeCount) {
        // No selection - apply to entire editor
        editor.style.fontFamily = fontFamily;
        return;
    }

    const range = selection.getRangeAt(0);
    if (selection.isCollapsed) {
        // Cursor position only - apply to entire editor
        editor.style.fontFamily = fontFamily;
        return;
    }

    // Apply to selection
    document.execCommand('styleWithCSS', false, true);
    const span = document.createElement('span');
    span.style.fontFamily = fontFamily;
    
    // Save the range
    const savedRange = range.cloneRange();
    
    try {
        range.surroundContents(span);
    } catch (e) {
        // If surroundContents fails, use a different approach
        const fragment = range.extractContents();
        span.appendChild(fragment);
        range.insertNode(span);
    }
    
    // Restore selection
    selection.removeAllRanges();
    selection.addRange(savedRange);

    // Cleanup any nested or redundant spans
    editor.normalize();
    mergeAdjacentSpans(editor);
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
    if (localStorage.getItem('bannerDismissed4.0') === 'true') {
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

    initializeSelectionTracking();
    updateToolbarState(); // Initial state update

    // Add cursor preservation handler
    document.addEventListener('mousedown', preserveEditorFocus);
    
    // Prevent toolbar buttons from stealing focus
    document.querySelectorAll('.toolbar button, .toolbar select').forEach(element => {
        element.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });
    });
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
            
            isMarkdownMode = doc.isMarkdown || false;
            lastHtmlContent = doc.lastHtmlContent || '';
            
            const editor = document.getElementById('editor');
            
            if (isMarkdownMode) {
                editor.innerText = doc.originalContent || turndownService.turndown(doc.content);
                document.body.classList.add('markdown-mode');
                document.getElementById('markdownToggle').classList.add('active');
            } else {
                editor.innerHTML = doc.content;
                document.body.classList.remove('markdown-mode');
                document.getElementById('markdownToggle').classList.remove('active');
            }
            
            // Set the font in the selector and apply it
            if (doc.font) {
                const fontSelect = document.querySelector('select[title="Font"]');
                fontSelect.value = doc.font;
                editor.style.fontFamily = doc.fontFamily || getFontWithFallback(doc.font);
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
    
    // Store current selection
    const selection = window.getSelection();
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
    
    // Close other submenus
    allSubmenus.forEach(submenu => {
        if (submenu.id !== menuId) {
            submenu.classList.remove('active');
        }
    });
    
    // Toggle current submenu
    menu.classList.toggle('active');
    
    // Restore selection
    if (range) {
        setTimeout(() => {
            selection.removeAllRanges();
            selection.addRange(range);
            document.getElementById('editor').focus();
        }, 0);
    }
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
    const fontName = this.value;
    applyFont(fontName);
    
    // Save the font selection
    const docs = getAllDocuments();
    const doc = docs[currentDocId];
    if (doc) {
        doc.font = fontName;
        doc.fontFamily = getFontWithFallback(fontName);
        saveDocument(currentDocId, doc);
    }

    // Update toolbar state
    updateToolbarState();
});

// Format document function
function formatDoc(command, value = null) {
    document.execCommand(command, false, value);
    updateToolbarState();
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

// Replace existing image handling functions with these improved versions
function processImage(file) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            notifications.error('Invalid File', 'Please select an image file.');
            return reject('Invalid file type');
        }

        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            notifications.error('File Too Large', 'Image must be less than 5MB.');
            return reject('File too large');
        }

        const reader = new FileReader();
        reader.onload = (e) => insertImageDirectly(e.target.result);
        reader.onerror = () => {
            notifications.error('Upload Failed', 'Failed to load image.');
            reject('Upload failed');
        };
        reader.readAsDataURL(file);
    });
}

function insertImageDirectly(dataUrl) {
    const img = document.createElement('img');
    img.src = dataUrl;
    img.classList.add('editor-image');
    img.style.maxWidth = '100%';
    img.style.cursor = 'pointer';
    
    // Add resize handles
    img.addEventListener('click', (e) => {
        // Remove selected class from other images
        document.querySelectorAll('.editor-image.selected').forEach(img => 
            img.classList.remove('selected'));
        img.classList.add('selected');
        showImageControls(img);
    });

    // Insert the image at cursor position or at the end
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.insertNode(img);
        range.collapse(false);
    } else {
        document.getElementById('editor').appendChild(img);
    }

    // Show image controls
    showImageControls(img);
}

// Add new functions for image manipulation
function showImageControls(img) {
    // Remove any existing controls
    removeImageControls();

    const controls = document.createElement('div');
    controls.className = 'image-controls';
    controls.innerHTML = `
        <button onclick="resizeImage(this.parentElement.targetImage, 0.9)" title="Decrease Size">
            <i class="fas fa-search-minus"></i>
        </button>
        <button onclick="resizeImage(this.parentElement.targetImage, 1.1)" title="Increase Size">
            <i class="fas fa-search-plus"></i>
        </button>
        <button onclick="resetImageSize(this.parentElement.targetImage)" title="Reset Size">
            <i class="fas fa-undo"></i>
        </button>
        <button onclick="alignImage(this.parentElement.targetImage, 'left')" title="Align Left">
            <i class="fas fa-align-left"></i>
        </button>
        <button onclick="alignImage(this.parentElement.targetImage, 'center')" title="Align Center">
            <i class="fas fa-align-center"></i>
        </button>
        <button onclick="alignImage(this.parentElement.targetImage, 'right')" title="Align Right">
            <i class="fas fa-align-right"></i>
        </button>
        <button onclick="removeImage(this.parentElement.targetImage)" title="Remove Image">
            <i class="fas fa-trash"></i>
        </button>
    `;
    
    controls.targetImage = img;
    controls.style.position = 'fixed';
    
    // Position controls above the image
    const rect = img.getBoundingClientRect();
    controls.style.top = `${rect.top - 40}px`;
    controls.style.left = `${rect.left}px`;
    
    document.body.appendChild(controls);

    // Update controls position on scroll
    const scrollHandler = () => {
        const newRect = img.getBoundingClientRect();
        controls.style.top = `${newRect.top - 40}px`;
        controls.style.left = `${newRect.left}px`;
    };
    
    window.addEventListener('scroll', scrollHandler);
    
    // Remove controls when clicking outside
    document.addEventListener('click', function closeControls(e) {
        if (!controls.contains(e.target) && e.target !== img) {
            removeImageControls();
            document.removeEventListener('click', closeControls);
            window.removeEventListener('scroll', scrollHandler);
        }
    });
}

function removeImageControls() {
    document.querySelectorAll('.image-controls').forEach(ctrl => ctrl.remove());
    document.querySelectorAll('.editor-image.selected').forEach(img => 
        img.classList.remove('selected'));
}

function resizeImage(img, factor) {
    const currentWidth = parseInt(img.style.width) || img.clientWidth;
    const newWidth = Math.min(Math.max(currentWidth * factor, 50), img.naturalWidth);
    img.style.width = `${newWidth}px`;
    updateImageControls(img);
}

function resetImageSize(img) {
    img.style.width = '';
    img.style.maxWidth = '100%';
    updateImageControls(img);
}

function alignImage(img, alignment) {
    img.style.display = 'block';
    switch (alignment) {
        case 'left':
            img.style.marginLeft = '0';
            img.style.marginRight = 'auto';
            break;
        case 'center':
            img.style.marginLeft = 'auto';
            img.style.marginRight = 'auto';
            break;
        case 'right':
            img.style.marginLeft = 'auto';
            img.style.marginRight = '0';
            break;
    }
    updateImageControls(img);
}

function removeImage(img) {
    if (confirm('Are you sure you want to remove this image?')) {
        removeImageControls();
        img.remove();
    }
}

function updateImageControls(img) {
    const controls = document.querySelector('.image-controls');
    if (controls && controls.targetImage === img) {
        const rect = img.getBoundingClientRect();
        controls.style.top = `${rect.top - 40}px`;
        controls.style.left = `${rect.left}px`;
    }
}

// Update event handler to close image controls when clicking editor
document.getElementById('editor').addEventListener('click', function(e) {
    if (e.target === this) {
        removeImageControls();
    }
});

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
    const enablePreview = document.getElementById('enableRichPreview').checked;

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
            existingLink.setAttribute('data-preview', enablePreview);
        } else {
            const link = document.createElement('a');
            link.href = url;
            link.textContent = text;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.setAttribute('data-preview', enablePreview);
            
            range.deleteContents();
            range.insertNode(link);

            // Add space after link
            const space = document.createTextNode(' ');
            link.parentNode.insertBefore(space, link.nextSibling);
            
            // Move cursor after space
            const newRange = document.createRange();
            newRange.setStartAfter(space);
            selection.removeAllRanges();
            selection.addRange(newRange);

            // If rich preview is enabled, fetch and insert preview
            if (enablePreview) {
                fetchLinkPreview(url).then(preview => {
                    if (preview) {
                        insertRichPreview(link, preview);
                    }
                });
            }
        }

        // Hide dialog
        document.getElementById('linkDialog').style.display = 'none';
        
        // Update content
        document.getElementById('editor').dispatchEvent(new Event('input'));
        
        notifications.success('Link Inserted', 'Link has been added successfully.');
    } catch (error) {
        console.error('Link insertion error:', error);
        notifications.error('Link Error', 'Failed to insert link. Please try again.');
    }
}

// Add function to insert rich preview
function insertRichPreview(link, preview) {
    const previewDiv = document.createElement('div');
    previewDiv.className = 'rich-link-preview';
    previewDiv.innerHTML = `
        ${preview.image ? `<img src="${preview.image.url}" alt="${preview.title || ''}" loading="lazy">` : ''}
        <div class="rich-link-content">
            <div class="rich-link-title">${preview.title || ''}</div>
            <div class="rich-link-description">${preview.description || ''}</div>
            <div class="rich-link-domain">${new URL(preview.url).hostname}</div>
        </div>
    `;
    
    // Insert preview after the link
    link.parentNode.insertBefore(previewDiv, link.nextSibling);
    
    // Make the preview clickable
    previewDiv.onclick = () => window.open(link.href, '_blank');
}

// Add event delegation for handling link clicks in the editor
document.getElementById('editor').addEventListener('click', function(e) {
    const link = e.target.closest('a');
    if (link && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const rect = link.getBoundingClientRect();
        
        const menu = document.createElement('div');
        menu.className = 'link-context-menu';
        menu.style.position = 'fixed';
        menu.style.left = `${rect.left}px`;
        menu.style.top = `${rect.bottom + 5}px`;
        menu.innerHTML = `
            <button onclick="window.open('${link.href}', '_blank')">
                <i class="fas fa-external-link-alt"></i> Open in New Tab
            </button>
            <button onclick="copyToClipboard('${link.href}')">
                <i class="fas fa-copy"></i> Copy URL
            </button>
            <button onclick="editLink(this.closest('.link-context-menu').previousElementSibling)">
                <i class="fas fa-edit"></i> Edit Link
            </button>
        `;
        
        document.body.appendChild(menu);
        
        // Close menu when clicking outside
        setTimeout(() => {
            const closeMenu = (e) => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            };
            document.addEventListener('click', closeMenu);
        }, 0);
    }
});

// Add clipboard helper
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        notifications.success('Copied', 'Link copied to clipboard');
    }).catch(() => {
        notifications.error('Copy Failed', 'Failed to copy link');
    });
}

// Add this new function for rich link previews
async function fetchLinkPreview(url) {
    try {
        const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error('Failed to fetch link preview:', error);
        return null;
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

// Add this function to update toolbar state
function updateToolbarState() {
    const editor = document.getElementById('editor');
    if (!editor.contains(document.activeElement)) return;

    // Get current selection
    const selection = window.getSelection();
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const hasSelection = !selection.isCollapsed;

    // Get formatting state
    const isBold = document.queryCommandState('bold');
    const isItalic = document.queryCommandState('italic');
    const isUnderline = document.queryCommandState('underline');
    const alignment = ['justifyLeft', 'justifyCenter', 'justifyRight']
        .find(cmd => document.queryCommandState(cmd));

    // Get current font and size
    const fontName = document.queryCommandValue('fontName');
    const fontSize = document.queryCommandValue('fontSize');

    // Update button states
    document.querySelector('button[title="Bold"]').classList.toggle('active', isBold);
    document.querySelector('button[title="Italic"]').classList.toggle('active', isItalic);
    document.querySelector('button[title="Underline"]').classList.toggle('active', isUnderline);
    document.querySelector('button[title="Align Left"]').classList.toggle('active', alignment === 'justifyLeft');
    document.querySelector('button[title="Align Center"]').classList.toggle('active', alignment === 'justifyCenter');
    document.querySelector('button[title="Align Right"]').classList.toggle('active', alignment === 'justifyRight');

    // Update select elements
    const fontSelect = document.querySelector('select[title="Font"]');
    const sizeSelect = document.querySelector('select[title="Size"]');

    if (fontName) {
        // Try to match the font name (handling quotes and fallbacks)
        const normalizedFontName = fontName.replace(/['"]/g, '').split(',')[0].trim();
        if (Array.from(fontSelect.options).some(opt => opt.value === normalizedFontName)) {
            fontSelect.value = normalizedFontName;
        }
    }

    if (fontSize) {
        sizeSelect.value = fontSize;
    }

    // Disable formatting controls if no text is selected
    const formattingControls = document.querySelectorAll('.toolbar button:not([title="Document"]), .toolbar select');
    formattingControls.forEach(control => {
        control.disabled = isMarkdownMode;
    });
}

// Update the existing event listeners section
function initializeSelectionTracking() {
    const editor = document.getElementById('editor');

    // Track selection changes
    document.addEventListener('selectionchange', updateToolbarState);

    // Track mouse up for selection changes
    editor.addEventListener('mouseup', updateToolbarState);

    // Track key combinations that might affect selection
    editor.addEventListener('keyup', (e) => {
        if (e.key.startsWith('Arrow') || e.key === 'Shift' || e.ctrlKey || e.metaKey) {
            updateToolbarState();
        }
    });

    // Update state when format commands are executed
    const formatButtons = document.querySelectorAll('.toolbar button');
    formatButtons.forEach(button => {
        button.addEventListener('click', () => {
            setTimeout(updateToolbarState, 0);
        });
    });

    // Update state when select values change
    const formatSelects = document.querySelectorAll('.toolbar select');
    formatSelects.forEach(select => {
        select.addEventListener('change', () => {
            setTimeout(updateToolbarState, 0);
        });
    });
}

// Add this new helper function
function mergeAdjacentSpans(container) {
    const spans = container.getElementsByTagName('span');
    for (let i = spans.length - 1; i >= 0; i--) {
        const span = spans[i];
        const nextSibling = span.nextSibling;
        
        if (nextSibling && nextSibling.nodeType === 1 && nextSibling.tagName === 'SPAN') {
            if (span.style.fontFamily === nextSibling.style.fontFamily) {
                // Merge the spans
                while (nextSibling.firstChild) {
                    span.appendChild(nextSibling.firstChild);
                }
                nextSibling.parentNode.removeChild(nextSibling);
            }
        }
        
        // Remove empty spans
        if (span.textContent.trim() === '') {
            span.parentNode.removeChild(span);
        }
        // Remove spans that only contain other spans with the same font
        else if (span.children.length === span.getElementsByTagName('span').length) {
            const allChildrenSameFont = Array.from(span.children).every(
                child => child.style.fontFamily === span.style.fontFamily
            );
            if (allChildrenSameFont) {
                while (span.firstChild) {
                    span.parentNode.insertBefore(span.firstChild, span);
                }
                span.parentNode.removeChild(span);
            }
        }
    }
}

// Add this new function
function preserveEditorFocus(e) {
    const editor = document.getElementById('editor');
    const selection = window.getSelection();
    const isClickInside = editor.contains(e.target);
    
    // Don't handle dropdown menus
    const isDropdown = e.target.closest('select, .dropdown-content, .user-dropdown');
    if (isDropdown) return;
    
    // Define which elements should preserve focus
    const isPreserveFocus = e.target.closest('.toolbar button:not([title="Document"]), .submenu:not(select), .dialog');
    
    // Don't process if clicking inside editor or it's already focused
    if (isClickInside || !selection.rangeCount) return;
    
    // If clicking toolbar buttons or other UI elements (except dropdowns), prevent focus loss
    if (isPreserveFocus) {
        e.preventDefault();
        const range = selection.getRangeAt(0);
        
        // Restore the selection after the click
        setTimeout(() => {
            selection.removeAllRanges();
            selection.addRange(range);
            editor.focus();
        }, 0);
    }
}