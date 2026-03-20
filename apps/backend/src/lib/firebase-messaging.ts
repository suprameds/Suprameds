import { getApps, initializeApp, cert } from "firebase-admin/app"
import { getMessaging, type Message } from "firebase-admin/messaging"

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")

function isFirebaseConfigured() {
  return Boolean(FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY)
}

function getOrInitFirebaseApp() {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase Admin is not configured in environment variables")
  }

  if (getApps().length > 0) {
    return getApps()[0]
  }

  return initializeApp({
    credential: cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY,
    }),
    projectId: FIREBASE_PROJECT_ID,
  })
}

function customerTopic(customerId: string) {
  // Topic names can only contain basic URL-safe chars.
  const safeId = customerId.replace(/[^a-zA-Z0-9-_.~%]/g, "_")
  return `customer_${safeId}`
}

export async function subscribeTokenToCustomerTopic(customerId: string, token: string) {
  if (!isFirebaseConfigured()) return { ok: false as const, reason: "missing_env" as const }
  if (!token || !customerId) return { ok: false as const, reason: "invalid_input" as const }

  const app = getOrInitFirebaseApp()
  const messaging = getMessaging(app)
  await messaging.subscribeToTopic([token], customerTopic(customerId))
  return { ok: true as const }
}

export async function unsubscribeTokenFromCustomerTopic(customerId: string, token: string) {
  if (!isFirebaseConfigured()) return { ok: false as const, reason: "missing_env" as const }
  if (!token || !customerId) return { ok: false as const, reason: "invalid_input" as const }

  const app = getOrInitFirebaseApp()
  const messaging = getMessaging(app)
  await messaging.unsubscribeFromTopic([token], customerTopic(customerId))
  return { ok: true as const }
}

export async function sendPushToCustomerTopic(
  customerId: string,
  payload: {
    title: string
    body: string
    data?: Record<string, string>
  }
) {
  if (!isFirebaseConfigured()) return { ok: false as const, reason: "missing_env" as const }
  if (!customerId) return { ok: false as const, reason: "invalid_input" as const }

  const app = getOrInitFirebaseApp()
  const messaging = getMessaging(app)

  const message: Message = {
    topic: customerTopic(customerId),
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data,
    webpush: {
      notification: {
        title: payload.title,
        body: payload.body,
        icon: "/images/suprameds.svg",
      },
      fcmOptions: payload.data?.url ? { link: payload.data.url } : undefined,
    },
  }

  const id = await messaging.send(message)
  return { ok: true as const, id }
}

