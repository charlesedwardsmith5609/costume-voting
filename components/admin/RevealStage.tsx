import { Photo } from "@/components/Photo";
import type { AdminResultNominee } from "@/lib/adminApi";
import { labelLines, singleLine } from "@/lib/nomineeLabel";

const CONFETTI = ["🎃", "👻", "🦇", "⭐", "🍬", "🕸️", "✨"];

// Falling emoji and a burst of sparks around the stage, shown when a winner appears.
function Celebration() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 44 }, (_, i) => (
        <span
          key={i}
          className="rv-fall absolute top-0"
          style={{
            left: `${(i * 29 + 7) % 100}%`,
            fontSize: `${3 + (i % 4)}vh`,
            ["--d" as string]: `${3.2 + (i % 5) * 0.6}s`,
            ["--delay" as string]: `${(i % 9) * 0.18}s`,
          }}
        >
          {CONFETTI[i % CONFETTI.length]}
        </span>
      ))}
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="rv-burst absolute left-[62%] top-[55%] size-[40vh] rounded-full border-[0.6vh] border-pumpkin"
          style={{ ["--delay" as string]: `${i * 0.25}s` }}
        />
      ))}
    </div>
  );
}

// Spotlight, then one flip card per winner: a "?" front and the photo and name behind it.
// Tied winners flip one after another. Tapping a hidden card calls onReveal.
export function RevealStage({
  winners,
  revealed,
  rolling,
  onReveal,
}: {
  winners: AdminResultNominee[];
  revealed: boolean;
  rolling: boolean;
  onReveal: () => void;
}) {
  const tie = winners.length > 1;
  const width = tie ? "min(30vh, 19vw)" : "min(40vh, 28vw)";
  if (winners.length === 0 && revealed) {
    return <p className="rv-pop text-center text-[5vh] font-semibold">No votes in this category</p>;
  }
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div
        aria-hidden
        className="rv-sweep absolute -top-[10vh] left-1/2 h-[90vh] w-[50vh] -translate-x-1/2 bg-gradient-to-b from-white/25 to-transparent"
        style={{ clipPath: "polygon(42% 0, 58% 0, 100% 100%, 0 100%)", ["--d" as string]: rolling ? "1.2s" : "6s" }}
      />
      {tie && revealed && <p className="rv-pop absolute -top-[2vh] text-[5vh] font-bold text-pumpkin">It&apos;s a tie!</p>}
      <ul className="relative flex items-center justify-center gap-[3vh]">
        {(winners.length ? winners : [null]).map((n, i) => {
          const lines = n ? labelLines(n) : null;
          return (
            <li key={n?.id ?? "none"} style={{ width, perspective: "120vh" }}>
              <div className={rolling ? "rv-shake" : ""}>
                <button
                  type="button"
                  onClick={onReveal}
                  disabled={revealed || rolling}
                  aria-label={revealed ? undefined : "Reveal the winner"}
                  className="relative block w-full text-left transition-transform duration-[900ms] ease-out disabled:cursor-default"
                  style={{
                    aspectRatio: "3 / 4",
                    transformStyle: "preserve-3d",
                    transform: revealed ? "rotateY(180deg)" : "none",
                    transitionDelay: revealed ? `${i * 0.7}s` : "0s",
                  }}
                >
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center rounded-[3vh] bg-gradient-to-br from-witch to-[#3b1d7a] ring-[0.6vh] ring-pumpkin"
                    style={{ backfaceVisibility: "hidden" }}
                  >
                    <span className={`font-title text-[22vh] leading-none text-pumpkin ${rolling ? "" : "rv-pulse"}`}>?</span>
                    {!rolling && <span className="mt-[2vh] text-[3vh] font-semibold text-violet-100">Tap to reveal</span>}
                  </div>
                  <div
                    className="rv-glow absolute inset-0 flex flex-col overflow-hidden rounded-[3vh] bg-night ring-[0.8vh] ring-pumpkin"
                    style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                  >
                    {n && lines && (
                      <>
                        <Photo thumbUrl={n.thumbUrl} photoUrl={n.photoUrl} alt={singleLine(n)} />
                        <div className="flex flex-1 flex-col items-center justify-center px-[1vh] text-center">
                          <p className="font-bold leading-tight" style={{ fontSize: tie ? "3vh" : "4vh" }}>
                            🏆 {lines.top}
                          </p>
                          {lines.bottom && (
                            <p className="leading-tight text-violet-200" style={{ fontSize: tie ? "2.4vh" : "3vh" }}>
                              {lines.bottom}
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { Celebration };
