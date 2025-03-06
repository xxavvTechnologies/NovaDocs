import { auth, db, doc, getDoc, setDoc, collection } from './firebase-config.js';

class DocumentViewer {
    constructor() {
        this.init();
    }

    async init() {
        try {
            await this.loadDocument();
            this.setupCopyProtection();
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
        // Get the content container
        const contentArea = document.querySelector('.document-content');
        if (!contentArea) return;

        // Set the document content
        contentArea.innerHTML = data.content || '';

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
                ${data.isPublic ? '<span class="public-badge">Public</span>' : ''}
            `;
        }

        // Setup copy protection based on document settings
        if (data.allowCopy) {
            contentArea.style.setProperty('--allow-copy', 'text');
        } else {
            contentArea.style.setProperty('--allow-copy', 'none');
        }
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
}

document.addEventListener('DOMContentLoaded', () => {
    new DocumentViewer();
});
