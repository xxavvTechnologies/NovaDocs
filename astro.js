class AstroAI {
    constructor() {
        this.usageCount = parseInt(localStorage.getItem('astro_usage_count') || '0');
        this.usageLimit = 20;
        this.usageResetDate = localStorage.getItem('astro_reset_date');
        this.checkUsageReset();
        this.setupSidebar();
        this.lastAction = null;
        this.lastInput = null;
        this.setupActions();
    }

    async checkUsageReset() {
        const now = new Date();
        const resetDate = new Date(this.usageResetDate || '2000-01-01');
        
        // Reset usage count if it's a new month
        if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
            this.usageCount = 0;
            this.usageResetDate = now.toISOString();
            localStorage.setItem('astro_usage_count', '0');
            localStorage.setItem('astro_reset_date', now.toISOString());
        }
    }

    setupSidebar() {
        const closeBtn = document.getElementById('closeAstro');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeSidebar());
        }
        this.updateUsageCount();
    }

    setupActions() {
        const tryAgainBtn = document.getElementById('astroTryAgain');
        const moreActionsBtn = document.getElementById('astroMoreActions');
        const menuContent = document.querySelector('.astro-menu-content');

        if (tryAgainBtn) {
            tryAgainBtn.addEventListener('click', () => this.tryAgain());
        }

        if (moreActionsBtn) {
            moreActionsBtn.addEventListener('click', () => {
                menuContent.classList.toggle('active');
            });

            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!moreActionsBtn.contains(e.target) && !menuContent.contains(e.target)) {
                    menuContent.classList.remove('active');
                }
            });
        }

        // Setup menu actions
        menuContent?.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const selection = window.getSelection().toString().trim();
                const editor = document.getElementById('editor');
                
                switch(action) {
                    case 'summarize':
                        this.summarizeText(editor.innerText);
                        break;
                    case 'expand':
                        if (selection) this.expandIdea(selection);
                        break;
                    case 'draft':
                        this.draftContent(editor.innerText, 'document');
                        break;
                }
                menuContent.classList.remove('active');
            });
        });
    }

    updateUsageCount() {
        const countEl = document.getElementById('astroUsageCount');
        if (countEl) {
            countEl.textContent = this.getRemainingUses();
        }
    }

    openSidebar() {
        const sidebar = document.getElementById('astroSidebar');
        if (sidebar) {
            sidebar.classList.add('active');
        }
    }

    closeSidebar() {
        const sidebar = document.getElementById('astroSidebar');
        if (sidebar) {
            sidebar.classList.remove('active');
        }
    }

    async tryAgain() {
        if (!this.lastAction || !this.lastInput) {
            notifications.warning('No Previous Action', 'Nothing to retry');
            return;
        }

        switch (this.lastAction) {
            case 'summarize':
                await this.summarizeText(this.lastInput);
                break;
            case 'expand':
                await this.expandIdea(this.lastInput);
                break;
            case 'draft':
                await this.draftContent(this.lastInput, 'document');
                break;
        }
    }

    async summarizeText(text) {
        this.lastAction = 'summarize';
        this.lastInput = text;
        if (!this.canUseAstro()) return;
        
        const loadingEl = this.createLoadingElement('Analyzing text...');
        
        try {
            const response = await fetch('/.netlify/functions/astro-ai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'summarize',
                    text: text
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'API request failed');
            }

            loadingEl.remove();
            this.incrementUsage();
            const responseContainer = document.getElementById('astroResponses');
            responseContainer.innerHTML += this.wrapResponseInContainer(data.summary_text);
            this.updateUsageCount();
            return data.summary_text;
        } catch (error) {
            loadingEl.remove();
            console.error('Summarization failed:', error);
            notifications.error(
                'Summarization Failed', 
                error.message || 'Could not summarize text. Please try again later.'
            );
        }
    }

    async expandIdea(text) {
        this.lastAction = 'expand';
        this.lastInput = text;
        if (!this.canUseAstro()) return;

        const loadingEl = this.createLoadingElement('Expanding idea...');

        try {
            const response = await fetch('/.netlify/functions/astro-ai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'expand',
                    text: text
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'API request failed');
            }

            loadingEl.remove();
            this.incrementUsage();
            const responseContainer = document.getElementById('astroResponses');
            responseContainer.innerHTML += this.wrapResponseInContainer(data.generated_text);
            this.updateUsageCount();
            return data.generated_text;
        } catch (error) {
            loadingEl.remove();
            console.error('Expansion failed:', error);
            notifications.error(
                'Expansion Failed', 
                error.message || 'Could not expand on the idea. Please try again later.'
            );
        }
    }

    async draftContent(topic, type) {
        this.lastAction = 'draft';
        this.lastInput = topic;
        if (!this.canUseAstro()) return;

        const loadingEl = this.createLoadingElement('Drafting content...');

        try {
            const response = await fetch('/.netlify/functions/astro-ai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'draft',
                    text: `${type} about ${topic}`
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'API request failed');
            }

            loadingEl.remove();
            this.incrementUsage();
            const responseContainer = document.getElementById('astroResponses');
            responseContainer.innerHTML += this.wrapResponseInContainer(data.generated_text);
            this.updateUsageCount();
            return data.generated_text;
        } catch (error) {
            loadingEl.remove();
            console.error('Draft failed:', error);
            notifications.error(
                'Draft Failed', 
                error.message || 'Could not create draft content. Please try again later.'
            );
        }
    }

    createLoadingElement(message) {
        const el = document.createElement('div');
        el.className = 'astro-loading';
        el.innerHTML = `<i class="fas fa-robot"></i> ${message}`;
        document.getElementById('astroResponses').appendChild(el);
        this.openSidebar();
        return el;
    }

    wrapResponseInContainer(text) {
        return `<div class="astro-response">${text}</div>`;
    }

    canUseAstro() {
        if (this.usageCount >= this.usageLimit) {
            notifications.warning(
                'Usage Limit Reached', 
                `You've reached your monthly limit of ${this.usageLimit} Astro uses. Resets next month.`
            );
            return false;
        }
        return true;
    }

    incrementUsage() {
        this.usageCount++;
        localStorage.setItem('astro_usage_count', this.usageCount.toString());
        this.updateUsageCount();
    }

    getRemainingUses() {
        return this.usageLimit - this.usageCount;
    }
}

export const astro = new AstroAI();
