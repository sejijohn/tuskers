import 'react-native-get-random-values';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  // apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  // authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  // projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  // storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  // messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  // appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
  apiKey: "AIzaSyDADeUXh_Wormoxa_vhDikMB4xicJ1_5FM",
  authDomain: "tuskers-8cbc4.firebaseapp.com",
  databaseURL: "https://tuskers-8cbc4-default-rtdb.firebaseio.com",
  projectId: "tuskers-8cbc4",
  storageBucket: "tuskers-8cbc4.firebasestorage.app",
  messagingSenderId: "34498458933",
  appId: "1:34498458933:web:e3e7e8827efc9a9424087c",
  measurementId: "G-HZ5CC2W5TL"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);