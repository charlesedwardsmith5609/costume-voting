import type { CategorySlug } from "./categories";

// The only nominee fields a guest ever receives (SPEC: id, names, categories, photo URL).
export type GuestNominee = {
  id: string;
  personName: string | null;
  costumeName: string | null;
  categories: CategorySlug[];
  photoUrl: string;
  // Small copy for grids and strips; may be missing (older photos, failed upload), so the UI
  // falls back to photoUrl.
  thumbUrl: string;
};

export type VotingStatus = "not_started" | "open" | "closed";

export type GuestState = {
  status: VotingStatus;
  votingOpensAt: string | null;
  votingClosesAt: string | null;
  // Results are visible to guests (published by the host, and voting is closed).
  resultsPublished: boolean;
  serverNow: string;
};

// Published results for guests (/api/results): per category, nominees with votes in rank order
// (ties share a rank) and the rest as also nominated. Never vote counts.
export type GuestResultNominee = {
  id: string;
  personName: string | null;
  costumeName: string | null;
  photoUrl: string;
  thumbUrl: string;
};
export type GuestCategoryResult = {
  category: CategorySlug;
  label: string;
  ranked: (GuestResultNominee & { rank: number })[];
  alsoNominated: GuestResultNominee[];
};
