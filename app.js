// Nova Docs Editor Main Application Logic

document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('editor');
    const fontSelect = document.getElementById('font-select');
    const fontSizeSelect = document.getElementById('font-size-select');
    const textColorPicker = document.getElementById('text-color-picker');
    const highlightColorPicker = document.getElementById('highlight-color-picker');
    const formattingButtons = document.querySelectorAll('.formatting-btn');

    // Autosave functionality
    let saveTimeout;
    function autoSave() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            const content = editor.innerHTML;
            localStorage.setItem('novaDocs-content', content);
            console.log('Document autosaved');
        }, 1000);
    }

    // Load saved content on page load
    const savedContent = localStorage.getItem('novaDocs-content');
    if (savedContent) {
        editor.innerHTML = savedContent;
    }

    // Event listener for content changes
    editor.addEventListener('input', autoSave);

    // Formatting button event listeners
    formattingButtons.forEach(button => {
        button.addEventListener('click', () => {
            const command = button.dataset.command;
            document.execCommand(command, false, null);
            editor.focus();
        });
    });

    // Font family selection
    fontSelect.addEventListener('change', (e) => {
        document.execCommand('fontName', false, e.target.value);
        editor.focus();
    });

    // Font size selection
    fontSizeSelect.addEventListener('change', (e) => {
        document.execCommand('fontSize', false, e.target.value);
        editor.focus();
    });

    // Text color picker
    textColorPicker.addEventListener('change', (e) => {
        document.execCommand('foreColor', false, e.target.value);
        editor.focus();
    });

    // Highlight (background) color picker
    highlightColorPicker.addEventListener('change', (e) => {
        document.execCommand('hiliteColor', false, e.target.value);
        editor.focus();
    });

    // Keyboard shortcuts
    editor.addEventListener('keydown', (e) => {
        // Ctrl+B for Bold
        if (e.ctrlKey && e.key === 'b') {
            e.preventDefault();
            document.execCommand('bold', false, null);
        }
        // Ctrl+I for Italic
        if (e.ctrlKey && e.key === 'i') {
            e.preventDefault();
            document.execCommand('italic', false, null);
        }
        // Ctrl+U for Underline
        if (e.ctrlKey && e.key === 'u') {
            e.preventDefault();
            document.execCommand('underline', false, null);
        }
        // Ctrl+Z for Undo
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            document.execCommand('undo', false, null);
        }
        // Ctrl+Y for Redo
        if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            document.execCommand('redo', false, null);
        }
    });

    // Export functionality
    function exportDocument(format) {
        const content = editor.innerHTML;
        if (format === 'txt') {
            const blob = new Blob([editor.innerText], { type: 'text/plain' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'nova_docs_export.txt';
            link.click();
        } else if (format === 'html') {
            const blob = new Blob([content], { type: 'text/html' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'nova_docs_export.html';
            link.click();
        }
    }

    // TODO: Implement user authentication and cloud save/load
    // This is a placeholder for future implementation
    function cloudSave() {
        console.log('Cloud save functionality not yet implemented');
    }

    function cloudLoad() {
        console.log('Cloud load functionality not yet implemented');
    }

    // Prevent default drag and drop behavior to allow text dragging
    editor.addEventListener('dragstart', (e) => {
        e.preventDefault();
    });

    // Optional: Add placeholder behavior
    editor.addEventListener('focus', () => {
        if (editor.textContent === 'Start editing your document here...') {
            editor.textContent = '';
        }
    });

    editor.addEventListener('blur', () => {
        if (editor.textContent.trim() === '') {
            editor.textContent = 'Start editing your document here...';
        }
    });
});

// Export functions if needed
export {
    exportDocument
};