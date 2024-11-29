// GoogleDriveSync.js
class GoogleDriveSync {
    constructor(clientId, apiKey) {
      this.clientId = clientId;
      this.apiKey = apiKey;
      this.isInitialized = false;
      this.accessToken = null;
    }
  
    // Initialize Google API client using modern Google Identity Services
    async initializeGoogleAPI() {
      if (this.isInitialized) return;
  
      return new Promise((resolve, reject) => {
        // Load the Google API client and Google Sign-In library
        const gapiScript = document.createElement('script');
        gapiScript.src = 'https://apis.google.com/js/api.js';
        
        const gsiScript = document.createElement('script');
        gsiScript.src = 'https://accounts.google.com/gsi/client';
        
        gsiScript.onload = () => {
          // Initialize Google Identity Services
          window.google.accounts.id.initialize({
            client_id: this.clientId,
            callback: this.handleCredentialResponse.bind(this)
          });
  
          this.isInitialized = true;
          resolve();
        };
  
        gapiScript.onload = () => {
          window.gapi.load('client', () => {
            window.gapi.client.init({
              apiKey: this.apiKey,
              discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
            }).then(() => {
              document.body.appendChild(gsiScript);
            }).catch(reject);
          });
        };
  
        gapiScript.onerror = reject;
        document.body.appendChild(gapiScript);
      });
    }
  
    // Handle credential response from Google Sign-In
    handleCredentialResponse(response) {
      this.accessToken = response.credential;
    }
  
    // Authenticate user and get access token
    async authenticate() {
      await this.initializeGoogleAPI();
  
      return new Promise((resolve, reject) => {
        // Prompt Google Sign-In
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed()) {
            console.log('Authentication prompt not displayed');
            reject(new Error('Authentication failed'));
          }
        });
  
        // Set up a callback to handle successful authentication
        window.google.accounts.id.setTokenClient({
          client_id: this.clientId,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: (tokenResponse) => {
            this.accessToken = tokenResponse.access_token;
            resolve(this.accessToken);
          }
        });
      });
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
      if (window.google && window.google.accounts) {
        window.google.accounts.id.disableAutoSelect();
        this.accessToken = null;
        this.isInitialized = false;
      }
    }
  }
  
  export default GoogleDriveSync;