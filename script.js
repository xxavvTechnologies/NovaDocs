// Google Drive Sync Setup
const GOOGLE_CLIENT_ID = '139502800975-lqhp99o1t4pqv7tkjcodunqch8b4vbut.apps.googleusercontent.com';
const GOOGLE_API_SCOPE = 'https://www.googleapis.com/auth/drive.file';

// DOM Elements
const editor = document.getElementById('editor');
const saveBtn = document.getElementById('save-btn');
const loadBtn = document.getElementById('load-btn');
const newBtn = document.getElementById('new-btn');
const printBtn = document.getElementById('print-btn');
const fontSelect = document.getElementById('font-select');
const fontSizeSelect = document.getElementById('font-size-select');
const textColorInput = document.getElementById('text-color');
const highlightColorInput = document.getElementById('highlight-color');
const googleLoginBtn = document.getElementById('google-login-btn');

// Initialize Google API Client
function initializeGoogleAPI() {
    gapi.load('client:auth2', () => {
        gapi.auth2.init({
            client_id: GOOGLE_CLIENT_ID,
            scope: GOOGLE_API_SCOPE,
        }).then(() => {
            const authInstance = gapi.auth2.getAuthInstance();
            updateSigninStatus(authInstance.isSignedIn.get());

            // Listen for changes in sign-in status
            authInstance.isSignedIn.listen(updateSigninStatus);

            // Set up login button
            googleLoginBtn.addEventListener('click', () => {
                if (authInstance.isSignedIn.get()) {
                    authInstance.signOut();
                } else {
                    authInstance.signIn();
                }
            });
        });
    });
}

// Update Sign-In Status
function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        googleLoginBtn.textContent = 'Sign Out of Google';
    } else {
        googleLoginBtn.textContent = 'Sign in with Google';
    }
}

// Save Document to Google Drive
function saveToGoogleDrive() {
    const documentContent = editor.innerHTML;
    const blob = new Blob([documentContent], { type: 'text/html' });

    const metadata = {
        name: 'Nova_Document.html',
        mimeType: 'text/html',
    };

    const accessToken = gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token;

    const formData = new FormData();
    formData.append(
        'metadata',
        new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    formData.append('file', blob);

    fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({ Authorization: 'Bearer ' + accessToken }),
        body: formData,
    })
        .then((response) => response.json())
        .then((data) => {
            alert('File saved to Google Drive with ID: ' + data.id);
        })
        .catch((error) => {
            console.error('Error saving to Google Drive:', error);
        });
}

// Save Document to Local Storage
function saveDocument() {
    const documentName = prompt('Enter a name for this document:');
    if (documentName) {
        const documentContent = editor.innerHTML;
        const savedDocuments = JSON.parse(localStorage.getItem('savedDocuments') || '{}');
        savedDocuments[documentName] = documentContent;
        localStorage.setItem('savedDocuments', JSON.stringify(savedDocuments));
        alert(`Document "${documentName}" saved successfully!`);
    }
}

// Load Documents from Local Storage
function loadDocuments() {
    const savedDocuments = JSON.parse(localStorage.getItem('savedDocuments') || '{}');
    if (Object.keys(savedDocuments).length === 0) {
        alert('No saved documents found.');
        return;
    }

    const documentName = prompt('Enter the name of the document to load:');
    if (savedDocuments[documentName]) {
        editor.innerHTML = savedDocuments[documentName];
        alert(`Document "${documentName}" loaded successfully!`);
    } else {
        alert('Document not found.');
    }
}

// Create New Document
function newDocument() {
    if (confirm('Are you sure you want to create a new document? Unsaved changes will be lost.')) {
        editor.innerHTML = '';
    }
}

// Print Document
function printDocument() {
    const printContents = editor.innerHTML;
    const originalContents = document.body.innerHTML;

    document.body.innerHTML = printContents;
    window.print();

    document.body.innerHTML = originalContents;
    location.reload(); // Reload to restore functionality
}

// Format Commands
function format(command, value = null) {
    document.execCommand(command, false, value);
}

// Apply Font
fontSelect.addEventListener('change', () => {
    const selectedFont = fontSelect.value;
    format('fontName', selectedFont);
});

// Apply Font Size
fontSizeSelect.addEventListener('change', () => {
    const selectedFontSize = fontSizeSelect.value;
    format('fontSize', selectedFontSize);
});

// Apply Text Color
textColorInput.addEventListener('change', () => {
    const selectedTextColor = textColorInput.value;
    format('foreColor', selectedTextColor);
});

// Apply Highlight Color
highlightColorInput.addEventListener('change', () => {
    const selectedHighlightColor = highlightColorInput.value;
    format('hiliteColor', selectedHighlightColor);
});

// Event Listeners for Buttons
saveBtn.addEventListener('click', () => {
    if (gapi.auth2.getAuthInstance().isSignedIn.get()) {
        saveToGoogleDrive();
    } else {
        saveDocument();
    }
});
loadBtn.addEventListener('click', loadDocuments);
newBtn.addEventListener('click', newDocument);
printBtn.addEventListener('click', printDocument);

// Initialize Google API on DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeGoogleAPI();
});