import { json, serverError } from "@/lib/server/http";
import { db } from "@/lib/server/supabase";
import type { GuestState } from "@/lib/types";

export const dynamic = "force-dynamic";

// Voting window and whether results are published, for guest screens. Owner: settings (read via guest_state()).
export async function GET(): Promise<Response> {
  const { data, error } = await db().rpc("guest_state");
  if (error) return serverError("state", error);
  const body: GuestState = {
    status: data.status,
    votingOpensAt: data.voting_opens_at,
    votingClosesAt: data.voting_closes_at,
    resultsPublished: data.results_published,
    serverNow: data.now,
  };
  return json(body);
}
