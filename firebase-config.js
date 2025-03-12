import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
    getAuth,
    GoogleAuthProvider,
    GithubAuthProvider
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
    getFirestore,
    collection,
    getDocs,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyAeNLHp2EO50B0PrZuBchOJvxhxHlVuVu4",
    authDomain: "novasuite-e4257.firebaseapp.com",
    projectId: "novasuite-e4257",
    storageBucket: "novasuite-e4257.firebasestorage.app",
    messagingSenderId: "349176160657",
    appId: "1:349176160657:web:942bcbe9ee33b617f63a30",
    measurementId: "G-2HW7Y59VXY"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

export { 
    auth, 
    db, 
    googleProvider,
    githubProvider,
    collection,
    getDocs,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit
};