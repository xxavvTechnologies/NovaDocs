// Google Drive Sync Setup (Placeholder)
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_API_SCOPE = 'https://www.googleapis.com/auth/drive.file';

// Format selected text
function format(command, value = null) {
    document.execCommand(command, false, value);
}

// Theme Toggle Functionality
function initThemeToggle() {
    const themeSwitch = document.getElementById('theme-switch');
    const body = document.body;

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        body.classList.toggle('dark-mode', savedTheme === 'dark');
        themeSwitch.checked = savedTheme === 'dark';
    }

    themeSwitch.addEventListener('change', () => {
        body.classList.toggle('dark-mode');
        
        // Save theme preference
        const theme = body.classList.contains('dark-mode') ? 'dark' : 'light';
        localStorage.setItem('theme', theme);
    });
}

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
const savedDocumentsModal = document.getElementById('saved-documents-modal');
const savedDocumentsList = document.getElementById('saved-documents-list');
const closeModalBtns = document.querySelectorAll('.close-btn');
const googleLoginBtn = document.getElementById('google-login-btn');
const driveSyncModal = document.getElementById('drive-sync-modal');
const driveSyncContent = document.getElementById('drive-sync-content');

// Save document to localStorage
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

// Load documents from localStorage
function loadDocuments() {
    const savedDocuments = JSON.parse(localStorage.getItem('savedDocuments') || '{}');
    savedDocumentsList.innerHTML = ''; // Clear previous list

    if (Object.keys(savedDocuments).length === 0) {
        savedDocumentsList.innerHTML = '<li>No saved documents found.</li>';
        return;
    }

    Object.keys(savedDocuments).forEach(docName => {
        const li = document.createElement('li');
        li.textContent = docName;
        li.addEventListener('click', () => {
            editor.innerHTML = savedDocuments[docName];
            savedDocumentsModal.style.display = 'none';
        });
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
    
    document.body.innerHTML = printContents;
    window.print();
    
    document.body.innerHTML = originalContents;
    location.reload(); // Reload to restore functionality
}

// Apply font
fontSelect.addEventListener('change', () => {
    const selectedFont = fontSelect.value;
    document.execCommand('fontName', false, selectedFont);
});

// Apply font size
fontSizeSelect.addEventListener('change', () => {
    const selectedFontSize = fontSizeSelect.value;
    document.execCommand('fontSize', false, selectedFontSize);
});

// Apply text color
textColorInput.addEventListener('change', () => {
    const selectedTextColor = textColorInput.value;
    document.execCommand('foreColor', false, selectedTextColor);
});

// Apply highlight color
highlightColorInput.addEventListener('change', () => {
    const selectedHighlightColor = highlightColorInput.value;
    document.execCommand('hiliteColor', false, selectedHighlightColor);
});

// Event listeners for buttons
saveBtn.addEventListener('click', saveDocument);
loadBtn.addEventListener('click', loadDocuments);
newBtn.addEventListener('click', newDocument);
printBtn.addEventListener('click', printDocument);

// Close modals
closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const modal = btn.closest('.modal');
        modal.style.display = 'none';
    });
});

// Initialize theme toggle
initThemeToggle();

// Google Drive login (requires further implementation)
googleLoginBtn.addEventListener('click', () => {
    alert('Google Drive sync functionality is not implemented yet.');
});

document.addEventListener('DOMContentLoaded', () => {
    // Placeholder for future Google Drive functionality
});
