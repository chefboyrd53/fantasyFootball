// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyCGaGqGUQwhh0PbSn6AjCu-ibLnPnOoqnE',
  authDomain: 'blue-gold-league.firebaseapp.com',
  projectId: 'blue-gold-league',
  storageBucket: 'blue-gold-league.firebasestorage.app',
  messagingSenderId: '107842991158',
  appId: '1:107842991158:web:3fd2e88ed9d2d971d1d497',
  measurementId: 'G-5F80T3EZ3Q',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Use React Native persistence for Auth
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export { db, auth }; 