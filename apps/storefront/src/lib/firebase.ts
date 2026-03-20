import { getApp, getApps, initializeApp } from "firebase/app"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyA-pCRcas8RfwZbSOroUAF6PUgUD6bkxTU",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "supracynpharma-c7f6f.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "supracynpharma-c7f6f",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "supracynpharma-c7f6f.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "176148661568",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:176148661568:web:ee73b75a66d8ae775466a5",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "G-RDYLD3PM8D",
}

export function getFirebaseApp() {
  if (getApps().length > 0) return getApp()
  return initializeApp(firebaseConfig)
}

