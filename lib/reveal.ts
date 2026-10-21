// Winner reveal helpers (host TV view). Pure, so they are unit tested.
type Ranked = { rank: number; votes: number };

// Every tied first-place nominee, in the order given. A category with no votes has no winner.
export function winnersOf<T extends Ranked>(nominees: T[]): T[] {
  return nominees.filter((n) => n.rank === 1 && n.votes > 0);
}

// Fisher-Yates copy; `random` is injectable for tests.
export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// A fresh random order of the photos for one slideshow pass. When the previous pass ended on
// `lastPath`, the new one never starts on it, so a photo is not shown twice in a row.
export function slideshowOrder<T extends { path: string }>(photos: T[], lastPath: string | null, random: () => number = Math.random): T[] {
  const order = shuffled(photos, random);
  if (order.length > 1 && order[0].path === lastPath) [order[0], order[1]] = [order[1], order[0]];
  return order;
}
