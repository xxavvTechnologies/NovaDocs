import { 
    auth, 
    db, 
    googleProvider,
    collection,
    getDocs,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    query,
    where,
    limit
} from './firebase-config.js';  // Fixed the import path

class DocumentEditor {
    constructor() {
        this.pendingSave = null;
        this.lastSaveTime = Date.now();
        this.MIN_SAVE_INTERVAL = 3000; // Reduced from 10000 to 3000ms
        this.batchTimeout = null;
        this.pendingChanges = [];
        this.lastRevisionTime = Date.now();
        this.exporter = new DocumentExporter();
        this.editor = null;
        this.isMarkdownMode = false; // Add this line
        this.currentZoom = parseFloat(localStorage.getItem('editorZoom')) || 1;
        this.isMobile = window.innerWidth <= 768;
        
        // Stability improvements - initialize cleanup arrays
        this.timeouts = new Set();
        this.intervals = new Set();
        this.eventListeners = new Map();
        this.retryAttempts = 0;
        this.maxRetries = 3;
        this.isDestroyed = false;
        
        this.init();
        this.setupMobileOptimizations();
        
        // Add cleanup handler for page unload
        this.setupCleanupHandlers();
    }    async init() {
        try {
            // Prevent double initialization
            if (this.isDestroyed) return;
            
            // Wait for DOM to be ready with timeout
            if (document.readyState === 'loading') {
                await Promise.race([
                    new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve)),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('DOM load timeout')), 10000))
                ]);
            }
            
            // Get editor element and verify it exists
            this.editor = document.getElementById('editor');
            if (!this.editor) {
                throw new Error('Editor element not found');
            }
            
            await this.setupEditor();
            await this.loadDocumentFromUrl();
            
            // Mark as successfully initialized
            this.isInitialized = true;
            
        } catch (error) {
            console.error('Editor initialization failed:', error);
            this.handleInitializationError(error);
        }
    }

    handleInitializationError(error) {
        // Show user-friendly error message
        if (window.notifications) {
            notifications.error('Initialization Failed', 'Could not initialize editor. Please refresh the page.');
        }
        
        // Try to provide a fallback editor
        const editor = document.getElementById('editor');
        if (editor) {
            editor.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #666;">
                    <h3>Editor failed to initialize</h3>
                    <p>Please refresh the page to try again.</p>
                    <button onclick="window.location.reload()" style="padding: 8px 16px; margin-top: 10px;">
                        Refresh Page
                    </button>
                </div>
            `;
        }
    }

    setupCleanupHandlers() {
        // Setup cleanup on page unload
        const cleanup = () => this.cleanup();
        
        window.addEventListener('beforeunload', cleanup);
        window.addEventListener('unload', cleanup);
        
        // Store cleanup handlers to remove later
        this.eventListeners.set('beforeunload', cleanup);
        this.eventListeners.set('unload', cleanup);
    }    cleanup() {
        if (this.isDestroyed) return;
        
        console.log('Cleaning up DocumentEditor...');
        this.isDestroyed = true;
        
        try {
            // Clear all timeouts
            this.timeouts.forEach(timeout => {
                try {
                    clearTimeout(timeout);
                } catch (error) {
                    console.error('Error clearing timeout:', error);
                }
            });
            this.timeouts.clear();
            
            // Clear all intervals
            this.intervals.forEach(interval => {
                try {
                    clearInterval(interval);
                } catch (error) {
                    console.error('Error clearing interval:', error);
                }
            });
            this.intervals.clear();
            
            // Remove all tracked event listeners
            this.eventListeners.forEach((listener, key) => {
                try {
                    if (listener.element && listener.handler) {
                        listener.element.removeEventListener(listener.event, listener.handler);
                    }
                } catch (error) {
                    console.error(`Error removing event listener ${key}:`, error);
                }
            });
            this.eventListeners.clear();
            
            // Clear any pending batch timeout
            if (this.batchTimeout) {
                try {
                    clearTimeout(this.batchTimeout);
                } catch (error) {
                    console.error('Error clearing batch timeout:', error);
                }
                this.batchTimeout = null;
            }
            
            // Clear page break debounce
            if (this.pageBreakDebounce) {
                try {
                    clearTimeout(this.pageBreakDebounce);
                } catch (error) {
                    console.error('Error clearing page break debounce:', error);
                }
                this.pageBreakDebounce = null;
            }
            
            // Final save attempt
            if (this.currentDocId && this.pendingChanges.length > 0) {
                try {
                    this.processBatch().catch(error => {
                        console.error('Error in final save attempt:', error);
                    });
                } catch (error) {
                    console.error('Error initiating final save:', error);
                }
            }
            
            // Clear references
            this.editor = null;
            this.selectionState = null;
            this.pendingChanges = [];
            
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }

    // Utility method to manage timeouts
    setTimeout(callback, delay) {
        const timeout = setTimeout(() => {
            this.timeouts.delete(timeout);
            if (!this.isDestroyed) {
                callback();
            }
        }, delay);
        this.timeouts.add(timeout);
        return timeout;
    }

    // Utility method to manage intervals
    setInterval(callback, delay) {
        const interval = setInterval(() => {
            if (!this.isDestroyed) {
                callback();
            } else {
                clearInterval(interval);
                this.intervals.delete(interval);
            }
        }, delay);
        this.intervals.add(interval);
        return interval;
    }

    setupEditor() {
        return new Promise((resolve) => {
            // Initialize core properties
            this.currentUser = null;
            this.currentDocId = null;
            this.saveTimeout = null;
            this.activeButtons = new Set();

            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    this.initializeComponents();
                    resolve();
                });
            } else {
                this.initializeComponents();
                resolve();
            }
        });
    }

    initializeComponents() {
        this.initializeEditor();
        this.attachEventListeners();
        this.setupAuthStateListener();
        this.setupToolbar();
        this.lastSaveTime = null;
        this.originalContent = null;
        this.sessionStartTime = new Date();
        this.initializeShareDialog();
        this.initializeTitleInput();
        this.pageHeight = 1056; // 11 inches at 96dpi
        this.setupPageManagement();
        this.pageBreakDebounce = null;
        this.setupFontHandling();
        this.lastSelection = null;
        this.lastRange = null;
        this.lastScroll = 0;
        this.selectionState = null;
        this.selectedRevision = null;
        this.initializeHistoryDialog();
        this.setupZoomControls();
    }    async loadDocumentFromUrl() {
        try {
            // Prevent loading if destroyed
            if (this.isDestroyed) return;
            
            // Get document ID from URL
            const urlParams = new URLSearchParams(window.location.search);
            const docId = urlParams.get('id');
            const action = urlParams.get('action');

            // Show loading state with null check
            if (this.editor) {
                this.editor.innerHTML = `
                    <div class="loading-state" style="display: flex; justify-content: center; align-items: center; height: 200px;">
                        <i class="fas fa-spinner fa-spin" style="margin-right: 10px;"></i>
                        Loading document...
                    </div>
                `;
            }

            if (action === 'new') {
                await this.createNewDocument();
                this.updateDocumentTitle('Untitled Document');
            } else if (docId) {
                await this.loadExistingDocument(docId);
            } else {
                // No document specified, create new one
                await this.createNewDocument();
                this.updateDocumentTitle('Untitled Document');
            }
        } catch (error) {
            console.error('Error loading document:', error);
            this.handleDocumentLoadError(error);
        }
    }

    async loadExistingDocument(docId) {
        const docRef = doc(db, 'documents', docId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            throw new Error('Document not found');
        }

        const data = docSnap.data();
        
        // Check if user has access to this document
        if (!this.currentUser || 
            (data.userId !== this.currentUser.uid && 
             !data.isPublic && 
             (!data.sharedWith || !data.sharedWith.includes(this.currentUser.uid)))) {
            throw new Error('Access denied to this document');
        }
        
        this.currentDocId = docId;
        
        // Handle markdown mode safely
        if (data.isMarkdown) {
            this.isMarkdownMode = true;
            const markdownToggle = document.getElementById('markdownToggle');
            if (markdownToggle) {
                markdownToggle.classList.add('active');
            }
            if (this.editor) {
                this.editor.classList.add('markdown-mode');
                this.editor.innerHTML = `<pre><code>${data.content || ''}</code></pre>`;
            }
        } else {
            // Set content and title with fallback
            const content = data.content || '<div class="page" data-page="1"><p>Start typing here...</p></div>';
            if (this.editor) {
                this.editor.innerHTML = content;
            }
        }
        this.updateDocumentTitle(data.title || 'Untitled Document');
    }

    handleDocumentLoadError(error) {
        console.error('Document load error:', error);
        this.updateDocumentTitle('Error Loading Document');
        
        if (this.editor) {
            this.editor.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #666;">
                    <h3>Failed to load document</h3>
                    <p>${error.message}</p>
                    <button onclick="window.location.reload()" style="padding: 8px 16px; margin-top: 10px;">
                        Try Again
                    </button>
                </div>
            `;
        }
        
        if (window.notifications) {
            notifications.error('Load Failed', error.message);
        }
    }

    // Add this new method
    updateDocumentTitle(title) {
        // Update the input field
        const titleInput = document.getElementById('docTitle');
        if (titleInput) {
            titleInput.value = title;
        }

        // Update the browser tab title
        document.title = `${title} - Nova Docs`;
    }

    saveSelection() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            this.lastSelection = selection.getRangeAt(0).cloneRange();
        }
    }

    restoreSelection() {
        if (this.lastSelection) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(this.lastSelection);
        }
    }    saveEditorState() {
        try {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                // Save both range and scroll position
                this.selectionState = {
                    range: selection.getRangeAt(0).cloneRange(),
                    scroll: {
                        x: window.scrollX || 0,
                        y: window.scrollY || 0
                    }
                };
            }
        } catch (error) {
            console.error('Failed to save editor state:', error);
            // Reset selection state on error
            this.selectionState = null;
        }
    }

    restoreEditorState() {
        if (!this.selectionState) return;

        try {
            // Restore scroll position first
            if (this.selectionState.scroll) {
                window.scrollTo(this.selectionState.scroll.x, this.selectionState.scroll.y);
            }

            // Then restore selection with validation
            if (this.selectionState.range) {
                const selection = window.getSelection();
                if (selection) {
                    selection.removeAllRanges();
                    
                    // Validate range is still valid
                    const range = this.selectionState.range;
                    if (range.startContainer && range.endContainer &&
                        this.editor && this.editor.contains(range.startContainer) &&
                        this.editor.contains(range.endContainer)) {
                        selection.addRange(range);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to restore editor state:', error);
            // Clear invalid state
            this.selectionState = null;
        }
    }    initializeEditor() {
        // Check if editor exists before initializing
        if (!this.editor) {
            throw new Error('Editor element not found during initialization');
        }

        try {
            // Add input event listeners with Markdown handling and error boundaries
            const inputHandler = (e) => {
                try {
                    this.handleEditorChange();
                    this.updateWordCount();
                    this.handleMarkdownConversion(e);
                } catch (error) {
                    console.error('Error in input handler:', error);
                }
            };

            this.editor.addEventListener('input', inputHandler);
            this.eventListeners.set('editor-input', { element: this.editor, event: 'input', handler: inputHandler });

            // Initialize toolbar buttons if they exist
            this.initializeToolbarButtons();

            // Initialize font controls
            this.initializeFontControls();

            // Add Markdown mode toggle if it exists
            this.initializeMarkdownToggle();

            // Add selection tracking for formatting
            this.initializeSelectionTracking();

        } catch (error) {
            console.error('Error initializing editor components:', error);
            throw error;
        }
    }

    initializeToolbarButtons() {
        try {
            const toolbarButtons = document.querySelectorAll('.toolbar button');
            if (toolbarButtons.length > 0) {
                toolbarButtons.forEach(button => {
                    const clickHandler = (e) => {
                        try {
                            this.handleToolbarAction(e);
                        } catch (error) {
                            console.error('Error in toolbar action:', error);
                        }
                    };
                    button.addEventListener('click', clickHandler);
                });
            }
        } catch (error) {
            console.error('Error initializing toolbar buttons:', error);
        }
    }

    initializeFontControls() {
        try {
            // Initialize font select if it exists
            const fontSelect = document.getElementById('fontSelect');
            if (fontSelect) {
                const fontHandler = (e) => {
                    try {
                        this.execCommand('fontName', e.target.value);
                    } catch (error) {
                        console.error('Error applying font:', error);
                    }
                };
                fontSelect.addEventListener('change', fontHandler);
                this.eventListeners.set('font-select', { element: fontSelect, event: 'change', handler: fontHandler });
            }

            // Initialize font size if it exists
            const fontSize = document.getElementById('fontSize');
            if (fontSize) {
                const sizeHandler = (e) => {
                    try {
                        this.execCommand('fontSize', e.target.value);
                    } catch (error) {
                        console.error('Error applying font size:', error);
                    }
                };
                fontSize.addEventListener('change', sizeHandler);
                this.eventListeners.set('font-size', { element: fontSize, event: 'change', handler: sizeHandler });
            }
        } catch (error) {
            console.error('Error initializing font controls:', error);
        }
    }

    initializeMarkdownToggle() {
        try {
            const markdownToggle = document.getElementById('markdownToggle');
            if (markdownToggle) {
                const toggleHandler = () => {
                    try {
                        this.toggleMarkdownMode();
                    } catch (error) {
                        console.error('Error toggling markdown mode:', error);
                    }
                };
                markdownToggle.addEventListener('click', toggleHandler);
                this.eventListeners.set('markdown-toggle', { element: markdownToggle, event: 'click', handler: toggleHandler });
                this.isMarkdownMode = false;
            }
        } catch (error) {
            console.error('Error initializing markdown toggle:', error);
        }
    }

    initializeSelectionTracking() {
        try {
            const keyupHandler = () => {
                try {
                    this.updateActiveFormats();
                } catch (error) {
                    console.error('Error updating formats on keyup:', error);
                }
            };

            const mouseupHandler = () => {
                try {
                    this.updateActiveFormats();
                } catch (error) {
                    console.error('Error updating formats on mouseup:', error);
                }
            };

            this.editor.addEventListener('keyup', keyupHandler);
            this.editor.addEventListener('mouseup', mouseupHandler);

            this.eventListeners.set('editor-keyup', { element: this.editor, event: 'keyup', handler: keyupHandler });
            this.eventListeners.set('editor-mouseup', { element: this.editor, event: 'mouseup', handler: mouseupHandler });
        } catch (error) {
            console.error('Error initializing selection tracking:', error);
        }
    }

    handleMarkdownConversion(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const currentNode = range.startContainer;
        
        if (currentNode.nodeType !== 3) return; // Only process text nodes
        
        const text = currentNode.textContent;
        const patterns = [
            { regex: /\*\*(.+?)\*\*$/, format: 'bold' },
            { regex: /\_\_(.+?)\_\_$/, format: 'bold' },
            { regex: /\*(.+?)\*$/, format: 'italic' },
            { regex: /\_(.+?)\_$/, format: 'italic' },
            { regex: /\~\~(.+?)\~\~$/, format: 'strike' },
            { regex: /\`(.+?)\`$/, format: 'code' },
            { regex: /^\# (.+)$/, format: 'h1' },
            { regex: /^\#\# (.+)$/, format: 'h2' },
            { regex: /^\#\#\# (.+)$/, format: 'h3' }
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern.regex);
            if (match) {
                e.preventDefault();
                const content = match[1];
                const parentBlock = currentNode.parentElement;

                // Create a new text node with the content
                const newText = document.createTextNode(content);

                // Apply the formatting
                if (['h1', 'h2', 'h3'].includes(pattern.format)) {
                    const header = document.createElement(pattern.format);
                    header.appendChild(newText);
                    parentBlock.parentElement.replaceChild(header, parentBlock);
                } else if (pattern.format === 'code') {
                    const code = document.createElement('code');
                    code.appendChild(newText);
                    code.style.fontFamily = 'Roboto Mono, monospace';
                    code.style.backgroundColor = '#f1f5f9';
                    code.style.padding = '0.2em 0.4em';
                    code.style.borderRadius = '3px';
                    parentBlock.replaceChild(code, currentNode);
                } else {
                    // For basic text formatting (bold, italic, strike)
                    const formattedSpan = document.createElement('span');
                    formattedSpan.appendChild(newText);
                    switch (pattern.format) {
                        case 'bold':
                            formattedSpan.style.fontWeight = 'bold';
                            break;
                        case 'italic':
                            formattedSpan.style.fontStyle = 'italic';
                            break;
                        case 'strike':
                            formattedSpan.style.textDecoration = 'line-through';
                            break;
                    }
                    parentBlock.replaceChild(formattedSpan, currentNode);
                }

                // Show a subtle notification
                notifications.minimal('success', 
                    `Markdown ${pattern.format} formatting applied`, 
                    'Converted Markdown to rich text');

                // Set cursor position after the formatted text
                const newRange = document.createRange();
                newRange.setStartAfter(newText);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                break;
            }
        }
    }

    toggleMarkdownMode() {
        this.isMarkdownMode = !this.isMarkdownMode;
        const markdownToggle = document.getElementById('markdownToggle');
        const editor = document.getElementById('editor');

        editor.classList.toggle('markdown-mode', this.isMarkdownMode);
        markdownToggle.classList.toggle('active', this.isMarkdownMode);

        if (this.isMarkdownMode) {
            // Convert content to Markdown
            const html = this.editor.innerHTML;
            const turndownService = new TurndownService({
                headingStyle: 'atx',
                codeBlockStyle: 'fenced'
            });
            const markdown = turndownService.turndown(html);
            this.editor.innerHTML = `<pre><code>${markdown}</code></pre>`;
        } else {
            // Convert back to HTML
            const markdown = this.editor.querySelector('code').textContent;
            const converter = new showdown.Converter({
                simpleLineBreaks: true,
                tables: true
            });
            this.editor.innerHTML = converter.makeHtml(markdown);
        }

        this.handleEditorChange();
    }

    setupToolbar() {
        // Format buttons
        const formatButtons = ['bold', 'italic', 'underline', 'strike'];
        formatButtons.forEach(format => {
            const button = document.getElementById(`${format}Btn`);
            button.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.applyFormat(format);
            });
        });

        // Color pickers
        const textColorBtn = document.getElementById('textColorBtn');
        const highlightBtn = document.getElementById('highlightBtn');

        textColorBtn.addEventListener('input', (e) => this.applyFormat('textColor', e.target.value));
        textColorBtn.addEventListener('change', (e) => this.applyFormat('textColor', e.target.value));
        highlightBtn.addEventListener('input', (e) => this.applyFormat('highlight', e.target.value));
        highlightBtn.addEventListener('change', (e) => this.applyFormat('highlight', e.target.value));

        // Clear formatting
        document.getElementById('clearFormatBtn').addEventListener('click', () => this.clearFormatting());

        // Alignment buttons
        const alignButtons = ['alignLeft', 'alignCenter', 'alignRight', 'alignJustify'];
        alignButtons.forEach(align => {
            const button = document.getElementById(`${align}Btn`);
            button.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevent losing selection
                this.setAlignment(align);
                alignButtons.forEach(a => document.getElementById(`${a}Btn`).classList.remove('active'));
                button.classList.add('active');
            });
        });
    }

    applyFormat(format, value = null) {
        this.saveSelection();
        const selection = window.getSelection();
        
        if (!selection.rangeCount) {
            this.restoreSelection();
            return;
        }

        try {
            document.execCommand('styleWithCSS', false, true);
            
            switch (format) {
                case 'textColor':
                    document.execCommand('foreColor', false, value);
                    break;
                case 'highlight':
                    document.execCommand('hiliteColor', false, value);
                    break;
                case 'bold':
                    document.execCommand('bold', false, null);
                    break;
                case 'italic':
                    document.execCommand('italic', false, null);
                    break;
                case 'underline':
                    document.execCommand('underline', false, null);
                    break;
                case 'strike':
                    document.execCommand('strikethrough', false, null);
                    break;
            }

            this.cleanupFormatting(selection.getRangeAt(0).commonAncestorContainer);
            this.updateActiveFormats();

        } catch (e) {
            console.error('Format application error:', e);
        }

        this.editor.focus();
        this.restoreSelection();
    }

    clearFormatting() {
        this.saveSelection();
        document.execCommand('removeFormat', false, null);
        
        // Also remove any span elements that might have formatting
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer;
            const element = container.nodeType === 3 ? container.parentElement : container;
            
            if (element) {
                const spans = element.getElementsByTagName('span');
                Array.from(spans).forEach(span => {
                    const text = document.createTextNode(span.textContent);
                    span.parentNode.replaceChild(text, span);
                });
            }
        }

        this.editor.focus();
        this.restoreSelection();
        this.updateActiveFormats();
    }

    cleanupFormatting(element) {
        if (!element) return;

        const root = element.nodeType === 1 ? element : element.parentElement;
        if (!root) return;

        // Merge adjacent spans with identical styles
        const spans = root.getElementsByTagName('span');
        Array.from(spans).forEach(span => {
            if (span.nextSibling && span.nextSibling.nodeType === 1 && span.nextSibling.tagName === 'SPAN') {
                const next = span.nextSibling;
                if (span.style.cssText === next.style.cssText) {
                    span.textContent += next.textContent;
                    next.remove();
                }
            }
        });

        // Remove empty spans
        Array.from(spans).forEach(span => {
            if (!span.textContent.trim()) {
                span.remove();
            }
        });
    }

    updateActiveFormats() {
        const formatStates = {
            'bold': document.queryCommandState('bold'),
            'italic': document.queryCommandState('italic'),
            'underline': document.queryCommandState('underline'),
            'strike': document.queryCommandState('strikethrough')
        };

        Object.entries(formatStates).forEach(([format, state]) => {
            const button = document.getElementById(`${format}Btn`);
            if (button) {
                button.classList.toggle('active', state);
            }
        });

        // Update color buttons
        const textColor = document.queryCommandValue('foreColor');
        const highlightColor = document.queryCommandValue('hiliteColor');
        
        const textColorBtn = document.getElementById('textColorBtn');
        const highlightBtn = document.getElementById('highlightBtn');

        if (textColor && textColorBtn) textColorBtn.value = this.rgbToHex(textColor);
        if (highlightColor && highlightBtn) highlightBtn.value = this.rgbToHex(highlightColor);
    }

    rgbToHex(rgb) {
        // Convert rgb(r,g,b) to #rrggbb
        const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (!match) return rgb;
        
        const r = parseInt(match[1]).toString(16).padStart(2, '0');
        const g = parseInt(match[2]).toString(16).padStart(2, '0');
        const b = parseInt(match[3]).toString(16).padStart(2, '0');
        
        return `#${r}${g}${b}`;
    }    attachEventListeners() {
        try {
            // User menu dropdown with error handling
            this.setupUserMenu();

            // Format tracking with error boundaries
            this.setupFormatTracking();

            // Export functionality with error handling
            this.setupExportHandlers();

        } catch (error) {
            console.error('Error attaching event listeners:', error);
        }
    }

    setupUserMenu() {
        try {
            const userMenuBtn = document.getElementById('userMenuBtn');
            const userDropdown = document.getElementById('userDropdown');

            if (userMenuBtn && userDropdown) {
                const menuClickHandler = (e) => {
                    try {
                        e.stopPropagation();
                        userDropdown.classList.toggle('show');
                    } catch (error) {
                        console.error('Error handling user menu click:', error);
                    }
                };

                const outsideClickHandler = (e) => {
                    try {
                        if (!userDropdown.contains(e.target) && !userMenuBtn.contains(e.target)) {
                            userDropdown.classList.remove('show');
                        }
                    } catch (error) {
                        console.error('Error handling outside click:', error);
                    }
                };

                userMenuBtn.addEventListener('click', menuClickHandler);
                document.addEventListener('click', outsideClickHandler);

                this.eventListeners.set('user-menu-click', { element: userMenuBtn, event: 'click', handler: menuClickHandler });
                this.eventListeners.set('user-menu-outside', { element: document, event: 'click', handler: outsideClickHandler });
            }
        } catch (error) {
            console.error('Error setting up user menu:', error);
        }
    }

    setupFormatTracking() {
        try {
            if (this.editor) {
                // These handlers are already set up in initializeSelectionTracking
                // This method is kept for backward compatibility
            }
        } catch (error) {
            console.error('Error setting up format tracking:', error);
        }
    }

    setupExportHandlers() {
        try {
            const exportBtn = document.getElementById('exportBtn');
            const exportDropdown = document.getElementById('exportDropdown');
            
            if (exportBtn && exportDropdown) {
                const exportClickHandler = (e) => {
                    try {
                        e.stopPropagation();
                        exportDropdown.classList.toggle('show');
                    } catch (error) {
                        console.error('Error handling export button click:', error);
                    }
                };

                const exportItemHandler = async (e) => {
                    try {
                        e.preventDefault();
                        if (e.target.tagName === 'A') {
                            const format = e.target.dataset.format;
                            const titleElement = document.getElementById('docTitle');
                            const title = titleElement ? titleElement.value || 'Untitled Document' : 'Untitled Document';
                            const content = this.editor ? this.editor.innerHTML : '';
                            
                            await this.handleExport(format, title, content);
                        }
                    } catch (error) {
                        console.error('Export error:', error);
                        if (window.notifications) {
                            notifications.error('Export Failed', `Could not export document: ${error.message}`);
                        }
                    }
                };

                const exportOutsideClickHandler = (e) => {
                    try {
                        if (!exportDropdown.contains(e.target) && !exportBtn.contains(e.target)) {
                            exportDropdown.classList.remove('show');
                        }
                    } catch (error) {
                        console.error('Error handling export outside click:', error);
                    }
                };

                exportBtn.addEventListener('click', exportClickHandler);
                exportDropdown.addEventListener('click', exportItemHandler);
                document.addEventListener('click', exportOutsideClickHandler);

                this.eventListeners.set('export-btn', { element: exportBtn, event: 'click', handler: exportClickHandler });
                this.eventListeners.set('export-dropdown', { element: exportDropdown, event: 'click', handler: exportItemHandler });
                this.eventListeners.set('export-outside', { element: document, event: 'click', handler: exportOutsideClickHandler });
            }
        } catch (error) {
            console.error('Error setting up export handlers:', error);
        }
    }

    async handleExport(format, title, content) {
        if (!this.exporter) {
            throw new Error('Exporter not available');
        }

        switch (format) {
            case 'pdf':
                await this.exporter.exportToPDF(content, title);
                break;
            case 'word':
                this.exporter.exportToWord(content);
                break;
            case 'markdown':
                this.exporter.exportToMarkdown(content);
                break;
            case 'rtf':
                this.exporter.exportToRTF(content);
                break;
            case 'html':
                this.exporter.exportToHTML(content);
                break;
            case 'txt':
                this.exporter.exportToPlainText(content);
                break;
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
        
        if (window.notifications) {
            notifications.success('Export Complete', `Document exported as ${format.toUpperCase()}`);
        }
    }

    setupAuthStateListener() {
        auth.onAuthStateChanged(user => {
            if (user) {
                this.currentUser = user;
                localStorage.setItem('user', JSON.stringify(user));
                this.updateUserInterface();
            } else {
                localStorage.removeItem('user');
                window.location.href = 'index.html';
            }
        });
    }    storeCursorPosition() {
        try {
            const selection = window.getSelection();
            if (!selection || !selection.rangeCount) return null;

            const range = selection.getRangeAt(0);
            const preSelectionRange = range.cloneRange();
            preSelectionRange.selectNodeContents(this.editor);
            preSelectionRange.setEnd(range.startContainer, range.startOffset);
            
            const start = preSelectionRange.toString().length;
            const selectedText = range.toString();

            return {
                start,
                end: start + selectedText.length,
                scrollTop: this.editor ? this.editor.scrollTop : 0,
                scrollLeft: this.editor ? this.editor.scrollLeft : 0,
                selectedText, // Store selected text for validation
                containerPath: this.getNodePath(range.startContainer) // Store path to container
            };
        } catch (error) {
            console.error('Error storing cursor position:', error);
            return null;
        }
    }

    getNodePath(node) {
        const path = [];
        let current = node;
        
        try {
            while (current && current !== this.editor) {
                if (current.parentNode) {
                    const siblings = Array.from(current.parentNode.childNodes);
                    const index = siblings.indexOf(current);
                    path.unshift({ tagName: current.nodeName, index });
                    current = current.parentNode;
                } else {
                    break;
                }
            }
        } catch (error) {
            console.error('Error getting node path:', error);
        }
        
        return path;
    }

    restoreCursorPosition(savedSelection) {
        if (!savedSelection || this.isDestroyed || !this.editor) return;

        try {
            // Restore scroll position first
            if (this.editor && typeof savedSelection.scrollTop === 'number') {
                this.editor.scrollTop = savedSelection.scrollTop;
                this.editor.scrollLeft = savedSelection.scrollLeft || 0;
            }

            // Attempt to restore selection using multiple strategies
            if (this.restoreByNodePath(savedSelection) || 
                this.restoreByCharacterIndex(savedSelection)) {
                return; // Successfully restored
            }

            // Fallback: place cursor at end of editor
            this.placeCursorAtEnd();

        } catch (error) {
            console.error('Error restoring cursor position:', error);
            // Fallback on any error
            this.placeCursorAtEnd();
        }
    }

    restoreByNodePath(savedSelection) {
        try {
            if (!savedSelection.containerPath || !savedSelection.containerPath.length) {
                return false;
            }

            let current = this.editor;
            for (const pathStep of savedSelection.containerPath) {
                if (!current.childNodes || current.childNodes.length <= pathStep.index) {
                    return false;
                }
                current = current.childNodes[pathStep.index];
                if (!current) return false;
            }

            // Create selection at the found node
            const selection = window.getSelection();
            const range = document.createRange();
            
            if (current.nodeType === Node.TEXT_NODE) {
                const offset = Math.min(savedSelection.start, current.textContent.length);
                range.setStart(current, offset);
                range.setEnd(current, Math.min(savedSelection.end, current.textContent.length));
            } else {
                range.setStartBefore(current);
                range.setEndBefore(current);
            }

            selection.removeAllRanges();
            selection.addRange(range);
            return true;
        } catch (error) {
            console.error('Error restoring by node path:', error);
            return false;
        }
    }

    restoreByCharacterIndex(savedSelection) {
        try {
            const charIndex = (containerEl, index) => {
                let currentIndex = 0;
                const walk = document.createTreeWalker(
                    containerEl,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );

                let node;
                while ((node = walk.nextNode())) {
                    const length = node.textContent.length;
                    if (currentIndex + length >= index) {
                        return [node, index - currentIndex];
                    }
                    currentIndex += length;
                }
                return [null, 0];
            };

            const selection = window.getSelection();
            const [startNode, startOffset] = charIndex(this.editor, savedSelection.start);
            
            if (startNode) {
                const range = document.createRange();
                range.setStart(startNode, Math.min(startOffset, startNode.textContent.length));
                
                if (savedSelection.start !== savedSelection.end) {
                    const [endNode, endOffset] = charIndex(this.editor, savedSelection.end);
                    if (endNode) {
                        range.setEnd(endNode, Math.min(endOffset, endNode.textContent.length));
                    }
                } else {
                    range.collapse(true);
                }

                selection.removeAllRanges();
                selection.addRange(range);
                
                // Scroll into view if needed
                if (startNode.parentElement) {
                    startNode.parentElement.scrollIntoView({ block: 'nearest', behavior: 'auto' });
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error restoring by character index:', error);
            return false;
        }
    }

    placeCursorAtEnd() {
        try {
            if (!this.editor) return;
            
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(this.editor);
            range.collapse(false); // Collapse to end
            selection.removeAllRanges();
            selection.addRange(range);
        } catch (error) {
            console.error('Error placing cursor at end:', error);
        }
    }async handleEditorChange() {
        try {
            // Prevent processing if destroyed
            if (this.isDestroyed) return;
            
            const saveStatus = document.getElementById('saveStatus');
            if (saveStatus) {
                saveStatus.innerHTML = '<i class="fas fa-sync fa-spin"></i> Saving...';
            }
            
            // Store cursor position before save with error handling
            const cursorPosition = this.storeCursorPosition();
            
            // Add change to pending batch
            this.pendingChanges.push({
                content: this.editor ? this.editor.innerHTML : '',
                cursorPosition,
                timestamp: Date.now()
            });

            // Clear existing batch timeout
            if (this.batchTimeout) {
                clearTimeout(this.batchTimeout);
                this.timeouts.delete(this.batchTimeout);
            }

            // Set new batch timeout using our managed timeout method
            this.batchTimeout = this.setTimeout(() => this.processBatch(), this.MIN_SAVE_INTERVAL);

            // Remove preview mode if it exists
            if (this.editor) {
                this.editor.classList.remove('preview-mode');
            }
        } catch (error) {
            console.error('Error handling editor change:', error);
            const saveStatus = document.getElementById('saveStatus');
            if (saveStatus) {
                saveStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
            }
        }
    }

    async processBatch() {
        if (!this.pendingChanges.length || this.isDestroyed) return;

        try {
            // Reset retry count on successful batch
            this.retryAttempts = 0;
            
            // Get latest change from batch
            const latestChange = this.pendingChanges[this.pendingChanges.length - 1];
            
            // Clear pending changes
            this.pendingChanges = [];

            await this.saveDocument(latestChange);

        } catch (error) {
            console.error('Batch save failed:', error);
            
            // Implement exponential backoff retry
            this.retryAttempts++;
            if (this.retryAttempts <= this.maxRetries) {
                const backoffDelay = this.MIN_SAVE_INTERVAL * Math.pow(2, this.retryAttempts - 1);
                console.log(`Retrying save in ${backoffDelay}ms (attempt ${this.retryAttempts}/${this.maxRetries})`);
                
                this.setTimeout(() => this.processBatch(), backoffDelay);
            } else {
                // Max retries exceeded
                console.error('Max retry attempts exceeded');
                const saveStatus = document.getElementById('saveStatus');
                if (saveStatus) {
                    saveStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Save failed - please refresh';
                }
                if (window.notifications) {
                    notifications.error('Save Failed', 'Please refresh the page and try again');
                }
            }
        }
    }    async saveDocument({content, cursorPosition, timestamp}) {
        if (!this.currentUser || !this.currentDocId || this.isDestroyed) return;

        try {
            const now = new Date();
            const docRef = doc(db, 'documents', this.currentDocId);

            // Validate content before saving
            const validatedContent = this.validateContent(content);

            // Only save content and essential metadata
            const docData = {
                content: this.isMarkdownMode ? 
                    this.getMarkdownContent(validatedContent) :
                    validatedContent,
                lastModified: now.toISOString(),
            };

            // Save document with merge to prevent data loss
            await setDoc(docRef, docData, { merge: true });

            // Update save status safely
            const saveStatus = document.getElementById('saveStatus');
            if (saveStatus) {
                saveStatus.innerHTML = '<i class="fas fa-check"></i> Saved';
            }
            this.lastSaveTime = now;

            // Manage revisions less frequently (every 5 minutes)
            if (now - this.lastRevisionTime > 5 * 60 * 1000) {
                await this.manageRevisions(validatedContent, now);
                this.lastRevisionTime = now;
            }

            // Restore cursor position safely
            this.restoreCursorPosition(cursorPosition);
            if (this.editor && !this.isDestroyed) {
                this.editor.focus();
            }

        } catch (error) {
            console.error('Save document error:', error);
            this.handleSaveError(error);
        }
    }

    validateContent(content) {
        // Basic content validation
        if (typeof content !== 'string') {
            console.warn('Invalid content type, using empty string');
            return '<div class="page" data-page="1"><p>Start typing here...</p></div>';
        }
        
        // Ensure content has at least one page
        if (!content.includes('class="page"')) {
            return `<div class="page" data-page="1">${content}</div>`;
        }
        
        return content;
    }

    getMarkdownContent(content) {
        try {
            const codeElement = this.editor && this.editor.querySelector('code');
            return codeElement ? codeElement.textContent : content;
        } catch (error) {
            console.error('Error getting markdown content:', error);
            return content;
        }
    }

    handleSaveError(error) {
        const saveStatus = document.getElementById('saveStatus');
        
        if (error.code === 'resource-exhausted') {
            if (saveStatus) {
                saveStatus.innerHTML = '<i class="fas fa-clock"></i> Rate limited';
            }
            // Retry with longer delay for rate limiting
            this.setTimeout(() => {
                this.processBatch();
            }, this.MIN_SAVE_INTERVAL * 4);
        } else if (error.code === 'permission-denied') {
            if (saveStatus) {
                saveStatus.innerHTML = '<i class="fas fa-lock"></i> Permission denied';
            }
            if (window.notifications) {
                notifications.error('Save Failed', 'You do not have permission to edit this document');
            }
        } else {
            if (saveStatus) {
                saveStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error saving';
            }
            if (window.notifications) {
                notifications.error('Save Failed', 'Could not save the document');
            }
            // Re-throw to trigger retry logic
            throw error;
        }
    }

    async manageRevisions(content, timestamp) {
        try {
            const revisionsRef = collection(db, 'documents', this.currentDocId, 'revisions');
            
            // Only store original and last 2 recent revisions
            const revisionData = {
                content,
                timestamp: timestamp.toISOString(),
                type: this.originalContent ? 'recent' : 'original'
            };

            if (!this.originalContent) {
                this.originalContent = content;
                await setDoc(doc(revisionsRef, 'original'), revisionData);
            } else {
                await setDoc(doc(revisionsRef), revisionData);
            }

        } catch (error) {
            console.error('Error managing revisions:', error);
        }
    }

    async createNewDocument() {
        try {
            if (!this.currentUser) {
                throw new Error('User not authenticated');
            }

            const newDoc = {
                title: 'Untitled Document',
                content: this.editor.innerHTML,
                userId: this.currentUser.uid,
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString()
            };

            const docRef = doc(collection(db, 'documents'));
            await setDoc(docRef, newDoc);
            
            this.currentDocId = docRef.id;
            notifications.success('Created', 'New document created');
            return docRef.id;
        } catch (error) {
            notifications.error('Creation Failed', 'Could not create new document', ERROR_CODES.SAVE_ERROR);
        }
    }

    async loadUserDocuments() {
        try {
            if (!this.currentUser) {
                throw new Error('User not authenticated');
            }

            const querySnapshot = await getDocs(collection(db, 'documents'));
            const docs = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.userId === this.currentUser.uid) {
                    docs.push({ id: doc.id, ...data });
                }
            });

            // If no documents exist, create a new one
            if (docs.length === 0) {
                await this.createNewDocument();
            } else {
                // Load the most recent document
                const mostRecent = docs.sort((a, b) => 
                    new Date(b.lastModified) - new Date(a.lastModified)
                )[0];
                
                this.currentDocId = mostRecent.id;
                this.editor.innerHTML = mostRecent.content || `
                    <div class="page" data-page="1">
                        <h1>Untitled Document</h1>
                        <p>Start typing here...</p>
                    </div>
                `;

                // Wait for content to be rendered before checking page breaks
                setTimeout(() => this.checkPageBreaks(), 0);
            }

            if (this.currentDocId) {
                // Load original revision if it exists
                const originalRevDoc = await getDoc(doc(db, 'documents', this.currentDocId, 'revisions', 'original'));
                if (originalRevDoc.exists()) {
                    this.originalContent = originalRevDoc.data().content;
                }
            }

            if (this.currentDocId) {
                const docRef = doc(db, 'documents', this.currentDocId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    document.getElementById('docTitle').value = data.title || 'Untitled Document';
                }
            }
        } catch (error) {
            console.error('Load error:', error);
            notifications.error('Load Failed', error.message, ERROR_CODES.LOAD_ERROR);
        }
    }

    execCommand(command, value = null) {
        if (command === 'fontName') {
            this.applyFontToSelection(value);
        } else {
            document.execCommand(command, false, value);
        }
        this.editor.focus();
    }

    applyFontToSelection(fontFamily) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        
        if (!range.collapsed) {
            // Text is selected
            try {
                document.execCommand('styleWithCSS', false, true);
                document.execCommand('fontName', false, fontFamily);

                // Clean up nested spans
                const container = range.commonAncestorContainer;
                if (container.nodeType === 1) { // Element node
                    this.cleanupFontSpans(container);
                } else { // Text node
                    this.cleanupFontSpans(container.parentElement);
                }
            } catch (e) {
                console.error('Font application error:', e);
            }
        } else {
            // No selection, apply to current block
            const block = selection.focusNode.nodeType === 1 ? 
                selection.focusNode : 
                selection.focusNode.parentElement;

            if (block) {
                if (block.classList.contains('page')) {
                    const p = document.createElement('p');
                    p.style.fontFamily = fontFamily;
                    p.innerHTML = '&#8203;';
                    block.appendChild(p);
                    
                    const newRange = document.createRange();
                    newRange.setStart(p.firstChild, 1);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                } else {
                    block.style.fontFamily = fontFamily;
                }
            }
        }
    }

    cleanupFontSpans(element) {
        element.querySelectorAll('span').forEach(span => {
            if (span.nextSibling && span.nextSibling.tagName === 'SPAN') {
                const next = span.nextSibling;
                if (span.style.cssText === next.style.cssText) {
                    while (next.firstChild) {
                        span.appendChild(next.firstChild);
                    }
                    next.remove();
                }
            }
        });
    }

    handleToolbarAction(e) {
        e.preventDefault(); // Prevent losing selection
        const button = e.currentTarget;
        const command = button.id.replace('Btn', '').toLowerCase();
        
        switch(command) {
            case 'bold':
            case 'italic':
            case 'underline':
            case 'strike':
                this.applyFormat(command);
                break;
            case 'alignleft':
            case 'aligncenter':
            case 'alignright':
            case 'alignjustify':
                this.setAlignment(command);
                break;
        }
    }

    toggleFormat(format) {
        // Save current font family before applying format
        const selection = window.getSelection();
        let currentFont = null;
        
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer;
            const parentElement = container.nodeType === 3 ? container.parentElement : container;
            
            if (parentElement && this.editor.contains(parentElement)) {
                currentFont = window.getComputedStyle(parentElement).fontFamily;
            }
        }

        document.execCommand('styleWithCSS', false, true);
        document.execCommand(format, false, null);

        // Re-apply font if needed
        if (currentFont) {
            const newSelection = window.getSelection();
            if (newSelection.rangeCount > 0) {
                const newRange = newSelection.getRangeAt(0);
                const newContainer = newRange.commonAncestorContainer;
                const newParent = newContainer.nodeType === 3 ? newContainer.parentElement : newContainer;
                
                if (newParent && newParent.tagName === 'SPAN') {
                    newParent.style.fontFamily = currentFont;
                }
            }
        }

        this.editor.focus();
        this.updateActiveFormats();
    }

    setAlignment(align) {
        const command = 'justify' + align.replace('align', '').toLowerCase();
        document.execCommand(command, false, null);
        this.editor.focus();
    }

    updateWordCount() {
        const text = this.editor.innerText;
        const words = text.trim().split(/\s+/).length;
        const chars = text.length;
        
        document.getElementById('wordCount').textContent = `${words} words`;
        document.getElementById('charCount').textContent = `${chars} characters`;
    }

    updateUserInterface() {
        const userAvatar = document.getElementById('userAvatar');
        userAvatar.src = this.currentUser.photoURL || 'https://d2zcpib8duehag.cloudfront.net/accountuser.png';
        
        const dropdown = document.getElementById('userDropdown');
        dropdown.innerHTML = `
            <div class="user-info">
                <img src="${this.currentUser.photoURL || 'https://d2zcpib8duehag.cloudfront.net/accountuser.png'}" alt="Profile">
                <span>${this.currentUser.displayName || this.currentUser.email}</span>
            </div>
            <a href="documents.html" id="myDocsBtn"><i class="fas fa-folder"></i> My Documents</a>
            <a href="editor.html?action=new" id="newDocBtn"><i class="fas fa-plus"></i> New Document</a>
            <a href="#" id="settingsBtn"><i class="fas fa-cog"></i> Settings</a>
            <a href="#" id="logoutBtn"><i class="fas fa-sign-out-alt"></i> Sign Out</a>
        `;

        // Attach event listeners to menu items
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            auth.signOut();
        });

        document.getElementById('newDocBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.createNewDocument();
        });
    }

    redirectToLogin() {
        // Fix the login path
        window.location.href = 'index.html';
    }

    initializeShareDialog() {
        const shareDialog = document.getElementById('shareDialog');
        const shareBtn = document.getElementById('shareBtn');
        const cancelShare = document.getElementById('cancelShare');
        const confirmShare = document.getElementById('confirmShare');
        const shareLinkContainer = document.getElementById('shareLinkContainer');
        
        shareBtn.addEventListener('click', () => this.openShareDialog());
        cancelShare.addEventListener('click', () => shareDialog.style.display = 'none');
        confirmShare.addEventListener('click', () => this.handleShare());
        
        // Add copy link button handler
        document.getElementById('copyLink')?.addEventListener('click', () => this.copyShareLink());
    
        // Handle share type changes
        document.querySelectorAll('input[name="shareType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                shareLinkContainer.style.display = e.target.value === 'public' ? 'flex' : 'none';
                if (e.target.value === 'public') {
                    const shareLink = `${window.location.origin}/view.html?id=${this.currentDocId}`;
                    document.getElementById('shareLink').value = shareLink;
                }
            });
        });
    }

    async handleShare() {
        const shareType = document.querySelector('input[name="shareType"]:checked').value;
        const shareEmails = document.getElementById('shareEmails').value;
        const allowCopy = document.getElementById('allowCopy')?.checked ?? true;
        const embedSize = document.querySelector('input[name="embedSize"]:checked')?.value || 'medium';
        const docRef = doc(db, 'documents', this.currentDocId);
    
        try {
            if (shareType === 'public') {
                await setDoc(docRef, {
                    isPublic: true,
                    allowCopy,
                    sharedWith: []
                }, { merge: true });
    
                // Update share options
                const shareLinkContainer = document.getElementById('shareLinkContainer');
                const embedContainer = document.getElementById('embedContainer');
                shareLinkContainer.style.display = 'flex';
                embedContainer.style.display = 'flex';
    
                // Generate links
                const baseUrl = `${window.location.origin}/view.html?id=${this.currentDocId}`;
                const shareLink = baseUrl;
                const embedLink = `${baseUrl}&embed=true`;
    
                // Update share link
                document.getElementById('shareLink').value = shareLink;
    
                // Update embed code
                const embedCode = this.generateEmbedCode(embedLink, embedSize);
                document.getElementById('embedCode').value = embedCode;
    
                notifications.success('Shared', 'Document is now public');
            } else {
                const emails = shareEmails.split(',').map(email => email.trim()).filter(Boolean);
                
                if (emails.length === 0) {
                    notifications.warning('No Recipients', 'Please enter at least one email address');
                    return;
                }
    
                const validUsers = [];
                const invalidEmails = [];
    
                for (const email of emails) {
                    const usersRef = collection(db, 'users');
                    const q = query(usersRef, where('email', '==', email), limit(1));
                    
                    const querySnapshot = await getDocs(q);
                    if (!querySnapshot.empty) {
                        validUsers.push(querySnapshot.docs[0].id);
                    } else {
                        invalidEmails.push(email);
                    }
                }
    
                if (invalidEmails.length > 0) {
                    notifications.warning(
                        'Some users not found', 
                        `The following users need a Nova account: ${invalidEmails.join(', ')}`
                    );
                }
    
                if (validUsers.length > 0) {
                    await setDoc(docRef, {
                        isPublic: false,
                        allowCopy,
                        sharedWith: validUsers
                    }, { merge: true });
                    
                    notifications.success('Shared', `Document shared with ${validUsers.length} user(s)`);
                    document.getElementById('shareDialog').style.display = 'none';
                }
            }
        } catch (error) {
            notifications.error('Share Failed', error.message);
        }
    }
    
    copyShareLink() {
        const shareLink = document.getElementById('shareLink');
        shareLink.select();
        document.execCommand('copy');
        notifications.success('Copied', 'Link copied to clipboard');
    }

    generateEmbedCode(embedUrl, size) {
        const sizes = {
            small: { width: '400px', height: '300px' },
            medium: { width: '600px', height: '400px' },
            large: { width: '800px', height: '600px' },
            responsive: { width: '100%', height: '500px' }
        };
    
        const { width, height } = sizes[size] || sizes.medium;
    
        return `<iframe src="${embedUrl}" width="${width}" height="${height}" frameborder="0" allowfullscreen></iframe>`;
    }

    async openShareDialog() {
        const dialog = document.getElementById('shareDialog');
        const shareLinkContainer = document.getElementById('shareLinkContainer');
        dialog.style.display = 'block';
        
        try {
            // Get current document state
            const docRef = doc(db, 'documents', this.currentDocId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // Set correct radio button based on current share state
                const shareType = data.isPublic ? 'public' : 'private';
                document.querySelector(`input[name="shareType"][value="${shareType}"]`).checked = true;
                
                // Update share link container visibility and URL if public
                if (data.isPublic) {
                    shareLinkContainer.style.display = 'flex';
                    const shareLink = `${window.location.origin}/view.html?id=${this.currentDocId}`;
                    document.getElementById('shareLink').value = shareLink;
                } else {
                    shareLinkContainer.style.display = 'none';
                    document.getElementById('shareEmails').value = '';
                }
    
                // Set allow copy checkbox
                const allowCopyCheckbox = document.getElementById('allowCopy');
                if (allowCopyCheckbox) {
                    allowCopyCheckbox.checked = data.allowCopy ?? true;
                }
            }
            
            // Update shared users list
            await this.updateSharedUsersList();
            
        } catch (error) {
            console.error('Error loading share settings:', error);
            notifications.error('Error', 'Could not load sharing settings');
        }
    }
    

    async updateSharedUsersList() {
        const sharedUsersList = document.getElementById('sharedUsersList');
        sharedUsersList.innerHTML = '';

        try {
            const docRef = doc(db, 'documents', this.currentDocId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                
                if (data.isPublic) {
                    sharedUsersList.innerHTML = `
                        <div class="shared-user">
                            <i class="fas fa-globe"></i>
                            <span>Anyone with the link</span>
                        </div>
                    `;
                } else if (data.sharedWith && data.sharedWith.length > 0) {
                    for (const userId of data.sharedWith) {
                        const userRef = doc(db, 'users', userId);
                        const userSnap = await getDoc(userRef);
                        
                        if (userSnap.exists()) {
                            const userData = userSnap.data();
                            sharedUsersList.innerHTML += `
                                <div class="shared-user">
                                    <img src="${userData.photoURL || 'https://d2zcpib8duehag.cloudfront.net/accountuser.png'}" alt="${userData.email}">
                                    <span>${userData.email}</span>
                                    <button onclick="window.editor.removeSharedUser('${userId}')">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            `;
                        }
                    }
                } else {
                    sharedUsersList.innerHTML = '<p>Not shared with anyone</p>';
                }
            }
        } catch (error) {
            console.error('Error updating shared users list:', error);
        }
    }

    async removeSharedUser(userId) {
        try {
            const docRef = doc(db, 'documents', this.currentDocId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                const updatedSharedWith = (data.sharedWith || []).filter(id => id !== userId);
                
                await setDoc(docRef, {
                    sharedWith: updatedSharedWith
                }, { merge: true });
                
                await this.updateSharedUsersList();
                notifications.success('Updated', 'User removed from document');
            }
        } catch (error) {
            notifications.error('Update Failed', 'Could not remove user');
        }
    }

    initializeTitleInput() {
        const titleInput = document.getElementById('docTitle');
        titleInput.addEventListener('blur', () => this.saveTitle());
        titleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent newline in title
                titleInput.blur();
            }
        });

        // Add this new input handler
        titleInput.addEventListener('input', () => {
            document.title = `${titleInput.value.trim() || 'Untitled Document'} - Nova Docs`;
        });
    }

    async saveTitle() {
        if (!this.currentUser || !this.currentDocId) return;

        const titleInput = document.getElementById('docTitle');
        const newTitle = titleInput.value.trim() || 'Untitled Document';

        try {
            const docRef = doc(db, 'documents', this.currentDocId);
            await setDoc(docRef, {
                title: newTitle,
                lastModified: new Date().toISOString()
            }, { merge: true });

            this.updateDocumentTitle(newTitle); // Add this line
            notifications.success('Saved', 'Document title updated');
        } catch (error) {
            notifications.error('Save Failed', 'Could not update document title');
        }
    }    setupPageManagement() {
        // Debounce the page break checking with better management
        const pageBreakHandler = () => {
            if (this.pageBreakDebounce) {
                clearTimeout(this.pageBreakDebounce);
                this.timeouts.delete(this.pageBreakDebounce);
            }
            this.pageBreakDebounce = this.setTimeout(() => {
                try {
                    this.checkPageBreaks();
                } catch (error) {
                    console.error('Error in debounced page break check:', error);
                }
            }, 1000);
        };

        const pasteHandler = () => {
            if (this.pageBreakDebounce) {
                clearTimeout(this.pageBreakDebounce);
                this.timeouts.delete(this.pageBreakDebounce);
            }
            this.pageBreakDebounce = this.setTimeout(() => {
                try {
                    this.checkPageBreaks();
                } catch (error) {
                    console.error('Error in paste page break check:', error);
                }
            }, 1500); // Longer delay for paste to allow content to settle
        };

        if (this.editor) {
            this.editor.addEventListener('input', pageBreakHandler);
            this.editor.addEventListener('paste', pasteHandler);
            
            // Store event listeners for cleanup
            this.eventListeners.set('page-input', { element: this.editor, event: 'input', handler: pageBreakHandler });
            this.eventListeners.set('page-paste', { element: this.editor, event: 'paste', handler: pasteHandler });
        }
    }checkPageBreaks() {
        // Prevent execution if destroyed or editor not ready
        if (this.isDestroyed || !this.editor || !this.editor.children || !this.editor.children.length) {
            return;
        }

        try {
            this.saveEditorState();

            // Create temporary container with error handling
            const tempContainer = document.createElement('div');
            tempContainer.style.cssText = 'visibility: hidden; position: absolute; top: -9999px;';
            
            // Safely append to body
            if (document.body) {
                document.body.appendChild(tempContainer);
            } else {
                console.warn('Document body not available for page break calculation');
                return;
            }

            // Get all content preserving order with validation
            const allContent = [];
            try {
                Array.from(this.editor.children).forEach(page => {
                    if (page && page.classList && page.classList.contains('page')) {
                        const pageContent = Array.from(page.childNodes);
                        allContent.push(...pageContent);
                    }
                });
            } catch (error) {
                console.error('Error extracting page content:', error);
                this.cleanupTempContainer(tempContainer);
                return;
            }

            // Reset editor safely
            const newFirstPage = document.createElement('div');
            newFirstPage.className = 'page';
            newFirstPage.dataset.page = '1';
            
            this.editor.innerHTML = '';
            this.editor.appendChild(newFirstPage);
            
            let currentPage = newFirstPage;
            let totalHeight = 0;
            let pageNumber = 1;

            // Process content in original order with error handling
            allContent.forEach(node => {
                try {
                    if (!node || this.isDestroyed) return;

                    // Clone node to avoid moving original
                    const clonedNode = node.cloneNode(true);
                    
                    // Add node to temp container to measure it
                    tempContainer.appendChild(clonedNode);
                    const nodeHeight = tempContainer.offsetHeight || 0;
                    tempContainer.innerHTML = '';

                    if (totalHeight + nodeHeight > this.pageHeight - 192) { // 192px = 2 inches margins
                        // Create new page
                        currentPage = document.createElement('div');
                        currentPage.className = 'page';
                        pageNumber++;
                        currentPage.dataset.page = pageNumber;
                        this.editor.appendChild(currentPage);
                        totalHeight = 0;
                    }

                    currentPage.appendChild(node);
                    totalHeight += nodeHeight;
                } catch (nodeError) {
                    console.error('Error processing node in page breaks:', nodeError);
                    // Continue with next node
                }
            });

            // Clean up temp container
            this.cleanupTempContainer(tempContainer);

            // Update page indicator safely
            const pageIndicator = document.getElementById('pageIndicator');
            if (pageIndicator) {
                pageIndicator.textContent = `Page ${pageNumber} of ${pageNumber}`;
            }

            this.restoreEditorState();

            // Ensure cursor position is maintained
            if (this.editor && !this.isDestroyed) {
                this.editor.focus();
            }
        } catch (error) {
            console.error('Error in checkPageBreaks:', error);
            // Attempt to restore editor state even on error
            try {
                this.restoreEditorState();
            } catch (restoreError) {
                console.error('Failed to restore editor state after page break error:', restoreError);
            }
        }
    }

    cleanupTempContainer(tempContainer) {
        try {
            if (tempContainer && tempContainer.parentNode) {
                tempContainer.parentNode.removeChild(tempContainer);
            }
        } catch (error) {
            console.error('Error cleaning up temp container:', error);
        }
    }

    setupFontHandling() {
        const fontSelect = document.getElementById('fontSelect');
        fontSelect.addEventListener('change', (e) => {
            // Get the selected font
            const font = e.target.value;
            // Apply to current selection or whole editor if no selection
            if (window.getSelection().toString()) {
                this.execCommand('fontName', font);
            } else {
                // Apply to current paragraph or whole editor
                const node = window.getSelection().focusNode;
                const currentBlock = node ? node.nodeType === 1 ? node : node.parentElement : null;
                if (currentBlock && this.editor.contains(currentBlock)) {
                    currentBlock.style.fontFamily = font;
                } else {
                    // No valid selection, apply to whole page
                    const currentPage = this.editor.querySelector('.page');
                    if (currentPage) {
                        currentPage.style.fontFamily = font;
                    }
                }
            }
            this.editor.focus();
        });
    }

    initializeHistoryDialog() {
        const historyBtn = document.getElementById('historyBtn');
        const historyPanel = document.getElementById('historyPanel');
        const closeHistory = document.getElementById('closeHistory');
        const restoreVersion = document.getElementById('restoreVersion');

        historyBtn.addEventListener('click', () => this.openHistoryPanel());
        closeHistory.addEventListener('click', () => {
            this.closeHistoryPanel();
        });
        restoreVersion.addEventListener('click', () => this.restoreRevision());

        // Handle Escape key to close panel
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && historyPanel.classList.contains('active')) {
                this.closeHistoryPanel();
            }
        });
    }

    async openHistoryPanel() {
        const historyPanel = document.getElementById('historyPanel');
        const revisionList = document.getElementById('revisionList');
        revisionList.innerHTML = '<div class="loading">Loading history...</div>';
        historyPanel.classList.add('active');

        try {
            const revisionsRef = collection(db, 'documents', this.currentDocId, 'revisions');
            const revisionDocs = await getDocs(revisionsRef);
            const revisions = [];

            revisionDocs.forEach(doc => {
                revisions.push({ id: doc.id, ...doc.data() });
            });

            // Sort revisions by timestamp, most recent first
            revisions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            revisionList.innerHTML = revisions.map(rev => `
                <div class="revision-item" data-id="${rev.id}" data-content="${encodeURIComponent(rev.content)}">
                    <div class="revision-time">
                        ${new Date(rev.timestamp).toLocaleString()}
                        <span class="revision-type ${rev.type}">${rev.type}</span>
                    </div>
                    <div class="revision-preview">
                        ${this.getPreviewText(rev.content)}
                    </div>
                </div>
            `).join('');

            // Add click handlers to revision items
            revisionList.querySelectorAll('.revision-item').forEach(item => {
                item.addEventListener('click', () => this.selectRevision(item));
            });

        } catch (error) {
            revisionList.innerHTML = '<div class="error">Failed to load history</div>';
            console.error('Error loading history:', error);
        }
    }

    closeHistoryPanel() {
        const historyPanel = document.getElementById('historyPanel');
        const restoreVersion = document.getElementById('restoreVersion');
        
        historyPanel.classList.remove('active');
        restoreVersion.style.display = 'none';
        this.selectedRevision = null;

        // Restore original content if in preview mode
        if (this.editor.classList.contains('preview-mode')) {
            this.editor.innerHTML = this.currentContent;
            this.editor.classList.remove('preview-mode');
        }
    }

    getPreviewText(content) {
        const temp = document.createElement('div');
        temp.innerHTML = content;
        return temp.textContent.slice(0, 200) + '...';
    }

    selectRevision(item) {
        // Remove selection from other items
        document.querySelectorAll('.revision-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');

        // Store the selected revision
        this.selectedRevision = {
            id: item.dataset.id,
            content: decodeURIComponent(item.dataset.content)
        };

        // Show restore button
        document.getElementById('restoreVersion').style.display = 'block';

        // Show preview in editor without saving
        const tempContent = this.editor.innerHTML;
        this.editor.innerHTML = this.selectedRevision.content;

        // Add preview class to editor
        this.editor.classList.add('preview-mode');

        // Store the current content to restore if needed
        this.currentContent = tempContent;
    }

    async restoreRevision() {
        if (!this.selectedRevision) return;

        try {
            // Save the restored version as a new revision
            const now = new Date();
            const revisionsRef = collection(db, 'documents', this.currentDocId, 'revisions');
            
            await setDoc(doc(revisionsRef), {
                content: this.selectedRevision.content,
                timestamp: now.toISOString(),
                type: 'restored'
            });

            // Update the main document
            const docRef = doc(db, 'documents', this.currentDocId);
            await setDoc(docRef, {
                content: this.selectedRevision.content,
                lastModified: now.toISOString()
            }, { merge: true });

            // Update editor and close panel
            this.editor.innerHTML = this.selectedRevision.content;
            this.editor.classList.remove('preview-mode');
            const historyPanel = document.getElementById('historyPanel');
            historyPanel.classList.remove('active');
            this.selectedRevision = null;
            document.getElementById('restoreVersion').style.display = 'none';

            notifications.success('Restored', 'Document restored to selected version');
        } catch (error) {
            notifications.error('Restore Failed', 'Could not restore the selected version');
            console.error('Error restoring revision:', error);
        }
    }

    setupZoomControls() {
        const zoomOut = document.getElementById('zoomOutBtn');
        const zoomIn = document.getElementById('zoomInBtn');
        const zoomLevel = document.getElementById('zoomLevel');

        // Initialize zoom level
        this.applyZoom(this.currentZoom);
        zoomLevel.value = this.currentZoom === 1 ? '1' : this.currentZoom.toString();

        zoomOut.addEventListener('click', () => {
            const currentIndex = zoomLevel.selectedIndex;
            if (currentIndex > 0) {
                zoomLevel.selectedIndex = currentIndex - 1;
                this.handleZoomChange(zoomLevel.value);
            }
        });

        zoomIn.addEventListener('click', () => {
            const currentIndex = zoomLevel.selectedIndex;
            if (currentIndex < zoomLevel.options.length - 1) {
                zoomLevel.selectedIndex = currentIndex + 1;
                this.handleZoomChange(zoomLevel.value);
            }
        });

        zoomLevel.addEventListener('change', (e) => {
            this.handleZoomChange(e.target.value);
        });

        // Handle zoom keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === '0') {
                    e.preventDefault();
                    this.handleZoomChange('1');
                    zoomLevel.value = '1';
                } else if (e.key === '+' || e.key === '=') {
                    e.preventDefault();
                    zoomIn.click();
                } else if (e.key === '-') {
                    e.preventDefault();
                    zoomOut.click();
                }
            }
        });

        // Handle zoom with mouse wheel
        document.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                if (e.deltaY < 0) {
                    zoomIn.click();
                } else {
                    zoomOut.click();
                }
            }
        }, { passive: false });
    }

    handleZoomChange(value) {
        if (value === 'fit' || value === 'fill') {
            this.applyFitZoom(value);
        } else {
            this.applyZoom(parseFloat(value));
        }
    }

    applyZoom(scale) {
        this.currentZoom = scale;
        localStorage.setItem('editorZoom', scale.toString());
        this.editor.parentElement.style.transform = `scale(${scale})`;
        this.editor.parentElement.style.transformOrigin = 'top center';
        this.checkPageBreaks();
    }

    applyFitZoom(type) {
        const container = this.editor.parentElement;
        const containerWidth = container.parentElement.clientWidth;
        const pageWidth = this.editor.querySelector('.page').offsetWidth;
        
        let scale;
        if (type === 'fit') {
            scale = (containerWidth - 40) / pageWidth; // 40px for padding
        } else { // fill
            scale = containerWidth / pageWidth;
        }

        this.applyZoom(scale);
        document.getElementById('zoomLevel').value = type;
    }

    setupMobileOptimizations() {
        // Handle toolbar scrolling
        const toolbar = document.querySelector('.toolbar');
        let touchStartX = 0;
        let scrollLeft = 0;

        toolbar.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].pageX - toolbar.offsetLeft;
            scrollLeft = toolbar.scrollLeft;
        }, { passive: true });

        toolbar.addEventListener('touchmove', (e) => {
            if (e.touches.length > 1) return; // Ignore multi-touch
            const touchX = e.touches[0].pageX - toolbar.offsetLeft;
            const walk = (touchX - touchStartX) * 2;
            toolbar.scrollLeft = scrollLeft - walk;
        }, { passive: true });

        // Handle mobile keyboard
        this.editor.addEventListener('focus', () => {
            if (this.isMobile) {
                setTimeout(() => {
                    this.editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            }
        });

        // Handle touch selection
        this.editor.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault(); // Prevent zoom on double touch
            }
        }, { passive: false });

        // Optimize dropdowns for mobile
        const dropdowns = document.querySelectorAll('.dropdown-content');
        dropdowns.forEach(dropdown => {
            dropdown.addEventListener('touchmove', (e) => {
                e.stopPropagation();
            }, { passive: true });
        });
   }

    // Add retry mechanism for failed initialization
    async retryInitialization(maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Initialization attempt ${attempt}/${maxRetries}`);
                
                // Wait before retry (exponential backoff)
                if (attempt > 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 2)));
                }
                
                // Reset destroyed state for retry
                this.isDestroyed = false;
                
                await this.init();
                
                console.log('Initialization successful');
                return;
                
            } catch (error) {
                console.error(`Initialization attempt ${attempt} failed:`, error);
                
                if (attempt === maxRetries) {
                    console.error('All initialization attempts failed');
                    this.showInitializationFailure();
                    return;
                }
            }
        }
    }

    showInitializationFailure() {
        const container = document.body || document.documentElement;
        if (container) {
            const errorDiv = document.createElement('div');
            errorDiv.innerHTML = `
                <div style="
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    padding: 30px;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    text-align: center;
                    z-index: 10000;
                    max-width: 400px;
                ">
                    <h3 style="color: #e74c3c; margin-bottom: 15px;">
                        <i class="fas fa-exclamation-triangle"></i>
                        Initialization Failed
                    </h3>
                    <p style="margin-bottom: 20px; color: #666;">
                        The editor could not be initialized. This may be due to:
                    </p>
                    <ul style="text-align: left; margin-bottom: 20px; color: #666;">
                        <li>Network connectivity issues</li>
                        <li>Browser compatibility problems</li>
                        <li>Missing required resources</li>
                    </ul>
                    <button onclick="window.location.reload()" style="
                        background: #3498db;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 4px;
                        cursor: pointer;
                        margin-right: 10px;
                    ">
                        Reload Page
                    </button>
                    <button onclick="this.parentElement.remove()" style="
                        background: #95a5a6;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 4px;
                        cursor: pointer;
                    ">
                        Dismiss
                    </button>
                </div>
            `;
            container.appendChild(errorDiv);
        }
    }

    // Recovery methods for common failures
    recoverFromSaveFailure() {
        try {
            // Reset retry attempts
            this.retryAttempts = 0;
            
            // Clear any corrupted pending changes
            if (this.pendingChanges.length > 10) {
                console.warn('Too many pending changes, clearing some...');
                this.pendingChanges = this.pendingChanges.slice(-5); // Keep only last 5
            }
            
            // Restart the save process
            if (this.pendingChanges.length > 0) {
                this.setTimeout(() => this.processBatch(), this.MIN_SAVE_INTERVAL);
            }
            
        } catch (error) {
            console.error('Error in save failure recovery:', error);
        }
    }

    recoverFromEditorStateFailure() {
        try {
            // Clear corrupted state
            this.selectionState = null;
            this.lastSelection = null;
            this.lastRange = null;
            
            // Ensure editor is focused and editable
            if (this.editor && !this.isDestroyed) {
                this.editor.focus();
                
                // Place cursor at a safe position
                this.placeCursorAtEnd();
            }
            
        } catch (error) {
            console.error('Error in editor state recovery:', error);
        }
    }

    // Health check method
    performHealthCheck() {
        const issues = [];
        
        try {
            // Check if editor exists and is accessible
            if (!this.editor) {
                issues.push('Editor element not found');
            } else if (!document.contains(this.editor)) {
                issues.push('Editor element not in DOM');
            }
            
            // Check if essential methods are available
            if (typeof this.saveDocument !== 'function') {
                issues.push('Save functionality compromised');
            }
            
            // Check if Firebase is available
            if (typeof db === 'undefined') {
                issues.push('Database connection unavailable');
            }
            
            // Check for memory leaks
            if (this.timeouts.size > 50) {
                issues.push('Too many active timeouts - possible memory leak');
            }
            
            if (this.eventListeners.size > 100) {
                issues.push('Too many event listeners - possible memory leak');
            }
            
            // Log health status
            if (issues.length === 0) {
                console.log('DocumentEditor health check: OK');
            } else {
                console.warn('DocumentEditor health issues:', issues);
                
                // Attempt auto-recovery for some issues
                if (issues.includes('Too many active timeouts - possible memory leak')) {
                    this.timeouts.clear();
                }
            }
            
        } catch (error) {
            console.error('Error during health check:', error);
            issues.push('Health check failed');
        }
        
        return issues;
    }

    // ...existing code...
}

// Initialize the editor when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.editor = new DocumentEditor();
        
        // Perform periodic health checks (every 5 minutes)
        setInterval(() => {
            if (window.editor && !window.editor.isDestroyed) {
                window.editor.performHealthCheck();
            }
        }, 5 * 60 * 1000);
        
        // Add global error handler for unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            if (window.notifications) {
                notifications.error('Unexpected Error', 'An unexpected error occurred. Please save your work.');
            }
        });
        
        // Add global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            // Don't show notification for every error to avoid spam
        });
        
    } catch (error) {
        console.error('Failed to initialize DocumentEditor:', error);
        
        // Try to create a fallback editor after a delay
        setTimeout(() => {
            if (!window.editor) {
                console.log('Attempting fallback initialization...');
                try {
                    window.editor = new DocumentEditor();
                    window.editor.retryInitialization();
                } catch (fallbackError) {
                    console.error('Fallback initialization also failed:', fallbackError);
                }
            }
        }, 2000);
    }
});
