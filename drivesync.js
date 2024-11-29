// GoogleDriveSync.js
class GoogleDriveSync {
    constructor(clientId, apiKey) {
      this.clientId = clientId;
      this.apiKey = apiKey;
      this.isInitialized = false;
      this.accessToken = null;
    }
  
    // Initialize Google API client
    async initializeGoogleAPI() {
      if (this.isInitialized) return;
  
      return new Promise((resolve, reject) => {
        // Load the Google API client library
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => {
          window.gapi.load('client:auth2', () => {
            window.gapi.client.init({
              apiKey: this.apiKey,
              clientId: this.clientId,
              discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
              scope: 'https://www.googleapis.com/auth/drive.file'
            }).then(() => {
              this.isInitialized = true;
              resolve();
            }).catch((error) => {
              console.error('Error initializing Google API client', error);
              reject(error);
            });
          });
        };
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }
  
    // Authenticate user and get access token
    async authenticate() {
      await this.initializeGoogleAPI();
  
      try {
        // Try to sign in silently first
        await window.gapi.auth2.getAuthInstance().signInSilently();
      } catch {
        // If silent sign-in fails, prompt user
        await window.gapi.auth2.getAuthInstance().signIn();
      }
  
      // Get the access token
      this.accessToken = window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token;
      return this.accessToken;
    }
  
    // Upload document to Google Drive
    async uploadDocument(documentName, documentContent) {
      if (!this.accessToken) {
        await this.authenticate();
      }
  
      try {
        // Prepare file metadata
        const metadata = {
          name: documentName,
          mimeType: 'text/plain'
        };
  
        // Create multipart request
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([documentContent], { type: 'text/plain' }));
  
        // Send request to Google Drive API
        const response = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.accessToken}`
            },
            body: form
          }
        );
  
        const responseData = await response.json();
        return responseData.id; // Return the file ID
      } catch (error) {
        console.error('Error uploading document to Google Drive', error);
        throw error;
      }
    }
  
    // List documents from Google Drive
    async listDocuments(pageSize = 10) {
      if (!this.accessToken) {
        await this.authenticate();
      }
  
      try {
        const response = await window.gapi.client.drive.files.list({
          pageSize: pageSize,
          fields: 'nextPageToken, files(id, name, modifiedTime)',
          q: "mimeType='text/plain'"
        });
  
        return response.result.files;
      } catch (error) {
        console.error('Error listing documents from Google Drive', error);
        throw error;
      }
    }
  
    // Download a specific document from Google Drive
    async downloadDocument(fileId) {
      if (!this.accessToken) {
        await this.authenticate();
      }
  
      try {
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`
            }
          }
        );
  
        const documentContent = await response.text();
        return documentContent;
      } catch (error) {
        console.error('Error downloading document from Google Drive', error);
        throw error;
      }
    }
  
    // Delete a document from Google Drive
    async deleteDocument(fileId) {
      if (!this.accessToken) {
        await this.authenticate();
      }
  
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        });
      } catch (error) {
        console.error('Error deleting document from Google Drive', error);
        throw error;
      }
    }
  
    // Logout method to revoke access
    async logout() {
      if (window.gapi.auth2) {
        const authInstance = window.gapi.auth2.getAuthInstance();
        await authInstance.signOut();
        this.accessToken = null;
        this.isInitialized = false;
      }
    }
  }
  
  // Usage example (to be implemented in your document editor)
  /*
  const driveSyncer = new GoogleDriveSync(
    'YOUR_GOOGLE_CLIENT_ID', 
    'YOUR_GOOGLE_API_KEY'
  );
  
  // Authenticate
  await driveSyncer.authenticate();
  
  // Upload a document
  const fileId = await driveSyncer.uploadDocument('MyDocument.txt', documentContent);
  
  // List documents
  const documentList = await driveSyncer.listDocuments();
  
  // Download a document
  const content = await driveSyncer.downloadDocument(fileId);
  
  // Delete a document
  await driveSyncer.deleteDocument(fileId);
  
  // Logout
  await driveSyncer.logout();
  */
  
  export default GoogleDriveSync;