// Nova Docs Editor Main Application Logic with Local Storage Document Management
//app.js

document.addEventListener('DOMContentLoaded', () => {
    // Element selections with error handling
    const editor = document.getElementById('editor');
    const fontSelect = document.getElementById('font-select');
    const fontSizeSelect = document.getElementById('font-size-select');
    const textColorPicker = document.getElementById('text-color-picker');
    const highlightColorPicker = document.getElementById('highlight-color-picker');
    const formattingButtons = document.querySelectorAll('.formatting-btn');
    
    // Document management elements
    const documentNameInput = document.getElementById('document-name');
    const documentListContainer = document.getElementById('document-list');
    const saveDocumentButton = document.getElementById('save-document');
    const newDocumentButton = document.getElementById('new-document');
    const exportTxtButton = document.getElementById('export-txt');
    const exportHtmlButton = document.getElementById('export-html');

    // Validate required elements exist
    const requiredElements = [
        editor, fontSelect, fontSizeSelect, textColorPicker, highlightColorPicker,
        documentNameInput, documentListContainer, saveDocumentButton, 
        newDocumentButton, exportTxtButton, exportHtmlButton
    ];
    
    const missingElements = requiredElements.filter(el => !el);
    if (missingElements.length > 0) {
        console.error('Missing required DOM elements:', missingElements);
        return;
    }

    class DocumentManager {
        static STORAGE_KEY = 'novaDocs-documents';
        static MAX_DOCUMENTS = 100; // Prevent unlimited storage
    
        static getDocuments() {
            try {
                const docs = localStorage.getItem(this.STORAGE_KEY);
                return docs ? JSON.parse(docs) : {};
            } catch (error) {
                console.error('Error retrieving documents:', error);
                return {};
            }
        }
    
        static saveDocument(name, content) {
            if (!name) {
                throw new Error('Document name cannot be empty');
            }
            try {
                const documents = this.getDocuments();
                const sanitizedName = this.sanitizeFileName(name);
                documents[sanitizedName] = {
                    content: content,
                    lastEditDate: new Date().toISOString(),
                    characterCount: content.length
                };
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(documents));
                return sanitizedName;
            } catch (error) {
                console.error('Error saving document:', error);
                alert(error.message);
                return null;
            }
        }
    
        static sanitizeFileName(name) {
            return name.replace(/[<>:"/\\|?*]/g, '').trim();
        }
    
        static loadDocument(name) {
            const documents = this.getDocuments();
            return documents[name] || null;
        }
    
        static deleteDocument(name) {
            try {
                const documents = this.getDocuments();
                delete documents[name];
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(documents));
                return true;
            } catch (error) {
                console.error('Error deleting document:', error);
                return false;
            }
        }

        // Render document list with improved UI
        static renderDocumentList() {
            // Load document from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const docName = urlParams.get('doc');
if (docName) {
    const doc = DocumentManager.loadDocument(docName);
    if (doc) {
        documentNameInput.value = docName;
        editor.innerHTML = doc.content;
    }
}

// Load template from sessionStorage
const templateContent = sessionStorage.getItem('novaDocsTemplate');
if (templateContent) {
    editor.innerHTML = templateContent;
    sessionStorage.removeItem('novaDocsTemplate');
}

    // Autosave functionality with debounce
    let saveTimeout;
    function autoSave() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            const documentName = documentNameInput.value.trim();
            if (documentName) {
                const content = editor.innerHTML;
                DocumentManager.saveDocument(documentName, content);
                DocumentManager.renderDocumentList();
                console.log('Document autosaved');
            }
        }, 1000);
    }

    // Event listeners for document management
    saveDocumentButton.addEventListener('click', () => {
        const documentName = documentNameInput.value.trim();
        if (documentName) {
            const content = editor.innerHTML;
            const savedName = DocumentManager.saveDocument(documentName, content);
            if (savedName) {
                alert(`Document "${savedName}" saved successfully!`);
            }
        } else {
            alert('Please enter a document name');
        }
    });
    

    newDocumentButton.addEventListener('click', () => {
        documentNameInput.value = '';
        editor.innerHTML = '';
        editor.focus();
    });

    // Export button event listeners
    exportTxtButton.addEventListener('click', () => exportDocument('txt'));
    exportHtmlButton.addEventListener('click', () => exportDocument('html'));

    // Initial document list render
    DocumentManager.renderDocumentList();

    // Formatting button event listeners
    formattingButtons.forEach(button => {
        button.addEventListener('click', () => {
            const command = button.dataset.command;
            applyTextFormat(command);
            editor.focus();
        });
    });

    // Apply formatting function with improved error handling
    function applyTextFormat(command) {
        try {
            // Ensure there's an active selection
            const selection = window.getSelection();
            if (selection.rangeCount === 0) {
                editor.focus();
                return;
            }

            switch(command) {
                case 'bold':
                    document.execCommand('bold', false, null);
                    break;
                case 'italic':
                    document.execCommand('italic', false, null);
                    break;
                case 'underline':
                    document.execCommand('underline', false, null);
                    break;
                case 'strikethrough':
                    document.execCommand('strikethrough', false, null);
                    break;
                case 'justifyLeft':
                    document.execCommand('justifyLeft', false, null);
                    break;
                case 'justifyCenter':
                    document.execCommand('justifyCenter', false, null);
                    break;
                case 'justifyRight':
                    document.execCommand('justifyRight', false, null);
                    break;
                case 'justifyFull':
                    document.execCommand('justifyFull', false, null);
                    break;
                case 'insertUnorderedList':
                    document.execCommand('insertUnorderedList', false, null);
                    break;
                case 'insertOrderedList':
                    document.execCommand('insertOrderedList', false, null);
                    break;
                default:
                    console.warn(`Unsupported formatting command: ${command}`);
            }
        } catch (error) {
            console.error('Error applying text format:', error);
        }
    }

    // Font family selection
    fontSelect.addEventListener('change', (e) => {
        document.execCommand('fontName', false, e.target.value);
        editor.focus();
    });

    // Font size selection
    fontSizeSelect.addEventListener('change', (e) => {
        document.execCommand('fontSize', false, e.target.value);
        editor.focus();
    });

    // Text color picker
    textColorPicker.addEventListener('change', (e) => {
        document.execCommand('foreColor', false, e.target.value);
        editor.focus();
    });

    // Highlight (background) color picker
    highlightColorPicker.addEventListener('change', (e) => {
        document.execCommand('hiliteColor', false, e.target.value);
        editor.focus();
    });

    // Keyboard shortcuts with improved error handling
    editor.addEventListener('keydown', (e) => {
        // Prevent default for known shortcuts
        const shortcuts = {
            'b': () => applyTextFormat('bold'),
            'i': () => applyTextFormat('italic'),
            'u': () => applyTextFormat('underline'),
            'z': () => document.execCommand('undo', false, null),
            'y': () => document.execCommand('redo', false, null)
        };

        if (e.ctrlKey && shortcuts[e.key]) {
            e.preventDefault();
            shortcuts[e.key]();
        }
    });

    // Enhanced export functionality
    function exportDocument(format) {
        const documentName = documentNameInput.value.trim() || 'Untitled';
        const content = editor.innerHTML;
        
        try {
            let blob, filename;
            if (format === 'txt') {
                blob = new Blob([editor.innerText], { type: 'text/plain;charset=utf-8' });
                filename = `${documentName}.txt`;
            } else if (format === 'html') {
                // Include basic HTML structure for better exported file
                const htmlContent = `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <title>${documentName}</title>
                    </head>
                    <body>
                        ${content}
                    </body>
                    </html>
                `;
                blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
                filename = `${documentName}.html`;
            } else {
                throw new Error('Unsupported export format');
            }

            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
            
            // Clean up
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export document. Please try again.');
        }
    }

    // Prevent default drag and drop behavior to allow text dragging
    editor.addEventListener('dragstart', (e) => {
        e.preventDefault();
    });

    // Placeholder behavior with improved UX
    const placeholderText = 'Start editing your document here...';
    
    editor.addEventListener('focus', () => {
        if (editor.textContent === placeholderText) {
            editor.textContent = '';
        }
    });

    editor.addEventListener('blur', () => {
        if (editor.textContent.trim() === '') {
            editor.textContent = placeholderText;
        }
    });

    // Initialize with placeholder if empty
    if (editor.textContent.trim() === '') {
        editor.textContent = placeholderText;
    }

    // Event listeners for autosave
    editor.addEventListener('input', autoSave);
    documentNameInput.addEventListener('input', autoSave);

    // Expose utility functions if needed
    window.NovaDocsEditor = {
        exportDocument,
        DocumentManager
    };
}}});