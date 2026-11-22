// A tiny seeded random number generator (mulberry32) so a seed always replays
// the same game: screenshots and tests are deterministic.
export function createRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An integer in [min, max) from a seeded generator. */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min));
}
