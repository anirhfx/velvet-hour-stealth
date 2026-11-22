// The tile map: parsing, collision, line of sight and shadow lookups.
// Tiles: '#' wall, '.' floor, 'D' dark floor, 'C' crate, 'P' pedestal/plant,
// 'H' hedge, 'S' start, 'G' gem, 'a' artifact, 'E' exit.

import { COLS, ROWS, TILE } from './config.js';

export const TILE_WALL = '#';
export const TILE_FLOOR = '.';
export const TILE_DARK = 'D';
export const TILE_CRATE = 'C';
export const TILE_PEDESTAL = 'P';
export const TILE_HEDGE = 'H';

/** Tiles that block movement and sight. */
export function blocksSight(tile) {
  return tile === TILE_WALL || tile === TILE_CRATE || tile === TILE_PEDESTAL || tile === TILE_HEDGE;
}

export function blocksMove(tile) {
  return blocksSight(tile);
}

/** Parse one level definition into a playable level object. */
export function parseLevel(definition) {
  const grid = definition.map.map((row) => row.split(''));
  let start = null;
  let gem = null;
  let exit = null;
  const artifacts = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const tile = grid[row][col];
      const centre = { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE };
      if (tile === 'S') {
        start = centre;
        grid[row][col] = TILE_FLOOR;
      } else if (tile === 'G') {
        gem = centre;
        grid[row][col] = TILE_FLOOR;
      } else if (tile === 'E') {
        exit = centre;
        grid[row][col] = TILE_FLOOR;
      } else if (tile === 'a') {
        artifacts.push({ ...centre, taken: false });
        grid[row][col] = TILE_FLOOR;
      }
    }
  }
  return {
    name: definition.name,
    par: definition.par,
    intro: definition.intro,
    grid,
    start,
    gem,
    exit,
    artifacts,
    guards: definition.guards.map((guard) => ({
      x: (guard.x + 0.5) * TILE,
      y: (guard.y + 0.5) * TILE,
      route: guard.route.map(([col, row]) => ({ x: (col + 0.5) * TILE, y: (row + 0.5) * TILE })),
    })),
  };
}

export function tileAt(level, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return TILE_WALL;
  return level.grid[row][col];
}

export function tileAtPixel(level, x, y) {
  return tileAt(level, Math.floor(x / TILE), Math.floor(y / TILE));
}

export function isShadow(level, x, y) {
  return tileAtPixel(level, x, y) === TILE_DARK;
}

/** True when a circle of `radius` at (x, y) overlaps a blocking tile. */
export function collides(level, x, y, radius) {
  const left = Math.floor((x - radius) / TILE);
  const right = Math.floor((x + radius) / TILE);
  const top = Math.floor((y - radius) / TILE);
  const bottom = Math.floor((y + radius) / TILE);
  for (let row = top; row <= bottom; row += 1) {
    for (let col = left; col <= right; col += 1) {
      if (blocksMove(tileAt(level, col, row))) return true;
    }
  }
  return false;
}

/**
 * Move a circle by (dx, dy), sliding along walls: try the full move, then each
 * axis alone, so the player glides around corners instead of sticking.
 */
export function moveCircle(level, x, y, dx, dy, radius) {
  let nextX = x;
  let nextY = y;
  if (!collides(level, x + dx, y + dy, radius)) {
    nextX = x + dx;
    nextY = y + dy;
  } else if (!collides(level, x + dx, y, radius)) {
    nextX = x + dx;
  } else if (!collides(level, x, y + dy, radius)) {
    nextY = y + dy;
  }
  return { x: nextX, y: nextY };
}

/**
 * Line of sight between two points: sample along the segment; a blocking tile
 * anywhere on it breaks the sight line. The endpoints' own tiles are skipped,
 * so a guard standing in a doorway can still see out of it.
 */
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const distance = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(distance / 8));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    if (blocksSight(tileAtPixel(level, x, y))) return false;
  }
  return true;
}

/** Flood fill from (col, row) over walkable tiles; returns a Set of "col,row". */
export function reachableTiles(level, startCol, startRow) {
  const seen = new Set();
  const queue = [[startCol, startRow]];
  seen.add(`${startCol},${startRow}`);
  while (queue.length > 0) {
    const [col, row] = queue.pop();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nextCol = col + dc;
      const nextRow = row + dr;
      const key = `${nextCol},${nextRow}`;
      if (seen.has(key)) continue;
      if (blocksMove(tileAt(level, nextCol, nextRow))) continue;
      seen.add(key);
      queue.push([nextCol, nextRow]);
    }
  }
  return seen;
}

/**
 * Breadth-first path between two pixel points, as a list of tile-centre
 * waypoints (not including the start tile). Guards follow it so they walk
 * through door gaps instead of pushing against walls. Returns null when the
 * destination tile cannot be reached.
 */
export function findPath(level, fromX, fromY, toX, toY) {
  const start = [Math.floor(fromX / TILE), Math.floor(fromY / TILE)];
  const goal = [Math.floor(toX / TILE), Math.floor(toY / TILE)];
  const key = ([col, row]) => `${col},${row}`;
  if (blocksMove(tileAt(level, goal[0], goal[1]))) return null;
  const prev = new Map();
  const queue = [start];
  prev.set(key(start), null);
  while (queue.length > 0) {
    const current = queue.shift();
    if (current[0] === goal[0] && current[1] === goal[1]) break;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = [current[0] + dc, current[1] + dr];
      if (prev.has(key(next))) continue;
      if (blocksMove(tileAt(level, next[0], next[1]))) continue;
      prev.set(key(next), current);
      queue.push(next);
    }
  }
  if (!prev.has(key(goal))) return null;
  const path = [];
  let current = goal;
  while (current) {
    path.unshift({ x: (current[0] + 0.5) * TILE, y: (current[1] + 0.5) * TILE });
    current = prev.get(key(current));
  }
  path.shift(); // the start tile itself is not a waypoint
  return path;
}
