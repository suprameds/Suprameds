export const DRAFTS_KEY = "suprameds_pharmacist_drafts"
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000

export function loadDrafts<T extends { savedAt: string }>(): T[] {
  if (typeof window === "undefined") return []
  try {
    const all: T[] = JSON.parse(localStorage.getItem(DRAFTS_KEY) || "[]")
    const now = Date.now()
    const fresh = all.filter((d) => now - new Date(d.savedAt).getTime() < DRAFT_TTL_MS)
    if (fresh.length !== all.length) {
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(fresh))
    }
    return fresh
  } catch {
    return []
  }
}

export function saveDrafts<T>(drafts: T[]) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts))
}
