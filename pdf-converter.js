class PDFConverter {
    constructor() {
        this.pdfjsLib = window.pdfjsLib;
        this.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    }

    async convertToDocument(file) {
        try {
            // Read the PDF file
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await this.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            let content = '<div class="page" data-page="1">';
            
            // Process each page
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                
                // Start new page div if not first page
                if (i > 1) {
                    content += `</div><div class="page" data-page="${i}">`;
                }

                // Convert text items to HTML
                let lastY = null;
                for (const item of textContent.items) {
                    if (lastY !== null && lastY !== item.transform[5]) {
                        content += '<br>';
                    }
                    
                    // Handle different text styles
                    const fontSize = Math.round(item.transform[0]); // Approximate font size
                    const style = [];
                    
                    if (fontSize > 20) {
                        content += `<h1>${item.str}</h1>`;
                    } else if (fontSize > 16) {
                        content += `<h2>${item.str}</h2>`;
                    } else {
                        if (item.fontName.toLowerCase().includes('bold')) {
                            style.push('font-weight: bold');
                        }
                        if (item.fontName.toLowerCase().includes('italic')) {
                            style.push('font-style: italic');
                        }
                        
                        content += style.length > 0 
                            ? `<span style="${style.join(';')}">${item.str}</span>` 
                            : item.str;
                    }
                    
                    lastY = item.transform[5];
                }
            }
            
            content += '</div>';
            return content;

        } catch (error) {
            console.error('PDF conversion error:', error);
            throw new Error('Failed to convert PDF');
        }
    }
}

export default PDFConverter;
