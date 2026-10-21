// Category screen name filter, shown once a category has more than SEARCH_THRESHOLD nominees.
// Same rule as the server's name matches: case-insensitive substring on either name; photo-only
// nominees never match.
type Names = { personName: string | null; costumeName: string | null };

export const SEARCH_THRESHOLD = 8;

export function showSearch(count: number): boolean {
  return count > SEARCH_THRESHOLD;
}

export function filterByName<T extends Names>(nominees: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return nominees;
  return nominees.filter((n) => [n.personName, n.costumeName].some((name) => name?.toLowerCase().includes(q)));
}
