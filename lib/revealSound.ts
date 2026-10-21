// Sound for the winner reveal: a looping music track, a drumroll, fireworks, and applause from
// files in public/sounds (see CREDITS.md), plus a synthesized cymbal and chord. A file that is
// missing or fails to decode is skipped (the drumroll falls back to synthesized hits). Browsers
// block audio until a tap, so the reveal page calls start() from its "Tap to start" button.
export type RevealAudio = {
  start: () => void;
  // Seconds the drumroll lasts, so the page can time the flip to its end.
  drumrollSeconds: () => number;
  // Fades the music out and pauses it (so it resumes where it was), then plays the drumroll.
  drumroll: () => void;
  // Cymbal, chord, fireworks, applause; the music fades back in a few seconds later.
  celebrate: () => void;
  setMuted: (muted: boolean) => void;
  stop: () => void;
};

const FILES = {
  music: "/sounds/music.mp3",
  drumroll: "/sounds/drumroll.mp3",
  fireworks: "/sounds/fireworks.mp3",
  applause: "/sounds/applause.mp3",
} as const;

const MUSIC_LEVEL = 0.4;
const FADE_S = 0.6;
const MUSIC_RETURN_MS = 3500;
const FALLBACK_DRUMROLL_S = 2.2;
const MAX_DRUMROLL_S = 6;

// Frequencies in Hz.
const C4 = 261.63;
const E4 = 329.63;
const G4 = 392;
const C5 = 523.25;

// Where the sound really begins: recordings often open with silence, which makes an effect feel late.
export function firstAudibleSeconds(data: Float32Array, sampleRate: number, threshold = 0.02): number {
  const i = data.findIndex((s) => Math.abs(s) > threshold);
  return i <= 0 ? 0 : Math.max(0, i / sampleRate - 0.01);
}

export function createRevealAudio(): RevealAudio | null {
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  const ctx = new Ctor();
  const master = ctx.createGain();
  master.connect(ctx.destination);
  const musicGain = ctx.createGain();
  musicGain.gain.value = 0;
  musicGain.connect(master);

  let muted = false;
  let started = false;
  let music: HTMLAudioElement | null = null;
  const buffers: Partial<Record<"drumroll" | "fireworks" | "applause", AudioBuffer>> = {};
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };

  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  async function load(url: string): Promise<AudioBuffer | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  function playBuffer(buffer: AudioBuffer, level: number, maxSeconds?: number) {
    const offset = firstAudibleSeconds(buffer.getChannelData(0), buffer.sampleRate);
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    gain.gain.value = level;
    src.connect(gain).connect(master);
    src.start(ctx.currentTime + 0.02, offset, maxSeconds);
  }

  function tone(freq: number, at: number, length: number, type: OscillatorType, level: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }

  function noiseHit(at: number, length: number, filter: BiquadFilterType, freq: number, level: number) {
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = noise;
    f.type = filter;
    f.frequency.value = freq;
    gain.gain.setValueAtTime(level, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    src.connect(f).connect(gain).connect(master);
    src.start(at);
    src.stop(at + length + 0.05);
  }

  function musicTo(level: number) {
    musicGain.gain.setTargetAtTime(level, ctx.currentTime, FADE_S / 3);
  }

  // Tom hits that speed up and get louder; used only when the drumroll file is missing.
  function syntheticDrumroll() {
    const t0 = ctx.currentTime + 0.05;
    for (let t = 0, gap = 0.28; t < FALLBACK_DRUMROLL_S; t += gap, gap = Math.max(0.045, gap * 0.9)) {
      const at = t0 + t;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(150, at);
      osc.frequency.exponentialRampToValueAtTime(70, at + 0.12);
      gain.gain.setValueAtTime(0.25 + (t / FALLBACK_DRUMROLL_S) * 0.6, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.15);
      osc.connect(gain).connect(master);
      osc.start(at);
      osc.stop(at + 0.2);
    }
  }

  return {
    start() {
      void ctx.resume();
      if (started) return;
      started = true;
      master.gain.value = muted ? 0 : 1;
      music = new Audio(FILES.music);
      music.loop = true;
      music.addEventListener("error", () => (music = null));
      try {
        ctx.createMediaElementSource(music).connect(musicGain);
        void music.play().then(() => musicTo(MUSIC_LEVEL), () => {});
      } catch {
        music = null;
      }
      for (const key of ["drumroll", "fireworks", "applause"] as const) {
        void load(FILES[key]).then((b) => b && (buffers[key] = b));
      }
    },
    drumrollSeconds() {
      const b = buffers.drumroll;
      if (!b) return FALLBACK_DRUMROLL_S;
      const offset = firstAudibleSeconds(b.getChannelData(0), b.sampleRate);
      return Math.min(b.duration - offset, MAX_DRUMROLL_S);
    },
    drumroll() {
      musicTo(0);
      const m = music;
      later(() => m?.pause(), FADE_S * 1000);
      if (buffers.drumroll) playBuffer(buffers.drumroll, 0.9, MAX_DRUMROLL_S);
      else syntheticDrumroll();
    },
    celebrate() {
      const at = ctx.currentTime + 0.02;
      noiseHit(at, 2, "highpass", 6000, 0.5);
      noiseHit(at, 0.5, "lowpass", 300, 0.8);
      [C4, E4, G4, C5].forEach((f, i) => tone(f, at + i * 0.09, 1.6, "triangle", 0.35));
      if (buffers.fireworks) playBuffer(buffers.fireworks, 0.8);
      if (buffers.applause) playBuffer(buffers.applause, 0.9);
      later(() => {
        if (!music) return;
        void music.play().then(() => musicTo(MUSIC_LEVEL), () => {});
      }, MUSIC_RETURN_MS);
    },
    setMuted(value) {
      muted = value;
      master.gain.setTargetAtTime(value ? 0 : 1, ctx.currentTime, 0.05);
    },
    stop() {
      timers.forEach(clearTimeout);
      timers.clear();
      music?.pause();
      void ctx.close();
    },
  };
}
