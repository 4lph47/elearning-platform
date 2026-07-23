const KEY = "recentCourseSearches";
const MAX_ITEMS = 8;

export interface RecentCourseSearch {
  slug: string;
  title: string;
  thumbnailUrl: string | null;
}

export function getRecentCourseSearches(): RecentCourseSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addRecentCourseSearch(item: RecentCourseSearch) {
  if (typeof window === "undefined") return;
  const current = getRecentCourseSearches().filter((r) => r.slug !== item.slug);
  const next = [item, ...current].slice(0, MAX_ITEMS);
  localStorage.setItem(KEY, JSON.stringify(next));
}
