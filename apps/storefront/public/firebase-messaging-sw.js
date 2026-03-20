/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js")
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js")

firebase.initializeApp({
  apiKey: "AIzaSyA-pCRcas8RfwZbSOroUAF6PUgUD6bkxTU",
  authDomain: "supracynpharma-c7f6f.firebaseapp.com",
  projectId: "supracynpharma-c7f6f",
  storageBucket: "supracynpharma-c7f6f.firebasestorage.app",
  messagingSenderId: "176148661568",
  appId: "1:176148661568:web:ee73b75a66d8ae775466a5",
  measurementId: "G-RDYLD3PM8D",
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

