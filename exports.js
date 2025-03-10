class DocumentExporter {
    constructor() {
        this.depsLoaded = false;
        this.loadDependencies();
    }

    async loadDependencies() {
        try {
            // Load dependencies in parallel with Promise.all
            await Promise.all([
                // Load jsPDF
                this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
                // Load Turndown for HTML to Markdown conversion
                this.loadScript('https://unpkg.com/turndown/dist/turndown.js')
            ]);
            this.depsLoaded = true;
            // Initialize Turndown instance after load
            if (window.TurndownService) {
                this.turndown = new window.TurndownService({
                    headingStyle: 'atx',
                    codeBlockStyle: 'fenced'
                });
            }
        } catch (error) {
            console.error('Failed to load export dependencies:', error);
            throw new Error('Export dependencies failed to load');
        }
    }

    loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load ${url}`));
            document.head.appendChild(script);
        });
    }

    async ensureDependencies() {
        if (!this.depsLoaded) {
            await this.loadDependencies();
        }
    }

    async exportToPDF(content, title = 'document') {
        await this.ensureDependencies();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Remove page divs but keep content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const pages = tempDiv.querySelectorAll('.page');
        let fullContent = '';
        pages.forEach(page => fullContent += page.innerHTML);

        // Add title
        doc.setFontSize(16);
        doc.text(title, 20, 20);
        
        // Add content
        doc.setFontSize(12);
        const splitText = doc.splitTextToSize(this.stripHtml(fullContent), 170);
        doc.text(splitText, 20, 30);

        // Save PDF
        doc.save(`${title}.pdf`);
    }

    exportToMarkdown(content) {
        if (!this.turndown) {
            throw new Error('Markdown converter not initialized');
        }

        try {
            // Clean up the content first
            const cleanContent = this.cleanContentForMarkdown(content);
            
            // Convert to Markdown
            const markdown = this.turndown.turndown(cleanContent);
            
            // Download the file
            this.downloadFile(markdown, 'document.md', 'text/markdown');
        } catch (error) {
            console.error('Markdown conversion failed:', error);
            throw new Error('Failed to convert document to Markdown');
        }
    }

    cleanContentForMarkdown(content) {
        const temp = document.createElement('div');
        temp.innerHTML = content;

        // Remove page divs but keep content
        const pages = temp.querySelectorAll('.page');
        let cleanContent = '';
        pages.forEach(page => {
            cleanContent += page.innerHTML;
        });

        // Create a new div with clean content
        const cleanDiv = document.createElement('div');
        cleanDiv.innerHTML = cleanContent;

        // Remove unnecessary spans and preserve only styling
        cleanDiv.querySelectorAll('span').forEach(span => {
            if (!span.style.fontWeight && !span.style.fontStyle && !span.style.textDecoration) {
                const text = span.textContent;
                span.replaceWith(text);
            }
        });

        return cleanDiv.innerHTML;
    }

    exportToRTF(content) {
        const rtfHeader = '{\\rtf1\\ansi\n';
        const rtfFooter = '}';
        const plainText = this.stripHtml(content);
        const rtfContent = rtfHeader + this.escapeRTF(plainText) + rtfFooter;
        
        this.downloadFile(rtfContent, 'document.rtf', 'application/rtf');
    }

    exportToWord(content) {
        const wordContent = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
            <head>
                <meta charset="utf-8">
                <title>Export HTML to Word Document</title>
            </head>
            <body>
                ${content}
            </body>
            </html>
        `;

        this.downloadFile(wordContent, 'document.doc', 'application/msword');
    }

    exportToHTML(content) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Exported Document</title>
                <style>
                    .page { margin: 2rem auto; max-width: 8.5in; }
                </style>
            </head>
            <body>
                ${content}
            </body>
            </html>
        `;
        this.downloadFile(html, 'document.html', 'text/html');
    }

    exportToPlainText(content) {
        const text = this.stripHtml(content);
        this.downloadFile(text, 'document.txt', 'text/plain');
    }

    stripHtml(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent || temp.innerText || '';
    }

    escapeRTF(text) {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/\{/g, '\\{')
            .replace(/\}/g, '\\}')
            .replace(/\n/g, '\\par\n');
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    }
}
