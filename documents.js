import { 
    auth, 
    db,
    collection,
    getDocs,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    query,
    where,
    orderBy
} from './firebase-config.js';

class DocumentManager {
    constructor() {
        this.documentsGrid = document.getElementById('documentsGrid');
        this.searchInput = document.getElementById('searchDocs');
        this.viewButtons = {
            grid: document.getElementById('gridView'),
            list: document.getElementById('listView')
        };
        this.filterButtons = document.querySelectorAll('.filter-btn');
        this.newDocBtn = document.getElementById('newDocBtn');
        
        this.currentUser = null;
        this.currentFilter = 'all';
        this.currentView = 'grid';
        this.documents = [];
        
        this.init();
    }

    async init() {
        // Check auth state first before doing anything
        try {
            const user = auth.currentUser;
            if (!user) {
                // If no current user, wait briefly for auth to initialize
                const authUser = await new Promise(resolve => {
                    const unsubscribe = auth.onAuthStateChanged(user => {
                        unsubscribe();
                        resolve(user);
                    });
                    setTimeout(() => resolve(null), 2000);
                });
                
                if (!authUser) {
                    window.location.href = 'index.html';
                    return;
                }
                this.currentUser = authUser;
            } else {
                this.currentUser = user;
            }

            // Only setup UI and load documents if authenticated
            this.setupEventListeners();
            this.updateUserInterface();
            await this.loadDocuments();
            
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = 'index.html';
        }
    }

    setupAuthListener() {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                this.updateUserInterface();
                await this.loadDocuments();
            } else {
                window.location.href = 'index.html';
            }
        });
    }

    setupEventListeners() {
        // Search
        this.searchInput.addEventListener('input', () => this.handleSearch());

        // View toggle
        this.viewButtons.grid.addEventListener('click', () => this.toggleView('grid'));
        this.viewButtons.list.addEventListener('click', () => this.toggleView('list'));

        // Filters
        this.filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleFilter(e.currentTarget.dataset.filter));
        });

        // New document
        this.newDocBtn.addEventListener('click', () => this.createNewDocument());

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

        // Version banner close button
        const closeBanner = document.getElementById('closeBanner');
        if (closeBanner) {
            closeBanner.addEventListener('click', () => {
                const banner = document.querySelector('.version-banner');
                const container = document.querySelector('.container');
                
                banner.classList.add('hidden');
                container.classList.add('no-banner');
                
                // Store in localStorage to prevent showing again
                localStorage.setItem('novadocs_banner_5_0', 'dismissed');
                
                // Remove from DOM after animation
                setTimeout(() => banner.remove(), 300);
            });
        }

        // Check if banner should be shown
        const bannerDismissed = localStorage.getItem('novadocs_banner_5_2') === 'dismissed';
        if (bannerDismissed) {
            const banner = document.querySelector('.version-banner');
            const container = document.querySelector('.container');
            if (banner) {
                banner.remove();
                container.classList.add('no-banner');
            }
        }
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
            <a href="editor.html?action=new" id="newDocMenuBtn"><i class="fas fa-plus"></i> New Document</a>
            <a href="#" id="settingsBtn"><i class="fas fa-cog"></i> Settings</a>
            <a href="#" id="logoutBtn"><i class="fas fa-sign-out-alt"></i> Sign Out</a>
        `;

        // Attach event listeners to menu items
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            auth.signOut();
        });

        document.getElementById('newDocMenuBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.createNewDocument();
        });
    }

    async loadDocuments() {
        try {
            // Show loading state
            this.documentsGrid.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    Loading documents...
                </div>
            `;

            // Load all documents for the current user
            let documentsQuery = query(
                collection(db, 'documents'),
                where('userId', '==', this.currentUser.uid),
                orderBy('lastModified', 'desc')
            );

            // Also load documents shared with the user
            const sharedQuery = query(
                collection(db, 'documents'),
                where('sharedWith', 'array-contains', this.currentUser.uid),
                orderBy('lastModified', 'desc')
            );

            const [userDocs, sharedDocs] = await Promise.all([
                getDocs(documentsQuery),
                getDocs(sharedQuery)
            ]);
            
            this.documents = [];
            
            // Add user's own documents
            userDocs.forEach((doc) => {
                this.documents.push({ 
                    id: doc.id, 
                    ...doc.data(),
                    isOwner: true 
                });
            });

            // Add shared documents
            sharedDocs.forEach((doc) => {
                this.documents.push({ 
                    id: doc.id, 
                    ...doc.data(),
                    isShared: true 
                });
            });

            // Sort all documents by last modified date
            this.documents.sort((a, b) => 
                new Date(b.lastModified) - new Date(a.lastModified)
            );
            
            // Handle empty state
            if (this.documents.length === 0) {
                this.documentsGrid.innerHTML = `
                    <div class="empty-state">
                        <i class="far fa-file-alt"></i>
                        <h3>Create your first document</h3>
                        <p>Get started by creating a new document</p>
                        <button class="primary-button" onclick="window.docManager.createNewDocument()">
                            <i class="fas fa-plus"></i>
                            New Document
                        </button>
                    </div>
                `;
                return;
            }
            
            this.renderDocuments();
        } catch (error) {
            console.error('Load error:', error);
            // Show empty state with retry button instead of error state
            this.documentsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-refresh"></i>
                    <h3>Couldn't load documents</h3>
                    <p>We're having trouble loading your documents</p>
                    <button class="primary-button" onclick="window.docManager.loadDocuments()">
                        <i class="fas fa-sync"></i>
                        Try Again
                    </button>
                </div>
            `;
            notifications.error('Load Failed', 'Could not load your documents. Please try again.');
        }
    }

    renderDocuments() {
        let filteredDocs = this.filterDocuments();
        const searchTerm = this.searchInput.value.toLowerCase();
        
        if (searchTerm) {
            filteredDocs = filteredDocs.filter(doc => 
                (doc.title || 'Untitled Document').toLowerCase().includes(searchTerm)
            );
        }

        // Handle no results from search
        if (filteredDocs.length === 0) {
            this.documentsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No results found</h3>
                    <p>Try different search terms</p>
                </div>
            `;
            return;
        }

        this.documentsGrid.className = this.currentView === 'grid' ? 'documents-grid' : 'documents-list';
        
        this.documentsGrid.innerHTML = filteredDocs.map(doc => `
            <div class="document-card" onclick="window.location.href='editor.html?id=${doc.id}'">
                <div class="document-icon">
                    <i class="far fa-file-alt"></i>
                </div>
                <div class="document-info">
                    <h3>${doc.title || 'Untitled Document'}</h3>
                    <div class="document-meta">
                        <span>Modified ${this.formatDate(doc.lastModified)}</span>
                        ${doc.isShared ? '<span> · Shared with you</span>' : ''}
                        ${doc.sharedWith && doc.sharedWith.length > 0 ? '<span> · Shared with others</span>' : ''}
                        ${doc.isDeleted ? '<span class="document-deleted"> · In Trash</span>' : ''}
                    </div>
                </div>
                ${doc.isOwner && this.currentFilter === 'trash' ? `
                    <div class="document-actions">
                        <button onclick="event.stopPropagation(); window.docManager.restoreDocument('${doc.id}')" class="action-btn restore-btn">
                            <i class="fas fa-undo"></i>
                        </button>
                        <button onclick="event.stopPropagation(); window.docManager.deleteDocument('${doc.id}')" class="action-btn delete-btn">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    filterDocuments() {
        const now = new Date();
        const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

        switch (this.currentFilter) {
            case 'recent':
                return this.documents.filter(doc => 
                    !doc.isDeleted && 
                    new Date(doc.lastModified) > oneWeekAgo
                );
            
            case 'shared':
                return this.documents.filter(doc => 
                    !doc.isDeleted && 
                    (doc.isShared || (doc.sharedWith && doc.sharedWith.length > 0))
                );
            
            case 'trash':
                return this.documents.filter(doc => 
                    doc.isDeleted && doc.isOwner
                );
            
            default: // 'all'
                return this.documents.filter(doc => !doc.isDeleted);
        }
    }

    handleSearch() {
        this.renderDocuments();
    }

    toggleView(view) {
        this.currentView = view;
        
        // Update button states
        this.viewButtons.grid.classList.toggle('active', view === 'grid');
        this.viewButtons.list.classList.toggle('active', view === 'list');
        
        this.renderDocuments();
    }

    handleFilter(filter) {
        this.currentFilter = filter;
        
        // Update button states
        this.filterButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        
        this.renderDocuments();
    }

    async createNewDocument() {
        try {
            const newDoc = {
                title: 'Untitled Document',
                content: '<div class="page" data-page="1"><h1>Untitled Document</h1><p>Start typing here...</p></div>',
                userId: this.currentUser.uid,
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString()
            };

            const docRef = doc(collection(db, 'documents'));
            await setDoc(docRef, newDoc);
            
            window.location.href = `editor.html?id=${docRef.id}`;
        } catch (error) {
            notifications.error('Creation Failed', 'Could not create new document');
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        // Less than 24 hours
        if (diff < 86400000) {
            return this.formatTimeAgo(diff);
        }
        
        // Less than a week
        if (diff < 604800000) {
            return date.toLocaleDateString(undefined, { weekday: 'long' });
        }
        
        // Otherwise
        return date.toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }

    formatTimeAgo(diff) {
        const hours = Math.floor(diff / 3600000);
        if (hours > 0) return `${hours}h ago`;
        
        const minutes = Math.floor(diff / 60000);
        if (minutes > 0) return `${minutes}m ago`;
        
        return 'Just now';
    }

    async moveToTrash(docId) {
        try {
            const docRef = doc(db, 'documents', docId);
            await setDoc(docRef, {
                isDeleted: true,
                deletedAt: new Date().toISOString()
            }, { merge: true });
            
            await this.loadDocuments();
            notifications.success('Moved to Trash', 'Document moved to trash');
        } catch (error) {
            console.error('Error moving to trash:', error);
            notifications.error('Action Failed', 'Could not move document to trash');
        }
    }

    async restoreDocument(docId) {
        try {
            const docRef = doc(db, 'documents', docId);
            await setDoc(docRef, {
                isDeleted: false,
                deletedAt: null
            }, { merge: true });
            
            await this.loadDocuments();
            notifications.success('Restored', 'Document restored from trash');
        } catch (error) {
            console.error('Error restoring document:', error);
            notifications.error('Action Failed', 'Could not restore document');
        }
    }

    async deleteDocument(docId) {
        if (confirm('Are you sure you want to permanently delete this document? This action cannot be undone.')) {
            try {
                await deleteDoc(doc(db, 'documents', docId));
                await this.loadDocuments();
                notifications.success('Deleted', 'Document permanently deleted');
            } catch (error) {
                console.error('Error deleting document:', error);
                notifications.error('Action Failed', 'Could not delete document');
            }
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.docManager = new DocumentManager();
});
