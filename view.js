import { auth, db, doc, getDoc, setDoc, collection } from './firebase-config.js';

class DocumentViewer {
    constructor() {
        // Core properties
        this.history = [];
        this.currentHistoryIndex = -1;
        this.isUndoRedo = false;
        this.currentZoom = parseFloat(localStorage.getItem('viewerZoom')) || 1;
        this.currentPage = 1;
        this.totalPages = 1;
        this.searchMatches = [];
        this.currentMatch = -1;
        this.isFullscreen = false;
        
        // Stability improvements
        this.timeouts = new Set();
        this.intervals = new Set();
        this.eventListeners = new Map();
        this.isDestroyed = false;
        this.documentData = null;
        this.retryAttempts = 0;
        this.maxRetries = 3;
        
        // Setup cleanup handlers
        this.setupCleanupHandlers();
        
        this.init();
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
        
        console.log('Cleaning up DocumentViewer...');
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
            
            // Clear references
            this.documentData = null;
            this.history = [];
            this.searchMatches = [];
            
        } catch (error) {
            console.error('Error during viewer cleanup:', error);
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

    async init() {
        try {
            if (this.isDestroyed) return;
            
            await this.loadDocument();
            
            if (this.isDestroyed) return;
            
            this.setupCopyProtection();
            this.setupZoomControls();
            this.setupPrintButton();
            this.setupFullscreenButton();
            this.setupSearchFunctionality();
            this.setupPageNavigation();
        } catch (error) {
            console.error('Failed to initialize document viewer:', error);
            this.handleInitializationError(error);
        }
    }

    handleInitializationError(error) {
        this.showAccessDeniedOverlay(
            'Initialization Failed',
            'Failed to load document viewer',
            'Please refresh the page to try again.'
        );
    }

    updatePageMetadata(title) {
        try {
            // Update page title
            document.title = `${title} - Nova Docs`;
            
            // Update meta tags with safe access
            const description = `View "${title}" on Nova Docs`;
            
            // Update SEO description
            const metaDescription = document.getElementById('metaDescription');
            if (metaDescription) {
                metaDescription.content = description;
            }
            
            // Update OpenGraph
            const ogTitle = document.getElementById('ogTitle');
            const ogDescription = document.getElementById('ogDescription');
            if (ogTitle) ogTitle.content = `${title} - Nova Docs`;
            if (ogDescription) ogDescription.content = description;
            
            // Update Twitter
            const twitterTitle = document.getElementById('twitterTitle');
            const twitterDescription = document.getElementById('twitterDescription');
            if (twitterTitle) twitterTitle.content = `${title} - Nova Docs`;
            if (twitterDescription) twitterDescription.content = description;
        } catch (error) {
            console.error('Error updating page metadata:', error);
        }
    }    async loadDocument() {
        try {
            if (this.isDestroyed) return;

            const urlParams = new URLSearchParams(window.location.search);
            const docId = urlParams.get('id');
            const embed = urlParams.get('embed') === 'true';

            if (!docId) {
                this.showAccessDeniedOverlay('Invalid Link', 'No document ID provided');
                return;
            }

            // Check if Firebase is available
            if (typeof db === 'undefined') {
                throw new Error('Database connection not available');
            }

            const docRef = doc(db, 'documents', docId);
            const docSnap = await getDoc(docRef);

            if (this.isDestroyed) return;

            if (docSnap.exists()) {
                const data = docSnap.data();
                
                if (!data) {
                    throw new Error('Document data is empty');
                }
                
                // Check access permissions with enhanced validation
                if (!data.isPublic && 
                    (!auth.currentUser || 
                     (data.userId !== auth.currentUser.uid && 
                      !data.sharedWith?.includes(auth.currentUser.uid)))) {
                    this.showAccessDeniedOverlay(
                        'Access Denied',
                        'This document is private',
                        'Please ask the document owner to share it with you or make it public.'
                    );
                    return;
                }

                // Store document data
                this.documentData = data;

                // Update page title and metadata with error handling
                try {
                    const title = data.title || 'Untitled Document';
                    this.updatePageMetadata(title);

                    // Set visible title safely
                    const titleElement = document.querySelector('#docTitle');
                    if (titleElement) {
                        titleElement.textContent = title;
                    }
                } catch (metadataError) {
                    console.error('Error updating metadata:', metadataError);
                }

                // Handle embed mode with error handling
                if (embed) {
                    try {
                        this.setupEmbedMode();
                    } catch (embedError) {
                        console.error('Error setting up embed mode:', embedError);
                    }
                }

                // Render document with validation
                if (!this.isDestroyed) {
                    this.renderDocument(data);
                }
            } else {
                this.showAccessDeniedOverlay('Not Found', 'This document does not exist');
            }
        } catch (error) {
            console.error('Error loading document:', error);
            
            // Categorize error for better user feedback
            let errorMessage = 'Failed to load document';
            let errorDetails = 'Please try again later.';
            
            if (error.code === 'permission-denied') {
                errorMessage = 'Access Denied';
                errorDetails = 'You do not have permission to view this document.';
            } else if (error.code === 'unavailable') {
                errorMessage = 'Service Unavailable';
                errorDetails = 'The document service is temporarily unavailable.';
            } else if (error.message.includes('network')) {
                errorMessage = 'Network Error';
                errorDetails = 'Please check your internet connection.';
            }
            
            this.showAccessDeniedOverlay(errorMessage, 'Unable to load document', errorDetails);
        }
    }    renderDocument(data) {
        try {
            if (this.isDestroyed) return;

            const contentArea = document.querySelector('.document-content');
            if (!contentArea) {
                console.error('Document content area not found');
                return;
            }

            if (!data || !data.content) {
                contentArea.innerHTML = '<div class="page" data-page="1"><p>No content</p></div>';
                return;
            }

            // Safely render content with validation
            try {
                contentArea.innerHTML = data.content;
            } catch (renderError) {
                console.error('Error rendering document content:', renderError);
                contentArea.innerHTML = '<div class="page" data-page="1"><p>Error rendering document content</p></div>';
                return;
            }

            // Verify page structure with error handling
            let pages;
            try {
                pages = contentArea.querySelectorAll('.page');
                if (pages.length === 0) {
                    // If no pages found, wrap content in a page div
                    const content = contentArea.innerHTML;
                    contentArea.innerHTML = `<div class="page" data-page="1">${content}</div>`;
                    pages = contentArea.querySelectorAll('.page');
                }
            } catch (pageError) {
                console.error('Error processing pages:', pageError);
                return;
            }

            // Update page numbers safely
            try {
                pages.forEach((page, index) => {
                    if (page && page.dataset) {
                        page.dataset.page = index + 1;
                    }
                });
            } catch (pageNumberError) {
                console.error('Error updating page numbers:', pageNumberError);
            }

            // Use pages count for metadata with validation
            const pageCount = pages ? pages.length : 1;
            try {
                const pageIndicator = document.querySelector('.page-indicator');
                if (pageIndicator) {
                    pageIndicator.textContent = `Page 1 of ${pageCount}`;
                }
            } catch (indicatorError) {
                console.error('Error updating page indicator:', indicatorError);
            }

            // Set document title safely
            try {
                const titleElement = document.querySelector('.document-title');
                if (titleElement) {
                    titleElement.textContent = data.title || 'Untitled Document';
                }
            } catch (titleError) {
                console.error('Error setting document title:', titleError);
            }

            // Set document metadata with error handling
            try {
                const metadataElement = document.querySelector('.document-metadata');
                if (metadataElement && data.lastModified) {
                    const lastModified = new Date(data.lastModified).toLocaleDateString();
                    metadataElement.innerHTML = `
                        <span>Last modified: ${lastModified}</span>
                        <div class="document-badges">
                            ${data.isPublic ? '<span class="public-badge">Public</span>' : ''}
                            ${!data.isPublic && data.userId !== auth.currentUser?.uid ? 
                                '<span class="shared-badge"><i class="fas fa-lock"></i> Shared with you (Read-only)</span>' : 
                                ''}
                        </div>
                    `;
                }
            } catch (metadataError) {
                console.error('Error setting document metadata:', metadataError);
            }

            // Setup copy protection based on document settings
            try {
                if (data.allowCopy) {
                    contentArea.style.setProperty('--allow-copy', 'text');
                } else {
                    contentArea.style.setProperty('--allow-copy', 'none');
                }
            } catch (copyError) {
                console.error('Error setting copy protection:', copyError);
            }

            // Add initial state to history after rendering
            if (!this.isDestroyed) {
                try {
                    this.pushToHistory(contentArea.innerHTML);
                    
                    // Setup undo/redo after content is loaded
                    this.setupUndoRedo();
                } catch (historyError) {
                    console.error('Error setting up history:', historyError);
                }
            }

            // Use the same pages collection for page counting
            this.totalPages = pageCount;
            this.currentPage = 1;
            
            if (!this.isDestroyed) {
                try {
                    this.updatePageButtons();
                } catch (buttonError) {
                    console.error('Error updating page buttons:', buttonError);
                }
            }
        } catch (error) {
            console.error('Error in renderDocument:', error);
            // Fallback rendering
            try {
                const contentArea = document.querySelector('.document-content');
                if (contentArea) {
                    contentArea.innerHTML = '<div class="page" data-page="1"><p>Error loading document content</p></div>';
                }
            } catch (fallbackError) {
                console.error('Error in fallback rendering:', fallbackError);
            }
        }
    }    showAccessDeniedOverlay(title, message, details = '') {
        if (this.isDestroyed) return;

        try {
            // Clear existing content first
            const contentArea = document.querySelector('.document-content');
            if (contentArea) {
                contentArea.classList.add('hidden');
            }
        
            // Remove any existing overlay
            const existingOverlay = document.querySelector('.access-denied-overlay');
            if (existingOverlay) {
                try {
                    existingOverlay.remove();
                } catch (removeError) {
                    console.warn('Could not remove existing overlay:', removeError);
                }
            }
        
            // Create and add overlay to document
            const overlay = document.createElement('div');
            overlay.className = 'access-denied-overlay';
            overlay.innerHTML = `
                <div class="access-denied-content">
                    <div class="access-denied-icon">
                        <i class="fas fa-lock"></i>
                    </div>
                    <h2>${title}</h2>
                    <p>${message}</p>
                    ${details ? `<p class="details">${details}</p>` : ''}
                    <div class="access-denied-actions">
                        <a href="documents.html" class="primary-button">
                            <i class="fas fa-home"></i>
                            Go to Documents
                        </a>
                        ${auth.currentUser ? '' : `
                            <a href="index.html" class="secondary-button">
                                <i class="fas fa-sign-in-alt"></i>
                                Sign In
                            </a>
                        `}
                    </div>
                </div>
            `;
            
            if (document.body) {
                document.body.appendChild(overlay);
            } else {
                console.error('Document body not available for overlay');
            }
        } catch (error) {
            console.error('Error showing access denied overlay:', error);
            // Fallback to simple alert if overlay creation fails
            try {
                alert(`${title}: ${message}`);
            } catch (alertError) {
                console.error('Could not show fallback alert:', alertError);
            }
        }
    }setupCopyProtection() {
        if (this.isDestroyed) return;

        try {
            const copyHandler = (e) => {
                if (this.isDestroyed) return;
                if (!this.documentData?.allowCopy) {
                    e.preventDefault();
                    try {
                        notifications.warning('Copy Disabled', 'The document owner has disabled copying');
                    } catch (notificationError) {
                        console.warn('Could not show copy notification:', notificationError);
                    }
                }
            };

            const pasteHandler = (e) => {
                if (this.isDestroyed) return;
                if (!this.documentData?.allowCopy) {
                    e.preventDefault();
                    try {
                        notifications.warning('Paste Disabled', 'The document owner has disabled pasting');
                    } catch (notificationError) {
                        console.warn('Could not show paste notification:', notificationError);
                    }
                }
            };

            document.addEventListener('copy', copyHandler);
            document.addEventListener('paste', pasteHandler);

            // Track event listeners for cleanup
            this.eventListeners.set('copy', copyHandler);
            this.eventListeners.set('paste', pasteHandler);
        } catch (error) {
            console.error('Error setting up copy protection:', error);
        }
    }    setupCopyButton() {
        if (this.isDestroyed) return;

        try {
            const copyBtn = document.getElementById('makeACopy');
            if (!copyBtn) {
                console.warn('Copy button not found');
                return;
            }

            const copyHandler = async () => {
                if (this.isDestroyed) return;

                try {
                    // Check if user is logged in
                    if (!auth.currentUser) {
                        window.location.href = 'index.html';
                        return;
                    }

                    // Validate document data
                    if (!this.documentData) {
                        throw new Error('No document data available for copying');
                    }

                    // Create new document
                    const newDoc = {
                        ...this.documentData,
                        title: `Copy of ${this.documentData.title || 'Untitled Document'}`,
                        userId: auth.currentUser.uid,
                        createdAt: new Date().toISOString(),
                        lastModified: new Date().toISOString(),
                        isPublic: false,
                        sharedWith: []
                    };

                    // Remove original document's ID and metadata
                    delete newDoc.id;

                    // Create new document in database
                    const docRef = doc(collection(db, 'documents'));
                    await setDoc(docRef, newDoc);

                    // Show success notification before redirect
                    try {
                        notifications.success('Copy Created', 'Document copied successfully');
                    } catch (notificationError) {
                        console.warn('Could not show success notification:', notificationError);
                    }

                    // Redirect to editor
                    window.location.href = `editor.html?id=${docRef.id}`;
                } catch (error) {
                    console.error('Error copying document:', error);
                    try {
                        notifications.error('Copy Failed', 'Could not create a copy of the document');
                    } catch (notificationError) {
                        console.warn('Could not show error notification:', notificationError);
                    }
                }
            };

            copyBtn.addEventListener('click', copyHandler);
            
            // Track event listener for cleanup
            this.eventListeners.set('makeACopy', copyHandler);
        } catch (error) {
            console.error('Error setting up copy button:', error);
        }
    }    setupEmbedMode() {
        if (this.isDestroyed) return;

        try {
            document.body.classList.add('embed-mode');
            
            // Safely remove header and other unnecessary elements
            const header = document.querySelector('header');
            if (header) {
                try {
                    header.remove();
                } catch (removeError) {
                    console.warn('Could not remove header:', removeError);
                }
            }
            
            // Add embed styling
            this.addEmbedStyles();
        } catch (error) {
            console.error('Error setting up embed mode:', error);
        }
    }

    addEmbedStyles() {
        if (this.isDestroyed) return;

        try {
            const style = document.createElement('style');
            style.textContent = `
                .embed-mode {
                    margin: 0;
                    padding: 0;
                    height: 100vh;
                    overflow-y: auto;
                }
                .embed-mode .document-content {
                    padding: 0;
                    margin: 0;
                    border: none;
                    box-shadow: none;
                }
                .embed-mode .page {
                    margin: 0;
                    padding: 1rem;
                    box-shadow: none;
                }
            `;
            
            if (document.head) {
                document.head.appendChild(style);
            } else {
                console.warn('Document head not available for embed styles');
            }
        } catch (error) {
            console.error('Error adding embed styles:', error);
        }
    }    setupUndoRedo() {
        if (this.isDestroyed) return;

        try {
            // Get buttons with validation
            const undoBtn = document.getElementById('undoBtn');
            const redoBtn = document.getElementById('redoBtn');

            // Add click handlers
            if (undoBtn) {
                const undoHandler = () => {
                    if (!this.isDestroyed) {
                        this.undo();
                    }
                };
                undoBtn.addEventListener('click', undoHandler);
                this.eventListeners.set('undoBtn', undoHandler);
            }

            if (redoBtn) {
                const redoHandler = () => {
                    if (!this.isDestroyed) {
                        this.redo();
                    }
                };
                redoBtn.addEventListener('click', redoHandler);
                this.eventListeners.set('redoBtn', redoHandler);
            }

            // Add keyboard shortcuts
            const keydownHandler = (e) => {
                if (this.isDestroyed) return;
                
                if (e.ctrlKey || e.metaKey) {
                    if (e.key === 'z' && !e.shiftKey) {
                        e.preventDefault();
                        this.undo();
                    } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
                        e.preventDefault();
                        this.redo();
                    }
                }
            };

            document.addEventListener('keydown', keydownHandler);
            this.eventListeners.set('undoRedoKeydown', keydownHandler);

            // Initial state
            this.updateUndoRedoButtons();
        } catch (error) {
            console.error('Error setting up undo/redo:', error);
        }
    }    pushToHistory(content) {
        if (this.isDestroyed || this.isUndoRedo) return;
        
        try {
            // Remove any future redos
            this.history = this.history.slice(0, this.currentHistoryIndex + 1);
            
            // Add new state
            this.history.push(content);
            this.currentHistoryIndex++;
            
            // Limit history size
            if (this.history.length > 100) {
                this.history.shift();
                this.currentHistoryIndex--;
            }
            
            this.updateUndoRedoButtons();
        } catch (error) {
            console.error('Error pushing to history:', error);
        }
    }

    undo() {
        if (this.isDestroyed || this.currentHistoryIndex <= 0) return;
        
        try {
            this.isUndoRedo = true;
            this.currentHistoryIndex--;
            
            const content = this.history[this.currentHistoryIndex];
            const contentArea = document.querySelector('.document-content');
            if (contentArea && content) {
                contentArea.innerHTML = content;
            }
            
            this.updateUndoRedoButtons();
        } catch (error) {
            console.error('Error in undo operation:', error);
        } finally {
            this.isUndoRedo = false;
        }
    }

    redo() {
        if (this.isDestroyed || this.currentHistoryIndex >= this.history.length - 1) return;
        
        try {
            this.isUndoRedo = true;
            this.currentHistoryIndex++;
            
            const content = this.history[this.currentHistoryIndex];
            const contentArea = document.querySelector('.document-content');
            if (contentArea && content) {
                contentArea.innerHTML = content;
            }
            
            this.updateUndoRedoButtons();
        } catch (error) {
            console.error('Error in redo operation:', error);
        } finally {
            this.isUndoRedo = false;
        }
    }

    updateUndoRedoButtons() {
        if (this.isDestroyed) return;

        try {
            const undoBtn = document.getElementById('undoBtn');
            const redoBtn = document.getElementById('redoBtn');
            
            if (undoBtn) {
                undoBtn.disabled = this.currentHistoryIndex <= 0;
            }
            if (redoBtn) {
                redoBtn.disabled = this.currentHistoryIndex >= this.history.length - 1;
            }
        } catch (error) {
            console.error('Error updating undo/redo buttons:', error);
        }
    }    setupZoomControls() {
        if (this.isDestroyed) return;

        try {
            const zoomOut = document.getElementById('zoomOutBtn');
            const zoomIn = document.getElementById('zoomInBtn');
            const zoomLevel = document.getElementById('zoomLevel');

            if (!zoomOut || !zoomIn || !zoomLevel) {
                console.warn('One or more zoom controls not found');
                return;
            }

            // Initialize zoom level
            this.applyZoom(this.currentZoom);
            zoomLevel.value = this.currentZoom === 1 ? '1' : this.currentZoom.toString();

            const zoomOutHandler = () => {
                if (this.isDestroyed) return;
                try {
                    const currentIndex = zoomLevel.selectedIndex;
                    if (currentIndex > 0) {
                        zoomLevel.selectedIndex = currentIndex - 1;
                        this.handleZoomChange(zoomLevel.value);
                    }
                } catch (error) {
                    console.error('Error in zoom out:', error);
                }
            };

            const zoomInHandler = () => {
                if (this.isDestroyed) return;
                try {
                    const currentIndex = zoomLevel.selectedIndex;
                    if (currentIndex < zoomLevel.options.length - 1) {
                        zoomLevel.selectedIndex = currentIndex + 1;
                        this.handleZoomChange(zoomLevel.value);
                    }
                } catch (error) {
                    console.error('Error in zoom in:', error);
                }
            };

            const zoomChangeHandler = (e) => {
                if (this.isDestroyed) return;
                try {
                    this.handleZoomChange(e.target.value);
                } catch (error) {
                    console.error('Error in zoom change:', error);
                }
            };

            zoomOut.addEventListener('click', zoomOutHandler);
            zoomIn.addEventListener('click', zoomInHandler);
            zoomLevel.addEventListener('change', zoomChangeHandler);

            // Track event listeners for cleanup
            this.eventListeners.set('zoomOutBtn', zoomOutHandler);
            this.eventListeners.set('zoomInBtn', zoomInHandler);
            this.eventListeners.set('zoomLevel', zoomChangeHandler);

            // Handle zoom keyboard shortcuts
            const keydownHandler = (e) => {
                if (this.isDestroyed) return;
                
                if (e.ctrlKey || e.metaKey) {
                    try {
                        if (e.key === '0') {
                            e.preventDefault();
                            this.handleZoomChange('1');
                            zoomLevel.value = '1';
                        } else if (e.key === '+' || e.key === '=') {
                            e.preventDefault();
                            zoomInHandler();
                        } else if (e.key === '-') {
                            e.preventDefault();
                            zoomOutHandler();
                        }
                    } catch (error) {
                        console.error('Error in zoom keyboard shortcut:', error);
                    }
                }
            };

            document.addEventListener('keydown', keydownHandler);
            this.eventListeners.set('zoomKeydown', keydownHandler);

            // Handle zoom with mouse wheel
            const wheelHandler = (e) => {
                if (this.isDestroyed) return;
                
                if (e.ctrlKey || e.metaKey) {
                    try {
                        e.preventDefault();
                        if (e.deltaY < 0) {
                            zoomInHandler();
                        } else {
                            zoomOutHandler();
                        }
                    } catch (error) {
                        console.error('Error in zoom wheel:', error);
                    }
                }
            };

            document.addEventListener('wheel', wheelHandler, { passive: false });
            this.eventListeners.set('zoomWheel', wheelHandler);
        } catch (error) {
            console.error('Error setting up zoom controls:', error);
        }
    }    handleZoomChange(value) {
        if (this.isDestroyed) return;

        try {
            if (value === 'fit' || value === 'fill') {
                this.applyFitZoom(value);
            } else {
                const zoomValue = parseFloat(value);
                if (!isNaN(zoomValue) && zoomValue > 0) {
                    this.applyZoom(zoomValue);
                }
            }
        } catch (error) {
            console.error('Error handling zoom change:', error);
        }
    }

    applyZoom(scale) {
        if (this.isDestroyed) return;

        try {
            this.currentZoom = scale;
            localStorage.setItem('viewerZoom', scale.toString());
            
            const content = document.querySelector('.document-content');
            if (content) {
                content.style.transform = `scale(${scale})`;
                content.style.transformOrigin = 'top center';
            }
        } catch (error) {
            console.error('Error applying zoom:', error);
        }
    }

    applyFitZoom(type) {
        if (this.isDestroyed) return;

        try {
            const content = document.querySelector('.document-content');
            if (!content) return;

            const container = content.parentElement;
            if (!container) return;

            const page = content.querySelector('.page');
            if (!page) return;

            const containerWidth = container.clientWidth;
            const pageWidth = page.offsetWidth;
            
            let scale;
            if (type === 'fit') {
                scale = (containerWidth - 40) / pageWidth; // 40px for padding
            } else { // fill
                scale = containerWidth / pageWidth;
            }

            if (scale > 0) {
                this.applyZoom(scale);
                const zoomLevel = document.getElementById('zoomLevel');
                if (zoomLevel) {
                    zoomLevel.value = type;
                }
            }
        } catch (error) {
            console.error('Error applying fit zoom:', error);
        }
    }    setupPrintButton() {
        if (this.isDestroyed) return;

        try {
            const printBtn = document.getElementById('printBtn');
            if (!printBtn) {
                console.warn('Print button not found');
                return;
            }

            const printHandler = () => {
                if (this.isDestroyed) return;
                try {
                    window.print();
                } catch (error) {
                    console.error('Error printing document:', error);
                    try {
                        notifications.error('Print Failed', 'Could not print the document');
                    } catch (notificationError) {
                        console.warn('Could not show print error notification:', notificationError);
                    }
                }
            };

            printBtn.addEventListener('click', printHandler);
            this.eventListeners.set('printBtn', printHandler);
        } catch (error) {
            console.error('Error setting up print button:', error);
        }
    }

    setupFullscreenButton() {
        if (this.isDestroyed) return;

        try {
            const fullscreenBtn = document.getElementById('fullscreenBtn');
            const container = document.querySelector('.editor-container');
            
            if (!fullscreenBtn) {
                console.warn('Fullscreen button not found');
                return;
            }

            if (!container) {
                console.warn('Editor container not found for fullscreen');
                return;
            }

            const fullscreenHandler = () => {
                if (this.isDestroyed) return;

                try {
                    if (!this.isFullscreen) {
                        if (container.requestFullscreen) {
                            container.requestFullscreen().catch(error => {
                                console.error('Error entering fullscreen:', error);
                            });
                        }
                        fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
                    } else {
                        if (document.exitFullscreen) {
                            document.exitFullscreen().catch(error => {
                                console.error('Error exiting fullscreen:', error);
                            });
                        }
                        fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
                    }
                    this.isFullscreen = !this.isFullscreen;
                } catch (error) {
                    console.error('Error toggling fullscreen:', error);
                }
            };

            const fullscreenChangeHandler = () => {
                if (this.isDestroyed) return;

                try {
                    this.isFullscreen = !!document.fullscreenElement;
                    fullscreenBtn.innerHTML = this.isFullscreen ? 
                        '<i class="fas fa-compress"></i>' : 
                        '<i class="fas fa-expand"></i>';
                } catch (error) {
                    console.error('Error handling fullscreen change:', error);
                }
            };

            fullscreenBtn.addEventListener('click', fullscreenHandler);
            document.addEventListener('fullscreenchange', fullscreenChangeHandler);

            // Track event listeners for cleanup
            this.eventListeners.set('fullscreenBtn', fullscreenHandler);
            this.eventListeners.set('fullscreenchange', fullscreenChangeHandler);
        } catch (error) {
            console.error('Error setting up fullscreen button:', error);
        }
    }    setupSearchFunctionality() {
        if (this.isDestroyed) return;

        try {
            const searchInput = document.getElementById('searchInput');
            const prevMatch = document.getElementById('prevMatch');
            const nextMatch = document.getElementById('nextMatch');
            const matchCount = document.getElementById('matchCount');

            if (!searchInput || !prevMatch || !nextMatch || !matchCount) {
                console.warn('One or more search elements not found');
                return;
            }

            let searchTimeout;

            const searchHandler = () => {
                if (this.isDestroyed) return;
                
                clearTimeout(searchTimeout);
                searchTimeout = this.managedSetTimeout(() => {
                    if (!this.isDestroyed) {
                        this.performSearch(searchInput.value);
                    }
                }, 300);
            };

            const prevHandler = () => {
                if (!this.isDestroyed) {
                    this.navigateSearch('prev');
                }
            };

            const nextHandler = () => {
                if (!this.isDestroyed) {
                    this.navigateSearch('next');
                }
            };

            searchInput.addEventListener('input', searchHandler);
            prevMatch.addEventListener('click', prevHandler);
            nextMatch.addEventListener('click', nextHandler);

            // Track event listeners for cleanup
            this.eventListeners.set('searchInput', searchHandler);
            this.eventListeners.set('prevMatch', prevHandler);
            this.eventListeners.set('nextMatch', nextHandler);
        } catch (error) {
            console.error('Error setting up search functionality:', error);
        }
    }    performSearch(query) {
        if (this.isDestroyed) return;

        try {
            // Clear existing highlights
            const existingHighlights = document.querySelectorAll('.search-highlight');
            existingHighlights.forEach(el => {
                try {
                    el.outerHTML = el.innerHTML;
                } catch (error) {
                    console.warn('Could not clear highlight:', error);
                }
            });

            if (!query) {
                this.searchMatches = [];
                this.currentMatch = -1;
                this.updateSearchButtons();
                return;
            }

            const content = document.querySelector('.document-content');
            if (!content) {
                console.warn('Document content not found for search');
                return;
            }

            const text = content.innerHTML;
            const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            let match;
            this.searchMatches = [];

            // Replace all matches with highlighted spans
            const highlightedText = text.replace(regex, (match) => {
                this.searchMatches.push(match);
                return `<span class="search-highlight">${match}</span>`;
            });

            content.innerHTML = highlightedText;

            this.currentMatch = this.searchMatches.length ? 0 : -1;
            this.updateSearchButtons();
            this.highlightCurrentMatch();
        } catch (error) {
            console.error('Error performing search:', error);
        }
    }

    navigateSearch(direction) {
        if (this.isDestroyed || !this.searchMatches.length) return;

        try {
            if (direction === 'next') {
                this.currentMatch = (this.currentMatch + 1) % this.searchMatches.length;
            } else {
                this.currentMatch = this.currentMatch - 1;
                if (this.currentMatch < 0) this.currentMatch = this.searchMatches.length - 1;
            }

            this.highlightCurrentMatch();
        } catch (error) {
            console.error('Error navigating search:', error);
        }
    }

    highlightCurrentMatch() {
        if (this.isDestroyed) return;

        try {
            const highlights = document.querySelectorAll('.search-highlight');
            highlights.forEach(h => h.classList.remove('active'));
            
            if (this.currentMatch >= 0 && highlights[this.currentMatch]) {
                const currentHighlight = highlights[this.currentMatch];
                currentHighlight.classList.add('active');
                currentHighlight.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }

            const matchCount = document.getElementById('matchCount');
            if (matchCount) {
                matchCount.textContent = 
                    this.searchMatches.length ? 
                    `${this.currentMatch + 1}/${this.searchMatches.length}` : 
                    '';
            }
        } catch (error) {
            console.error('Error highlighting current match:', error);
        }
    }

    updateSearchButtons() {
        if (this.isDestroyed) return;

        try {
            const hasMatches = this.searchMatches.length > 0;
            const prevMatch = document.getElementById('prevMatch');
            const nextMatch = document.getElementById('nextMatch');
            const matchCount = document.getElementById('matchCount');

            if (prevMatch) {
                prevMatch.disabled = !hasMatches;
            }
            if (nextMatch) {
                nextMatch.disabled = !hasMatches;
            }
            if (matchCount) {
                matchCount.textContent = 
                    hasMatches ? `${this.currentMatch + 1}/${this.searchMatches.length}` : '';
            }
        } catch (error) {
            console.error('Error updating search buttons:', error);
        }
    }    setupPageNavigation() {
        if (this.isDestroyed) return;

        try {
            const prevPage = document.getElementById('prevPage');
            const nextPage = document.getElementById('nextPage');
            
            if (!prevPage || !nextPage) {
                console.warn('Page navigation buttons not found');
                return;
            }

            const prevHandler = () => {
                if (!this.isDestroyed) {
                    this.changePage('prev');
                }
            };

            const nextHandler = () => {
                if (!this.isDestroyed) {
                    this.changePage('next');
                }
            };

            prevPage.addEventListener('click', prevHandler);
            nextPage.addEventListener('click', nextHandler);

            // Track event listeners for cleanup
            this.eventListeners.set('prevPage', prevHandler);
            this.eventListeners.set('nextPage', nextHandler);
        } catch (error) {
            console.error('Error setting up page navigation:', error);
        }
    }

    changePage(direction) {
        if (this.isDestroyed) return;

        try {
            if (direction === 'next' && this.currentPage < this.totalPages) {
                this.currentPage++;
            } else if (direction === 'prev' && this.currentPage > 1) {
                this.currentPage--;
            }

            const pages = document.querySelectorAll('.page');
            if (pages.length > 0 && this.currentPage <= pages.length) {
                const targetPage = pages[this.currentPage - 1];
                if (targetPage) {
                    targetPage.scrollIntoView({ behavior: 'smooth' });
                }
            }

            this.updatePageButtons();
        } catch (error) {
            console.error('Error changing page:', error);
        }
    }

    updatePageButtons() {
        if (this.isDestroyed) return;

        try {
            const prevPage = document.getElementById('prevPage');
            const nextPage = document.getElementById('nextPage');
            const pageIndicator = document.getElementById('pageIndicator');

            if (prevPage) {
                prevPage.disabled = this.currentPage === 1;
            }
            if (nextPage) {
                nextPage.disabled = this.currentPage === this.totalPages;
            }
            if (pageIndicator) {
                pageIndicator.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
            }
        } catch (error) {
            console.error('Error updating page buttons:', error);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DocumentViewer();
});
