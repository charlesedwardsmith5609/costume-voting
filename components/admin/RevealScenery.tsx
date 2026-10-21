// Animated night-sky backdrop for the winner reveal: moon, stars, bats, ghosts, pumpkins, and a
// spider. Decorative only (aria-hidden); motion comes from the rv-* keyframes in globals.css.
function Bat({ className, style }: { className: string; style: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 60 30" className={`absolute w-[7vw] fill-black ${className}`} style={style}>
      <path d="M30 8c-3 0-4-4-5-6-1 3-3 5-6 5-4 0-7-3-9-6 0 6 2 12 6 15 3 2 6 1 8 4 1-2 3-3 6-3s5 1 6 3c2-3 5-2 8-4 4-3 6-9 6-15-2 3-5 6-9 6-3 0-5-2-6-5-1 2-2 6-5 6z" />
      <circle cx="26" cy="9" r="1" className="fill-pumpkin" />
      <circle cx="34" cy="9" r="1" className="fill-pumpkin" />
    </svg>
  );
}

function Ghost({ className, style }: { className: string; style: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 50 60" className={`absolute w-[7vw] opacity-80 ${className}`} style={style}>
      <path d="M25 2C12 2 5 12 5 26v30l7-6 6 6 7-6 7 6 6-6 7 6V26C45 12 38 2 25 2z" fill="#f5f3ff" />
      <ellipse cx="18" cy="24" rx="4" ry="6" fill="#1b1330" />
      <ellipse cx="32" cy="24" rx="4" ry="6" fill="#1b1330" />
      <ellipse cx="25" cy="38" rx="4" ry="5" fill="#1b1330" />
    </svg>
  );
}

function Pumpkin({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 120 100" className={`absolute rv-glow ${className}`}>
      <rect x="54" y="2" width="12" height="20" rx="4" fill="#3f6b2a" />
      <ellipse cx="38" cy="58" rx="32" ry="38" fill="#e8650d" />
      <ellipse cx="82" cy="58" rx="32" ry="38" fill="#e8650d" />
      <ellipse cx="60" cy="58" rx="26" ry="40" fill="#ff7a1a" />
      <path d="M36 44l10 12-20 0zM84 44l10 12-20 0z" fill="#2a1200" />
      <path d="M32 72q28 24 56 0l-8-2-6 6-6-6-6 6-6-6-6 6-6-6z" fill="#2a1200" />
    </svg>
  );
}

const STARS = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  top: (i * 23 + 5) % 55,
  size: 0.4 + (i % 3) * 0.25,
  delay: (i % 7) * 0.5,
}));

export function RevealScenery() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-b from-[#07040f] via-[#150b2b] to-[#2a1040]">
      {STARS.map((s, i) => (
        <span
          key={i}
          className="rv-twinkle absolute rounded-full bg-white"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: `${s.size}vh`, height: `${s.size}vh`, ["--delay" as string]: `${s.delay}s` }}
        />
      ))}

      <svg viewBox="0 0 200 200" className="absolute -right-[4vw] top-[6vh] w-[26vh]">
        <defs>
          <radialGradient id="rv-moon-glow">
            <stop offset="55%" stopColor="#fff3c4" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#fff3c4" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="100" fill="url(#rv-moon-glow)" />
        <circle cx="100" cy="100" r="58" fill="#fff3c4" />
        <circle cx="82" cy="86" r="10" fill="#e9d79a" />
        <circle cx="116" cy="116" r="14" fill="#e9d79a" />
        <circle cx="112" cy="78" r="6" fill="#e9d79a" />
      </svg>

      <Bat className="rv-fly" style={{ top: "14%", ["--d" as string]: "16s", ["--delay" as string]: "0s" }} />
      <Bat className="rv-fly" style={{ top: "30%", ["--d" as string]: "22s", ["--delay" as string]: "-9s", ["--s" as string]: "0.7" }} />
      <Bat className="rv-fly" style={{ top: "8%", ["--d" as string]: "19s", ["--delay" as string]: "-14s", ["--s" as string]: "1.2" }} />

      <Ghost className="rv-bob left-[3%] top-[38%]" style={{ ["--d" as string]: "5s" }} />
      <Ghost className="rv-bob right-[4%] top-[55%]" style={{ ["--d" as string]: "6.5s", ["--delay" as string]: "-2s" }} />

      <div className="rv-swing absolute left-[30%] top-0 flex flex-col items-center">
        <div className="h-[16vh] w-px bg-white/50" />
        <span className="text-[4vh] leading-none">🕷️</span>
      </div>

      <Pumpkin className="-left-[1vw] bottom-0 w-[16vh]" />
      <Pumpkin className="-right-[1vw] bottom-0 w-[20vh]" />
      <Pumpkin className="bottom-0 left-[16%] w-[9vh]" />
      <div className="absolute inset-x-0 bottom-0 h-[8vh] bg-gradient-to-t from-black to-transparent" />
    </div>
  );
}
