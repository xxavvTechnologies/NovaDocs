// Format selected text
function format(command) {
    document.execCommand(command, false, null);
}

// Save content to localStorage
document.getElementById('save-btn').addEventListener('click', () => {
    const content = document.getElementById('editor').innerHTML;
    localStorage.setItem('documentContent', content);
    alert('Document saved to local storage!');
});

// Load content from localStorage
document.getElementById('load-btn').addEventListener('click', () => {
    const content = localStorage.getItem('documentContent');
    if (content) {
        document.getElementById('editor').innerHTML = content;
        alert('Document loaded from local storage!');
    } else {
        alert('No saved document found.');
    }
});
