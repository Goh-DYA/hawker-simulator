/**
 * The procedural Web Audio director: score, ambience and sound cues.
 *
 * Its default mix and voice limit come from the player preference defaults, so a new
 * director matches the settings a new player starts with.
 */
import { DEFAULT_MIX, get_voice_limit_for_quality } from "@/src/game/persistence/preferences";

/** Original, deterministic Web Audio score and sound palette. No audio assets are downloaded. */
export class AudioDirector {
  private context?: AudioContext;
  private masterGain?: GainNode;
  private musicGain?: GainNode;
  private ambienceGain?: GainNode;
  private sfxGain?: GainNode;
  private scheduler?: number;
  private step = 0;
  private isOpen = false;
  private intensity = 0;
  private muted = false;
  private activeVoices = 0;
  private voiceLimit = get_voice_limit_for_quality("standard");
  private musicVolume: number = DEFAULT_MIX.music;
  private ambienceVolume: number = DEFAULT_MIX.ambience;
  private sfxVolume: number = DEFAULT_MIX.sfx;
  private readonly lastCueAt = new Map<string, number>();

  /**
   * Creates a silent director. No `AudioContext` exists until {@link AudioDirector.unlock}; in a
   * browser it starts listening for page visibility changes.
   */
  constructor() {
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.handleVisibility);
  }

  /**
   * Sets the bus volumes and the master mute.
   *
   * @param music - The music volume, clamped to 0 to 1.
   * @param ambience - The ambience volume, clamped to 0 to 1.
   * @param sfx - The effects volume, clamped to 0 to 1.
   * @param muted - True to silence the master bus.
   */
  setVolumes(music: number, ambience: number, sfx: number, muted = false) {
    this.musicVolume = clamp01(music);
    this.ambienceVolume = clamp01(ambience);
    this.sfxVolume = clamp01(sfx);
    this.muted = muted;
    this.applyMix();
  }

  /**
   * Updates the state the score follows: whether the centre is open, and an intensity from the
   * crowd size and queue pressure.
   *
   * @param isOpen - Whether the centre is open.
   * @param activeCustomers - The number of guests in the hall.
   * @param queuePressure - The queue pressure from 0 to 100.
   */
  setGameplayState(isOpen: boolean, activeCustomers: number, queuePressure: number) {
    this.isOpen = isOpen;
    const crowd = 1 - Math.exp(-Math.max(0, activeCustomers) / 24);
    this.intensity = clamp01(crowd * 0.7 + clamp01(queuePressure / 100) * 0.3);
  }

  /**
   * Caps the number of simultaneous tones; new tones beyond the cap are skipped.
   *
   * @param limit - The cap, floored to an integer of at least 1.
   */
  setVoiceLimit(limit: number) {
    this.voiceLimit = Math.max(1, Math.floor(limit));
  }

  /**
   * Creates or resumes the `AudioContext`. Call it from a user gesture, because browsers keep audio
   * suspended until one.
   *
   * @returns A promise that settles once the context is running.
   */
  async unlock() {
    this.context ??= new AudioContext();
    this.ensureBuses();
    if (this.context.state === "suspended") await this.context.resume();
  }

  /**
   * Starts the scheduled score and ambience; does nothing before {@link AudioDirector.unlock} or
   * when already running.
   */
  startAmbience() {
    if (this.scheduler || !this.context) return;
    this.scheduler = window.setInterval(() => this.scheduleStep(), 680);
    this.scheduleStep();
  }

  /** Stops the scheduled score and ambience. */
  stopAmbience() {
    if (this.scheduler) window.clearInterval(this.scheduler);
    this.scheduler = undefined;
  }

  /**
   * Plays a short sound cue. Repeats of a cue within its minimum gap are skipped.
   *
   * @param cue - The cue to play.
   */
  play(cue: "place" | "invalid" | "sale" | "reward" | "ui" | "open" | "close") {
    const now = performance.now();
    const minimumGap = cue === "sale" ? 260 : cue === "ui" ? 45 : 100;
    if (now - (this.lastCueAt.get(cue) ?? -Infinity) < minimumGap) return;
    this.lastCueAt.set(cue, now);
    const patterns: Record<typeof cue, readonly [number, number, OscillatorType][]> = {
      place: [[330, 0.08, "sine"]],
      invalid: [[145, 0.16, "square"]],
      sale: [[523, 0.08, "sine"], [659, 0.12, "sine"]],
      reward: [[392, 0.08, "triangle"], [523, 0.09, "triangle"], [784, 0.18, "triangle"]],
      ui: [[260, 0.045, "sine"]],
      open: [[294, 0.08, "triangle"], [440, 0.14, "triangle"]],
      close: [[440, 0.08, "triangle"], [294, 0.14, "triangle"]],
    };
    patterns[cue].forEach(([frequency, duration, type], index) => {
      window.setTimeout(() => this.tone(frequency, duration, 0.12, type, "sfx"), index * 75);
    });
  }

  /**
   * Stops the score, removes the visibility listener and closes the `AudioContext`; a close failure
   * is logged.
   */
  destroy() {
    this.stopAmbience();
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.handleVisibility);
    this.context?.close().catch((error) => console.warn("[audio] close failed", error));
    this.context = undefined;
    this.masterGain = undefined;
    this.musicGain = undefined;
    this.ambienceGain = undefined;
    this.sfxGain = undefined;
  }

  private readonly handleVisibility = () => {
    if (!this.context) return;
    if (document.hidden) this.context.suspend().catch((error) => console.warn("[audio] suspend failed", error));
    else this.context.resume().catch((error) => console.warn("[audio] resume failed", error));
  };

  private ensureBuses() {
    if (!this.context || this.masterGain) return;
    this.masterGain = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.ambienceGain = this.context.createGain();
    this.sfxGain = this.context.createGain();
    this.musicGain.connect(this.masterGain);
    this.ambienceGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);
    this.applyMix();
  }

  private applyMix() {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.masterGain?.gain.setTargetAtTime(this.muted ? 0 : 0.82, now, 0.03);
    this.musicGain?.gain.setTargetAtTime(this.musicVolume, now, 0.08);
    this.ambienceGain?.gain.setTargetAtTime(this.ambienceVolume, now, 0.08);
    this.sfxGain?.gain.setTargetAtTime(this.sfxVolume, now, 0.03);
  }

  private scheduleStep() {
    if (!this.context || document.hidden) return;
    const roots = [196, 220, 174.61, 246.94] as const;
    const root = roots[Math.floor(this.step / 8) % roots.length]!;
    const chord = [1, 1.25, 1.5];
    if (this.step % 4 === 0) {
      chord.forEach((ratio, index) => this.tone(root * ratio, 2.5, 0.022 - index * 0.003, "sine", "music"));
    }
    const melody = [1.5, 1.25, 2, 1.5, 1.125, 1.25, 1.5, 2] as const;
    if (this.step % (this.isOpen ? 2 : 4) === 0) {
      this.tone(root * melody[this.step % melody.length]!, 0.5, 0.026, "triangle", "music");
    }
    if (this.isOpen && (this.step % 2 === 0 || this.intensity > 0.55)) {
      this.tone(root / 2, 0.16, 0.018 + this.intensity * 0.012, "triangle", "music");
    }
    if (this.step % 5 === 0) {
      const roomTone = [98, 110, 123.47][Math.floor(this.step / 5) % 3]!;
      this.tone(roomTone, 1.4, 0.012, "sine", "ambience");
    }
    this.step = (this.step + 1) % 256;
  }

  private tone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    bus: "music" | "ambience" | "sfx",
  ) {
    if (!this.context || volume <= 0 || this.activeVoices >= this.voiceLimit) return;
    const destination = bus === "music" ? this.musicGain : bus === "ambience" ? this.ambienceGain : this.sfxGain;
    if (!destination) return;
    const oscillator = this.context.createOscillator();
    this.activeVoices += 1;
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    filter.type = "lowpass";
    filter.frequency.value = bus === "music" ? 1_800 : 1_250;
    gain.gain.setValueAtTime(0.0001, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, this.context.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);
    oscillator.connect(filter).connect(gain).connect(destination);
    oscillator.start();
    oscillator.stop(this.context.currentTime + duration + 0.05);
    oscillator.onended = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
      oscillator.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
