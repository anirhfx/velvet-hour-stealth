// Guard behaviour: patrol, suspicion, chase and search.
// A guard walks its route until it sees something. Suspicion is a per-guard
// meter: half full means "I thought I saw something" (walk over and look),
// full means the alarm is up and the guard runs the player down.

import { GUARD, TILE } from './config.js';
import { findPath, hasLineOfSight, isShadow, moveCircle } from './level.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_ALERT = 'alert';
export const GUARD_SEARCH = 'search';

export function createGuard(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    angle: -Math.PI / 2, // facing up to start
    route: spawn.route,
    waypoint: 1 % spawn.route.length,
    state: GUARD_PATROL,
    suspicion: 0,
    lastSeen: null,
    noSight: 0,
    searchTimer: 0,
    lookTimer: 0,
    lookAngle: 0,
    radius: 14,
    path: [], // tile-centre waypoints from findPath, followed in order
    pathKey: null, // "col,row" of the destination the path was built for
    repath: 0, // seconds until a chasing guard rebuilds its path
  };
}

/** Follow `guard.path` toward `dest` at `speed`; returns true when arrived. */
function followPath(level, guard, dest, speed, dt) {
  const destKey = `${Math.floor(dest.x / TILE)},${Math.floor(dest.y / TILE)}`;
  if (guard.pathKey !== destKey || guard.path.length === 0) {
    guard.path = findPath(level, guard.x, guard.y, dest.x, dest.y) ?? [];
    guard.pathKey = destKey;
  }
  const next = guard.path[0] ?? dest;
  const dx = next.x - guard.x;
  const dy = next.y - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 6) {
    if (guard.path.length > 0) guard.path.shift();
    return Math.hypot(dest.x - guard.x, dest.y - guard.y) < 10;
  }
  guard.angle = Math.atan2(dy, dx);
  const moved = moveCircle(level, guard.x, guard.y, (dx / distance) * speed * dt, (dy / distance) * speed * dt, guard.radius);
  guard.x = moved.x;
  guard.y = moved.y;
  return Math.hypot(dest.x - guard.x, dest.y - guard.y) < 10;
}

/** How well this guard can see the player right now, 0 (not at all) to 1. */
export function guardSeesPlayer(level, guard, player) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance > GUARD.viewRange) return 0;
  if (distance < 26) {
    // Close enough to bump into: always noticed, cone or not.
    return hasLineOfSight(level, guard.x, guard.y, player.x, player.y) ? 1 : 0;
  }
  const angleToPlayer = Math.atan2(dy, dx);
  let diff = angleToPlayer - guard.angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > GUARD.viewHalfAngle) return 0;
  if (!hasLineOfSight(level, guard.x, guard.y, player.x, player.y)) return 0;
  // Nearer, standing and in the light is easier to spot; crouched in shadow
  // at the edge of the cone is barely a flicker.
  let visibility = 1 - distance / GUARD.viewRange;
  if (player.crouching) visibility *= GUARD.crouchFactor;
  if (isShadow(level, player.x, player.y)) visibility *= GUARD.shadowFactor;
  return Math.max(0, Math.min(1, visibility));
}

/** A guard heard a noise at (x, y): walk over and look, if it is in range. */
export function guardHearsNoise(guard, x, y, radius) {
  if (guard.state === GUARD_ALERT) return;
  const distance = Math.hypot(x - guard.x, y - guard.y);
  if (distance > radius) return;
  guard.state = GUARD_SUSPICIOUS;
  guard.lastSeen = { x, y };
  guard.lookTimer = 0;
  guard.suspicion = Math.max(guard.suspicion, 0.45);
}

/**
 * Advance one guard a step. Returns 'spotted' the step a guard's suspicion
 * first hits full, 'calmed' when an alerted guard gives up and goes back to
 * patrol, and null otherwise.
 */
export function stepGuard(level, guard, player, dt) {
  const seen = guardSeesPlayer(level, guard, player);
  let event = null;
  if (seen > 0) {
    const rate = GUARD.fillFar + (GUARD.fillBase - GUARD.fillFar) * seen;
    const before = guard.suspicion;
    guard.suspicion = Math.min(1, guard.suspicion + rate * dt);
    guard.lastSeen = { x: player.x, y: player.y };
    guard.noSight = 0;
    if (before < 1 && guard.suspicion >= 1 && guard.state !== GUARD_ALERT) {
      guard.state = GUARD_ALERT;
      event = 'spotted';
    } else if (guard.suspicion >= 0.55 && guard.state === GUARD_PATROL) {
      guard.state = GUARD_SUSPICIOUS;
    }
  } else {
    guard.noSight += dt;
    guard.suspicion = Math.max(0, guard.suspicion - GUARD.drain * dt);
    if (guard.state === GUARD_ALERT && guard.noSight >= GUARD.alertHold) {
      guard.state = GUARD_SEARCH;
      guard.searchTimer = GUARD.searchTime;
      event = 'calmed';
    }
    if (guard.state === GUARD_SUSPICIOUS && guard.suspicion < 0.3) {
      guard.state = GUARD_PATROL;
    }
  }

  // Movement for the guard's current state, following a tile path so guards
  // walk through door gaps instead of pushing against walls.
  if (guard.state === GUARD_PATROL) {
    const target = guard.route[guard.waypoint];
    if (followPath(level, guard, target, GUARD.patrolSpeed, dt)) {
      guard.waypoint = (guard.waypoint + 1) % guard.route.length;
    }
  } else if (guard.state === GUARD_SUSPICIOUS) {
    if (guard.lastSeen && followPath(level, guard, guard.lastSeen, GUARD.suspiciousSpeed, dt)) {
      // Arrived: stand and look around for a while.
      guard.lookTimer += dt;
      guard.angle = guard.lookAngle + Math.sin(guard.lookTimer * 1.4) * 1.1;
      if (guard.lookTimer > 3) {
        guard.state = GUARD_PATROL;
        guard.suspicion = 0.2;
      }
    } else if (guard.lastSeen) {
      guard.lookAngle = guard.angle;
    }
  } else if (guard.state === GUARD_ALERT) {
    // The player keeps moving: rebuild the chase path twice a second.
    guard.repath -= dt;
    if (guard.repath <= 0) {
      guard.pathKey = null;
      guard.repath = 0.5;
    }
    followPath(level, guard, { x: player.x, y: player.y }, GUARD.chaseSpeed, dt);
  } else if (guard.state === GUARD_SEARCH) {
    guard.searchTimer -= dt;
    if (guard.searchTimer <= 0) {
      guard.state = GUARD_PATROL;
      guard.suspicion = 0;
      return event;
    }
    // Wander in a small circle around the last seen spot.
    const angle = guard.searchTimer * 1.1;
    followPath(
      level,
      guard,
      {
        x: guard.lastSeen.x + Math.cos(angle) * 60,
        y: guard.lastSeen.y + Math.sin(angle) * 60,
      },
      GUARD.suspiciousSpeed,
      dt,
    );
  }
  return event;
}

/** The highest suspicion among the guards — the HUD's alarm meter. */
export function maxSuspicion(guards) {
  let max = 0;
  for (const guard of guards) max = Math.max(max, guard.suspicion);
  return max;
}

/** True when any guard is actively chasing the player. */
export function anyAlert(guards) {
  return guards.some((guard) => guard.state === GUARD_ALERT);
}
