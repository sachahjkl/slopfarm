import type { GameEvent, GameState } from "../game/simulation";

export interface FeedbackSettings {
  sound: boolean;
  vibration: boolean;
  reducedMotion: boolean;
  quality: "low" | "high";
}

export class SoundFeedback {
  readonly #settings: FeedbackSettings;
  #context: AudioContext | undefined;
  #musicRemaining = 0;
  #musicStep = 0;
  #stepRemaining = 0;
  #lastPlayerPosition: { x: number; z: number } | undefined;
  #stepSide = 0;
  #output: AudioNode | undefined;
  #resumePending = false;
  readonly #lastSoundAt = new Map<string, number>();

  constructor(settings: FeedbackSettings) {
    this.#settings = settings;
    const unlock = (): void => {
      this.#context ??= new AudioContext();
      this.#createOutput();
      this.#resumeContext();
    };
    addEventListener("pointerdown", unlock, { once: true });
    addEventListener("keydown", unlock, { once: true });
  }

  consume(events: readonly GameEvent[]): void {
    this.#resumeContext();
    const sounds = new Set<"hit" | "pickup" | "sale" | "upgrade" | "worker">();
    let pickupFrequency = 520;
    for (const event of events) {
      if (event.type === "tree.hit" || event.type === "animal.hit")
        sounds.add("hit");
      else if (event.type === "pickup.collected") {
        sounds.add("pickup");
        if (event.kind === "coin") pickupFrequency = 820;
      } else if (event.type === "customer.served") {
        sounds.add("sale");
      } else if (
        event.type === "tool.upgraded" ||
        event.type === "automation.upgraded" ||
        event.type === "monument.advanced" ||
        event.type === "turret.upgraded"
      ) {
        sounds.add("upgrade");
      } else if (event.type === "worker.hired") {
        sounds.add("worker");
      }
    }
    if (sounds.has("hit") && this.#canPlay("hit", 0.055))
      this.#tone(120, 0.035, "square", 0.025);
    if (sounds.has("pickup") && this.#canPlay("pickup", 0.07))
      this.#tone(pickupFrequency, 0.07, "sine", 0.035);
    if (sounds.has("sale") && this.#canPlay("sale", 0.12))
      this.#tone(720, 0.09, "triangle", 0.04);
    if (sounds.has("upgrade") && this.#canPlay("upgrade", 0.15)) {
      this.#tone(440, 0.16, "triangle", 0.06);
      this.#vibrate([25, 25, 45]);
    }
    if (sounds.has("worker") && this.#canPlay("worker", 0.12))
      this.#tone(620, 0.1, "triangle", 0.045);
  }

  update(state: GameState, delta: number): void {
    this.#resumeContext();
    if (this.#lastPlayerPosition) {
      const moved = Math.hypot(
        state.player.position.x - this.#lastPlayerPosition.x,
        state.player.position.z - this.#lastPlayerPosition.z,
      );
      if (moved > 0.001) {
        this.#stepRemaining -= delta;
        if (this.#stepRemaining <= 0) {
          this.#footstep();
          this.#stepRemaining = 0.27 - state.player.trailMomentum * 0.1;
        }
      } else this.#stepRemaining = 0;
    }
    this.#lastPlayerPosition = { ...state.player.position };
    this.#musicRemaining -= delta;
    if (this.#musicRemaining > 0 || !this.#settings.sound) return;
    const notes = [220, 277, 330, 415, 330, 277];
    const layers =
      1 + Math.min(3, state.automationLevel + state.monument.stage);
    this.#tone(notes[this.#musicStep % notes.length]!, 0.24, "sine", 0.008);
    if (layers >= 2)
      this.#tone(
        notes[(this.#musicStep + 2) % notes.length]! / 2,
        0.32,
        "triangle",
        0.005,
      );
    if (layers >= 3 && this.#musicStep % 2 === 0)
      this.#tone(110, 0.08, "square", 0.003);
    this.#musicStep += 1;
    this.#musicRemaining = state.monument.stage >= 3 ? 0.28 : 0.52;
  }

  #footstep(): void {
    if (!this.#settings.sound || !this.#context) return;
    const duration = 0.045;
    const sampleCount = Math.ceil(this.#context.sampleRate * duration);
    const buffer = this.#context.createBuffer(
      1,
      sampleCount,
      this.#context.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      const envelope = 1 - index / samples.length;
      samples[index] = (Math.random() * 2 - 1) * envelope;
    }
    const source = this.#context.createBufferSource();
    const filter = this.#context.createBiquadFilter();
    const gain = this.#context.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = this.#stepSide % 2 === 0 ? 520 : 430;
    gain.gain.setValueAtTime(0.035, this.#context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      this.#context.currentTime + duration,
    );
    source
      .connect(filter)
      .connect(gain)
      .connect(this.#output ?? this.#context.destination);
    source.start();
    this.#stepSide += 1;
  }

  #tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ): void {
    if (!this.#settings.sound || !this.#context) return;
    const oscillator = this.#context.createOscillator();
    const gain = this.#context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, this.#context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      this.#context.currentTime + duration,
    );
    oscillator.connect(gain).connect(this.#output ?? this.#context.destination);
    oscillator.start();
    oscillator.stop(this.#context.currentTime + duration);
  }

  #canPlay(kind: string, cooldown: number): boolean {
    if (!this.#context) return false;
    const now = this.#context.currentTime;
    if (now - (this.#lastSoundAt.get(kind) ?? -Infinity) < cooldown)
      return false;
    this.#lastSoundAt.set(kind, now);
    return true;
  }

  #createOutput(): void {
    if (!this.#context || this.#output) return;
    const compressor = this.#context.createDynamicsCompressor();
    const gain = this.#context.createGain();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.2;
    gain.gain.value = 0.65;
    compressor.connect(gain).connect(this.#context.destination);
    this.#output = compressor;
  }

  #resumeContext(): void {
    if (
      !this.#settings.sound ||
      this.#context?.state !== "suspended" ||
      this.#resumePending
    )
      return;
    this.#resumePending = true;
    void this.#context
      .resume()
      .catch(() => undefined)
      .finally(() => {
        this.#resumePending = false;
      });
  }

  #vibrate(pattern: number[]): void {
    if (this.#settings.vibration) navigator.vibrate(pattern);
  }
}
