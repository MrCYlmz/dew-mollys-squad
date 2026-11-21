// A fixed set of objects created up front, so spawning and removing allocate nothing.
export class Pool<T> {
  readonly active: T[] = []
  private readonly free: T[] = []

  constructor(
    capacity: number,
    create: () => T,
    private readonly reset: (item: T) => void,
  ) {
    for (let i = 0; i < capacity; i++) this.free.push(create())
  }

  // Returns undefined when every object is in use.
  acquire(): T | undefined {
    const item = this.free.pop()
    if (item !== undefined) this.active.push(item)
    return item
  }

  // Swaps the last active object into the freed place, so callers iterating from the end skip none.
  release(index: number): void {
    const item = this.active[index]
    const last = this.active.pop()
    if (last !== undefined && last !== item) this.active[index] = last
    this.reset(item)
    this.free.push(item)
  }
}
