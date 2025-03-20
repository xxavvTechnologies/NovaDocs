import { auth, db, doc, getDoc, setDoc, collection } from './firebase-config.js';

class DocumentViewer {
    constructor() {
        this.history = [];
        this.currentHistoryIndex = -1;
        this.isUndoRedo = false;
        this.currentZoom = parseFloat(localStorage.getItem('viewerZoom')) || 1;
        this.currentPage = 1;
        this.totalPages = 1;
        this.searchMatches = [];
        this.currentMatch = -1;
        this.isFullscreen = false;
        this.init();
    }

    async init() {
        try {
            await this.loadDocument();
            this.setupCopyProtection();
            this.setupZoomControls();
            this.setupPrintButton();
            this.setupFullscreenButton();
            this.setupSearchFunctionality();
            this.setupPageNavigation();
        } catch (error) {
            console.error('Failed to load document:', error);
            this.showAccessDeniedOverlay(
                'Error',
                'Failed to load document',
                'Please try again later or contact support if the problem persists.'
            );
        }
    }

    updatePageMetadata(title) {
        // Update page title
        document.title = `${title} - Nova Docs`;
        
        // Update meta tags
        const description = `View "${title}" on Nova Docs`;
        
        // Update SEO description
        document.getElementById('metaDescription').content = description;
        
        // Update OpenGraph
        document.getElementById('ogTitle').content = `${title} - Nova Docs`;
        document.getElementById('ogDescription').content = description;
        
        // Update Twitter
        document.getElementById('twitterTitle').content = `${title} - Nova Docs`;
        document.getElementById('twitterDescription').content = description;
    }

    async loadDocument() {
        const urlParams = new URLSearchParams(window.location.search);
        const docId = urlParams.get('id');
        const embed = urlParams.get('embed') === 'true';

        if (!docId) {
            this.showAccessDeniedOverlay('Invalid Link', 'No document ID provided');
            return;
        }

        try {
            const docRef = doc(db, 'documents', docId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // Check access permissions
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

                // Update page title and metadata
                const title = data.title || 'Untitled Document';
                this.updatePageMetadata(title);

                // Set visible title
                const titleElement = document.querySelector('#docTitle');
                if (titleElement) {
                    titleElement.textContent = title;
                }

                // Handle embed mode
                if (embed) {
                    this.setupEmbedMode();
                }

                // Render document
                this.renderDocument(data);
            } else {
                this.showAccessDeniedOverlay('Not Found', 'This document does not exist');
            }
        } catch (error) {
            console.error('Error loading document:', error);
            this.showAccessDeniedOverlay(
                'Error',
                'Failed to load document',
                'Please try again later.'
            );
        }
    }

    renderDocument(data) {
        const contentArea = document.querySelector('.document-content');
        if (!contentArea) return;

        if (!data.content) {
            contentArea.innerHTML = '<div class="page" data-page="1"><p>No content</p></div>';
            return;
        }

        // Render content (it should already contain page divs from the editor)
        contentArea.innerHTML = data.content;

        // Verify page structure
        const pages = contentArea.querySelectorAll('.page');
        if (pages.length === 0) {
            // If no pages found, wrap content in a page div
            const content = contentArea.innerHTML;
            contentArea.innerHTML = `<div class="page" data-page="1">${content}</div>`;
        }

        // Update page numbers
        pages.forEach((page, index) => {
            page.dataset.page = index + 1;
        });

        // Use pages count for metadata
        const pageCount = pages.length;
        const pageIndicator = document.querySelector('.page-indicator');
        if (pageIndicator) {
            pageIndicator.textContent = `Page 1 of ${pageCount}`;
        }

        // Set document title if it exists
        const titleElement = document.querySelector('.document-title');
        if (titleElement) {
            titleElement.textContent = data.title || 'Untitled Document';
        }

        // Set document metadata
        const metadataElement = document.querySelector('.document-metadata');
        if (metadataElement) {
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

        // Setup copy protection based on document settings
        if (data.allowCopy) {
            contentArea.style.setProperty('--allow-copy', 'text');
        } else {
            contentArea.style.setProperty('--allow-copy', 'none');
        }

        // Add initial state to history after rendering
        this.pushToHistory(contentArea.innerHTML);
        
        // Setup undo/redo after content is loaded
        this.setupUndoRedo();

        // Use the same pages collection for page counting
        this.totalPages = pageCount;
        this.currentPage = 1;
        this.updatePageButtons();
    }

    showAccessDeniedOverlay(title, message, details = '') {
        // Clear existing content first
        const contentArea = document.querySelector('.document-content');
        if (contentArea) {
            contentArea.classList.add('hidden');
        }
    
        // Remove any existing overlay
        const existingOverlay = document.querySelector('.access-denied-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
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
        document.body.appendChild(overlay);
    }

    setupCopyProtection() {
        document.addEventListener('copy', (e) => {
            if (!this.documentData?.allowCopy) {
                e.preventDefault();
                notifications.warning('Copy Disabled', 'The document owner has disabled copying');
            }
        });

        document.addEventListener('paste', (e) => {
            if (!this.documentData?.allowCopy) {
                e.preventDefault();
                notifications.warning('Paste Disabled', 'The document owner has disabled pasting');
            }
        });
    }

    setupCopyButton() {
        const copyBtn = document.getElementById('makeACopy');
        copyBtn.addEventListener('click', async () => {
            try {
                // Check if user is logged in
                if (!auth.currentUser) {
                    window.location.href = 'index.html';
                    return;
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

                // Redirect to editor
                window.location.href = `editor.html?id=${docRef.id}`;
                notifications.success('Copy Created', 'Document copied successfully');
            } catch (error) {
                console.error('Error copying document:', error);
                notifications.error('Copy Failed', 'Could not create a copy of the document');
            }
        });
    }

    setupEmbedMode() {
        document.body.classList.add('embed-mode');
        // Remove header and other unnecessary elements
        const header = document.querySelector('header');
        if (header) header.remove();
        // Add embed styling
        this.addEmbedStyles();
    }

    addEmbedStyles() {
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
        document.head.appendChild(style);
    }

    setupUndoRedo() {
        // Get buttons
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');

        // Add click handlers
        undoBtn?.addEventListener('click', () => this.undo());
        redoBtn?.addEventListener('click', () => this.redo());

        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' && !e.shiftKey) {
                    e.preventDefault();
                    this.undo();
                } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
                    e.preventDefault();
                    this.redo();
                }
            }
        });

        // Initial state
        this.updateUndoRedoButtons();
    }

    pushToHistory(content) {
        if (this.isUndoRedo) return;
        
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
    }

    undo() {
        if (this.currentHistoryIndex <= 0) return;
        
        this.isUndoRedo = true;
        this.currentHistoryIndex--;
        
        const content = this.history[this.currentHistoryIndex];
        const contentArea = document.querySelector('.document-content');
        if (contentArea) {
            contentArea.innerHTML = content;
        }
        
        this.updateUndoRedoButtons();
        this.isUndoRedo = false;
    }

    redo() {
        if (this.currentHistoryIndex >= this.history.length - 1) return;
        
        this.isUndoRedo = true;
        this.currentHistoryIndex++;
        
        const content = this.history[this.currentHistoryIndex];
        const contentArea = document.querySelector('.document-content');
        if (contentArea) {
            contentArea.innerHTML = content;
        }
        
        this.updateUndoRedoButtons();
        this.isUndoRedo = false;
    }

    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        
        if (undoBtn) {
            undoBtn.disabled = this.currentHistoryIndex <= 0;
        }
        if (redoBtn) {
            redoBtn.disabled = this.currentHistoryIndex >= this.history.length - 1;
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
        localStorage.setItem('viewerZoom', scale.toString());
        const content = document.querySelector('.document-content');
        content.style.transform = `scale(${scale})`;
        content.style.transformOrigin = 'top center';
    }

    applyFitZoom(type) {
        const content = document.querySelector('.document-content');
        const container = content.parentElement;
        const containerWidth = container.clientWidth;
        const pageWidth = content.querySelector('.page').offsetWidth;
        
        let scale;
        if (type === 'fit') {
            scale = (containerWidth - 40) / pageWidth; // 40px for padding
        } else { // fill
            scale = containerWidth / pageWidth;
        }

        this.applyZoom(scale);
        document.getElementById('zoomLevel').value = type;
    }

    setupPrintButton() {
        const printBtn = document.getElementById('printBtn');
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }

    setupFullscreenButton() {
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        const container = document.querySelector('.editor-container');
        
        fullscreenBtn.addEventListener('click', () => {
            if (!this.isFullscreen) {
                if (container.requestFullscreen) {
                    container.requestFullscreen();
                }
                fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
                fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
            }
            this.isFullscreen = !this.isFullscreen;
        });

        document.addEventListener('fullscreenchange', () => {
            this.isFullscreen = !!document.fullscreenElement;
            fullscreenBtn.innerHTML = this.isFullscreen ? 
                '<i class="fas fa-compress"></i>' : 
                '<i class="fas fa-expand"></i>';
        });
    }

    setupSearchFunctionality() {
        const searchInput = document.getElementById('searchInput');
        const prevMatch = document.getElementById('prevMatch');
        const nextMatch = document.getElementById('nextMatch');
        const matchCount = document.getElementById('matchCount');

        let searchTimeout;

        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.performSearch(searchInput.value), 300);
        });

        prevMatch.addEventListener('click', () => this.navigateSearch('prev'));
        nextMatch.addEventListener('click', () => this.navigateSearch('next'));
    }

    performSearch(query) {
        // Clear existing highlights
        document.querySelectorAll('.search-highlight').forEach(el => {
            el.outerHTML = el.innerHTML;
        });

        if (!query) {
            this.searchMatches = [];
            this.currentMatch = -1;
            this.updateSearchButtons();
            return;
        }

        const content = document.querySelector('.document-content');
        const text = content.innerHTML;
        const regex = new RegExp(query, 'gi');
        let match;
        this.searchMatches = [];

        // Replace all matches with highlighted spans
        content.innerHTML = text.replace(regex, (match) => {
            this.searchMatches.push(match);
            return `<span class="search-highlight">${match}</span>`;
        });

        this.currentMatch = this.searchMatches.length ? 0 : -1;
        this.updateSearchButtons();
        this.highlightCurrentMatch();
    }

    navigateSearch(direction) {
        if (!this.searchMatches.length) return;

        if (direction === 'next') {
            this.currentMatch = (this.currentMatch + 1) % this.searchMatches.length;
        } else {
            this.currentMatch = this.currentMatch - 1;
            if (this.currentMatch < 0) this.currentMatch = this.searchMatches.length - 1;
        }

        this.highlightCurrentMatch();
    }

    highlightCurrentMatch() {
        const highlights = document.querySelectorAll('.search-highlight');
        highlights.forEach(h => h.classList.remove('active'));
        
        if (this.currentMatch >= 0) {
            const currentHighlight = highlights[this.currentMatch];
            currentHighlight.classList.add('active');
            currentHighlight.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }

        document.getElementById('matchCount').textContent = 
            this.searchMatches.length ? 
            `${this.currentMatch + 1}/${this.searchMatches.length}` : 
            '';
    }

    updateSearchButtons() {
        const hasMatches = this.searchMatches.length > 0;
        document.getElementById('prevMatch').disabled = !hasMatches;
        document.getElementById('nextMatch').disabled = !hasMatches;
        document.getElementById('matchCount').textContent = 
            hasMatches ? `${this.currentMatch + 1}/${this.searchMatches.length}` : '';
    }

    setupPageNavigation() {
        const prevPage = document.getElementById('prevPage');
        const nextPage = document.getElementById('nextPage');
        
        prevPage.addEventListener('click', () => this.changePage('prev'));
        nextPage.addEventListener('click', () => this.changePage('next'));
    }

    changePage(direction) {
        if (direction === 'next' && this.currentPage < this.totalPages) {
            this.currentPage++;
        } else if (direction === 'prev' && this.currentPage > 1) {
            this.currentPage--;
        }

        const pages = document.querySelectorAll('.page');
        pages.forEach((page, index) => {
            if (index + 1 === this.currentPage) {
                page.scrollIntoView({ behavior: 'smooth' });
            }
        });

        this.updatePageButtons();
    }

    updatePageButtons() {
        const prevPage = document.getElementById('prevPage');
        const nextPage = document.getElementById('nextPage');
        const pageIndicator = document.getElementById('pageIndicator');

        prevPage.disabled = this.currentPage === 1;
        nextPage.disabled = this.currentPage === this.totalPages;
        pageIndicator.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DocumentViewer();
});
