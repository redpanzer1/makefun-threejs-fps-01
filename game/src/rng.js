// One seeded RNG for the whole game, so ?shot= captures are deterministic.
// Live play re-seeds from the clock; the seed comes from the URL (?seed=N).
export function mulberry32(initial) {
  let a = initial | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rng = {
  next: Math.random,
  seed(value) {
    this.next = mulberry32(value);
  },
  range(min, max) {
    return min + this.next() * (max - min);
  },
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  },
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  },
};
