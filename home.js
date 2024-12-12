//home.js

document.addEventListener('DOMContentLoaded', () => {
    const documentListContainer = document.getElementById('document-list');
    const templatesContainer = document.getElementById('templates-container');

    // Document Manager (similar to previous implementation)
    const DocumentManager = {
        STORAGE_KEY: 'novaDocs-documents',

        // Get all saved documents
        getDocuments() {
            try {
                const docs = localStorage.getItem(this.STORAGE_KEY);
                return docs ? JSON.parse(docs) : {};
            } catch (error) {
                console.error('Error retrieving documents:', error);
                return {};
            }
        }
    };

    // Render document list
    function renderDocumentList() {
        const documents = DocumentManager.getDocuments();
        documentListContainer.innerHTML = '';

        // Sort documents by last edit date (most recent first)
        const sortedDocuments = Object.entries(documents)
            .sort(([, a], [, b]) => new Date(b.lastEditDate) - new Date(a.lastEditDate));

        if (sortedDocuments.length === 0) {
            const noDocsMessage = document.createElement('div');
            noDocsMessage.textContent = 'No documents saved yet';
            noDocsMessage.className = 'text-center text-gray-500 p-4';
            documentListContainer.appendChild(noDocsMessage);
            return;
        }

        sortedDocuments.forEach(([name, doc]) => {
            const docElement = document.createElement('div');
            docElement.className = 'bg-gray-50 p-4 rounded-lg flex justify-between items-center hover:bg-gray-100 transition';
            
            const detailsContainer = document.createElement('div');
            detailsContainer.className = 'flex flex-col';

            const nameSpan = document.createElement('span');
            nameSpan.textContent = name;
            nameSpan.className = 'font-medium text-gray-800 mb-1';

            const lastEditSpan = document.createElement('small');
            const lastEditDate = new Date(doc.lastEditDate);
            lastEditSpan.textContent = `Last edited: ${lastEditDate.toLocaleString()}`;
            lastEditSpan.className = 'text-xs text-gray-500';

            const openLink = document.createElement('a');
            openLink.href = `editor.html?doc=${encodeURIComponent(name)}`;
            openLink.innerHTML = '<i class="fas fa-edit text-blue-500 hover:text-blue-600"></i>';
            openLink.className = 'ml-4';
            openLink.title = 'Open Document';

            detailsContainer.appendChild(nameSpan);
            detailsContainer.appendChild(lastEditSpan);
            
            docElement.appendChild(detailsContainer);
            docElement.appendChild(openLink);
            documentListContainer.appendChild(docElement);
        });
    }

    // Template handling
    function setupTemplateHandlers() {
        const templates = {
            'resume': `
                <h1 style="text-align: center;">Your Name</h1>
                <p style="text-align: center;">Contact Information</p>
                <h2>Professional Summary</h2>
                <p>A brief overview of your professional experience and skills.</p>
                <h2>Work Experience</h2>
                <h3>Job Title, Company Name</h3>
                <p>Date Range</p>
                <ul>
                    <li>Key responsibility or achievement</li>
                    <li>Key responsibility or achievement</li>
                </ul>
                <h2>Education</h2>
                <h3>Degree, University Name</h3>
                <p>Graduation Date</p>
            `,
            'report': `
                <h1 style="text-align: center;">Report Title</h1>
                <p style="text-align: center;">Date</p>
                <h2>Introduction</h2>
                <p>Provide background and context for the report.</p>
                <h2>Findings</h2>
                <p>Detail the key findings of your research or analysis.</p>
                <h2>Conclusion</h2>
                <p>Summarize the main points and provide recommendations.</p>
            `,
            'letter': `
                <p>[Your Name]<br>
                [Your Address]<br>
                [City, State ZIP Code]</p>
                <p>[Date]</p>
                <p>[Recipient Name]<br>
                [Recipient Address]<br>
                [City, State ZIP Code]</p>
                <p>Dear [Recipient Name],</p>
                <p>First paragraph: Introduce yourself and state the purpose of the letter.</p>
                <p>Second paragraph: Provide additional details or explanation.</p>
                <p>Closing paragraph: Summarize and indicate next steps.</p>
                <p>Sincerely,</p>
                <p>[Your Name]</p>
            `,
            'meeting-notes': `
                <h1>Meeting Notes</h1>
                <p><strong>Date:</strong> [Insert Date]<br>
                <strong>Time:</strong> [Insert Time]<br>
                <strong>Attendees:</strong> [List Attendees]</p>
                <h2>Agenda</h2>
                <ul>
                    <li>Item 1</li>
                    <li>Item 2</li>
                </ul>
                <h2>Discussion Points</h2>
                <ul>
                    <li>Point 1
                        <ul>
                            <li>Key details</li>
                            <li>Action items</li>
                        </ul>
                    </li>
                </ul>
                <h2>Action Items</h2>
                <ul>
                    <li>[Task] - [Assignee] - [Due Date]</li>
                </ul>
            `
        };

        document.querySelectorAll('.template-card').forEach(card => {
            card.addEventListener('click', () => {
                const templateName = card.dataset.template;
                const templateContent = templates[templateName];
                
                // Open editor with template
                const editorUrl = new URL('editor.html', window.location.origin);
                editorUrl.searchParams.set('template', templateName);
                window.location.href = editorUrl;
                
                // Store template in sessionStorage for editor to read
                sessionStorage.setItem('novaDocsTemplate', templateContent);
            });
        });
    }

    // Initialize
    renderDocumentList();
    setupTemplateHandlers();
});