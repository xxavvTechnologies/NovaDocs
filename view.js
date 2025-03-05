import { auth, db, doc, getDoc, setDoc, collection } from './firebase-config.js';

class DocumentViewer {
    constructor() {
        this.init();
    }

    async init() {
        try {
            await this.loadDocument();
            this.setupCopyProtection();
            this.setupCopyButton();
        } catch (error) {
            console.error('Failed to load document:', error);
            notifications.error('Load Failed', 'Could not load the document');
        }
    }

    async loadDocument() {
        const urlParams = new URLSearchParams(window.location.search);
        const docId = urlParams.get('id');

        if (!docId) {
            notifications.error('Invalid Link', 'No document ID provided');
            return;
        }

        const docRef = doc(db, 'documents', docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            if (!data.isPublic) {
                notifications.error('Access Denied', 'This document is not publicly shared');
                return;
            }

            // Store document data
            this.documentData = data;

            // Set copy permissions
            if (data.allowCopy) {
                document.documentElement.style.setProperty('--allow-copy', 'text');
                document.getElementById('copyNotice').style.display = 'none';
            }

            // Update title
            document.title = `${data.title || 'Untitled Document'} - Nova Docs`;
            document.getElementById('docTitle').textContent = data.title || 'Untitled Document';

            // Update content
            const content = document.getElementById('documentContent');
            content.querySelector('.document-content').innerHTML = 
                data.content || '<div class="page"><p>No content</p></div>';

            // Show/hide copy button based on permissions
            const copyBtn = document.getElementById('makeACopy');
            copyBtn.style.display = data.allowCopy ? 'flex' : 'none';

        } else {
            notifications.error('Not Found', 'Document not found');
        }
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
}

document.addEventListener('DOMContentLoaded', () => {
    new DocumentViewer();
});
