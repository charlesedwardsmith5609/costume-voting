import { BackLink } from "@/components/BackLink";
import { PAGE } from "@/components/ui";

const GUIDELINES: { title: string; text: string }[] = [
  {
    title: "Nominate",
    text: "Tap “Nominate a costume”. Check whether they’re already listed; if so, just add categories. If not, snap a photo. Names are optional.",
  },
  {
    title: "Vote",
    text: "One vote per category. Tap a nominee, then Vote. Voting again changes your vote.",
  },
  {
    title: "Private",
    text: "Nobody sees who you voted for or any vote counts. Only the host sees results.",
  },
  {
    title: "Fix mistakes",
    text: "Anyone can tap “Edit” to fix a name or photo. Please be respectful: only fix real mistakes, and don’t change or joke about someone else’s nominee. The host can see every edit and undo it.",
  },
  {
    title: "Closing time",
    text: "Voting, nominating, and edits all stop at the time on the banner.",
  },
  {
    title: "Same phone",
    text: "Your votes are saved in this browser. Clearing it or switching browsers counts as a new voter. This runs on the honor system, so please vote once per category and keep it fair for everyone.",
  },
];

// Guest guidelines, linked from the "?" on the home screen.
export default function HelpPage() {
  return (
    <main className={PAGE}>
      <BackLink href="/">← Home</BackLink>
      <h1 className="mb-4 mt-2 font-title text-4xl text-pumpkin">How it works</h1>
      <dl className="space-y-4">
        {GUIDELINES.map(({ title, text }) => (
          <div key={title} className="rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
            <dt className="text-xl font-bold">{title}</dt>
            <dd className="mt-1 text-lg leading-snug text-violet-100">{text}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
