/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js")
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js")

firebase.initializeApp({
  apiKey: "AIzaSyDOeGUERI3zuojqi_y906iwywQMIGfp3Tk",
  authDomain: "supracyn-bda35.firebaseapp.com",
  projectId: "supracyn-bda35",
  storageBucket: "supracyn-bda35.firebasestorage.app",
  messagingSenderId: "500634840844",
  appId: "1:500634840844:web:213c0717866f2292c2e329",
  measurementId: "G-JKGJ3D3B86",
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || "Suprameds"
  const body = payload?.notification?.body || "You have a new update."
  const icon = payload?.notification?.icon || "/images/suprameds.svg"
  const url = payload?.data?.url || "/"

  self.registration.showNotification(title, {
    body,
    icon,
    data: { url },
  })
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = event.notification?.data?.url || "/"
  event.waitUntil(clients.openWindow(targetUrl))
})

