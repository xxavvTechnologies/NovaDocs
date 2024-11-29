// app.js - Standalone Nova Docs for GitHub Pages

class NovaDocs {
    constructor() {
        this.editor = document.getElementById('editor');
        this.profileButton = document.getElementById('profile-button');
        this.dropdownMenu = document.getElementById('dropdown-menu');
        
        // Initialize local storage for documents if not exists
        if (!localStorage.getItem('novaDocs_documents')) {
            localStorage.setItem('novaDocs_documents', JSON.stringify([]));
        }
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Auto-save functionality
        this.editor.addEventListener('input', () => this.debounce(this.autoSave, 1000)());

        // Document editing tracking
        this.editor.addEventListener('focus', () => this.trackDocumentActivity());
        this.editor.addEventListener('blur', () => this.trackDocumentActivity());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    // Debounce function to limit auto-save frequency
    debounce(func, delay) {
        let timeoutId;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(context, args), delay);
        };
    }

    // Auto-save document content
    autoSave() {
        if (!this.currentDocument) {
            this.createNewDocument();
            return;
        }

        const documents = JSON.parse(localStorage.getItem('novaDocs_documents'));
        const documentIndex = documents.findIndex(doc => doc.id === this.currentDocument.id);
        
        if (documentIndex !== -1) {
            documents[documentIndex].content = this.editor.innerHTML;
            documents[documentIndex].lastModified = new Date().toISOString();
            
            localStorage.setItem('novaDocs_documents', JSON.stringify(documents));
            this.showSaveStatus('Saved');
        }
    }

    // Show save status
    showSaveStatus(message, isError = false) {
        const statusDisplay = document.createElement('div');
        statusDisplay.className = `save-status ${isError ? 'error' : 'success'}`;
        statusDisplay.textContent = message;
        
        document.body.appendChild(statusDisplay);
        
        // Remove status after 3 seconds
        setTimeout(() => {
            document.body.removeChild(statusDisplay);
        }, 3000);
    }

    // Track document editing activity
    trackDocumentActivity() {
        if (!this.currentDocument) return;
        // Could be used for local tracking or future features
        console.log('Document activity tracked', this.currentDocument.id);
    }

    // Keyboard shortcuts handler
    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + S: Save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.autoSave();
        }

        // Ctrl/Cmd + B: Bold
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            document.execCommand('bold', false, null);
        }

        // Ctrl/Cmd + I: Italic
        if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
            e.preventDefault();
            document.execCommand('italic', false, null);
        }

        // Ctrl/Cmd + U: Underline
        if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
            e.preventDefault();
            document.execCommand('underline', false, null);
        }
    }

    // Load a specific document
    loadDocument(documentId) {
        const documents = JSON.parse(localStorage.getItem('novaDocs_documents'));
        const document = documents.find(doc => doc.id === documentId);
        
        if (document) {
            this.currentDocument = document;
            this.editor.innerHTML = document.content;
            document.title = document.title || 'Untitled Document';
            
            // Update page title
            document.title = `${document.title} - Nova Docs`;
        }
    }

    // Create a new document
    createNewDocument() {
        const documents = JSON.parse(localStorage.getItem('novaDocs_documents'));
        
        const newDocument = {
            id: `doc_${Date.now()}`,
            title: 'Untitled Document',
            content: '',
            created: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };

        documents.push(newDocument);
        localStorage.setItem('novaDocs_documents', JSON.stringify(documents));
        
        this.currentDocument = newDocument;
        this.editor.innerHTML = '';
        document.title = `${newDocument.title} - Nova Docs`;
        
        // Update documents list
        this.updateDocumentsList();
    }

    // Delete a document
    deleteDocument(documentId) {
        let documents = JSON.parse(localStorage.getItem('novaDocs_documents'));
        documents = documents.filter(doc => doc.id !== documentId);
        
        localStorage.setItem('novaDocs_documents', JSON.stringify(documents));
        
        // If current document was deleted, create a new one
        if (this.currentDocument && this.currentDocument.id === documentId) {
            this.createNewDocument();
        }
        
        this.updateDocumentsList();
    }

    // Rename a document
    renameDocument(documentId, newTitle) {
        const documents = JSON.parse(localStorage.getItem('novaDocs_documents'));
        const documentIndex = documents.findIndex(doc => doc.id === documentId);
        
        if (documentIndex !== -1) {
            documents[documentIndex].title = newTitle;
            documents[documentIndex].lastModified = new Date().toISOString();
            
            localStorage.setItem('novaDocs_documents', JSON.stringify(documents));
            
            if (this.currentDocument && this.currentDocument.id === documentId) {
                this.currentDocument.title = newTitle;
            }
            
            this.updateDocumentsList();
        }
    }

    // Update documents list in dropdown
    updateDocumentsList() {
        // Clear existing list
        this.dropdownMenu.innerHTML = '';

        // Add new document option
        const newDocOption = document.createElement('a');
        newDocOption.href = '#';
        newDocOption.textContent = '+ New Document';
        newDocOption.addEventListener('click', () => this.createNewDocument());
        this.dropdownMenu.appendChild(newDocOption);

        // Fetch and add existing documents
        const documents = JSON.parse(localStorage.getItem('novaDocs_documents')) || [];
        
        documents.forEach(doc => {
            const docContainer = document.createElement('div');
            docContainer.className = 'document-option';

            const docTitle = document.createElement('a');
            docTitle.href = '#';
            docTitle.textContent = doc.title || 'Untitled';
            docTitle.addEventListener('click', () => this.loadDocument(doc.id));
            docContainer.appendChild(docTitle);

            // Add rename button
            const renameBtn = document.createElement('button');
            renameBtn.innerHTML = '<i class="fas fa-edit"></i>';
            renameBtn.className = 'rename-btn';
            renameBtn.addEventListener('click', () => {
                const newTitle = prompt('Enter new document name:', doc.title);
                if (newTitle && newTitle.trim()) {
                    this.renameDocument(doc.id, newTitle.trim());
                }
            });
            docContainer.appendChild(renameBtn);

            // Add delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.className = 'delete-btn';
            deleteBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to delete this document?')) {
                    this.deleteDocument(doc.id);
                }
            });
            docContainer.appendChild(deleteBtn);

            this.dropdownMenu.appendChild(docContainer);
        });
    }

    // Initialize the application
    initialize() {
        // Fetch documents
        this.updateDocumentsList();

        // If no documents exist, create a new one
        const documents = JSON.parse(localStorage.getItem('novaDocs_documents')) || [];
        if (documents.length === 0) {
            this.createNewDocument();
        } else {
            // Load the most recently modified document
            const latestDoc = documents.reduce((latest, doc) => 
                (!latest || new Date(doc.lastModified) > new Date(latest.lastModified)) ? doc : latest
            );
            this.loadDocument(latestDoc.id);
        }
    }
}

// Initialize the application when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const novaDocs = new NovaDocs();
    novaDocs.initialize();
});