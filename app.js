// Nova Docs Editor Main Application Logic with Local Storage Document Management

document.addEventListener('DOMContentLoaded', () => {
    // Notification System
    class NotificationSystem {
        static DURATION = 3000; // Default duration in milliseconds
        static container = document.getElementById('notification-container');

        static show(message, type = 'info', duration = this.DURATION) {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            
            const iconMap = {
                success: 'check-circle',
                error: 'exclamation-circle',
                warning: 'exclamation-triangle',
                info: 'info-circle'
            };

            notification.innerHTML = `
                <i class="fas fa-${iconMap[type]} notification-icon"></i>
                <div class="notification-message">${message}</div>
                <i class="fas fa-times notification-close"></i>
            `;

            this.container.appendChild(notification);

            // Show notification with animation
            setTimeout(() => notification.classList.add('show'), 10);

            // Setup close button
            const closeBtn = notification.querySelector('.notification-close');
            closeBtn.addEventListener('click', () => this.close(notification));

            // Auto close after duration
            if (duration > 0) {
                setTimeout(() => this.close(notification), duration);
            }
        }

        static close(notification) {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }

        static success(message, duration) {
            this.show(message, 'success', duration);
        }

        static error(message, duration) {
            this.show(message, 'error', duration);
        }

        static warning(message, duration) {
            this.show(message, 'warning', duration);
        }

        static info(message, duration) {
            this.show(message, 'info', duration);
        }
    }

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

    // Document management class with enhanced error handling
    class DocumentManager {
        static STORAGE_KEY = 'novaDocs-documents';
        static MAX_DOCUMENTS = 100; // Prevent unlimited storage

        // Get all saved documents with error handling
        static getDocuments() {
            try {
                const docs = localStorage.getItem(this.STORAGE_KEY);
                return docs ? JSON.parse(docs) : {};
            } catch (error) {
                console.error('Error retrieving documents:', error);
                return {};
            }
        }

        // Save a document with additional validations
        static saveDocument(name, content) {
            if (!name) {
                NotificationSystem.error('Document name cannot be empty');
                return null;
            }

            try {
                const documents = this.getDocuments();

                // Check storage limit
                if (Object.keys(documents).length >= this.MAX_DOCUMENTS) {
                    NotificationSystem.error('Maximum number of documents reached');
                    return null;
                }

                // Sanitize document name
                const sanitizedName = this.sanitizeFileName(name);
                const isNew = !documents[sanitizedName];

                documents[sanitizedName] = {
                    content: content,
                    lastEditDate: new Date().toISOString(),
                    characterCount: content.length
                };

                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(documents));
                NotificationSystem.success(isNew ? 'Document created successfully' : 'Document saved successfully');
                return sanitizedName;
            } catch (error) {
                NotificationSystem.error('Failed to save document: ' + error.message);
                return null;
            }
        }

        // Sanitize file name to prevent invalid characters
        static sanitizeFileName(name) {
            return name.replace(/[<>:"/\\|?*]/g, '').trim();
        }

        // Load a document with error handling
        static loadDocument(name) {
            const documents = this.getDocuments();
            return documents[name] || null;
        }

        // Delete a document
        static deleteDocument(name) {
            try {
                const documents = this.getDocuments();
                delete documents[name];
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(documents));
                NotificationSystem.success('Document deleted successfully');
                return true;
            } catch (error) {
                NotificationSystem.error('Failed to delete document: ' + error.message);
                return false;
            }
        }

        // Render document list with improved UI
        static renderDocumentList() {
            const documents = this.getDocuments();
            const listContainer = documentListContainer;
            listContainer.innerHTML = '';

            // Sort documents by last edit date (most recent first)
            const sortedDocuments = Object.entries(documents)
                .sort(([, a], [, b]) => new Date(b.lastEditDate) - new Date(a.lastEditDate));

            if (sortedDocuments.length === 0) {
                const noDocsMessage = document.createElement('div');
                noDocsMessage.textContent = 'No documents saved yet';
                noDocsMessage.className = 'text-center text-gray-500 p-4';
                listContainer.appendChild(noDocsMessage);
                return;
            }

            sortedDocuments.forEach(([name, doc]) => {
                const docElement = document.createElement('div');
                docElement.className = 'document-item flex justify-between items-center p-2 hover:bg-gray-100 cursor-pointer';
                
                const detailsContainer = document.createElement('div');
                detailsContainer.className = 'flex flex-col';

                const nameSpan = document.createElement('span');
                nameSpan.textContent = name;
                nameSpan.className = 'font-medium';
                nameSpan.addEventListener('click', () => {
                    documentNameInput.value = name;
                    editor.innerHTML = doc.content;
                });

                const lastEditSpan = document.createElement('small');
                lastEditSpan.textContent = `Last edited: ${new Date(doc.lastEditDate).toLocaleString()}`;
                lastEditSpan.className = 'text-xs text-gray-500';

                const deleteButton = document.createElement('button');
                deleteButton.textContent = '✖';
                deleteButton.className = 'text-red-500 hover:text-red-700';
                deleteButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete "${name}"?`)) {
                        this.deleteDocument(name);
                        this.renderDocumentList();
                    }
                });

                detailsContainer.appendChild(nameSpan);
                detailsContainer.appendChild(lastEditSpan);
                
                docElement.appendChild(detailsContainer);
                docElement.appendChild(deleteButton);
                listContainer.appendChild(docElement);
            });
        }
    }

    // Autosave functionality with debounce
    let saveTimeout;
    function autoSave() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            const documentName = documentNameInput.value.trim();
            if (documentName) {
                const content = editor.innerHTML;
                if (DocumentManager.saveDocument(documentName, content)) {
                    DocumentManager.renderDocumentList();
                    NotificationSystem.info('Document autosaved');
                }
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
                DocumentManager.renderDocumentList();
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
            NotificationSystem.success(`Document exported as ${format.toUpperCase()}`);
        } catch (error) {
            console.error('Export failed:', error);
            NotificationSystem.error('Failed to export document. Please try again.');
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

    // Image handling
    let cropper = null;
    const imageModal = document.getElementById('imageModal');
    const tableModal = document.getElementById('tableModal');
    const cropperContainer = document.getElementById('cropperContainer');
    const cropperImage = document.getElementById('cropperImage');

    // Close modal handlers
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.onclick = function() {
            imageModal.style.display = 'none';
            tableModal.style.display = 'none';
            if (cropper) {
                cropper.destroy();
                cropper = null;
            }
        }
    });

    // Image upload handling
    document.getElementById('imageInput').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                cropperImage.src = e.target.result;
                cropperContainer.style.display = 'block';
                if (cropper) {
                    cropper.destroy();
                }
                cropper = new Cropper(cropperImage, {
                    aspectRatio: NaN,
                    viewMode: 2,
                    minContainerWidth: 200,
                    minContainerHeight: 200,
                });
            };
            reader.readAsDataURL(file);
        }
    });

    // Cropper controls
    document.getElementById('rotateLeft').onclick = () => cropper.rotate(-90);
    document.getElementById('rotateRight').onclick = () => cropper.rotate(90);
    document.getElementById('cropImage').onclick = () => {
        const croppedCanvas = cropper.getCroppedCanvas();
        insertImage(croppedCanvas.toDataURL());
        imageModal.style.display = 'none';
        cropper.destroy();
        cropper = null;
    };

    // Image URL handling
    document.getElementById('imageUrlBtn').onclick = () => {
        const url = prompt('Enter image URL:');
        if (url) {
            insertImage(url);
            imageModal.style.display = 'none';
        }
    };

    function insertImage(src) {
        const img = document.createElement('div');
        img.className = 'image-wrapper';
        img.innerHTML = `
            <img src="${src}" alt="Inserted image">
            <div class="image-controls">
                <button class="image-control-btn" onclick="this.closest('.image-wrapper').remove()">
                    <i class="fas fa-trash"></i>
                </button>
                <button class="image-control-btn" onclick="resizeImage(this)">
                    <i class="fas fa-expand"></i>
                </button>
            </div>
        `;
        insertAtCursor(img);
    }

    // Table handling
    document.getElementById('insertTableBtn').onclick = () => {
        const rows = parseInt(document.getElementById('tableRows').value);
        const cols = parseInt(document.getElementById('tableCols').value);
        
        if (rows > 0 && cols > 0) {
            insertTable(rows, cols);
            tableModal.style.display = 'none';
        }
    };

    function insertTable(rows, cols) {
        const table = document.createElement('table');
        
        // Create header row
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (let i = 0; i < cols; i++) {
            const th = document.createElement('th');
            th.contentEditable = true;
            th.innerHTML = `Header ${i + 1}`;
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create body rows
        const tbody = document.createElement('tbody');
        for (let i = 0; i < rows - 1; i++) {
            const row = document.createElement('tr');
            for (let j = 0; j < cols; j++) {
                const td = document.createElement('td');
                td.contentEditable = true;
                td.innerHTML = `Cell ${i + 1}-${j + 1}`;
                row.appendChild(td);
            }
            tbody.appendChild(row);
        }
        table.appendChild(tbody);

        insertAtCursor(table);
    }

    function insertAtCursor(element) {
        const selection = window.getSelection();
        if (selection.rangeCount) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(element);
            selection.collapseToEnd();
        }
    }

    // Add command handlers for new buttons
    const commandHandlers = {
        // ...existing handlers...
        'insertImage': () => {
            imageModal.style.display = 'block';
            document.getElementById('imageInput').value = '';
            cropperContainer.style.display = 'none';
        },
        'insertTable': () => {
            tableModal.style.display = 'block';
        }
    };

    // Update formatting button event listeners
    formattingButtons.forEach(button => {
        button.addEventListener('click', () => {
            const command = button.dataset.command;
            if (commandHandlers[command]) {
                commandHandlers[command]();
            } else {
                applyTextFormat(command);
            }
            editor.focus();
        });
    });

    // Image resize function
    window.resizeImage = function(button) {
        const img = button.closest('.image-wrapper').querySelector('img');
        const newWidth = prompt('Enter new width (in pixels):', img.width);
        if (newWidth && !isNaN(newWidth)) {
            img.style.width = `${newWidth}px`;
            img.style.height = 'auto';
        }
    };
});