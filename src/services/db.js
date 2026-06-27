import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDXa1SdnPX0euP9f4lx-DQjmKDXrgQuSjs",
  authDomain: "tournamentscore-6fbe5.firebaseapp.com",
  projectId: "tournamentscore-6fbe5",
  storageBucket: "tournamentscore-6fbe5.firebasestorage.app",
  messagingSenderId: "456131998495",
  appId: "1:456131998495:web:62a81df557fb05c5b1362a",
  measurementId: "G-M9SMXDR001"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

