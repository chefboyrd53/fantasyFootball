// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCGaGqGUQwhh0PbSn6AjCu-ibLnPnOoqnE",
  authDomain: "blue-gold-league.firebaseapp.com",
  projectId: "blue-gold-league",
  storageBucket: "blue-gold-league.firebasestorage.app",
  messagingSenderId: "107842991158",
  appId: "1:107842991158:web:3fd2e88ed9d2d971d1d497",
  measurementId: "G-5F80T3EZ3Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { db };
