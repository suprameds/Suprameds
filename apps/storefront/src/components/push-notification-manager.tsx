import { useEffect } from "react"
import { getMessaging, getToken, isSupported } from "firebase/messaging"
import { sdk } from "@/lib/utils/sdk"
import { getFirebaseApp } from "@/lib/firebase"
import { useCustomer } from "@/lib/hooks/use-customer"
import { isNativeApp } from "@/lib/utils/capacitor"
import { requestNotificationPermission } from "@/lib/capacitor"

const TOKEN_CACHE_KEY = "suprameds_fcm_token"

async function registerToken(token: string) {
  const previous = window.localStorage.getItem(TOKEN_CACHE_KEY)
  if (previous === token) return
  await sdk.client.fetch("/store/push/register", {
    method: "POST",
    body: { token },
  })
  window.localStorage.setItem(TOKEN_CACHE_KEY, token)
}

export function PushNotificationManager() {
  const { data: customer } = useCustomer()

  useEffect(() => {
    if (!customer?.id) return

    let active = true

    async function registerNative() {
      await requestNotificationPermission(async (token) => {
        if (!active) return
        try {
          await registerToken(token)
        } catch (err) {
          if (import.meta.env.DEV) console.warn("[push] backend register failed", err)
        }
      })
    }

    async function registerWeb() {
      try {
        if (typeof window === "undefined") return
        if (!("serviceWorker" in navigator)) return
        if (!("Notification" in window)) return
        if (!import.meta.env.VITE_FIREBASE_VAPID_KEY) return

        const supported = await isSupported()
        if (!supported) return

        let permission = Notification.permission
        if (permission === "default") {
          permission = await Notification.requestPermission()
        }
        if (permission !== "granted") return

        const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js")
        if (!active) return

        const messaging = getMessaging(getFirebaseApp())
        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: registration,
        })

        if (!token || !active) return
        await registerToken(token)
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn("[push] registration failed", err)
        }
      }
    }

    if (isNativeApp()) {
      registerNative()
    } else {
      registerWeb()
    }

    return () => {
      active = false
    }
  }, [customer?.id])

  return null
}

