// Format selected text
function format(command, value = null) {
    document.execCommand(command, false, value);
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
const closeModalBtn = document.querySelector('.close-btn');

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
fontSelect.addEventListener('change', (e) => {
    format('fontName', e.target.value);
});

// Apply font size
fontSizeSelect.addEventListener('change', (e) => {
    format('fontSize', e.target.value);
});

// Apply text color
textColorInput.addEventListener('change', (e) => {
    format('foreColor', e.target.value);
});

// Apply highlight color
highlightColorInput.addEventListener('change', (e) => {
    format('hiliteColor', e.target.value);
});

// Event Listeners
saveBtn.addEventListener('click', saveDocument);
loadBtn.addEventListener('click', loadDocuments);
newBtn.addEventListener('click', newDocument);
printBtn.addEventListener('click', printDocument);

// Close modal when clicking on close button
closeModalBtn.addEventListener('click', () => {
    savedDocumentsModal.style.display = 'none';
});

// Close modal when clicking outside of it
window.addEventListener('click', (e) => {
    if (e.target === savedDocumentsModal) {
        savedDocumentsModal.style.display = 'none';
    }
});

// Auto-save feature (every 2 minutes)
setInterval(() => {
    const autoSaveContent = editor.innerHTML;
    localStorage.setItem('autoSaveContent', autoSaveContent);
}, 120000);

// Restore auto-save on page load
window.addEventListener('load', () => {
    const autoSaveContent = localStorage.getItem('autoSaveContent');
    if (autoSaveContent) {
        editor.innerHTML = autoSaveContent;
    }
});