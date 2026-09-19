export class Queue<T> {
  readonly #items: T[] = [];

  add(item: T): void {
    this.#items.push(item);
  }

  drain(): T[] {
    return this.#items.splice(0);
  }
}
