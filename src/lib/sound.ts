// Every sound in the shop is synthesized on the fly with Web Audio. No files.
// The mandolin is Karplus-Strong string synthesis; the jukebox plays an original tarantella.

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function load(key: string, dflt: boolean) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? dflt : v === "1";
  } catch {
    return dflt;
  }
}
function save(key: string, v: boolean) {
  try {
    localStorage.setItem(key, v ? "1" : "0");
  } catch {
    /* private mode */
  }
}

// Original tune in A minor, 6/8. null = hold the previous note (mandolin tremolo).
const TUNE: (number | null)[][] = [
  [76, 76, 76, 76, 77, 76],
  [74, 72, 71, 69, null, null],
  [71, 71, 71, 71, 72, 71],
  [69, 68, 69, 71, null, null],
  [77, 77, 77, 77, 79, 77],
  [76, 74, 72, 69, 72, 76],
  [74, 72, 71, 68, 71, 74],
  [72, 71, 68, 69, null, null],
];
const CHORDS: { root: number; notes: number[] }[] = [
  { root: 45, notes: [57, 60, 64] },
  { root: 45, notes: [57, 60, 64] },
  { root: 40, notes: [56, 59, 64] },
  { root: 45, notes: [57, 60, 64] },
  { root: 38, notes: [53, 57, 62] },
  { root: 45, notes: [57, 60, 64] },
  { root: 40, notes: [56, 59, 62] },
  { root: 45, notes: [57, 60, 64] },
];

type Listener = () => void;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private strings = new Map<number, AudioBuffer>();
  private jukeTimer: number | null = null;
  private jukeNext = 0;
  private jukeBar = 0;
  private listeners = new Set<Listener>();

  enabled = load("sd-sound", true);
  voice = load("sd-voice", true);
  jukebox = false;

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  /** Call from any user gesture; browsers only allow audio after one. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.35;
      this.musicBus.connect(this.master);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    save("sd-sound", v);
    if (!v) this.stopJukebox();
    this.emit();
  }
  setVoice(v: boolean) {
    this.voice = v;
    save("sd-voice", v);
    this.emit();
  }

  private ready(): { ctx: AudioContext; out: GainNode; t: number } | null {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== "running") return null;
    return { ctx: this.ctx, out: this.master, t: this.ctx.currentTime + 0.01 };
  }

  private tone(freq: number, t: number, dur: number, peak: number, type: OscillatorType = "sine", out?: AudioNode, glideTo?: number) {
    const r = this.ready();
    if (!r) return;
    const o = r.ctx.createOscillator();
    const g = r.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out ?? r.out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private burst(t: number, dur: number, peak: number, filter: BiquadFilterType, f0: number, f1?: number, q = 1, out?: AudioNode) {
    const r = this.ready();
    if (!r || !this.noise) return;
    const src = r.ctx.createBufferSource();
    src.buffer = this.noise;
    const bq = r.ctx.createBiquadFilter();
    bq.type = filter;
    bq.Q.value = q;
    bq.frequency.setValueAtTime(f0, t);
    if (f1) bq.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = r.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bq).connect(g).connect(out ?? r.out);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  private string(midi: number): AudioBuffer {
    const ctx = this.ctx!;
    const hit = this.strings.get(midi);
    if (hit) return hit;
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * 1.1);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const n = Math.max(2, Math.round(sr / mtof(midi)));
    const line = new Float32Array(n);
    for (let i = 0; i < n; i++) line[i] = Math.random() * 2 - 1;
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const nx = (idx + 1) % n;
      d[i] = line[idx];
      line[idx] = 0.997 * 0.5 * (line[idx] + line[nx]);
      idx = nx;
    }
    this.strings.set(midi, buf);
    return buf;
  }

  private pluck(midi: number, t: number, gain = 0.5, out?: AudioNode) {
    const r = this.ready();
    if (!r) return;
    const src = r.ctx.createBufferSource();
    src.buffer = this.string(midi);
    const g = r.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(out ?? r.out);
    src.start(t);
    src.stop(t + 1.1);
  }

  private mandolin(midi: number, t: number, dur: number, out?: AudioNode) {
    if (dur <= 0.2) return this.pluck(midi, t, 0.5, out);
    for (let x = 0; x < dur - 0.02; x += 0.065) this.pluck(midi, t + x, x === 0 ? 0.5 : 0.28, out);
  }

  private accordion(notes: number[], t: number, dur: number, out?: AudioNode) {
    const r = this.ready();
    if (!r) return;
    const lp = r.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    const g = r.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(g).connect(out ?? r.out);
    for (const n of notes) {
      for (const det of [-6, 6]) {
        const o = r.ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = mtof(n);
        o.detune.value = det;
        o.connect(lp);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    }
  }

  // ---------- effects ----------

  /** Counter service bell. */
  bell() {
    const r = this.ready();
    if (!r) return;
    for (const [f, a, d] of [
      [2093, 0.35, 1.6],
      [5100, 0.12, 0.7],
      [3310, 0.08, 1.1],
    ] as const)
      this.tone(f, r.t, d, a);
  }

  /** Cash register: drawer rattle and a double "ching". */
  register() {
    const r = this.ready();
    if (!r) return;
    this.burst(r.t, 0.18, 0.4, "bandpass", 900, 400, 1.5);
    this.tone(1200, r.t, 0.08, 0.2, "square");
    for (const off of [0.12, 0.2]) {
      this.tone(2637, r.t + off, 0.9, 0.25);
      this.tone(3951, r.t + off, 0.6, 0.12);
    }
  }

  /** Pager chirp. */
  beep() {
    const r = this.ready();
    if (!r) return;
    for (const off of [0, 0.12, 0.24]) this.tone(3100, r.t + off, 0.07, 0.12, "square");
  }

  click() {
    const r = this.ready();
    if (!r) return;
    this.tone(1800, r.t, 0.03, 0.08, "square");
  }

  /** Countdown woodblock. */
  tick(high = false) {
    const r = this.ready();
    if (!r) return;
    this.tone(high ? 1250 : 880, r.t, 0.08, 0.25, "triangle");
  }

  whoosh(height = 0.6) {
    const r = this.ready();
    if (!r) return;
    this.burst(r.t, 0.45 + height * 0.3, 0.35, "bandpass", 300, 1200 + height * 1600, 2.5);
    this.tone(180, r.t, 0.12, 0.15, "sine", undefined, 90);
  }

  ceiling() {
    const r = this.ready();
    if (!r) return;
    this.tone(190, r.t, 0.25, 0.5, "triangle", undefined, 120);
    this.burst(r.t, 0.35, 0.3, "lowpass", 1200, 300);
    this.say("Hey! Da ceiling!", 1.2);
  }

  sneeze() {
    const r = this.ready();
    if (!r) return;
    this.tone(220, r.t, 0.45, 0.12, "sawtooth", undefined, 420);
    this.burst(r.t + 0.5, 0.35, 0.6, "highpass", 2500, 5000, 0.8);
  }

  splat() {
    const r = this.ready();
    if (!r) return;
    this.tone(110, r.t, 0.4, 0.8, "sine", undefined, 40);
    this.burst(r.t, 0.4, 0.5, "lowpass", 700, 120);
    this.trombone(r.t + 0.5);
  }

  /** Wah wah wah waaah. */
  trombone(t0?: number) {
    const r = this.ready();
    if (!r) return;
    const t = t0 ?? r.t;
    const notes = [58, 57, 56, 55];
    notes.forEach((n, i) => {
      const start = t + i * 0.42;
      const len = i === 3 ? 1.3 : 0.38;
      const o = r.ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = mtof(n - 12);
      if (i === 3) {
        const lfo = r.ctx.createOscillator();
        const lg = r.ctx.createGain();
        lfo.frequency.value = 6;
        lg.gain.value = 5;
        lfo.connect(lg).connect(o.frequency);
        lfo.start(start);
        lfo.stop(start + len);
      }
      const lp = r.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(400, start);
      lp.frequency.linearRampToValueAtTime(1100, start + 0.12);
      lp.frequency.linearRampToValueAtTime(500, start + len);
      const g = r.ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.25, start + 0.04);
      g.gain.setValueAtTime(0.25, start + len - 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, start + len);
      o.connect(lp).connect(g).connect(r.out);
      o.start(start);
      o.stop(start + len + 0.05);
    });
  }

  /** The whole joint yells "AYYY". */
  ayyy(big = false) {
    const r = this.ready();
    if (!r) return;
    const voices = big ? 9 : 5;
    for (let i = 0; i < voices; i++) {
      const start = r.t + Math.random() * 0.12;
      const f = 150 + Math.random() * 120;
      const o = r.ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(f, start);
      o.frequency.exponentialRampToValueAtTime(f * 1.5, start + 0.25);
      o.frequency.exponentialRampToValueAtTime(f * 1.35, start + 0.9);
      const f1 = r.ctx.createBiquadFilter();
      f1.type = "bandpass";
      f1.frequency.setValueAtTime(750, start);
      f1.frequency.linearRampToValueAtTime(400, start + 0.9); // "ah" sliding to "ee"
      f1.Q.value = 6;
      const f2 = r.ctx.createBiquadFilter();
      f2.type = "bandpass";
      f2.frequency.setValueAtTime(1200, start);
      f2.frequency.linearRampToValueAtTime(2200, start + 0.9);
      f2.Q.value = 8;
      const g = r.ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.18, start + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 1.0);
      o.connect(f1).connect(g);
      o.connect(f2).connect(g);
      g.connect(r.out);
      o.start(start);
      o.stop(start + 1.05);
    }
    this.burst(r.t, 1.0, 0.12, "bandpass", 1500, 1500, 0.5);
  }

  /** Crowd groan. */
  aww() {
    const r = this.ready();
    if (!r) return;
    for (let i = 0; i < 5; i++) {
      const f = 180 + Math.random() * 60;
      this.tone(f, r.t + Math.random() * 0.1, 1.1, 0.07, "sawtooth", undefined, f * 0.65);
    }
  }

  /** Snare-snare-cymbal. */
  rimshot(t0?: number) {
    const r = this.ready();
    if (!r) return;
    const t = t0 ?? r.t;
    for (const off of [0, 0.16]) {
      this.burst(t + off, 0.14, 0.5, "bandpass", 1900, 1900, 0.8);
      this.tone(190, t + off, 0.08, 0.3, "triangle");
    }
    this.burst(t + 0.34, 1.6, 0.35, "highpass", 6000, 8000, 0.5);
  }

  /** Short tarantella sting with a rimshot. */
  jingle() {
    const r = this.ready();
    if (!r) return;
    const e = 0.11;
    const phrase = [76, 76, 77, 76, 74, 72, 71, 72, 74, 76, 81];
    phrase.forEach((n, i) => this.mandolin(n, r.t + i * e, i === phrase.length - 1 ? 0.5 : e));
    this.accordion([57, 60, 64], r.t, 0.5);
    this.accordion([56, 59, 64], r.t + 0.66, 0.4);
    this.accordion([57, 60, 64, 69], r.t + phrase.length * e - e, 0.6);
    this.rimshot(r.t + phrase.length * e + 0.25);
  }

  win(bigCents: number) {
    this.register();
    setTimeout(() => this.jingle(), 350);
    setTimeout(() => this.ayyy(bigCents > 2000), 200);
    this.say(bigCents > 2000 ? "Bada bing! Bada boom!" : "Bada bing!", 0.9);
  }

  // ---------- jukebox ----------

  toggleJukebox() {
    if (this.jukebox) this.stopJukebox();
    else this.startJukebox();
  }

  startJukebox() {
    this.unlock();
    if (!this.ctx || !this.enabled) return;
    this.jukebox = true;
    this.jukeNext = this.ctx.currentTime + 0.1;
    this.jukeBar = 0;
    const eighth = 60 / (132 * 3);
    const schedule = () => {
      if (!this.ctx || !this.jukebox) return;
      while (this.jukeNext < this.ctx.currentTime + 0.6) {
        const bar = TUNE[this.jukeBar % TUNE.length];
        const chord = CHORDS[this.jukeBar % CHORDS.length];
        const t = this.jukeNext;
        bar.forEach((n, i) => {
          if (n == null) return;
          let hold = 1;
          while (bar[i + hold] === null) hold++;
          this.mandolin(n, t + i * eighth, hold * eighth, this.musicBus!);
        });
        this.pluck(chord.root, t, 0.6, this.musicBus!);
        this.accordion(chord.notes, t + eighth, eighth * 1.6, this.musicBus!);
        this.pluck(chord.root + 7, t + eighth * 3, 0.5, this.musicBus!);
        this.accordion(chord.notes, t + eighth * 4, eighth * 1.6, this.musicBus!);
        this.jukeNext += eighth * 6;
        this.jukeBar++;
      }
    };
    schedule();
    this.jukeTimer = window.setInterval(schedule, 150);
    this.emit();
  }

  stopJukebox() {
    this.jukebox = false;
    if (this.jukeTimer != null) window.clearInterval(this.jukeTimer);
    this.jukeTimer = null;
    this.emit();
  }

  // ---------- Sal's voice ----------

  say(text: string, rate = 1) {
    if (!this.enabled || !this.voice || typeof speechSynthesis === "undefined") return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.pitch = 0.6;
      u.rate = rate;
      u.volume = 0.9;
      const v = speechSynthesis.getVoices().find((x) => /en[-_]US/i.test(x.lang) && /male|fred|daniel|alex/i.test(x.name));
      if (v) u.voice = v;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch {
      /* no voice, no problem */
    }
  }
}

export const sound = new SoundEngine();

if (typeof window !== "undefined") {
  const unlock = () => sound.unlock();
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}
