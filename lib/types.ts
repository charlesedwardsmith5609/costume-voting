import type { CategorySlug } from "./categories";

// The only nominee fields a guest ever receives (SPEC: id, names, categories, photo URL).
export type GuestNominee = {
  id: string;
  personName: string | null;
  costumeName: string | null;
  categories: CategorySlug[];
  photoUrl: string;
};

export type VotingStatus = "not_started" | "open" | "closed";

export type GuestState = {
  status: VotingStatus;
  votingOpensAt: string | null;
  votingClosesAt: string | null;
  serverNow: string;
};
