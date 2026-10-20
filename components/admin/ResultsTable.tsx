import { Photo } from "@/components/Photo";
import type { AdminCategoryResult } from "@/lib/adminApi";

// One category's live tally: rank, thumbnail, label, and votes. Rank 1 is highlighted; tied
// nominees share a rank.
export function ResultsTable({ result }: { result: AdminCategoryResult }) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-2xl font-bold text-violet-100">{result.label}</h2>
        <p className="shrink-0 text-violet-200 tabular-nums">
          {result.totalVotes} {result.totalVotes === 1 ? "vote" : "votes"}
        </p>
      </div>
      {result.nominees.length === 0 ? (
        <p className="text-violet-200">No nominees yet</p>
      ) : (
        <ol className="space-y-2">
          {result.nominees.map((n) => (
            <li
              key={n.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
                n.rank === 1 && n.votes > 0 ? "bg-pumpkin/15 ring-1 ring-pumpkin" : "bg-white/5"
              }`}
            >
              <span className="w-7 shrink-0 text-right text-lg font-bold text-pumpkin tabular-nums">{n.rank}.</span>
              <div className="w-12 shrink-0 overflow-hidden rounded-lg">
                <Photo thumbUrl={n.thumbUrl} photoUrl={n.photoUrl} alt={n.label} />
              </div>
              <span className="min-w-0 flex-1 truncate text-lg">{n.label}</span>
              <span className="shrink-0 text-xl font-bold tabular-nums">{n.votes}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
