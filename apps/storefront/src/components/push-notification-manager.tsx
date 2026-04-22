import { useEffect } from "react"
import { getMessaging, getToken, isSupported } from "firebase/messaging"
import { sdk } from "@/lib/utils/sdk"
import { getFirebaseApp } from "@/lib/firebase"
import { useCustomer } from "@/lib/hooks/use-customer"
import { isNativeApp } from "@/lib/utils/capacitor"
import { requestNotificationPermission } from "@/lib/capacitor"
import { useToast } from "@/lib/context/toast-context"
import { useNavigate } from "@tanstack/react-router"

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
  const { showToast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    if (!customer?.id) return

    let active = true
    const nativeListeners: Array<{ remove: () => void }> = []

    async function registerNative() {
      await requestNotificationPermission(async (token) => {
        if (!active) return
        try {
          await registerToken(token)
        } catch (err) {
          if (import.meta.env.DEV) console.warn("[push] backend register failed", err)
        }
      })

      try {
        const { PushNotifications } = await import("@capacitor/push-notifications")

        // Foreground: FCM does not auto-display when the app is in foreground,
        // so surface the notification body as a toast.
        nativeListeners.push(
          await PushNotifications.addListener("pushNotificationReceived", (notification) => {
            const body = notification.body || notification.title
            if (body) showToast(body)
          }),
        )

        // Tap on a delivered notification — navigate to the deep link if provided.
        nativeListeners.push(
          await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
            const target = (action.notification.data as { link?: string; url?: string })?.link
              ?? (action.notification.data as { link?: string; url?: string })?.url
            if (!target) return
            try {
              const parsed = new URL(target)
              navigate({ to: parsed.pathname + parsed.search, replace: false })
            } catch {
              if (target.startsWith("/")) navigate({ to: target, replace: false })
            }
          }),
        )
      } catch (err) {
        if (import.meta.env.DEV) console.warn("[push] native listeners failed", err)
      }
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
      nativeListeners.forEach((h) => h.remove())
    }
  }, [customer?.id, navigate, showToast])

  return null
}

