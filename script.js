// Google Drive API Configuration
const GOOGLE_CLIENT_ID = '139502800975-lqhp99o1t4pqv7tkjcodunqch8b4vbut.apps.googleusercontent.com';
const GOOGLE_API_SCOPES = 'https://www.googleapis.com/auth/drive.file';

// DOM Elements (existing and new)
const editor = document.getElementById('editor');
const saveBtn = document.getElementById('save-btn');
const loadBtn = document.getElementById('load-btn');
const newBtn = document.getElementById('new-btn');
const printBtn = document.getElementById('print-btn');
const fontSelect = document.getElementById('font-select');
const fontSizeSelect = document.getElementById('font-size-select');
const textColorInput = document.getElementById('text-color');
const highlightColorInput = document.getElementById('highlight-color');
const savedDocumentsModal = document.getElementById('saved-documents-modal');
const savedDocumentsList = document.getElementById('saved-documents-list');
const closeModalBtns = document.querySelectorAll('.close-btn');
const driveLoginBtn = document.getElementById('google-login-btn');
const driveSyncBtn = document.getElementById('drive-sync-btn');
const driveSyncModal = document.getElementById('drive-sync-modal');
const driveFileList = document.getElementById('drive-file-list');
const themeSwitch = document.getElementById('theme-switch');
const collaborationManager = new PeerCollaboration(document.getElementById('editor'));

// Theme Toggle
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    // Save theme preference to localStorage
    localStorage.setItem('theme', 
        document.body.classList.contains('dark-mode') ? 'dark' : 'light'
    );
}

// Initialize theme on page load
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeSwitch.checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        themeSwitch.checked = false;
    }
}

// Format selected text
function format(command, value = null) {
    document.execCommand(command, false, value);
}

// Save document to localStorage
function saveDocument() {
    const documentName = prompt('Enter a name for this document:');
    if (documentName) {
        const documentContent = editor.innerHTML;
        const savedDocuments = JSON.parse(localStorage.getItem('savedDocuments') || '{}');
        savedDocuments[documentName] = {
            content: documentContent,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('savedDocuments', JSON.stringify(savedDocuments));
        alert(`Document "${documentName}" saved successfully!`);
    }
}

// Load documents from localStorage
function loadDocuments() {
    const savedDocuments = JSON.parse(localStorage.getItem('savedDocuments') || '{}');
    savedDocumentsList.innerHTML = ''; // Clear previous list

    if (Object.keys(savedDocuments).length === 0) {
        savedDocumentsList.innerHTML = '<li>No saved documents found.</li>';
        return;
    }

    // Sort documents by timestamp (most recent first)
    const sortedDocs = Object.entries(savedDocuments)
        .sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));

    sortedDocs.forEach(([docName, docData]) => {
        const li = document.createElement('li');
        
        // Create document info line
        const docInfo = document.createElement('div');
        docInfo.innerHTML = `
            <strong>${docName}</strong>
            <small>${new Date(docData.timestamp).toLocaleString()}</small>
        `;
        
        li.appendChild(docInfo);
        
        li.addEventListener('click', () => {
            editor.innerHTML = docData.content;
            savedDocumentsModal.style.display = 'none';
        });

        // Add delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '&times;';
        deleteBtn.classList.add('delete-doc');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete "${docName}"?`)) {
                const updatedDocs = JSON.parse(localStorage.getItem('savedDocuments') || '{}');
                delete updatedDocs[docName];
                localStorage.setItem('savedDocuments', JSON.stringify(updatedDocs));
                loadDocuments(); // Refresh the list
            }
        });
        li.appendChild(deleteBtn);

        savedDocumentsList.appendChild(li);
    });

    savedDocumentsModal.style.display = 'block';
}

// Create new document
function newDocument() {
    if (confirm('Are you sure you want to create a new document? Unsaved changes will be lost.')) {
        editor.innerHTML = '';
    }
}

// Print document
function printDocument() {
    const printContents = editor.innerHTML;
    const originalContents = document.body.innerHTML;
    
    document.body.innerHTML = printContents;
    window.print();
    
    document.body.innerHTML = originalContents;
    location.reload(); // Reload to restore functionality
}

// Google Drive Sync Functionality
const GoogleDriveSync = {
    isSignedIn: false,

    // Initialize Google API Client
    initClient() {
        gapi.load('client:auth2', () => {
            gapi.client.init({
                clientId: GOOGLE_CLIENT_ID,
                scope: GOOGLE_API_SCOPES
            }).then(() => {
                // Listen for sign-in state changes
                gapi.auth2.getAuthInstance().isSignedIn.listen(this.updateSigninStatus.bind(this));
                
                // Handle the initial sign-in state
                this.updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
            }).catch((error) => {
                console.error('Error initializing Google API client', error);
            });
        });
    },

    // Update UI based on sign-in state
    updateSigninStatus(signedIn) {
        this.isSignedIn = signedIn;
        if (signedIn) {
            driveLoginBtn.textContent = 'Logout';
            this.listFiles();
        } else {
            driveLoginBtn.textContent = 'Login with Google';
            driveFileList.innerHTML = '';
        }
    },

    // Handle Google login/logout
    handleAuthClick() {
        if (this.isSignedIn) {
            gapi.auth2.getAuthInstance().signOut();
        } else {
            gapi.auth2.getAuthInstance().signIn();
        }
    },

    // List files from Google Drive
    listFiles() {
        gapi.client.drive.files.list({
            'pageSize': 10,
            'fields': "nextPageToken, files(id, name, modifiedTime)",
            'q': "mimeType='text/plain' or mimeType='text/html'"
        }).then((response) => {
            const files = response.result.files;
            driveFileList.innerHTML = '';
            if (files && files.length > 0) {
                files.forEach((file) => {
                    const fileItem = document.createElement('div');
                    fileItem.classList.add('drive-file-item');
                    fileItem.innerHTML = `
                        <span>${file.name}</span>
                        <small>Modified: ${new Date(file.modifiedTime).toLocaleString()}</small>
                        <button class="load-drive-file" data-id="${file.id}">Load</button>
                    `;
                    fileItem.querySelector('.load-drive-file').addEventListener('click', () => this.loadFile(file.id));
                    driveFileList.appendChild(fileItem);
                });
            } else {
                driveFileList.innerHTML = '<p>No files found.</p>';
            }
        });
    },

    // Load a specific file from Google Drive
    loadFile(fileId) {
        gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        }).then((response) => {
            editor.innerHTML = response.body;
            driveSyncModal.style.display = 'none';
        });
    },

    // Save current document to Google Drive
    saveFile() {
        if (!this.isSignedIn) {
            alert('Please log in to Google Drive first.');
            return;
        }

        const fileName = prompt('Enter a name for the file:') || 'NovaDocs Document.html';
        const fileContent = editor.innerHTML;

        const file = new Blob([fileContent], {type: 'text/html'});
        const metadata = {
            'name': fileName,
            'mimeType': 'text/html'
        };

        const accessToken = gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token;
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
        form.append('file', file);

        fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({
                'Authorization': 'Bearer ' + accessToken
            }),
            body: form
        }).then(response => response.json())
        .then(file => {
            alert('File saved to Google Drive successfully!');
            this.listFiles();
        }).catch(error => {
            console.error('Error saving file to Google Drive', error);
            alert('Failed to save file to Google Drive.');
        });
    }
};

// Event Listeners
function initEventListeners() {
    // Existing listeners
    saveBtn.addEventListener('click', saveDocument);
    loadBtn.addEventListener('click', loadDocuments);
    newBtn.addEventListener('click', newDocument);
    printBtn.addEventListener('click', printDocument);

    // Font and style listeners
    fontSelect.addEventListener('change', (e) => {
        format('fontName', e.target.value);
    });

    fontSizeSelect.addEventListener('change', (e) => {
        format('fontSize', e.target.value);
    });

    textColorInput.addEventListener('change', (e) => {
        format('foreColor', e.target.value);
    });

    highlightColorInput.addEventListener('change', (e) => {
        format('hiliteColor', e.target.value);
    });

    // Theme toggle
    themeSwitch.addEventListener('change', toggleTheme);

    // Close modal buttons
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').style.display = 'none';
        });
    });

    // Close modal when clicking outside of it
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    // Google Drive sync listeners
    driveLoginBtn.addEventListener('click', () => GoogleDriveSync.handleAuthClick());
    driveSyncBtn.addEventListener('click', () => {
        if (GoogleDriveSync.isSignedIn) {
            GoogleDriveSync.saveFile();
        } else {
            driveSyncModal.style.display = 'block';
        }
    });
}

// Auto-save feature (every 2 minutes)
function initAutoSave() {
    setInterval(() => {
        const autoSaveContent = editor.innerHTML;
        localStorage.setItem('autoSaveContent', autoSaveContent);
    }, 120000);

    // Restore auto-save on page load
    const autoSaveContent = localStorage.getItem('autoSaveContent');
    if (autoSaveContent) {
        editor.innerHTML = autoSaveContent;
    }
}

// Initialize everything when the page loads
function init() {
    initTheme();
    initEventListeners();
    initAutoSave();

    // Initialize Google Drive API
    if (typeof gapi !== 'undefined') {
        GoogleDriveSync.initClient();
    }
}

// Run initialization when the page loads
window.addEventListener('load', init);

// Additional CSS to support new features
const styleTag = document.createElement('style');
styleTag.textContent = `
    .drive-file-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        border-bottom: 1px solid var(--border-color);
    }
    .drive-file-item button {
        margin-left: 10px;
    }
    .delete-doc {
        background: none;
        border: none;
        color: red;
        font-weight: bold;
        cursor: pointer;
        margin-left: 10px;
    }
`;
document.head.appendChild(styleTag);

class PeerCollaboration {
    constructor(editorElement) {
        // The editor we're collaborating on
        this.editor = editorElement;
        
        // Unique peer ID for this session
        this.peerId = this.generatePeerId();
        
        // Peer connections
        this.peers = new Map();
        
        // WebRTC configuration
        this.rtcConfiguration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                // Optional: Add TURN servers for better connectivity
                // { 
                //     urls: 'turn:your-turn-server.com',
                //     username: 'username',
                //     credential: 'password'
                // }
            ]
        };

        // Signaling channel using WebSocket
        this.initializeSignalingChannel();

        // Set up collaboration events
        this.setupCollaborationEvents();
    }

    // Generate a unique peer ID
    generatePeerId() {
        return `peer-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Initialize WebSocket for signaling
    initializeSignalingChannel() {
        // Replace with your actual domain/server address
        // Use wss:// for secure WebSocket (recommended for production)
        this.signalingSocket = new WebSocket('wss://docs.nova.xxavvgroup.com/ws');
    
        this.signalingSocket.onopen = () => {
            console.log('Signaling connection established');
            // Register our peer
            this.signalingSocket.send(JSON.stringify({
                type: 'register',
                peerId: this.peerId
            }));
        };
    
        this.signalingSocket.onmessage = this.handleSignalingMessage.bind(this);
    
        // Add error and close handlers for robustness
        this.signalingSocket.onerror = (error) => {
            console.error('Signaling socket error:', error);
        };
    
        this.signalingSocket.onclose = (event) => {
            console.warn('Signaling socket closed:', event);
            // Optional: implement reconnection logic
            setTimeout(() => this.initializeSignalingChannel(), 3000);
        };
    }

    // Handle incoming signaling messages
    handleSignalingMessage(event) {
        const message = JSON.parse(event.data);

        switch(message.type) {
            case 'offer':
                this.handleOffer(message);
                break;
            case 'answer':
                this.handleAnswer(message);
                break;
            case 'ice-candidate':
                this.handleIceCandidate(message);
                break;
            case 'peer-list':
                this.connectToPeers(message.peers);
                break;
        }
    }

    // Connect to other peers
    connectToPeers(peerIds) {
        peerIds.forEach(peerId => {
            if (peerId !== this.peerId && !this.peers.has(peerId)) {
                this.createPeerConnection(peerId);
            }
        });
    }

    // Create a new peer connection
    createPeerConnection(peerId) {
        // Create RTCPeerConnection
        const peerConnection = new RTCPeerConnection(this.rtcConfiguration);

        // Setup data channel for collaboration
        const dataChannel = peerConnection.createDataChannel('collaboration');
        
        // Setup event handlers for the data channel
        dataChannel.onopen = () => {
            console.log(`Data channel opened with ${peerId}`);
        };

        dataChannel.onmessage = (event) => {
            this.handleRemoteMessage(JSON.parse(event.data));
        };

        // Handle ICE candidate generation
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.signalingSocket.send(JSON.stringify({
                    type: 'ice-candidate',
                    peerId: peerId,
                    candidate: event.candidate
                }));
            }
        };

        // Create and send offer
        peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
            this.signalingSocket.send(JSON.stringify({
                type: 'offer',
                peerId: peerId,
                target: peerId, // Add target field
                offer: peerConnection.localDescription
            }));
        });

        // Store peer connection
        this.peers.set(peerId, {
            connection: peerConnection,
            dataChannel: dataChannel
        });

        return peerConnection;
    }

    // Handle incoming offer
    handleOffer(message) {
        const peerId = message.peerId;
        if (message.target !== this.peerId) return;

        const peerConnection = this.createPeerConnection(peerId);

peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer))
        .then(() => peerConnection.createAnswer())
        .then(answer => peerConnection.setLocalDescription(answer))
        .then(() => {
            this.signalingSocket.send(JSON.stringify({
                type: 'answer',
                peerId: peerId,
                target: peerId, // Add target field
                answer: peerConnection.localDescription
            }));
        });
    }

    // Handle incoming answer
    handleAnswer(message) {
        const peer = this.peers.get(message.peerId);
        if (peer) {
            peer.connection.setRemoteDescription(new RTCSessionDescription(message.answer));
        }
    }

    // Handle ICE candidates
    hhandleIceCandidate(message) {
        // Only process if the candidate is meant for this peer
        if (message.target !== this.peerId) return;
    
        const peer = this.peers.get(message.peerId);
        if (peer) {
            peer.connection.addIceCandidate(new RTCIceCandidate(message.candidate));
        }
    }

    // Setup collaboration events
    setupCollaborationEvents() {
        // Debounce content changes
        let updateTimeout;
        this.editor.addEventListener('input', () => {
            clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => {
                this.broadcastDocumentUpdate();
            }, 300);
        });
    }

    reconnectSignaling() {
        if (this.signalingSocket) {
            this.signalingSocket.close();
        }
        this.initializeSignalingChannel();
    }

    // Broadcast document updates to all peers
    broadcastDocumentUpdate() {
        const documentContent = this.editor.innerHTML;
        
        this.peers.forEach((peer) => {
            if (peer.dataChannel.readyState === 'open') {
                peer.dataChannel.send(JSON.stringify({
                    type: 'document-update',
                    content: documentContent
                }));
            }
        });
    }

    // Handle incoming messages from peers
    handleRemoteMessage(message) {
        switch(message.type) {
            case 'document-update':
                // Update document content from remote peer
                this.editor.innerHTML = message.content;
                break;
        }
    }

    // Cleanup method
    destroy() {
        // Close all peer connections
        this.peers.forEach((peer) => {
            peer.connection.close();
        });

        // Close signaling socket
        if (this.signalingSocket) {
            this.signalingSocket.close();
        }
    }
}

// Add some styles for peer cursors (optional)
const peerStyles = document.createElement('style');
peerStyles.textContent = `
    .peer-cursor {
        position: absolute;
        width: 2px;
        background-color: rgba(0, 120, 255, 0.7);
        height: 20px;
        pointer-events: none;
    }
`;
document.head.appendChild(peerStyles);

console.warn('Peer Collaboration requires a WebSocket signaling server');