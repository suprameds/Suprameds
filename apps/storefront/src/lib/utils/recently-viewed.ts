const STORAGE_KEY = "_suprameds_recently_viewed"
const MAX_ITEMS = 20

export type RecentlyViewedItem = {
  id: string
  title: string
  handle: string
  thumbnail: string | null
}

export function getRecentlyViewed(): RecentlyViewedItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addRecentlyViewed(item: RecentlyViewedItem) {
  if (typeof window === "undefined") return
  try {
    const items = getRecentlyViewed().filter((i) => i.id !== item.id)
    items.unshift(item)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
  } catch {
    // localStorage full or unavailable
  }
}

export function clearRecentlyViewed() {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
}
