export class RandomSource {
  #state: number;

  constructor(seed: number) {
    this.#state = seed >>> 0;
  }

  get state(): number {
    return this.#state;
  }

  set state(value: number) {
    this.#state = value >>> 0;
  }

  next(): number {
    this.#state += 0x6d2b_79f5;
    let value = this.#state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }
}
