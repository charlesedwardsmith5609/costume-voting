// Synthesized sound for the winner reveal (Web Audio: tones and noise, no audio files). Browsers
// block audio until a tap, so the reveal page calls start() from its "Tap to start" button.
export type RevealAudio = {
  start: () => void;
  drumroll: (seconds: number) => void;
  fanfare: () => void;
  setMuted: (muted: boolean) => void;
  stop: () => void;
};

// Frequencies in Hz.
const C4 = 261.63;
const E4 = 329.63;
const G4 = 392;
const C5 = 523.25;

export function createRevealAudio(): RevealAudio | null {
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  const ctx = new Ctor();
  const master = ctx.createGain();
  master.connect(ctx.destination);
  let muted = false;
  let pad: OscillatorNode[] = [];

  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

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

  return {
    // Quiet, slowly swelling minor drone.
    start() {
      void ctx.resume();
      if (pad.length) return;
      master.gain.value = muted ? 0 : 0.5;
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 400;
      const swell = ctx.createGain();
      swell.gain.value = 0.06;
      const lfo = ctx.createOscillator();
      const lfoDepth = ctx.createGain();
      lfo.frequency.value = 0.15;
      lfoDepth.gain.value = 0.04;
      lfo.connect(lfoDepth).connect(swell.gain);
      lfo.start();
      pad = [55, 65.41, 82.41].map((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = f;
        osc.detune.value = i * 7;
        osc.connect(lowpass);
        osc.start();
        return osc;
      });
      pad.push(lfo);
      lowpass.connect(swell).connect(master);
    },
    // Tom hits that speed up and get louder, ending on a low boom.
    drumroll(seconds) {
      const t0 = ctx.currentTime + 0.05;
      for (let t = 0, gap = 0.28; t < seconds; t += gap, gap = Math.max(0.045, gap * 0.9)) {
        const progress = t / seconds;
        const at = t0 + t;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(150, at);
        osc.frequency.exponentialRampToValueAtTime(70, at + 0.12);
        gain.gain.setValueAtTime(0.25 + progress * 0.6, at);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.15);
        osc.connect(gain).connect(master);
        osc.start(at);
        osc.stop(at + 0.2);
      }
    },
    // Cymbal crash and a bright major chord.
    fanfare() {
      const at = ctx.currentTime + 0.02;
      noiseHit(at, 2, "highpass", 6000, 0.5);
      noiseHit(at, 0.5, "lowpass", 300, 0.8);
      [C4, E4, G4, C5].forEach((f, i) => tone(f, at + i * 0.09, 1.6, "triangle", 0.35));
      [C4 * 2, G4 * 2].forEach((f) => tone(f, at + 0.4, 1.4, "square", 0.08));
    },
    setMuted(value) {
      muted = value;
      master.gain.setTargetAtTime(value ? 0 : 0.5, ctx.currentTime, 0.05);
    },
    stop() {
      pad.forEach((o) => o.stop());
      pad = [];
      void ctx.close();
    },
  };
}
