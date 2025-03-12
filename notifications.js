const ERROR_CODES = {
    SAVE_ERROR: 'E001',
    LOAD_ERROR: 'E002',
    DELETE_ERROR: 'E003',
    STORAGE_FULL: 'E004',
    INVALID_FONT: 'E005',
    TABLE_ERROR: 'E006',
    AUTH_ERROR: 'E007',
    NETWORK_ERROR: 'E008',
    FORMAT_ERROR: 'E009',
    UNKNOWN_ERROR: 'E999'
};

class NotificationSystem {
    constructor() {
        this.container = document.getElementById('notifications');
        this.notifications = new Map();
        this.counter = 0;
    }

    show(options) {
        const {
            type = 'info',
            title,
            message,
            duration = 5000,
            errorCode = null
        } = options;

        const id = `notification-${this.counter++}`;
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.id = id;
        
        notification.innerHTML = `
            <i class="notification-icon fas ${icons[type]}"></i>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
                ${errorCode ? `<div class="notification-error-code">Error Code: ${errorCode}</div>` : ''}
            </div>
            <button class="notification-close" onclick="notifications.dismiss('${id}')">×</button>
        `;

        this.container.appendChild(notification);
        this.notifications.set(id, setTimeout(() => this.dismiss(id), duration));

        return id;
    }

    dismiss(id) {
        const notification = document.getElementById(id);
        if (!notification) return;

        notification.style.animation = 'slideOut 0.3s ease-out forwards';
        clearTimeout(this.notifications.get(id));
        this.notifications.delete(id);

        setTimeout(() => notification.remove(), 300);
    }

    success(title, message, duration) {
        return this.show({ type: 'success', title, message, duration });
    }

    error(title, message, errorCode, duration = 8000) {
        return this.show({ type: 'error', title, message, errorCode, duration });
    }

    warning(title, message, duration) {
        return this.show({ type: 'warning', title, message, duration });
    }

    info(title, message, duration) {
        return this.show({ type: 'info', title, message, duration });
    }

    getIcon(type) {
        const icons = {
            success: '<i class="fas fa-check-circle"></i>',
            error: '<i class="fas fa-exclamation-circle"></i>',
            warning: '<i class="fas fa-exclamation-triangle"></i>',
            info: '<i class="fas fa-info-circle"></i>'
        };
        return icons[type] || icons.info;
    }

    minimal(type, title, message) {
        const notification = document.createElement('div');
        notification.className = `notification minimal ${type}`;
        notification.dataset.tooltip = `${title}: ${message}`;

        const icon = document.createElement('div');
        icon.className = 'notification-icon';
        icon.innerHTML = this.getIcon(type);
        
        notification.appendChild(icon);

        this.container.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, 2000);
    }
}

const notifications = new NotificationSystem();
