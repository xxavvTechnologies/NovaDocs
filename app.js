// app.js - Nova Docs with Google Drive Integration

// Import the GoogleDriveSync class from drivesync.js
import GoogleDriveSync from './drivesync.js';

// Configuration for Google Drive sync
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';
const GOOGLE_API_KEY = 'YOUR_GOOGLE_API_KEY';

class NovaDocs {
    constructor() {
        this.editor = document.getElementById('editor');
        this.profileButton = document.getElementById('profile-button');
        this.dropdownMenu = document.getElementById('dropdown-menu');
        this.driveSyncer = new GoogleDriveSync(GOOGLE_CLIENT_ID, GOOGLE_API_KEY);
        
        // Initialize local storage for documents if not exists
        if (!localStorage.getItem('novaDocs_documents')) {
            localStorage.setItem('novaDocs_documents', JSON.stringify([]));
        }
        
        this.driveLoginButton = document.getElementById('drive-login-button');
        this.driveSyncButton = document.getElementById('drive-sync-button');
        this.driveListButton = document.getElementById('drive-list-button');

        this.initializeEventListeners();
        this.initializeFormattingBar();
        this.initializeDriveSyncListeners();
    }

    initializeEventListeners() {
        // Auto-save functionality
        this.editor.addEventListener('input', () => this.debounce(this.autoSave, 1000)());

        // Document editing tracking
        this.editor.addEventListener('focus', () => this.trackDocumentActivity());
        this.editor.addEventListener('blur', () => this.trackDocumentActivity());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
        this.editor.addEventListener('mouseup', () => this.updateFormattingState());
        this.editor.addEventListener('keyup', () => this.updateFormattingState());
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

    initializeDriveSyncListeners() {
        // Login to Google Drive
        if (this.driveLoginButton) {
            this.driveLoginButton.addEventListener('click', async () => {
                try {
                    await this.driveSyncer.authenticate();
                    this.showSaveStatus('Google Drive Connected');
                    this.updateDriveSyncUI(true);
                } catch (error) {
                    this.showSaveStatus('Drive Connection Failed', true);
                }
            });
        }

        // Sync current document to Google Drive
        if (this.driveSyncButton) {
            this.driveSyncButton.addEventListener('click', () => this.syncDocumentToDrive());
        }

        // List documents from Google Drive
        if (this.driveListButton) {
            this.driveListButton.addEventListener('click', () => this.listDriveDocuments());
        }
    }

    // Update UI based on Drive sync status
    updateDriveSyncUI(isConnected) {
        if (this.driveLoginButton) {
            this.driveLoginButton.style.display = isConnected ? 'none' : 'block';
        }
        if (this.driveSyncButton) {
            this.driveSyncButton.style.display = isConnected ? 'block' : 'none';
        }
        if (this.driveListButton) {
            this.driveListButton.style.display = isConnected ? 'block' : 'none';
        }
    }

    // Sync current document to Google Drive
    async syncDocumentToDrive() {
        if (!this.currentDocument) {
            this.showSaveStatus('No document to sync', true);
            return;
        }

        try {
            // Ensure authentication
            await this.driveSyncer.authenticate();

            // Get document content and title
            const documentContent = this.editor.innerHTML;
            const documentName = this.currentDocument.title || 'Untitled Document';

            // Upload to Google Drive
            const fileId = await this.driveSyncer.uploadDocument(documentName, documentContent);

            // Update current document with Drive file ID
            this.currentDocument.driveFileId = fileId;
            this.updateDocumentInLocalStorage(this.currentDocument);

            this.showSaveStatus('Document Synced to Drive');
        } catch (error) {
            console.error('Drive sync error:', error);
            this.showSaveStatus('Sync to Drive Failed', true);
        }
    }

    // List documents from Google Drive
    async listDriveDocuments() {
        try {
            // Ensure authentication
            await this.driveSyncer.authenticate();

            // Fetch documents
            const driveDocuments = await this.driveSyncer.listDocuments();

            // Clear existing dropdown
            this.dropdownMenu.innerHTML = '';

            // Add Drive documents section
            const driveSection = document.createElement('div');
            driveSection.className = 'drive-documents-section';
            driveSection.innerHTML = '<h3>Google Drive Documents</h3>';

            driveDocuments.forEach(doc => {
                const docOption = document.createElement('div');
                docOption.className = 'document-option drive-document';
                
                const docTitle = document.createElement('a');
                docTitle.href = '#';
                docTitle.textContent = doc.name;
                docTitle.addEventListener('click', () => this.loadDriveDocument(doc.id));
                docOption.appendChild(docTitle);

                driveSection.appendChild(docOption);
            });

            this.dropdownMenu.appendChild(driveSection);
        } catch (error) {
            console.error('Error listing Drive documents:', error);
            this.showSaveStatus('Failed to list Drive documents', true);
        }
    }

    // Load a document from Google Drive
    async loadDriveDocument(fileId) {
        try {
            // Download document content
            const documentContent = await this.driveSyncer.downloadDocument(fileId);

            // Create a new local document from Drive document
            const newDocument = {
                id: `doc_${Date.now()}`,
                title: 'Drive Document',
                content: documentContent,
                created: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                driveFileId: fileId
            };

            // Save to local storage
            const documents = JSON.parse(localStorage.getItem('novaDocs_documents')) || [];
            documents.push(newDocument);
            localStorage.setItem('novaDocs_documents', JSON.stringify(documents));

            // Load the document
            this.currentDocument = newDocument;
            this.editor.innerHTML = documentContent;
            this.updateDocumentsList();

            this.showSaveStatus('Document Loaded from Drive');
        } catch (error) {
            console.error('Error loading Drive document:', error);
            this.showSaveStatus('Failed to load Drive document', true);
        }
    }

    // Update document in local storage
    updateDocumentInLocalStorage(updatedDocument) {
        const documents = JSON.parse(localStorage.getItem('novaDocs_documents')) || [];
        const docIndex = documents.findIndex(doc => doc.id === updatedDocument.id);

        if (docIndex !== -1) {
            documents[docIndex] = updatedDocument;
            localStorage.setItem('novaDocs_documents', JSON.stringify(documents));
        }
    }

    // Logout from Google Drive
    async logoutFromDrive() {
        try {
            await this.driveSyncer.logout();
            this.updateDriveSyncUI(false);
            this.showSaveStatus('Logged out of Google Drive');
        } catch (error) {
            console.error('Logout error:', error);
            this.showSaveStatus('Logout Failed', true);
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

    updateFormattingState() {
        const boldBtn = document.querySelector('.formatting-btn[data-command="bold"]');
        const italicBtn = document.querySelector('.formatting-btn[data-command="italic"]');
        const underlineBtn = document.querySelector('.formatting-btn[data-command="underline"]');
    
        boldBtn.classList.toggle('active', document.queryCommandState('bold'));
        italicBtn.classList.toggle('active', document.queryCommandState('italic'));
        underlineBtn.classList.toggle('active', document.queryCommandState('underline'));
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

    initializeFormattingBar() {
        // Formatting buttons
        const formattingButtons = document.querySelectorAll('.formatting-btn');
        formattingButtons.forEach(button => {
            button.addEventListener('click', () => {
                const command = button.dataset.command;
                document.execCommand(command, false, null);
                
                // Toggle active state for some buttons
                if (command === 'bold' || command === 'italic' || command === 'underline') {
                    button.classList.toggle('active');
                }
                
                // Restore focus to editor
                this.editor.focus();
            });
        });
    
        // Font family selector
        const fontSelect = document.getElementById('font-select');
        fontSelect.addEventListener('change', (e) => {
            document.execCommand('fontName', false, e.target.value);
            this.editor.focus();
        });
    
        // Font size selector
        const fontSizeSelect = document.getElementById('font-size-select');
        fontSizeSelect.addEventListener('change', (e) => {
            document.execCommand('fontSize', false, e.target.value);
            this.editor.focus();
        });
    
        // Text color picker
        const textColorPicker = document.getElementById('text-color-picker');
        textColorPicker.addEventListener('change', (e) => {
            document.execCommand('foreColor', false, e.target.value);
            this.editor.focus();
        });
    
        // Highlight color picker
        const highlightColorPicker = document.getElementById('highlight-color-picker');
        highlightColorPicker.addEventListener('change', (e) => {
            document.execCommand('hiliteColor', false, e.target.value);
            this.editor.focus();
        });
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

        const documents = JSON.parse(localStorage.getItem('novaDocs_documents')) || [];
        const driveDocuments = documents.filter(doc => doc.driveFileId);
        
        if (driveDocuments.length > 0) {
            // Optionally add a notification about synced documents
            console.log('You have documents previously synced with Drive');
        }
    }

}
}

// Initialize the application when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const novaDocs = new NovaDocs();
    novaDocs.initialize();
});