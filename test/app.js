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
} from '../firebase-config.js';

class DocumentEditor {
    constructor() {
        // Core properties
        this.editor = document.getElementById('editor');
        this.currentUser = null;
        this.currentDocId = null;
        this.saveTimeout = null;
        this.activeButtons = new Set();
        
        // Stability improvements - initialize cleanup arrays
        this.timeouts = new Set();
        this.intervals = new Set();
        this.eventListeners = new Map();
        this.retryAttempts = 0;
        this.maxRetries = 3;
        this.isDestroyed = false;
        
        // State management
        this.lastSaveTime = null;
        this.originalContent = null;
        this.sessionStartTime = new Date();
        this.pageHeight = 1056; // 11 inches at 96dpi
        this.pageBreakDebounce = null;
        this.lastSelection = null;
        this.lastRange = null;
        this.lastScroll = 0;
        this.selectionState = null;
        this.selectedRevision = null;
        
        // Initialize with error handling
        this.init();
    }

    async init() {
        try {
            // Prevent double initialization
            if (this.isDestroyed) return;
            
            if (!this.editor) {
                throw new Error('Editor element not found');
            }
            
            this.initializeEditor();
            this.attachEventListeners();
            this.setupAuthStateListener();
            this.setupToolbar();
            this.createNewDocumentIfNeeded();
            this.initializeShareDialog();
            this.initializeTitleInput();
            this.setupPageManagement();
            this.setupFontHandling();
            this.initializeHistoryDialog();
            
            // Setup cleanup handlers
            this.setupCleanupHandlers();
            
            this.isInitialized = true;
        } catch (error) {
            console.error('Test editor initialization failed:', error);
            this.handleInitializationError(error);
        }
    }

    handleInitializationError(error) {
        if (window.notifications) {
            notifications.error('Initialization Failed', 'Could not initialize test editor. Please refresh the page.');
        }
        
        if (this.editor) {
            this.editor.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #666;">
                    <h3>Test Editor failed to initialize</h3>
                    <p>Please refresh the page to try again.</p>
                    <button onclick="window.location.reload()" style="padding: 8px 16px; margin-top: 10px;">
                        Refresh Page
                    </button>
                </div>
            `;
        }
    }

    setupCleanupHandlers() {
        const cleanup = () => this.cleanup();
        
        window.addEventListener('beforeunload', cleanup);
        window.addEventListener('unload', cleanup);
        
        this.eventListeners.set('beforeunload', { element: window, event: 'beforeunload', handler: cleanup });
        this.eventListeners.set('unload', { element: window, event: 'unload', handler: cleanup });
    }

    cleanup() {
        if (this.isDestroyed) return;
        
        console.log('Cleaning up Test DocumentEditor...');
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
            
            // Clear debounce timeouts
            if (this.pageBreakDebounce) {
                try {
                    clearTimeout(this.pageBreakDebounce);
                } catch (error) {
                    console.error('Error clearing page break debounce:', error);
                }
                this.pageBreakDebounce = null;
            }
            
            if (this.saveTimeout) {
                try {
                    clearTimeout(this.saveTimeout);
                } catch (error) {
                    console.error('Error clearing save timeout:', error);
                }
                this.saveTimeout = null;
            }
            
            // Clear references
            this.editor = null;
            this.selectionState = null;
            
        } catch (error) {
            console.error('Error during test editor cleanup:', error);
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
            this.selectionState = null;
        }
    }    initializeEditor() {
        try {
            if (!this.editor) {
                throw new Error('Editor element not found');
            }

            const inputHandler = () => {
                try {
                    this.handleEditorChange();
                    this.updateWordCount();
                } catch (error) {
                    console.error('Error in editor input handler:', error);
                }
            };

            this.editor.addEventListener('input', inputHandler);
            this.eventListeners.set('editor-input', { element: this.editor, event: 'input', handler: inputHandler });

            // Initialize toolbar buttons with error handling
            const toolbarButtons = document.querySelectorAll('.toolbar button');
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

            // Initialize dropdowns and other elements safely
            this.initializeDropdowns();

        } catch (error) {
            console.error('Error initializing test editor:', error);
            throw error;
        }
    }    initializeDropdowns() {
        try {
            // Safe initialization of dropdown elements
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
            console.error('Error initializing dropdowns:', error);
        }
    }    setupToolbar() {
        try {
            // Format buttons with error handling
            const formatButtons = ['bold', 'italic', 'underline', 'strike'];
            formatButtons.forEach(format => {
                try {
                    const button = document.getElementById(`${format}Btn`);
                    if (button) {
                        const formatHandler = (e) => {
                            try {
                                e.preventDefault(); // Prevent losing selection
                                this.toggleFormat(format);
                                this.updateActiveFormats();
                            } catch (error) {
                                console.error(`Error toggling format ${format}:`, error);
                            }
                        };
                        button.addEventListener('mousedown', formatHandler);
                        this.eventListeners.set(`format-${format}`, { element: button, event: 'mousedown', handler: formatHandler });
                    }
                } catch (error) {
                    console.error(`Error setting up ${format} button:`, error);
                }
            });

            // Alignment buttons with error handling
            const alignButtons = ['alignLeft', 'alignCenter', 'alignRight', 'alignJustify'];
            alignButtons.forEach(align => {
                try {
                    const button = document.getElementById(`${align}Btn`);
                    if (button) {
                        const alignHandler = (e) => {
                            try {
                                e.preventDefault(); // Prevent losing selection
                                this.setAlignment(align);
                                alignButtons.forEach(a => {
                                    const alignBtn = document.getElementById(`${a}Btn`);
                                    if (alignBtn) alignBtn.classList.remove('active');
                                });
                                button.classList.add('active');
                            } catch (error) {
                                console.error(`Error setting alignment ${align}:`, error);
                            }
                        };
                        button.addEventListener('mousedown', alignHandler);
                        this.eventListeners.set(`align-${align}`, { element: button, event: 'mousedown', handler: alignHandler });
                    }
                } catch (error) {
                    console.error(`Error setting up ${align} button:`, error);
                }
            });
        } catch (error) {
            console.error('Error setting up toolbar:', error);
        }
    }

    toggleFormat(format) {
        const button = document.getElementById(`${format}Btn`);
        const isActive = document.queryCommandState(format);
        
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

        button.classList.toggle('active', !isActive);
        this.editor.focus();
    }    setAlignment(align) {
        try {
            // Convert alignment format for execCommand
            const alignmentMap = {
                'alignLeft': 'justifyLeft',
                'alignCenter': 'justifyCenter', 
                'alignRight': 'justifyRight',
                'alignJustify': 'justifyFull'
            };
            
            const command = alignmentMap[align] || 'justifyLeft';
            document.execCommand(command, false, null);
            
            if (this.editor && !this.isDestroyed) {
                this.editor.focus();
            }
        } catch (error) {
            console.error(`Error setting alignment ${align}:`, error);
        }
    }attachEventListeners() {
        try {
            // User menu dropdown with error handling
            const userMenuBtn = document.getElementById('userMenuBtn');
            const userDropdown = document.getElementById('userDropdown');

            if (userMenuBtn && userDropdown) {
                const userMenuHandler = (e) => {
                    try {
                        e.stopPropagation();
                        userDropdown.classList.toggle('show');
                    } catch (error) {
                        console.error('Error toggling user menu:', error);
                    }
                };
                userMenuBtn.addEventListener('click', userMenuHandler);
                this.eventListeners.set('user-menu-btn', { element: userMenuBtn, event: 'click', handler: userMenuHandler });

                // Close dropdown when clicking outside
                const outsideClickHandler = (e) => {
                    try {
                        if (!userDropdown.contains(e.target) && !userMenuBtn.contains(e.target)) {
                            userDropdown.classList.remove('show');
                        }
                    } catch (error) {
                        console.error('Error handling outside click:', error);
                    }
                };
                document.addEventListener('click', outsideClickHandler);
                this.eventListeners.set('outside-click', { element: document, event: 'click', handler: outsideClickHandler });
            }

            // Format tracking with error handling
            if (this.editor) {
                const formatUpdateHandler = () => {
                    try {
                        this.updateActiveFormats();
                    } catch (error) {
                        console.error('Error updating active formats:', error);
                    }
                };

                this.editor.addEventListener('keyup', formatUpdateHandler);
                this.eventListeners.set('editor-keyup', { element: this.editor, event: 'keyup', handler: formatUpdateHandler });

                this.editor.addEventListener('mouseup', formatUpdateHandler);
                this.eventListeners.set('editor-mouseup', { element: this.editor, event: 'mouseup', handler: formatUpdateHandler });
            }
        } catch (error) {
            console.error('Error attaching event listeners:', error);
        }
    }    updateActiveFormats() {
        try {
            if (this.isDestroyed) return;

            const formatStates = {
                'bold': document.queryCommandState('bold'),
                'italic': document.queryCommandState('italic'),
                'underline': document.queryCommandState('underline'),
                'strike': document.queryCommandState('strikethrough')
            };

            Object.entries(formatStates).forEach(([format, state]) => {
                try {
                    const button = document.getElementById(`${format}Btn`);
                    if (button) {
                        button.classList.toggle('active', state);
                    }
                } catch (error) {
                    console.error(`Error updating format ${format}:`, error);
                }
            });
        } catch (error) {
            console.error('Error updating active formats:', error);
        }
    }    setupAuthStateListener() {
        try {
            if (!auth) {
                throw new Error('Firebase auth not initialized');
            }

            const authHandler = async (user) => {
                try {
                    if (this.isDestroyed) return;

                    if (user) {
                        this.currentUser = user;
                        this.updateUserInterface();
                        await this.loadUserDocuments();
                    } else {
                        this.redirectToLogin();
                    }
                } catch (error) {
                    console.error('Error in auth state change handler:', error);
                    if (window.notifications) {
                        notifications.error('Authentication Error', 'Failed to handle authentication state change.');
                    }
                }
            };

            auth.onAuthStateChanged(authHandler);
            // Note: Firebase auth listener cleanup is handled by Firebase internally
        } catch (error) {
            console.error('Error setting up auth state listener:', error);
            if (window.notifications) {
                notifications.error('Authentication Setup Failed', 'Could not initialize authentication.');
            }
        }
    }    async handleEditorChange() {
        try {
            if (this.isDestroyed) return;

            // Clear existing save timeout
            if (this.saveTimeout) {
                clearTimeout(this.saveTimeout);
                this.timeouts.delete(this.saveTimeout);
            }

            this.saveEditorState();
            
            const saveStatus = document.getElementById('saveStatus');
            if (saveStatus) {
                saveStatus.innerHTML = '<i class="fas fa-sync fa-spin"></i> Saving...';
            }
            
            this.saveTimeout = this.setTimeout(async () => {
                try {
                    await this.saveDocument();
                } catch (error) {
                    console.error('Error saving document:', error);
                    const saveStatus = document.getElementById('saveStatus');
                    if (saveStatus) {
                        saveStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error saving';
                    }
                }
            }, 2000);

            // Remove preview mode if it exists
            if (this.editor) {
                this.editor.classList.remove('preview-mode');
            }
        } catch (error) {
            console.error('Error handling editor change:', error);
        }
    }    async saveDocument() {
        if (!this.currentUser || !this.currentDocId || this.isDestroyed) return;

        try {
            const content = this.editor?.innerHTML;
            if (!content) {
                console.warn('No content to save');
                return;
            }

            const now = new Date();
            const docRef = doc(db, 'documents', this.currentDocId);
            const pages = this.editor.querySelectorAll('.page').length || 1;
            
            await setDoc(docRef, {
                content,
                pages,
                lastModified: now.toISOString(),
                userId: this.currentUser.uid
            }, { merge: true });

            await this.manageRevisions(content, now);

            // Update only the save status indicator
            const saveStatus = document.getElementById('saveStatus');
            if (saveStatus) {
                saveStatus.innerHTML = '<i class="fas fa-check"></i> Saved';
            }
            this.lastSaveTime = now;
            
            this.restoreEditorState();
        } catch (error) {
            console.error('Error saving document:', error);
            const saveStatus = document.getElementById('saveStatus');
            if (saveStatus) {
                saveStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error saving';
            }
            
            if (window.notifications) {
                const errorMessage = this.categorizeFirebaseError(error);
                notifications.error('Save Failed', errorMessage.message);
            }
        }
    }

    categorizeFirebaseError(error) {
        const errorCode = error.code || '';
        const errorMessage = error.message || 'Unknown error';

        if (errorCode.includes('permission-denied')) {
            return { 
                type: 'PERMISSION_DENIED',
                message: 'You do not have permission to save this document.'
            };
        } else if (errorCode.includes('network-request-failed')) {
            return {
                type: 'NETWORK_ERROR', 
                message: 'Network error. Please check your connection and try again.'
            };
        } else if (errorCode.includes('quota-exceeded')) {
            return {
                type: 'QUOTA_EXCEEDED',
                message: 'Storage quota exceeded. Please contact support.'
            };
        } else {
            return {
                type: 'UNKNOWN_ERROR',
                message: 'Could not save the document. Please try again.'
            };
        }
    }    async manageRevisions(content, timestamp) {
        if (!this.currentDocId || this.isDestroyed) return;

        try {
            const revisionsRef = collection(db, 'documents', this.currentDocId, 'revisions');
            const revisionsSnapshot = await getDocs(revisionsRef);
            const revisions = [];
            
            revisionsSnapshot.forEach(doc => {
                revisions.push({ id: doc.id, ...doc.data() });
            });

            // Sort revisions by timestamp
            revisions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // If this is the first save of the session, store as original
            if (!this.originalContent) {
                this.originalContent = content;
                await setDoc(doc(revisionsRef, 'original'), {
                    content,
                    timestamp: this.sessionStartTime.toISOString(),
                    type: 'original'
                });
            }

            // Add new revision
            await setDoc(doc(revisionsRef), {
                content,
                timestamp: timestamp.toISOString(),
                type: 'recent'
            });

            // Keep only original and last 2 recent revisions
            const recentRevisions = revisions.filter(rev => rev.type === 'recent');
            if (recentRevisions.length > 2) {
                // Delete older revisions
                for (let i = 2; i < recentRevisions.length; i++) {
                    try {
                        await deleteDoc(doc(revisionsRef, recentRevisions[i].id));
                    } catch (deleteError) {
                        console.error('Error deleting old revision:', deleteError);
                        // Continue with other deletions even if one fails
                    }
                }
            }

        } catch (error) {
            console.error('Error managing revisions:', error);
            // Don't throw error to prevent breaking the save flow
        }
    }    async createNewDocumentIfNeeded() {
        try {
            if (!this.currentDocId && !this.isDestroyed) {
                await this.createNewDocument();
            }
        } catch (error) {
            console.error('Error creating new document:', error);
            if (window.notifications) {
                notifications.error('Document Creation Failed', 'Could not create a new document. Please try again.');
            }
        }
    }

    async createNewDocument() {
        try {
            if (!this.currentUser) {
                throw new Error('User not authenticated');
            }

            if (this.isDestroyed) {
                throw new Error('Editor has been destroyed');
            }

            const newDoc = {
                title: 'Untitled Document',
                content: this.editor?.innerHTML || '<div class="page" data-page="1"><h1>Untitled Document</h1><p>Start typing here...</p></div>',
                userId: this.currentUser.uid,
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString()
            };

            const docRef = doc(collection(db, 'documents'));
            await setDoc(docRef, newDoc);
            
            this.currentDocId = docRef.id;
            
            if (window.notifications) {
                notifications.success('Created', 'New document created');
            }
            return docRef.id;
        } catch (error) {
            console.error('Error creating new document:', error);
            if (window.notifications) {
                const errorMessage = this.categorizeFirebaseError(error);
                notifications.error('Creation Failed', errorMessage.message);
            }
            throw error;
        }
    }    async loadUserDocuments() {
        try {
            if (!this.currentUser) {
                throw new Error('User not authenticated');
            }

            if (this.isDestroyed) {
                console.warn('Attempted to load documents on destroyed editor');
                return;
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
                
                if (this.editor) {
                    this.editor.innerHTML = mostRecent.content || `
                        <div class="page" data-page="1">
                            <h1>Untitled Document</h1>
                            <p>Start typing here...</p>
                        </div>
                    `;

                    // Wait for content to be rendered before checking page breaks
                    this.setTimeout(() => {
                        if (!this.isDestroyed) {
                            this.checkPageBreaks();
                        }
                    }, 0);
                }
            }

            if (this.currentDocId && !this.isDestroyed) {
                try {
                    // Load original revision if it exists
                    const originalRevDoc = await getDoc(doc(db, 'documents', this.currentDocId, 'revisions', 'original'));
                    if (originalRevDoc.exists()) {
                        this.originalContent = originalRevDoc.data().content;
                    }

                    // Load document title
                    const docRef = doc(db, 'documents', this.currentDocId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const titleInput = document.getElementById('docTitle');
                        if (titleInput) {
                            titleInput.value = data.title || 'Untitled Document';
                        }
                    }
                } catch (revisionError) {
                    console.error('Error loading document revisions:', revisionError);
                    // Don't fail the entire load process for revision errors
                }
            }
        } catch (error) {
            console.error('Load error:', error);
            if (window.notifications) {
                const errorMessage = this.categorizeFirebaseError(error);
                notifications.error('Load Failed', errorMessage.message);
            }
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
        // Merge adjacent spans with the same properties
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
                this.toggleFormat(command);
                break;
            case 'alignleft':
            case 'aligncenter':
            case 'alignright':
            case 'alignjustify':
                this.setAlignment(command);
                break;
        }
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
            <a href="#" id="newDocBtn"><i class="fas fa-plus"></i> New Document</a>
            <a href="#" id="myDocsBtn"><i class="fas fa-folder"></i> My Documents</a>
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
        window.location.href = '../login.html';
    }

    initializeShareDialog() {
        const shareDialog = document.getElementById('shareDialog');
        const shareBtn = document.getElementById('shareBtn');
        const cancelShare = document.getElementById('cancelShare');
        const confirmShare = document.getElementById('confirmShare');
        const shareLinkContainer = document.getElementById('shareLinkContainer');
        const shareLink = document.getElementById('shareLink');
        const copyLink = document.getElementById('copyLink');
        
        shareBtn.addEventListener('click', () => this.openShareDialog());
        cancelShare.addEventListener('click', () => shareDialog.style.display = 'none');
        confirmShare.addEventListener('click', () => this.handleShare());
        copyLink.addEventListener('click', () => this.copyShareLink());

        document.querySelectorAll('input[name="shareType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                shareLinkContainer.style.display = e.target.value === 'public' ? 'flex' : 'none';
            });
        });
    }

    async handleShare() {
        const shareType = document.querySelector('input[name="shareType"]:checked').value;
        const shareEmails = document.getElementById('shareEmails').value;
        const docRef = doc(db, 'documents', this.currentDocId);

        try {
            if (shareType === 'public') {
                await setDoc(docRef, {
                    isPublic: true,
                    isPublic: true,
                    sharedWith: []
                }, { merge: true });

                const shareLink = `${window.location.origin}/view/${this.currentDocId}`;
                document.getElementById('shareLink').value = shareLink;
                notifications.success('Shared', 'Document is now public');
            } else {
                const emails = shareEmails.split(',').map(email => email.trim()).filter(Boolean);
                
                // Validate each email against users collection
                const validUsers = [];
                const invalidEmails = [];

                for (const email of emails) {
                    const usersRef = collection(db, 'users');
                    const q = query(
                        usersRef,
                        where('email', '==', email),
                        limit(1)
                    );
                    
                    const querySnapshot = await getDocs(q);
                    if (!querySnapshot.empty) {
                        validUsers.push(querySnapshot.docs[0].id);
                    } else {
                        invalidEmails.push(email);
                    }
                }

                // Show warning if some emails were invalid
                if (invalidEmails.length > 0) {
                    notifications.warning(
                        'Some users not found', 
                        `The following users need a Nova account: ${invalidEmails.join(', ')}`
                    );
                }

                // Only proceed if we found valid users
                if (validUsers.length > 0) {
                    await setDoc(docRef, {
                        isPublic: false,
                        sharedWith: validUsers
                    }, { merge: true });
                    
                    notifications.success('Shared', `Document shared with ${validUsers.length} user(s)`);
                }
            }
            document.getElementById('shareDialog').style.display = 'none';
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

    openShareDialog() {
        const dialog = document.getElementById('shareDialog');
        dialog.style.display = 'block';
        this.updateSharedUsersList();
        // Reset form
        document.querySelector('input[name="shareType"][value="private"]').checked = true;
        document.getElementById('shareEmails').value = '';
        document.getElementById('shareLinkContainer').style.display = 'none';
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
                titleInput.blur();
            }
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

            notifications.success('Saved', 'Document title updated');
        } catch (error) {
            notifications.error('Save Failed', 'Could not update document title');
        }
    }    setupPageManagement() {
        try {
            if (!this.editor) {
                console.warn('Editor not found for page management setup');
                return;
            }

            // Debounce the page break checking with error handling
            const pageBreakHandler = () => {
                try {
                    if (this.pageBreakDebounce) {
                        clearTimeout(this.pageBreakDebounce);
                        this.timeouts.delete(this.pageBreakDebounce);
                    }
                    this.pageBreakDebounce = this.setTimeout(() => {
                        if (!this.isDestroyed) {
                            this.checkPageBreaks();
                        }
                    }, 1000);
                } catch (error) {
                    console.error('Error in page break handler:', error);
                }
            };

            this.editor.addEventListener('input', pageBreakHandler);
            this.eventListeners.set('page-input', { element: this.editor, event: 'input', handler: pageBreakHandler });

            this.editor.addEventListener('paste', pageBreakHandler);
            this.eventListeners.set('page-paste', { element: this.editor, event: 'paste', handler: pageBreakHandler });

        } catch (error) {
            console.error('Error setting up page management:', error);
        }
    }    checkPageBreaks() {
        try {
            if (this.isDestroyed || !this.editor || !this.editor.children || !this.editor.children.length) {
                return;
            }

            this.saveEditorState();

            // Create temporary container to hold content while processing
            const tempContainer = document.createElement('div');
            tempContainer.style.visibility = 'hidden';
            tempContainer.style.position = 'absolute';
            tempContainer.style.top = '-9999px';
            
            try {
                document.body.appendChild(tempContainer);

                // Get all content preserving order
                const allContent = [];
                Array.from(this.editor.children).forEach(page => {
                    if (page.classList.contains('page')) {
                        const pageContent = Array.from(page.childNodes);
                        allContent.push(...pageContent);
                    }
                });

                // Reset editor
                const newFirstPage = document.createElement('div');
                newFirstPage.className = 'page';
                newFirstPage.dataset.page = '1';
                
                this.editor.innerHTML = '';
                this.editor.appendChild(newFirstPage);
                
                let currentPage = newFirstPage;
                let totalHeight = 0;
                let pageNumber = 1;

                // Process content in original order
                allContent.forEach(node => {
                    if (this.isDestroyed) return; // Exit if destroyed during processing

                    try {
                        // Add node to temp container to measure it
                        tempContainer.appendChild(node.cloneNode(true));
                        const nodeHeight = tempContainer.offsetHeight || 20; // Default height if measurement fails
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
                        console.error('Error processing node:', nodeError);
                        // Continue with next node
                    }
                });

                // Update page indicator
                const pageIndicator = document.getElementById('pageIndicator');
                if (pageIndicator) {
                    pageIndicator.textContent = `Page ${pageNumber} of ${pageNumber}`;
                }

                this.restoreEditorState();

                // Ensure cursor position is maintained
                if (this.editor && !this.isDestroyed) {
                    this.editor.focus();
                }

            } finally {
                // Clean up temp container
                this.cleanupTempContainer(tempContainer);
            }

        } catch (error) {
            console.error('Error checking page breaks:', error);
            // Restore editor state even if page break calculation fails
            try {
                this.restoreEditorState();
            } catch (restoreError) {
                console.error('Error restoring editor state:', restoreError);
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
    }    setupFontHandling() {
        try {
            const fontSelect = document.getElementById('fontSelect');
            if (!fontSelect) {
                console.warn('Font select element not found');
                return;
            }

            const fontHandler = (e) => {
                try {
                    // Get the selected font
                    const font = e.target.value;
                    if (!font) return;

                    // Apply to current selection or whole editor if no selection
                    const selection = window.getSelection();
                    if (selection && selection.toString()) {
                        this.execCommand('fontName', font);
                    } else {
                        // Apply to current paragraph or whole editor
                        const node = selection ? selection.focusNode : null;
                        const currentBlock = node ? (node.nodeType === 1 ? node : node.parentElement) : null;
                        
                        if (currentBlock && this.editor && this.editor.contains(currentBlock)) {
                            currentBlock.style.fontFamily = font;
                        } else {
                            // No valid selection, apply to current page
                            const currentPage = this.editor ? this.editor.querySelector('.page') : null;
                            if (currentPage) {
                                currentPage.style.fontFamily = font;
                            }
                        }
                    }
                    
                    if (this.editor && !this.isDestroyed) {
                        this.editor.focus();
                    }
                } catch (error) {
                    console.error('Error applying font:', error);
                }
            };

            fontSelect.addEventListener('change', fontHandler);
            this.eventListeners.set('font-handling', { element: fontSelect, event: 'change', handler: fontHandler });

        } catch (error) {
            console.error('Error setting up font handling:', error);
        }
    }    initializeHistoryDialog() {
        try {
            const historyBtn = document.getElementById('historyBtn');
            const historyPanel = document.getElementById('historyPanel');
            const closeHistory = document.getElementById('closeHistory');
            const restoreVersion = document.getElementById('restoreVersion');

            if (historyBtn) {
                const historyHandler = () => {
                    try {
                        this.openHistoryPanel();
                    } catch (error) {
                        console.error('Error opening history panel:', error);
                    }
                };
                historyBtn.addEventListener('click', historyHandler);
                this.eventListeners.set('history-btn', { element: historyBtn, event: 'click', handler: historyHandler });
            }

            if (closeHistory) {
                const closeHandler = () => {
                    try {
                        this.closeHistoryPanel();
                    } catch (error) {
                        console.error('Error closing history panel:', error);
                    }
                };
                closeHistory.addEventListener('click', closeHandler);
                this.eventListeners.set('close-history', { element: closeHistory, event: 'click', handler: closeHandler });
            }

            if (restoreVersion) {
                const restoreHandler = () => {
                    try {
                        this.restoreRevision();
                    } catch (error) {
                        console.error('Error restoring revision:', error);
                    }
                };
                restoreVersion.addEventListener('click', restoreHandler);
                this.eventListeners.set('restore-version', { element: restoreVersion, event: 'click', handler: restoreHandler });
            }

            // Handle Escape key to close panel
            const escapeHandler = (e) => {
                try {
                    if (e.key === 'Escape' && historyPanel && historyPanel.classList.contains('active')) {
                        this.closeHistoryPanel();
                    }
                } catch (error) {
                    console.error('Error handling escape key:', error);
                }
            };
            document.addEventListener('keydown', escapeHandler);
            this.eventListeners.set('history-escape', { element: document, event: 'keydown', handler: escapeHandler });

        } catch (error) {
            console.error('Error initializing history dialog:', error);
        }
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

    // Performance optimization and health monitoring methods
    performHealthCheck() {
        try {
            const healthStatus = {
                timestamp: new Date().toISOString(),
                isDestroyed: this.isDestroyed,
                hasEditor: !!this.editor,
                hasCurrentUser: !!this.currentUser,
                hasCurrentDoc: !!this.currentDocId,
                eventListenersCount: this.eventListeners.size,
                timeoutsCount: this.timeouts.size,
                intervalsCount: this.intervals.size,
                memoryUsage: performance.memory ? {
                    used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                    total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                    limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
                } : null
            };

            // Log potential issues
            if (this.eventListeners.size > 20) {
                console.warn('High number of event listeners detected:', this.eventListeners.size);
            }
            
            if (this.timeouts.size > 10) {
                console.warn('High number of active timeouts detected:', this.timeouts.size);
            }

            return healthStatus;
        } catch (error) {
            console.error('Error performing health check:', error);
            return { error: error.message, timestamp: new Date().toISOString() };
        }
    }

    startHealthMonitoring() {
        try {
            // Perform health check every 5 minutes
            const healthCheckInterval = this.setInterval(() => {
                if (!this.isDestroyed) {
                    const health = this.performHealthCheck();
                    console.log('Test Editor Health Check:', health);
                }
            }, 300000); // 5 minutes

            return healthCheckInterval;
        } catch (error) {
            console.error('Error starting health monitoring:', error);
        }
    }

    // Global error recovery
    retryInitialization(error, attempt = 1) {
        const maxRetries = 3;
        
        if (attempt > maxRetries) {
            console.error('Max initialization retries exceeded');
            this.handleInitializationError(new Error('Failed to initialize after multiple attempts'));
            return;
        }

        console.log(`Retrying test editor initialization (attempt ${attempt}/${maxRetries})`);
        
        // Progressive delay: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        
        this.setTimeout(() => {
            try {
                this.init().catch(retryError => {
                    console.error(`Initialization retry ${attempt} failed:`, retryError);
                    this.retryInitialization(retryError, attempt + 1);
                });
            } catch (syncError) {
                console.error(`Synchronous error in retry ${attempt}:`, syncError);
                this.retryInitialization(syncError, attempt + 1);
            }
        }, delay);
    }

    // Enhanced error boundary
    wrapMethodWithErrorBoundary(methodName, originalMethod) {
        return async function(...args) {
            try {
                if (this.isDestroyed) {
                    console.warn(`Method ${methodName} called on destroyed editor`);
                    return;
                }
                return await originalMethod.apply(this, args);
            } catch (error) {
                console.error(`Error in ${methodName}:`, error);
                
                // Attempt recovery for critical methods
                const criticalMethods = ['saveDocument', 'loadUserDocuments', 'handleEditorChange'];
                if (criticalMethods.includes(methodName)) {
                    console.log(`Attempting recovery for critical method: ${methodName}`);
                    // Could implement specific recovery logic here
                }
                
                // Don't rethrow for non-critical errors to prevent cascade failures
                if (!methodName.includes('save') && !methodName.includes('load')) {
                    return null;
                }
                throw error;
            }
        };
    }

}

// Enhanced global error handling for test environment
window.addEventListener('error', (event) => {
    console.error('Test Environment - Global error:', event.error);
    if (window.testEditor) {
        window.testEditor.performHealthCheck();
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Test Environment - Unhandled promise rejection:', event.reason);
    if (window.testEditor) {
        window.testEditor.performHealthCheck();
    }
});

// Initialize test editor with comprehensive error handling
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.testEditor = new DocumentEditor();
        
        // Start health monitoring
        if (window.testEditor && typeof window.testEditor.startHealthMonitoring === 'function') {
            window.testEditor.startHealthMonitoring();
        }
        
        console.log('Test DocumentEditor initialized successfully');
    } catch (error) {
        console.error('Failed to initialize test DocumentEditor:', error);
        
        // Show user-friendly error message
        const editor = document.getElementById('editor');
        if (editor) {
            editor.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #666; font-family: Arial, sans-serif;">
                    <h3>🚧 Test Editor Initialization Failed</h3>
                    <p>We're having trouble starting the test editor. Please try the following:</p>
                    <ul style="text-align: left; display: inline-block;">
                        <li>Refresh the page</li>
                        <li>Clear your browser cache</li>
                        <li>Check your internet connection</li>
                    </ul>
                    <button onclick="window.location.reload()" 
                            style="padding: 10px 20px; margin-top: 15px; background: #007cba; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Refresh Page
                    </button>
                </div>
            `;
        }
    }
});
