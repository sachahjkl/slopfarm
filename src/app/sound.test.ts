import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameEvent } from "../game/simulation";
import { SoundFeedback } from "./sound";

class FakeAudioParam {
  value = 0;
  readonly ramps: { value: number; time: number }[] = [];

  setValueAtTime(value: number, time: number): void {
    this.value = value;
    this.ramps.push({ value, time });
  }

  exponentialRampToValueAtTime(value: number, time: number): void {
    this.value = value;
    this.ramps.push({ value, time });
  }
}

class FakeAudioNode {
  connect<T>(destination: T): T {
    return destination;
  }
}

class FakeOscillator extends FakeAudioNode {
  type: OscillatorType = "sine";
  readonly frequency = new FakeAudioParam();
  starts = 0;
  readonly stops: number[] = [];

  start(): void {
    this.starts += 1;
  }

  stop(time: number): void {
    this.stops.push(time);
  }
}

class FakeGain extends FakeAudioNode {
  readonly gain = new FakeAudioParam();
}

class FakeCompressor extends FakeAudioNode {
  readonly threshold = new FakeAudioParam();
  readonly knee = new FakeAudioParam();
  readonly ratio = new FakeAudioParam();
  readonly attack = new FakeAudioParam();
  readonly release = new FakeAudioParam();
}

class FakeAudioContext {
  currentTime = 0;
  readonly sampleRate = 48_000;
  readonly destination = new FakeAudioNode();
  state: AudioContextState = "suspended";
  resumeCalls = 0;
  readonly oscillators: FakeOscillator[] = [];
  readonly gains: FakeGain[] = [];

  resume(): Promise<void> {
    this.resumeCalls += 1;
    this.state = "running";
    return Promise.resolve();
  }

  suspend(): void {
    this.state = "suspended";
  }

  createOscillator(): FakeOscillator {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createGain(): FakeGain {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }

  createDynamicsCompressor(): FakeCompressor {
    return new FakeCompressor();
  }
}

const settings = {
  sound: true,
  vibration: false,
  reducedMotion: false,
  quality: "high",
} as const;

const soundBurst: GameEvent[] = [
  { type: "tree.hit", position: { x: 0, z: 0 }, source: "player" },
  {
    type: "pickup.collected",
    kind: "coin",
    position: { x: 0, z: 0 },
    total: 1,
  },
  { type: "customer.served", position: { x: 0, z: 0 } },
  { type: "tool.upgraded", level: 2 },
  { type: "worker.hired", count: 1 },
];

describe("SoundFeedback", () => {
  let context: FakeAudioContext;
  let events: EventTarget;

  beforeEach(() => {
    context = new FakeAudioContext();
    events = new EventTarget();
    function AudioContextMock(): FakeAudioContext {
      return context;
    }
    vi.stubGlobal("AudioContext", AudioContextMock);
    vi.stubGlobal("addEventListener", events.addEventListener.bind(events));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("relance le contexte après une rafale suivie d'une suspension", async () => {
    const sound = new SoundFeedback(settings);
    events.dispatchEvent(new Event("pointerdown"));
    await Promise.resolve();
    await Promise.resolve();
    sound.consume(soundBurst);

    context.suspend();
    context.currentTime = 1;
    sound.consume([
      {
        type: "pickup.collected",
        kind: "wood",
        position: { x: 0, z: 0 },
        total: 2,
      },
    ]);

    expect(context.resumeCalls).toBe(2);
    expect(context.state).toBe("running");
    expect(context.oscillators).toHaveLength(6);
  });

  it("termine chaque oscillateur et garde une enveloppe audible", () => {
    const sound = new SoundFeedback(settings);
    events.dispatchEvent(new Event("keydown"));

    sound.consume(soundBurst);

    expect(context.oscillators).toHaveLength(5);
    for (const oscillator of context.oscillators) {
      expect(oscillator.starts).toBe(1);
      expect(oscillator.stops).toHaveLength(1);
      expect(oscillator.stops[0]).toBeGreaterThan(context.currentTime);
    }
    for (const gain of context.gains.slice(1)) {
      expect(gain.gain.ramps.at(-1)?.value).toBeGreaterThan(0);
    }
  });
});
