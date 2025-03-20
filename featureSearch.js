import { astro } from './astro.js';

class FeatureSearch {
    constructor() {
        this.features = [
            {
                id: 'bold',
                title: 'Bold Text',
                description: 'Make selected text bold',
                icon: 'fa-bold',
                shortcut: 'Ctrl + B',
                action: () => document.getElementById('boldBtn').click()
            },
            {
                id: 'italic',
                title: 'Italic Text',
                description: 'Make selected text italic',
                icon: 'fa-italic',
                shortcut: 'Ctrl + I',
                action: () => document.getElementById('italicBtn').click()
            },
            {
                id: 'underline',
                title: 'Underline Text',
                description: 'Add underline to selected text',
                icon: 'fa-underline',
                shortcut: 'Ctrl + U',
                action: () => document.getElementById('underlineBtn').click()
            },
            {
                id: 'share',
                title: 'Share Document',
                description: 'Share document with others',
                icon: 'fa-share-alt',
                shortcut: 'Ctrl + Shift + S',
                action: () => document.getElementById('shareBtn').click()
            },
            {
                id: 'export',
                title: 'Export Document',
                description: 'Export document in different formats',
                icon: 'fa-download',
                shortcut: 'Ctrl + Shift + E',
                action: () => document.getElementById('exportBtn').click()
            },
            {
                id: 'astro-summarize',
                title: 'Astro: Summarize Document',
                description: 'Use Astro AI to summarize the entire document',
                icon: 'fa-robot',
                shortcut: 'Alt + S',
                astroFeature: true,
                action: async () => {
                    const editor = document.getElementById('editor');
                    const content = editor.innerText.trim();
                    if (!content) {
                        notifications.warning('Empty Document', 'Please add some content to summarize');
                        return;
                    }
                    
                    const summary = await astro.summarizeText(content);
                    if (summary) {
                        // Insert at cursor position or at the start of document
                        const selection = window.getSelection();
                        if (selection.rangeCount > 0) {
                            selection.getRangeAt(0).insertNode(document.createTextNode(summary));
                        } else {
                            editor.innerHTML = summary + editor.innerHTML;
                        }
                        notifications.success('Document Summarized', `${astro.getRemainingUses()} Astro uses remaining`);
                    }
                }
            },
            {
                id: 'astro-expand',
                title: 'Astro: Expand Selection',
                description: 'Use Astro AI to expand on selected text (requires selection)',
                icon: 'fa-lightbulb',
                shortcut: 'Alt + E', 
                astroFeature: true,
                action: async () => {
                    const selection = window.getSelection().toString().trim();
                    if (!selection) {
                        notifications.warning('No Text Selected', 'Please select the text you want to expand upon');
                        return;
                    }
                    
                    const expanded = await astro.expandIdea(selection);
                    if (expanded) {
                        document.execCommand('insertText', false, expanded);
                        notifications.success('Selection Expanded', `${astro.getRemainingUses()} Astro uses remaining`);
                    }
                }
            },
            {
                id: 'astro-draft',
                title: 'Astro: Draft from Document',
                description: 'Use Astro AI to draft a new version based on current content',
                icon: 'fa-pen-fancy',
                shortcut: 'Alt + D',
                astroFeature: true,
                action: async () => {
                    const editor = document.getElementById('editor');
                    const content = editor.innerText.trim();
                    if (!content) {
                        notifications.warning('Empty Document', 'Please add some content to work from');
                        return;
                    }
                    
                    const draft = await astro.draftContent(content, 'document');
                    if (draft) {
                        // Create new page for the draft
                        const newPage = document.createElement('div');
                        newPage.className = 'page';
                        newPage.dataset.page = editor.querySelectorAll('.page').length + 1;
                        newPage.innerHTML = draft;
                        editor.appendChild(newPage);
                        notifications.success('Draft Created', `${astro.getRemainingUses()} Astro uses remaining`);
                    }
                }
            }
        ];

        this.init();
    }

    init() {
        this.createDialog();
        this.setupEventListeners();
    }

    createDialog() {
        const overlay = document.createElement('div');
        overlay.className = 'feature-search-overlay';
        overlay.innerHTML = `
            <div class="feature-search-dialog">
                <input type="text" class="feature-search-input" placeholder="Search for features (e.g., 'bold', 'share')">
                <div class="feature-search-results"></div>
            </div>
        `;
        document.body.appendChild(overlay);

        this.overlay = overlay;
        this.input = overlay.querySelector('.feature-search-input');
        this.results = overlay.querySelector('.feature-search-results');
    }

    setupEventListeners() {
        // Toggle dialog with Ctrl + / shortcut
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === '.') {
                e.preventDefault();
                this.toggleDialog();
            } else if (e.key === 'Escape' && this.overlay.style.display === 'block') {
                this.hideDialog();
            } else if (e.altKey || e.metaKey) { // Handle Alt/Option key shortcuts
                switch (e.key.toLowerCase()) {
                    case 's':
                        e.preventDefault();
                        const summarizeFeature = this.features.find(f => f.id === 'astro-summarize');
                        if (summarizeFeature) {
                            summarizeFeature.action();
                        }
                        break;
                    case 'e':
                        e.preventDefault();
                        const expandFeature = this.features.find(f => f.id === 'astro-expand');
                        if (expandFeature) {
                            expandFeature.action();
                        }
                        break;
                    case 'd':
                        e.preventDefault();
                        const draftFeature = this.features.find(f => f.id === 'astro-draft');
                        if (draftFeature) {
                            draftFeature.action();
                        }
                        break;
                }
            }
        });

        // Handle search input and shortcuts for Astro features
        this.input.addEventListener('input', () => {
            this.performSearch();
        });

        // Handle keyboard navigation
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                this.handleNavigation(e.key === 'ArrowDown' ? 1 : -1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                this.executeSelected();
            }
        });

        // Close when clicking outside
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hideDialog();
            }
        });
    }

    toggleDialog() {
        if (this.overlay.style.display === 'block') {
            this.hideDialog();
        } else {
            this.showDialog();
        }
    }

    showDialog() {
        this.overlay.style.display = 'block';
        this.input.value = '';
        this.input.focus();
        this.performSearch();
    }

    hideDialog() {
        this.overlay.style.display = 'none';
    }

    performSearch() {
        const query = this.input.value.toLowerCase();
        let results = this.features;
        
        if (query) {
            results = this.features.filter(feature => 
                feature.title.toLowerCase().includes(query) ||
                feature.description.toLowerCase().includes(query)
            );
        }

        this.renderResults(results.slice(0, query ? results.length : 5));
    }

    renderResults(results) {
        if (results.length === 0) {
            this.results.innerHTML = `
                <div class="feature-search-empty">
                    <i class="fas fa-search"></i>
                    <p>No features found</p>
                </div>
            `;
            return;
        }

        this.results.innerHTML = results.map((feature, index) => `
            <div class="feature-search-item ${index === 0 ? 'selected' : ''}" data-id="${feature.id}">
                <i class="fas ${feature.icon}"></i>
                <div class="feature-details">
                    <div class="feature-title">${feature.title}</div>
                    <div class="feature-description">${feature.description}</div>
                </div>
                <div class="shortcut">${feature.shortcut}</div>
            </div>
        `).join('');

        this.results.querySelectorAll('.feature-search-item').forEach(item => {
            item.addEventListener('click', () => {
                const feature = this.features.find(f => f.id === item.dataset.id);
                if (feature) {
                    feature.action();
                    this.hideDialog();
                }
            });
        });
    }

    handleNavigation(direction) {
        const items = this.results.querySelectorAll('.feature-search-item');
        const currentIndex = Array.from(items).findIndex(item => item.classList.contains('selected'));
        
        items[currentIndex]?.classList.remove('selected');
        
        let newIndex = currentIndex + direction;
        if (newIndex < 0) newIndex = items.length - 1;
        if (newIndex >= items.length) newIndex = 0;
        
        items[newIndex]?.classList.add('selected');
        items[newIndex]?.scrollIntoView({ block: 'nearest' });
    }

    executeSelected() {
        const selectedItem = this.results.querySelector('.feature-search-item.selected');
        if (selectedItem) {
            const feature = this.features.find(f => f.id === selectedItem.dataset.id);
            if (feature) {
                feature.action();
                this.hideDialog();
            }
        }
    }
}

// Initialize when DOM is loaded
window.addEventListener('DOMContentLoaded', async () => {
    window.featureSearch = new FeatureSearch();
});
