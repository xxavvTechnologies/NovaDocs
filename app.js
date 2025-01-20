// Nova Docs Editor Main Application Logic with Local Storage Document Management

document.addEventListener('DOMContentLoaded', () => {
    // Element selections with error handling
    const formattingButtons = document.querySelectorAll('.formatting-btn');
    const editor = document.getElementById('editor');
    const fontSelect = document.getElementById('font-select');
    const fontSizeSelect = document.getElementById('font-size-select');
    const textColorPicker = document.getElementById('text-color-picker');
    const highlightColorPicker = document.getElementById('highlight-color-picker');
    // Document management elements
    // Document management elements
    const documentNameInput = document.getElementById('document-name');
    const documentListContainer = document.getElementById('document-list');
    const saveDocumentButton = document.getElementById('save-document');
    const newDocumentButton = document.getElementById('new-document');
    const exportTxtButton = document.getElementById('export-txt');
    const exportHtmlButton = document.getElementById('export-html');
    const history = new DocumentHistory();
    const commentSystem = new CommentSystem(editor);
    const imageResizer = new ImageResizer(editor);

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

    editor.addEventListener('click', (e) => {
        if (e.target.matches('.comment-highlight')) {
            const comment = commentSystem.comments.get(e.target.dataset.commentId);
            if (comment) {
                commentSystem.showCommentUI(comment);
            }
        }
    });

        // Add close handler for comment sidebar
        document.querySelector('#comment-sidebar .close-btn')?.addEventListener('click', () => {
            document.getElementById('comment-sidebar').style.display = 'none';
        });

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
                throw new Error('Document name cannot be empty');
            }

            try {
                const documents = this.getDocuments();

                // Check storage limit
                if (Object.keys(documents).length >= this.MAX_DOCUMENTS) {
                    throw new Error('Maximum number of documents reached');
                }

                // Sanitize document name
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
                return true;
            } catch (error) {
                console.error('Error deleting document:', error);
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

    document.querySelector('[data-command="createTable"]').addEventListener('click', () => {
        const controls = document.createElement('div');
        controls.className = 'table-controls';
        controls.innerHTML = `
            <input type="number" id="table-rows" value="2" min="1" max="10">
            <input type="number" id="table-cols" value="2" min="1" max="10">
            <button class="btn-primary">Insert</button>
        `;
        
        controls.querySelector('button').onclick = () => {
            const rows = document.getElementById('table-rows').value;
            const cols = document.getElementById('table-cols').value;
            TextFormatter.createTable(rows, cols);
            controls.remove();
        };
        
        document.body.appendChild(controls);
    });
    
    // Add image button event listener
document.querySelector('[data-command="insertImage"]').addEventListener('click', () => {
    TextFormatter.insertImage();

    const APP_VERSION = '2.5.0'; // Update this when releasing new versions
    const LAST_SEEN_VERSION_KEY = 'novaDocs-lastSeenVersion';

function checkForUpdates() {
    const lastSeenVersion = localStorage.getItem(LAST_SEEN_VERSION_KEY);
    
    if (!lastSeenVersion || lastSeenVersion !== APP_VERSION) {
        showUpdateNotification();
    }
}

function showUpdateNotification() {
    const notification = document.getElementById('update-notification');
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 1000);
    
    // Add dismiss handler
    notification.querySelector('.dismiss-btn').addEventListener('click', () => {
        notification.classList.remove('show');
        localStorage.setItem(LAST_SEEN_VERSION_KEY, APP_VERSION);
    });
}

// Check for updates when app loads
checkForUpdates();
});

// Add comment button event listener
document.querySelector('[data-command="addComment"]').addEventListener('click', () => {
    const selection = window.getSelection();
    if (!selection.toString()) {
        alert('Please select some text to comment on');
        return;
    }
    
    const commentText = prompt('Enter your comment:');
    if (commentText) {
        commentSystem.addComment(selection, commentText);
    }
});

// Add history tracking
editor.addEventListener('input', () => {
    const selection = window.getSelection();
    history.recordChange(editor.innerHTML, {
        start: selection.anchorOffset,
        end: selection.focusOffset
    });
});

// Update keyboard shortcuts
editor.addEventListener('keydown', (e) => {
    if (e.ctrlKey) {
        switch(e.key) {
            case 'z':
                e.preventDefault();
                const undoChange = history.undo();
                if (undoChange) {
                    editor.innerHTML = undoChange.content;
                }
                break;
            case 'y':
                e.preventDefault();
                const redoChange = history.redo();
                if (redoChange) {
                    editor.innerHTML = redoChange.content;
                }
                break;
        }
    }
});

// Click handler for comment highlights
editor.addEventListener('click', (e) => {
    if (e.target.matches('.comment-highlight')) {
        const comment = commentSystem.comments.get(e.target.dataset.commentId);
        if (comment) {
            // Show comment details
            alert(comment.text); // Replace with better UI
        }
    }
});

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


    class DocumentHistory {
        static MAX_HISTORY_ITEMS = 100;
        
        constructor() {
            this.undoStack = [];
            this.redoStack = [];
            this.isRecording = false;
        }
    
        recordChange(content, selection) {
            if (this.isRecording) return;
            
            this.undoStack.push({
                content,
                selection,
                timestamp: new Date().toISOString()
            });
    
            if (this.undoStack.length > DocumentHistory.MAX_HISTORY_ITEMS) {
                this.undoStack.shift();
            }
            
            // Clear redo stack on new changes
            this.redoStack = [];
        }
    
        undo() {
            const change = this.undoStack.pop();
            if (!change) return null;
            
            this.redoStack.push(change);
            return change;
        }
    
        redo() {
            const change = this.redoStack.pop();
            if (!change) return null;
            
            this.undoStack.push(change);
            return change;
        }
    }

    // Modern text formatting helper functions
    const TextFormatter = {
        formatSelection(format, value = null) {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            const container = document.createElement('span');
            
            switch(format) {
                case 'bold':
                    container.style.fontWeight = 'bold';
                    break;
                case 'italic':
                    container.style.fontStyle = 'italic';
                    break;
                case 'underline':
                    container.style.textDecoration = 'underline';
                    break;
                case 'strikethrough':
                    container.style.textDecoration = 'line-through';
                    break;
                case 'justifyLeft':
                    container.style.textAlign = 'left';
                    break;
                case 'justifyCenter':
                    container.style.textAlign = 'center';
                    break;
                case 'justifyRight':
                    container.style.textAlign = 'right';
                    break;
                case 'justifyFull':
                    container.style.textAlign = 'justify';
                    break;
                case 'fontName':
                    container.style.fontFamily = value;
                    break;
                case 'fontSize':
                    container.style.fontSize = `${value}px`;
                    break;
                case 'foreColor':
                    container.style.color = value;
                    break;
                case 'hiliteColor':
                    container.style.backgroundColor = value;
                    break;
            }

            container.appendChild(range.extractContents());
            range.insertNode(container);
            selection.removeAllRanges();
            selection.addRange(range);
        },

        createList(type) {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            const list = document.createElement(type === 'ordered' ? 'ol' : 'ul');
            const listItem = document.createElement('li');
            
            listItem.appendChild(range.extractContents());
            list.appendChild(listItem);
            range.insertNode(list);
        },

        createTable(rows = 2, cols = 2) {
            const table = document.createElement('table');
            table.className = 'nova-table';
            
            for (let i = 0; i < rows; i++) {
                const row = table.insertRow();
                for (let j = 0; j < cols; j++) {
                    const cell = row.insertCell();
                    cell.contentEditable = true;
                }
            }
            
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            range.insertNode(table);
        // Add table controls
        const controls = document.getElementById('table-controls');
        controls.style.display = 'block';
        controls.style.top = `${table.offsetTop - 40}px`;
        controls.style.left = `${table.offsetLeft}px`;
        },
    
        insertImage() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                try {
                    const dataUrl = await this.fileToDataUrl(file);
                    const img = document.createElement('img');
                    img.src = dataUrl;
                    img.className = 'nova-image';
                    
                    const selection = window.getSelection();
                    const range = selection.getRangeAt(0);
                    range.insertNode(img);
                } catch (error) {
                    console.error('Error inserting image:', error);
                }
            };
            
            input.click();
        },
    
        async fileToDataUrl(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
    };

    class CommentSystem {
        constructor(editor) {
            this.editor = editor;
            this.comments = new Map();
            this.activeComment = null;
        }
    
        addComment(selection, text) {
            const id = Date.now().toString();
            const range = selection.getRangeAt(0);
            
            const comment = {
                id,
                text,
                timestamp: new Date(),
                resolved: false,
                range: {
                    start: range.startOffset,
                    end: range.endOffset
                }
            };
            
            this.comments.set(id, comment);
            this.highlightCommentedText(range, id);
            
            return comment;
        }
    
        highlightCommentedText(range, commentId) {
            const span = document.createElement('span');
            span.className = 'comment-highlight';
            span.dataset.commentId = commentId;
            
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
        }

        showCommentUI(comment) {
            const sidebar = document.getElementById('comment-sidebar');
            const commentList = document.getElementById('comment-list');
            
            sidebar.style.display = 'block';
            
            const commentEl = document.createElement('div');
            commentEl.className = 'comment-item';
            commentEl.innerHTML = `
                <div class="comment-header">
                    <span>${new Date(comment.timestamp).toLocaleString()}</span>
                    <div class="comment-actions">
                        <button class="resolve-btn"><i class="fas fa-check"></i></button>
                        <button class="delete-btn"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div class="comment-text">${comment.text}</div>
            `;
            
            commentList.appendChild(commentEl);
        }
        
        deleteComment(id) {
            const comment = this.comments.get(id);
            if (comment) {
                const highlight = document.querySelector(`[data-comment-id="${id}"]`);
                if (highlight) {
                    highlight.replaceWith(...highlight.childNodes);
                }
                this.comments.delete(id);
            }
        }
    }

    class ImageResizer {
        constructor(editor) {
            this.editor = editor;
            this.currentImage = null;
            this.init();
        }
        
        init() {
            this.editor.addEventListener('click', (e) => {
                if (e.target.matches('img')) {
                    this.showResizeHandles(e.target);
                }
            });
        }
        
        showResizeHandles(img) {
            const controls = document.getElementById('image-controls');
            controls.style.display = 'block';
            controls.style.left = `${img.offsetLeft}px`;
            controls.style.top = `${img.offsetTop}px`;
            controls.style.width = `${img.offsetWidth}px`;
            controls.style.height = `${img.offsetHeight}px`;
            this.currentImage = img;
        }
        
        init() {
            // Add resize handle events
            const handles = document.querySelectorAll('.resize-handle');
            handles.forEach(handle => {
                handle.addEventListener('mousedown', this.startResize.bind(this));
            });
            
            document.addEventListener('mouseup', this.stopResize.bind(this));
            document.addEventListener('mousemove', this.resize.bind(this));
        }
        
        startResize(e) {
            if (!this.currentImage) return;
            this.isResizing = true;
            this.startX = e.clientX;
            this.startY = e.clientY;
            this.startWidth = this.currentImage.offsetWidth;
            this.startHeight = this.currentImage.offsetHeight;
        }
        
        stopResize() {
            this.isResizing = false;
        }
        
        resize(e) {
            if (!this.isResizing) return;
            
            const deltaX = e.clientX - this.startX;
            const deltaY = e.clientY - this.startY;
            
            this.currentImage.style.width = `${this.startWidth + deltaX}px`;
            this.currentImage.style.height = `${this.startHeight + deltaY}px`;
            
            // Update resize handles
            this.showResizeHandles(this.currentImage);
        }
    }

    // Update formatting button event listeners
    formattingButtons.forEach(button => {
        button.addEventListener('click', () => {
            const command = button.dataset.command;
            if (command.includes('List')) {
                TextFormatter.createList(command === 'insertOrderedList' ? 'ordered' : 'unordered');
            } else {
                TextFormatter.formatSelection(command);
            }
            editor.focus();
        });
    });

    // Update font family selection
    fontSelect.addEventListener('change', (e) => {
        TextFormatter.formatSelection('fontName', e.target.value);
        editor.focus();
    });

    // Update font size selection
    fontSizeSelect.addEventListener('change', (e) => {
        TextFormatter.formatSelection('fontSize', e.target.value);
        editor.focus();
    });

    // Update text color picker
    textColorPicker.addEventListener('change', (e) => {
        TextFormatter.formatSelection('foreColor', e.target.value);
        editor.focus();
    });

    // Update highlight color picker
    highlightColorPicker.addEventListener('change', (e) => {
        TextFormatter.formatSelection('hiliteColor', e.target.value);
        editor.focus();
    });

    // Keyboard shortcuts with improved error handling
    editor.addEventListener('keydown', (e) => {
        // Prevent default for known shortcuts
        const shortcuts = {
            'b': () => TextFormatter.formatSelection('bold'),
            'i': () => TextFormatter.formatSelection('italic'),
            'u': () => TextFormatter.formatSelection('underline'),
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
});