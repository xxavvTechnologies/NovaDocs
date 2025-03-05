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
        this.init();
    }

    async init() {
        try {
            // Check auth state first
            const user = auth.currentUser;
            if (!user) {
                // If no current user, wait briefly for auth to initialize
                await new Promise(resolve => {
                    const unsubscribe = auth.onAuthStateChanged(user => {
                        unsubscribe();
                        resolve(user);
                    });
                    // Timeout after 2 seconds
                    setTimeout(() => resolve(null), 2000);
                });
            }

            if (!auth.currentUser) {
                window.location.href = 'index.html';
                return;
            }

            // Initialize editor only if authenticated
            await this.setupEditor();
            await this.loadDocumentFromUrl();
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = 'index.html';
        }
    }

    async loadDocumentFromUrl() {
        try {
            // Get document ID from URL
            const urlParams = new URLSearchParams(window.location.search);
            const docId = urlParams.get('id');
            const action = urlParams.get('action');

            // Show loading state
            this.editor.innerHTML = `
                <div class="loading-state" style="display: flex; justify-content: center; align-items: center; height: 200px;">
                    <i class="fas fa-spinner fa-spin" style="margin-right: 10px;"></i>
                    Loading document...
                </div>
            `;

            if (action === 'new') {
                await this.createNewDocument();
                this.updateDocumentTitle('Untitled Document'); // Add this line
            } else if (docId) {
                const docRef = doc(db, 'documents', docId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    
                    // Check if user has access to this document
                    if (data.userId === this.currentUser.uid || 
                        data.isPublic || 
                        (data.sharedWith && data.sharedWith.includes(this.currentUser.uid))) {
                        
                        this.currentDocId = docId;
                        
                        // Set content and title
                        const content = data.content || '<div class="page" data-page="1"><p>Start typing here...</p></div>';
                        this.editor.innerHTML = content;
                        this.updateDocumentTitle(data.title || 'Untitled Document'); // Update this line
                        
                        // Load original revision if exists...
                    }
                }
            }
        } catch (error) {
            console.error('Error loading document:', error);
            this.updateDocumentTitle('Error Loading Document');
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

    setupEditor() {
        this.editor = document.getElementById('editor');
        this.currentUser = auth.currentUser;
        this.currentDocId = null;
        this.saveTimeout = null;
        this.activeButtons = new Set();
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
    }

    saveEditorState() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            // Save both range and scroll position
            this.selectionState = {
                range: selection.getRangeAt(0),
                scroll: {
                    x: window.scrollX,
                    y: window.scrollY
                }
            };
        }
    }

    restoreEditorState() {
        if (!this.selectionState) return;

        try {
            // Restore scroll position first
            window.scrollTo(this.selectionState.scroll.x, this.selectionState.scroll.y);

            // Then restore selection
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(this.selectionState.range);
        } catch (error) {
            console.error('Failed to restore editor state:', error);
        }
    }

    initializeEditor() {
        this.editor.addEventListener('input', () => {
            this.handleEditorChange();
            this.updateWordCount();
        });

        // Initialize toolbar buttons
        document.querySelectorAll('.toolbar button').forEach(button => {
            button.addEventListener('click', (e) => this.handleToolbarAction(e));
        });

        // Initialize dropdowns
        document.getElementById('fontSelect').addEventListener('change', (e) => {
            this.execCommand('fontName', e.target.value);
        });

        document.getElementById('fontSize').addEventListener('change', (e) => {
            this.execCommand('fontSize', e.target.value);
        });
    }

    setupToolbar() {
        // Format buttons
        const formatButtons = ['bold', 'italic', 'underline', 'strike'];
        formatButtons.forEach(format => {
            const button = document.getElementById(`${format}Btn`);
            button.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevent losing selection
                this.toggleFormat(format);
                this.updateActiveFormats();
            });
        });

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
    }

    setAlignment(align) {
        const command = 'justify' + align.replace('align', '').toLowerCase();
        document.execCommand(command, false, null);
        this.editor.focus();
    }

    attachEventListeners() {
        // User menu dropdown
        const userMenuBtn = document.getElementById('userMenuBtn');
        const userDropdown = document.getElementById('userDropdown');

        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!userDropdown.contains(e.target) && !userMenuBtn.contains(e.target)) {
                userDropdown.classList.remove('show');
            }
        });

        // Format tracking
        this.editor.addEventListener('keyup', () => this.updateActiveFormats());
        this.editor.addEventListener('mouseup', () => this.updateActiveFormats());
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
    }

    setupAuthStateListener() {
        auth.onAuthStateChanged(user => {
            if (user) {
                this.currentUser = user;
                this.updateUserInterface();
            } else {
                window.location.href = 'index.html';
            }
        });
    }

    async handleEditorChange() {
        clearTimeout(this.saveTimeout);
        this.saveEditorState();
        
        const saveStatus = document.getElementById('saveStatus');
        saveStatus.innerHTML = '<i class="fas fa-sync fa-spin"></i> Saving...';
        
        this.saveTimeout = setTimeout(async () => {
            await this.saveDocument();
        }, 2000);

        // Remove preview mode if it exists
        this.editor.classList.remove('preview-mode');
    }

    async saveDocument() {
        if (!this.currentUser || !this.currentDocId) return;

        try {
            const content = this.editor.innerHTML;
            const now = new Date();
            const docRef = doc(db, 'documents', this.currentDocId);
            const pages = this.editor.querySelectorAll('.page').length;
            
            await setDoc(docRef, {
                content,
                pages,
                lastModified: now.toISOString(),
                userId: this.currentUser.uid
            }, { merge: true });

            await this.manageRevisions(content, now);

            // Update only the save status indicator
            const saveStatus = document.getElementById('saveStatus');
            saveStatus.innerHTML = '<i class="fas fa-check"></i> Saved';
            this.lastSaveTime = now;
            
            this.restoreEditorState();
        } catch (error) {
            const saveStatus = document.getElementById('saveStatus');
            saveStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error saving';
            notifications.error('Save Failed', 'Could not save the document', ERROR_CODES.SAVE_ERROR);
        }
    }

    async manageRevisions(content, timestamp) {
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
                    await deleteDoc(doc(revisionsRef, recentRevisions[i].id));
                }
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
        const docRef = doc(db, 'documents', this.currentDocId);
    
        try {
            if (shareType === 'public') {
                await setDoc(docRef, {
                    isPublic: true,
                    allowCopy,
                    sharedWith: []
                }, { merge: true });
    
                // Immediately show share link after setting public
                const shareLinkContainer = document.getElementById('shareLinkContainer');
                shareLinkContainer.style.display = 'flex';
                const shareLink = `${window.location.origin}/view.html?id=${this.currentDocId}`;
                document.getElementById('shareLink').value = shareLink;
                
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
    }

    setupPageManagement() {
        // Debounce the page break checking
        this.editor.addEventListener('input', () => {
            clearTimeout(this.pageBreakDebounce);
            this.pageBreakDebounce = setTimeout(() => this.checkPageBreaks(), 1000);
        });

        this.editor.addEventListener('paste', () => {
            clearTimeout(this.pageBreakDebounce);
            this.pageBreakDebounce = setTimeout(() => this.checkPageBreaks(), 1000);
        });
    }

    checkPageBreaks() {
        if (!this.editor || !this.editor.children || !this.editor.children.length) {
            return;
        }

        this.saveEditorState();

        // Create temporary container to hold content while processing
        const tempContainer = document.createElement('div');
        tempContainer.style.visibility = 'hidden';
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
            // Add node to temp container to measure it
            tempContainer.appendChild(node);
            const nodeHeight = tempContainer.offsetHeight;
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
        });

        // Clean up
        document.body.removeChild(tempContainer);

        // Update page indicator
        document.getElementById('pageIndicator').textContent = `Page ${pageNumber} of ${pageNumber}`;

        this.restoreEditorState();

        // Ensure cursor position is maintained
        this.editor.focus();
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
}

// Initialize the editor when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.editor = new DocumentEditor();
});
