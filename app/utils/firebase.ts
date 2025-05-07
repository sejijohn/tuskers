// import 'react-native-get-random-values';
// import { initializeApp } from 'firebase/app';
// import { getAuth,initializeAuth, getReactNativePersistence } from '@firebase/auth';
// import { getFirestore } from 'firebase/firestore';
// import { getStorage } from 'firebase/storage';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import Constants from 'expo-constants';


// // const firebaseConfig = {
// //   apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
// //   authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
// //   projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
// //   storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
// //   messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
// //   appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
// //   // apiKey: "AIzaSyDADeUXh_Wormoxa_vhDikMB4xicJ1_5FM",
// //   // authDomain: "tuskers-8cbc4.firebaseapp.com",
// //   // databaseURL: "https://tuskers-8cbc4-default-rtdb.firebaseio.com",
// //   // projectId: "tuskers-8cbc4",
// //   // storageBucket: "tuskers-8cbc4.firebasestorage.app",
// //   // messagingSenderId: "34498458933",
// //   // appId: "1:34498458933:web:e3e7e8827efc9a9424087c",
// //   // measurementId: "G-HZ5CC2W5TL"
// // };

// // const {
// //   firebaseApiKey,
// //   firebaseAuthDomain,
// //   firebaseProjectId,
// //   firebaseStorageBucket,
// //   firebaseMessagingSenderId,
// //   firebaseAppId,
// // } = Constants.expoConfig?.extra;

// // const firebaseConfig = {
// //   apiKey: firebaseApiKey,
// //   authDomain: firebaseAuthDomain,
// //   projectId: firebaseProjectId,
// //   storageBucket: firebaseStorageBucket,
// //   messagingSenderId: firebaseMessagingSenderId,
// //   appId: firebaseAppId,
// // };
// // console.log("🔥 Firebase config:", {
// //   apiKey: Constants.expoConfig.extra?.firebaseApiKey,
// //   authDomain: Constants.expoConfig.extra?.firebaseAuthDomain,
// //   projectId: Constants.expoConfig.extra?.firebaseProjectId,
// // });

// const extra = Constants.expoConfig?.extra || {};
// if (!extra.firebaseApiKey || !extra.firebaseProjectId) {
//   throw new Error('❌ Firebase config missing in Constants.extra');
// }
// const firebaseConfig = {
//   apiKey: extra.firebaseApiKey,
//   authDomain: extra.firebaseAuthDomain,
//   projectId: extra.firebaseProjectId,
//   storageBucket: extra.firebaseStorageBucket,
//   messagingSenderId: extra.firebaseMessagingSenderId,
//   appId: extra.firebaseAppId,
// };


// const app = initializeApp(firebaseConfig);

// //export const auth = getAuth(app);
// export const auth = initializeAuth(app, {
//   persistence: getReactNativePersistence(AsyncStorage),
// });
// export const db = getFirestore(app);
// export const storage = getStorage(app);

import 'react-native-get-random-values';
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with platform-specific persistence
const auth = Platform.OS === 'web' 
  ? getAuth(app)
  : initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };