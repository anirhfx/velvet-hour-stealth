// Velvet Hour — configuration and level data.
// A top-down stealth game: Wren the cat burglar slips through the Marlow Gallery
// after dark, steals the Starlight Opal, and reaches the service exit unseen.
// All names, art and story are original.

export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;
export const VIEW_W = COLS * TILE; // 1280
export const VIEW_H = ROWS * TILE; // 720
export const STEP = 1 / 60;
export const BEST_KEY = 'velvet-hour-best';
export const SAVE_KEY = 'velvet-hour-save';

// Player movement (pixels per second).
export const PLAYER = {
  walk: 132,
  run: 205,
  crouch: 68,
  radius: 13,
};

// Guard vision and movement.
export const GUARD = {
  viewRange: 235,
  viewHalfAngle: (38 * Math.PI) / 180,
  patrolSpeed: 56,
  suspiciousSpeed: 84,
  chaseSpeed: 118,
  catchRadius: 26,
  // Suspicion 0..1. Fills while the player is seen, drains while hidden.
  fillBase: 1.15, // per second at point-blank range, standing, in the light
  fillFar: 0.35, // per second at the edge of the cone
  drain: 0.28, // per second while unseen
  crouchFactor: 0.45,
  shadowFactor: 0.4,
  alertHold: 4.0, // seconds of no sight before a chasing guard gives up
  searchTime: 5.0, // seconds a guard searches the last seen spot
};

// Noise: running feet and thrown pebbles draw guards to a point.
export const NOISE = {
  runRadius: 165,
  runPulse: 0.45, // seconds between footstep pulses while running
  pebbleRadius: 230,
  pebbleCount: 3,
};

export const SCORE = {
  artifact: 100,
  gem: 250,
  timeBonusPerSecond: 5, // under the par time, per second saved
};

// Map legend (each level is 18 rows of 32 characters):
//   # wall   . floor   D dark floor (shadow: harder to be seen)
//   C crate  P pedestal / plant  H hedge  — all three block sight and movement
//   S player start   G the Starlight Opal   a artifact   E service exit
// Guards are listed separately with patrol routes (tile coordinates).
// Each map is four rooms separated by wall/hedge columns at cols 7, 16 and 24,
// with door gaps in those columns so every room connects to the next.

export const LEVELS = [
  {
    name: 'The Marble Wing',
    par: 150,
    intro:
      'The Marble Wing. Four guards walk the floor. Lift the Starlight Opal and slip out the service door.',
    map: [
      '################################',
      '#S.....#........#...D...#...a..#',
      '#......#...C....#.......#......#',
      '#..C...#........#..P....#......#',
      '#...............#.......#......#',
      '#......#...P....#...C...#..a...#',
      '#..P...#........#.......#......#',
      '#......#...D....#.......#...C..#',
      '#......#...D............#......#',
      '#..C...#........#..P....#......#',
      '#......#...C....#.......#......#',
      '#......#........#...D...#......#',
      '#..P...#...D....#...........a..#',
      '#......#...D....#.......#......#',
      '#..a...#........#...C...#......#',
      '#..........P....#...D...#......#',
      '#......#........#...D...#..G.E.#',
      '################################',
    ],
    guards: [
      { x: 10, y: 3, route: [[10, 3], [10, 14], [14, 14], [14, 3]] },
      { x: 20, y: 6, route: [[20, 6], [20, 12], [25, 12], [25, 6]] },
      { x: 6, y: 15, route: [[6, 15], [6, 8], [12, 8], [12, 15]] },
      { x: 28, y: 10, route: [[28, 10], [28, 4], [21, 4], [21, 12]] },
    ],
  },
  {
    name: 'The Vault Hall',
    par: 180,
    intro:
      'The Vault Hall. Six guards, tighter patrols, and the opal behind a ring of pedestals. Patience pays.',
    map: [
      '################################',
      '#S.....#...C....#...D...#....a.#',
      '#..P...#........#.......#......#',
      '#......#...P............#...C..#',
      '#..C...#........#..P....#......#',
      '#......#...D....#.......#..P...#',
      '#..........D....#...C...#......#',
      '#..P...#........#.......#...C..#',
      '#......#...D....#..............#',
      '#..C...#........#..P....#....a.#',
      '#......#...C....#.......#......#',
      '#..P...#...D............#..P...#',
      '#......#........#...D...#......#',
      '#..a...#...P....#.......#...C..#',
      '#...............#...C...#......#',
      '#......#...D....#..............#',
      '#......#...D....#...D...#..G.E.#',
      '################################',
    ],
    guards: [
      { x: 8, y: 4, route: [[8, 4], [8, 13], [13, 13], [13, 4]] },
      { x: 18, y: 3, route: [[18, 3], [18, 15], [22, 15], [22, 3]] },
      { x: 27, y: 6, route: [[27, 6], [27, 12], [25, 12], [25, 6]] },
      { x: 5, y: 14, route: [[5, 14], [5, 9], [11, 9], [11, 14]] },
      { x: 15, y: 9, route: [[15, 9], [15, 5], [18, 5], [18, 9]] },
      { x: 28, y: 15, route: [[28, 15], [28, 9], [25, 9], [25, 15]] },
    ],
  },
  {
    name: 'The Rooftop Garden',
    par: 200,
    intro:
      'The Rooftop Garden. Hedges for cover, moonlight pools, and seven guards between you and the door.',
    map: [
      '################################',
      '#S.....H..P.....H...D...H...a..#',
      '#......H........H.......H......#',
      '#..C...H...D....H..P....H......#',
      '#...............H.......H..P...#',
      '#..a...H...C....H.......H......#',
      '#......H..P.....H...D...H...C..#',
      '#..P...H........H.......H......#',
      '#......H...D............H......#',
      '#......H........H.......H...a..#',
      '#..C...H...P....H.......H......#',
      '#......H........H...D...H..P...#',
      '#..P...H...C....H..............#',
      '#......H..P.....H.......H...C..#',
      '#..C...H........H...D...H......#',
      '#..a.......D....H.......H......#',
      '#......H........H...D...H..G.E.#',
      '################################',
    ],
    guards: [
      { x: 10, y: 3, route: [[10, 3], [10, 14], [13, 14], [13, 3]] },
      { x: 19, y: 5, route: [[19, 5], [19, 12], [22, 12], [22, 5]] },
      { x: 25, y: 3, route: [[25, 3], [25, 14], [28, 14], [28, 3]] },
      { x: 4, y: 9, route: [[4, 9], [4, 15], [9, 15], [9, 9]] },
      { x: 13, y: 8, route: [[13, 8], [13, 15], [17, 15], [17, 8]] },
      { x: 22, y: 9, route: [[22, 9], [22, 4], [26, 4], [26, 9]] },
      { x: 29, y: 12, route: [[29, 12], [29, 6], [26, 6], [26, 12]] },
    ],
  },
];
