// Winner reveal helpers (host TV view). Pure, so they are unit tested.
type Ranked = { rank: number; votes: number };

// Every tied first-place nominee, in the order given. A category with no votes has no winner.
export function winnersOf<T extends Ranked>(nominees: T[]): T[] {
  return nominees.filter((n) => n.rank === 1 && n.votes > 0);
}
