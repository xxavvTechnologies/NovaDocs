// Google Drive API Configuration
const GOOGLE_CLIENT_ID = '139502800975-lqhp99o1t4pqv7tkjcodunqch8b4vbut.apps.googleusercontent.com';
const GOOGLE_API_SCOPES = 'https://www.googleapis.com/auth/drive.file';

// DOM Elements (existing and new)
const editor = document.getElementById('editor');
const saveBtn = document.getElementById('save-btn');
const loadBtn = document.getElementById('load-btn');
const newBtn = document.getElementById('new-btn');
const printBtn = document.getElementById('print-btn');
const fontSelect = document.getElementById('font-select');
const fontSizeSelect = document.getElementById('font-size-select');
const textColorInput = document.getElementById('text-color');
const highlightColorInput = document.getElementById('highlight-color');
const savedDocumentsModal = document.getElementById('saved-documents-modal');
const savedDocumentsList = document.getElementById('saved-documents-list');
const closeModalBtns = document.querySelectorAll('.close-btn');
const driveLoginBtn = document.getElementById('google-login-btn');
const driveSyncBtn = document.getElementById('drive-sync-btn');
const driveSyncModal = document.getElementById('drive-sync-modal');
const driveFileList = document.getElementById('drive-file-list');
const themeSwitch = document.getElementById('theme-switch');

// Theme Toggle
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    // Save theme preference to localStorage
    localStorage.setItem('theme', 
        document.body.classList.contains('dark-mode') ? 'dark' : 'light'
    );
}

// Initialize theme on page load
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeSwitch.checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        themeSwitch.checked = false;
    }
}

// Format selected text
function format(command, value = null) {
    document.execCommand(command, false, value);
}

// Save document to localStorage
function saveDocument() {
    const documentName = prompt('Enter a name for this document:');
    if (documentName) {
        const documentContent = editor.innerHTML;
        const savedDocuments = JSON.parse(localStorage.getItem('savedDocuments') || '{}');
        savedDocuments[documentName] = {
            content: documentContent,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('savedDocuments', JSON.stringify(savedDocuments));
        alert(`Document "${documentName}" saved successfully!`);
    }
}

// Load documents from localStorage
function loadDocuments() {
    const savedDocuments = JSON.parse(localStorage.getItem('savedDocuments') || '{}');
    savedDocumentsList.innerHTML = ''; // Clear previous list

    if (Object.keys(savedDocuments).length === 0) {
        savedDocumentsList.innerHTML = '<li>No saved documents found.</li>';
        return;
    }

    // Sort documents by timestamp (most recent first)
    const sortedDocs = Object.entries(savedDocuments)
        .sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));

    sortedDocs.forEach(([docName, docData]) => {
        const li = document.createElement('li');
        
        // Create document info line
        const docInfo = document.createElement('div');
        docInfo.innerHTML = `
            <strong>${docName}</strong>
            <small>${new Date(docData.timestamp).toLocaleString()}</small>
        `;
        
        li.appendChild(docInfo);
        
        li.addEventListener('click', () => {
            editor.innerHTML = docData.content;
            savedDocumentsModal.style.display = 'none';
        });

        // Add delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '&times;';
        deleteBtn.classList.add('delete-doc');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete "${docName}"?`)) {
                const updatedDocs = JSON.parse(localStorage.getItem('savedDocuments') || '{}');
                delete updatedDocs[docName];
                localStorage.setItem('savedDocuments', JSON.stringify(updatedDocs));
                loadDocuments(); // Refresh the list
            }
        });
        li.appendChild(deleteBtn);

        savedDocumentsList.appendChild(li);
    });

    savedDocumentsModal.style.display = 'block';
}

// Create new document
function newDocument() {
    if (confirm('Are you sure you want to create a new document? Unsaved changes will be lost.')) {
        editor.innerHTML = '';
    }
}

// Print document
function printDocument() {
    const printContents = editor.innerHTML;
    const originalContents = document.body.innerHTML;

    // Temporarily replace the body content with the editor's content
    document.body.innerHTML = printContents;

    // Trigger the print dialog
    window.print();

    // Restore the original content immediately after printing
    document.body.innerHTML = originalContents;

    // Optional: Reattach any event listeners or scripts if necessary
}

// Google Drive Sync Functionality
const GoogleDriveSync = {
    isSignedIn: false,

    // Initialize Google API Client
    initClient() {
        gapi.load('client:auth2', () => {
            gapi.client.init({
                clientId: GOOGLE_CLIENT_ID,
                scope: GOOGLE_API_SCOPES
            }).then(() => {
                // Listen for sign-in state changes
                gapi.auth2.getAuthInstance().isSignedIn.listen(this.updateSigninStatus.bind(this));
                
                // Handle the initial sign-in state
                this.updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
            }).catch((error) => {
                console.error('Error initializing Google API client', error);
            });
        });
    },

    // Update UI based on sign-in state
    updateSigninStatus(signedIn) {
        this.isSignedIn = signedIn;
        if (signedIn) {
            driveLoginBtn.textContent = 'Logout';
            this.listFiles();
        } else {
            driveLoginBtn.textContent = 'Login with Google';
            driveFileList.innerHTML = '';
        }
    },

    // Handle Google login/logout
    handleAuthClick() {
        if (this.isSignedIn) {
            gapi.auth2.getAuthInstance().signOut();
        } else {
            gapi.auth2.getAuthInstance().signIn();
        }
    },

    // List files from Google Drive
    listFiles() {
        gapi.client.drive.files.list({
            'pageSize': 10,
            'fields': "nextPageToken, files(id, name, modifiedTime)",
            'q': "mimeType='text/plain' or mimeType='text/html'"
        }).then((response) => {
            const files = response.result.files;
            driveFileList.innerHTML = '';
            if (files && files.length > 0) {
                files.forEach((file) => {
                    const fileItem = document.createElement('div');
                    fileItem.classList.add('drive-file-item');
                    fileItem.innerHTML = `
                        <span>${file.name}</span>
                        <small>Modified: ${new Date(file.modifiedTime).toLocaleString()}</small>
                        <button class="load-drive-file" data-id="${file.id}">Load</button>
                    `;
                    fileItem.querySelector('.load-drive-file').addEventListener('click', () => this.loadFile(file.id));
                    driveFileList.appendChild(fileItem);
                });
            } else {
                driveFileList.innerHTML = '<p>No files found.</p>';
            }
        });
    },

    // Load a specific file from Google Drive
    loadFile(fileId) {
        gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        }).then((response) => {
            editor.innerHTML = response.body;
            driveSyncModal.style.display = 'none';
        });
    },

    // Save current document to Google Drive
    saveFile() {
        if (!this.isSignedIn) {
            alert('Please log in to Google Drive first.');
            return;
        }

        const fileName = prompt('Enter a name for the file:') || 'NovaDocs Document.html';
        const fileContent = editor.innerHTML;

        const file = new Blob([fileContent], {type: 'text/html'});
        const metadata = {
            'name': fileName,
            'mimeType': 'text/html'
        };

        const accessToken = gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token;
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
        form.append('file', file);

        fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({
                'Authorization': 'Bearer ' + accessToken
            }),
            body: form
        }).then(response => response.json())
        .then(file => {
            alert('File saved to Google Drive successfully!');
            this.listFiles();
        }).catch(error => {
            console.error('Error saving file to Google Drive', error);
            alert('Failed to save file to Google Drive.');
        });
    }
};

function initFontSizeSelector() {
    const fontSizeSelect = document.getElementById('font-size-select');

    // Populate font size dropdown with default sizes
    for (let size = 9; size <= 60; size++) {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = size;
        fontSizeSelect.appendChild(option);
    }

    // Add an event listener to handle changes
    fontSizeSelect.addEventListener('change', (e) => {
        const selectedSize = parseInt(e.target.value, 10);
        if (selectedSize >= 9 && selectedSize <= 96) {
            format('fontSize', selectedSize);
        } else {
            alert('Please select a font size between 9 and 96.');
        }
    });

    // Allow custom font size input
    fontSizeSelect.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT') return;

        // Add input field for custom size
        const customInput = document.createElement('input');
        customInput.type = 'number';
        customInput.min = '9';
        customInput.max = '96';
        customInput.placeholder = 'Custom';
        customInput.className = 'custom-font-size-input';
        customInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                const value = parseInt(customInput.value, 10);
                if (value >= 9 && value <= 96) {
                    format('fontSize', value);
                    fontSizeSelect.value = value; // Update dropdown to reflect custom size
                } else {
                    alert('Font size must be between 9 and 96.');
                }
                customInput.remove(); // Remove input field
            }
        });
        fontSizeSelect.parentNode.appendChild(customInput);
        customInput.focus();
    });
}

// Event Listeners
function initEventListeners() {
    // Existing listeners
    saveBtn.addEventListener('click', saveDocument);
    loadBtn.addEventListener('click', loadDocuments);
    newBtn.addEventListener('click', newDocument);
    printBtn.addEventListener('click', printDocument);

    // Font and style listeners
    fontSelect.addEventListener('change', (e) => {
        format('fontName', e.target.value);
    });

    fontSizeSelect.addEventListener('change', (e) => {
        format('fontSize', e.target.value);
    });

    textColorInput.addEventListener('change', (e) => {
        format('foreColor', e.target.value);
    });

    highlightColorInput.addEventListener('change', (e) => {
        format('hiliteColor', e.target.value);
    });

    // Theme toggle
    themeSwitch.addEventListener('change', toggleTheme);

    // Close modal buttons
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').style.display = 'none';
        });
    });

    // Close modal when clicking outside of it
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    // Google Drive sync listeners
    driveLoginBtn.addEventListener('click', () => GoogleDriveSync.handleAuthClick());
    driveSyncBtn.addEventListener('click', () => {
        if (GoogleDriveSync.isSignedIn) {
            GoogleDriveSync.saveFile();
        } else {
            driveSyncModal.style.display = 'block';
        }
    });
}

// Auto-save feature (every 2 minutes)
function initAutoSave() {
    setInterval(() => {
        const autoSaveContent = editor.innerHTML;
        localStorage.setItem('autoSaveContent', autoSaveContent);
    }, 120000);

    // Restore auto-save on page load
    const autoSaveContent = localStorage.getItem('autoSaveContent');
    if (autoSaveContent) {
        editor.innerHTML = autoSaveContent;
    }
}

// Initialize everything when the page loads
function init() {
    initTheme();
    initEventListeners();
    initAutoSave();

    // Initialize Google Drive API
    if (typeof gapi !== 'undefined') {
        GoogleDriveSync.initClient();
    }
}

// Run initialization when the page loads
window.addEventListener('load', init);

// Additional CSS to support new features
const styleTag = document.createElement('style');
styleTag.textContent = `
    .drive-file-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        border-bottom: 1px solid var(--border-color);
    }
    .drive-file-item button {
        margin-left: 10px;
    }
    .delete-doc {
        background: none;
        border: none;
        color: red;
        font-weight: bold;
        cursor: pointer;
        margin-left: 10px;
    }
`;
document.head.appendChild(styleTag);