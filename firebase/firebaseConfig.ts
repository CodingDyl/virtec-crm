// Import the functions you need from the SDKs you need
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDeG-s_7ejLRvvSWIPJ0sKrfotQktU8KbA",
  authDomain: "virtec-crm.firebaseapp.com",
  projectId: "virtec-crm",
  storageBucket: "virtec-crm.firebasestorage.app",
  messagingSenderId: "135812408783",
  appId: "1:135812408783:web:001143978623f36e4d9eba"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, GoogleAuthProvider, db, storage}
