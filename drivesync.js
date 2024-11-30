// GoogleDriveSync.js
class GoogleDriveSync {
  constructor(clientId, apiKey) {
      this.clientId = clientId;
      this.apiKey = apiKey;
      this.isInitialized = false;
      this.accessToken = null;
  }

  // Initialize Google API client and identity services
  async initializeGoogleAPI() {
      if (this.isInitialized) return;

      return new Promise((resolve, reject) => {
          // Dynamically load Google API and Identity Services scripts
          const scripts = [
              { src: 'https://apis.google.com/js/api.js', id: 'gapi-script' },
              { src: 'https://accounts.google.com/gsi/client', id: 'gsi-script' }
          ];

          // Track script loading
          let loadedScripts = 0;

          const onScriptLoad = () => {
              loadedScripts++;
              if (loadedScripts === scripts.length) {
                  this.setupGoogleServices(resolve, reject);
              }
          };

          // Load scripts dynamically
          scripts.forEach(scriptConfig => {
              if (!document.getElementById(scriptConfig.id)) {
                  const script = document.createElement('script');
                  script.src = scriptConfig.src;
                  script.id = scriptConfig.id;
                  script.onload = onScriptLoad;
                  script.onerror = reject;
                  document.body.appendChild(script);
              } else {
                  onScriptLoad();
              }
          });
      });
  }

  // Set up Google services after script loading
  setupGoogleServices(resolve, reject) {
      try {
          // Initialize Google API Client
          window.gapi.load('client', () => {
              window.gapi.client.init({
                  apiKey: this.apiKey,
                  discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
              }).then(() => {
                  // Initialize Google Identity Services
                  window.google.accounts.id.initialize({
                      client_id: this.clientId,
                      callback: this.handleCredentialResponse.bind(this),
                      auto_select: true, // Attempt to auto-select an account
                      cancel_on_tap_outside: false // Prevent dismissing the prompt
                  });

                  // Opt-in to FedCM for future compatibility
                  window.google.accounts.id.enableFedCM();

                  this.isInitialized = true;
                  resolve();
              }).catch(reject);
          });
      } catch (error) {
          reject(error);
      }
  }

  // Handle credential response
  handleCredentialResponse(response) {
      if (response.credential) {
          this.accessToken = response.credential;
      }
  }

  // Authenticate user 
  async authenticate() {
      await this.initializeGoogleAPI();

      return new Promise((resolve, reject) => {
          try {
              // Use Google One Tap prompt
              window.google.accounts.id.prompt((notification) => {
                  // Handle different notification states
                  switch (notification.isDisplayed()) {
                      case true:
                          // Prompt is displayed
                          break;
                      case false:
                          // Try alternative authentication method
                          this.fallbackAuthentication(resolve, reject);
                          break;
                  }
              });

              // Set up token client for explicit authorization
              window.google.accounts.oauth2.initTokenClient({
                  client_id: this.clientId,
                  scope: 'https://www.googleapis.com/auth/drive.file',
                  callback: (tokenResponse) => {
                      if (tokenResponse.access_token) {
                          this.accessToken = tokenResponse.access_token;
                          resolve(this.accessToken);
                      }
                  }
              });
          } catch (error) {
              reject(error);
          }
      });
  }

  // Fallback authentication method
  fallbackAuthentication(resolve, reject) {
      try {
          // Attempt to trigger google sign-in explicitly
          const tokenClient = window.google.accounts.oauth2.initTokenClient({
              client_id: this.clientId,
              scope: 'https://www.googleapis.com/auth/drive.file',
              callback: (tokenResponse) => {
                  if (tokenResponse.access_token) {
                      this.accessToken = tokenResponse.access_token;
                      resolve(this.accessToken);
                  } else {
                      reject(new Error('Failed to obtain access token'));
                  }
              }
          });

          // Trigger sign-in
          tokenClient.requestAccessToken({ prompt: 'consent' });
      } catch (error) {
          reject(error);
      }
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
          window.google.accounts.id.revoke(this.clientId);
          this.accessToken = null;
          this.isInitialized = false;
      }
  }
}

export default GoogleDriveSync;