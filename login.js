import { 
    auth, 
    googleProvider,
    githubProvider 
} from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    signInWithPopup,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    setPersistence,
    browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

class LoginManager {
    constructor() {
        this.loginForm = document.getElementById('loginForm');
        this.googleLoginBtn = document.getElementById('googleLogin');
        this.githubLoginBtn = document.getElementById('githubLogin');
        this.signupLink = document.getElementById('signupLink');
        this.forgotPasswordLink = document.getElementById('forgotPassword');
        this.isSignup = false;

        this.attachEventListeners();
        this.setupPersistence();
        this.checkAuthState();
    }

    attachEventListeners() {
        this.loginForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        this.googleLoginBtn.addEventListener('click', () => this.handleGoogleLogin());
        this.githubLoginBtn.addEventListener('click', () => this.handleGithubLogin());
        this.signupLink.addEventListener('click', (e) => this.toggleSignupMode(e));
        this.forgotPasswordLink.addEventListener('click', (e) => this.handleForgotPassword(e));
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            if (this.isSignup) {
                await createUserWithEmailAndPassword(auth, email, password);
                notifications.success('Success', 'Account created successfully');
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            this.redirectToEditor();
        } catch (error) {
            notifications.error('Authentication Error', error.message);
        }
    }

    async handleGoogleLogin() {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            if (result.user) {
                this.redirectToEditor();
            }
        } catch (error) {
            if (error.code === 'auth/account-exists-with-different-credential') {
                window.location.href = 'https://account.nova.xxavvgroup.com';
            } else {
                notifications.error('Google Sign-in Error', error.message);
            }
        }
    }

    async handleGithubLogin() {
        try {
            const result = await signInWithPopup(auth, githubProvider);
            if (result.user) {
                this.redirectToEditor();
            }
        } catch (error) {
            if (error.code === 'auth/account-exists-with-different-credential') {
                window.location.href = 'https://account.nova.xxavvgroup.com';
            } else {
                notifications.error('GitHub Sign-in Error', error.message);
            }
        }
    }

    toggleSignupMode(e) {
        e.preventDefault();
        // Redirect to Nova Account portal
        window.location.href = 'https://account.nova.xxavvgroup.com';
    }

    async handleForgotPassword(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;

        if (!email) {
            notifications.warning('Email Required', 'Please enter your email address');
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            notifications.success('Email Sent', 'Password reset instructions have been sent to your email');
        } catch (error) {
            notifications.error('Reset Error', error.message);
        }
    }

    async setupPersistence() {
        try {
            await setPersistence(auth, browserLocalPersistence);
        } catch (error) {
            console.error('Persistence setup failed:', error);
        }
    }

    checkAuthState() {
        auth.onAuthStateChanged((user) => {
            if (user) {
                // User is already signed in, redirect to documents page
                window.location.href = 'documents.html';
            }
        });
    }

    redirectToEditor() {
        // Change redirect to documents page
        window.location.href = 'documents.html';
    }
}

// Initialize login manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LoginManager();
});
