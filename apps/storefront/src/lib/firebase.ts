import { getApp, getApps, initializeApp } from "firebase/app"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyDOeGUERI3zuojqi_y906iwywQMIGfp3Tk",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "supracyn-bda35.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "supracyn-bda35",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "supracyn-bda35.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "500634840844",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:500634840844:web:213c0717866f2292c2e329",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "G-JKGJ3D3B86",
}

export function getFirebaseApp() {
  if (getApps().length > 0) return getApp()
  return initializeApp(firebaseConfig)
}

