// The renderer: paints the gallery top-down on one canvas — floor and cover,
// guard vision cones, the player, the loot, the exit — plus the HUD, the
// minimap and every screen (title, pause, caught, level clear, win).

import { COLS, ROWS, TILE, VIEW_H, VIEW_W } from './config.js';
import { GUARD_ALERT, GUARD_PATROL, GUARD_SEARCH, GUARD_SUSPICIOUS, maxSuspicion } from './guards.js';
import { tileAt } from './level.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_LEVEL_CLEAR = 'level-clear';
export const SCREEN_WIN = 'win';

const FLOOR_A = '#2a2f3a';
const FLOOR_B = '#262b35';
const DARK_FLOOR = '#171c26';
const WALL = '#4a5468';
const WALL_TOP = '#6b7a99';

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');

  function drawFloor(level) {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const tile = tileAt(level, col, row);
        const x = col * TILE;
        const y = row * TILE;
        if (tile === '#') {
          context.fillStyle = WALL;
          context.fillRect(x, y, TILE, TILE);
          context.fillStyle = WALL_TOP;
          context.fillRect(x, y, TILE, 6);
          continue;
        }
        context.fillStyle = tile === 'D' ? DARK_FLOOR : (col + row) % 2 === 0 ? FLOOR_A : FLOOR_B;
        context.fillRect(x, y, TILE, TILE);
        if (tile === 'D') {
          // Moonlight edge on shadow floor so it reads as a hiding place.
          context.strokeStyle = 'rgba(120, 150, 255, 0.18)';
          context.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        }
        if (tile === 'C') {
          context.fillStyle = '#6e5233';
          roundRect(context, x + 4, y + 4, TILE - 8, TILE - 8, 4);
          context.fill();
          context.strokeStyle = '#8a6a42';
          context.strokeRect(x + 9, y + 9, TILE - 18, TILE - 18);
        } else if (tile === 'P') {
          context.fillStyle = '#3d4658';
          context.beginPath();
          context.arc(x + TILE / 2, y + TILE / 2, 13, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = '#7d8aa5';
          context.beginPath();
          context.arc(x + TILE / 2, y + TILE / 2, 6, 0, Math.PI * 2);
          context.fill();
        } else if (tile === 'H') {
          context.fillStyle = '#1e4d2b';
          roundRect(context, x + 2, y + 2, TILE - 4, TILE - 4, 8);
          context.fill();
          context.fillStyle = '#2f6b3d';
          for (let i = 0; i < 4; i += 1) {
            context.beginPath();
            context.arc(x + 10 + (i % 2) * 20, y + 11 + Math.floor(i / 2) * 18, 6, 0, Math.PI * 2);
            context.fill();
          }
        }
      }
    }
  }

  function drawVisionCone(guard) {
    const range = 235;
    const halfAngle = (38 * Math.PI) / 180;
    const alert = guard.state === GUARD_ALERT;
    const suspicious = guard.state === GUARD_SUSPICIOUS || guard.state === GUARD_SEARCH;
    context.save();
    context.beginPath();
    context.moveTo(guard.x, guard.y);
    context.arc(guard.x, guard.y, range, guard.angle - halfAngle, guard.angle + halfAngle);
    context.closePath();
    context.fillStyle = alert
      ? 'rgba(255, 60, 60, 0.30)'
      : suspicious
        ? 'rgba(255, 190, 60, 0.24)'
        : 'rgba(255, 220, 110, 0.16)';
    context.fill();
    context.restore();
  }

  function drawGuard(guard) {
    const alert = guard.state === GUARD_ALERT;
    const suspicious = guard.state === GUARD_SUSPICIOUS || guard.state === GUARD_SEARCH;
    // Body: a dark-uniform guard with a cap brim pointing where he looks.
    context.fillStyle = alert ? '#c0392b' : suspicious ? '#b7791f' : '#2c3e50';
    context.beginPath();
    context.arc(guard.x, guard.y, 14, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8e4d8';
    context.beginPath();
    context.arc(guard.x, guard.y, 8, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = alert ? '#ff5a4e' : '#d8d2c0';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(guard.x, guard.y);
    context.lineTo(guard.x + Math.cos(guard.angle) * 20, guard.y + Math.sin(guard.angle) * 20);
    context.stroke();
    // State mark above the head: ? while suspicious, ! while chasing.
    if (guard.state !== GUARD_PATROL) {
      context.fillStyle = alert ? '#ff6b5e' : '#ffcf5c';
      context.font = 'bold 20px sans-serif';
      context.textAlign = 'center';
      context.fillText(alert ? '!' : '?', guard.x, guard.y - 20);
    }
    // Suspicion arc under the guard.
    if (guard.suspicion > 0.05) {
      context.strokeStyle = guard.suspicion >= 1 ? '#ff5040' : '#ffc84d';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(guard.x, guard.y, 19, -Math.PI / 2, -Math.PI / 2 + guard.suspicion * Math.PI * 2);
      context.stroke();
    }
  }

  function drawPlayer(world, time) {
    const player = world.player;
    // A soft ring shows the noise radius while running.
    if (player.running) {
      context.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(player.x, player.y, 30 + Math.sin(time * 10) * 4, 0, Math.PI * 2);
      context.stroke();
    }
    // Wren: a hooded figure in deep teal, facing the way she moves.
    context.fillStyle = '#0f766e';
    context.beginPath();
    context.arc(player.x, player.y, 13, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#14b8a6';
    context.beginPath();
    context.arc(player.x + Math.cos(player.facing) * 5, player.y + Math.sin(player.facing) * 5, 7, 0, Math.PI * 2);
    context.fill();
    if (player.crouching) {
      context.strokeStyle = 'rgba(20, 184, 166, 0.8)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(player.x, player.y, 17, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawLoot(world, time) {
    const level = world.level;
    const pulse = 0.5 + Math.sin(time * 3) * 0.5;
    for (const artifact of level.artifacts) {
      if (artifact.taken) continue;
      context.fillStyle = '#f5c542';
      context.save();
      context.translate(artifact.x, artifact.y);
      context.rotate(Math.PI / 4);
      context.fillRect(-7, -7, 14, 14);
      context.restore();
      context.fillStyle = `rgba(245, 197, 66, ${0.25 + pulse * 0.2})`;
      context.beginPath();
      context.arc(artifact.x, artifact.y, 16 + pulse * 4, 0, Math.PI * 2);
      context.stroke();
    }
    if (!world.gemTaken) {
      const glow = 18 + pulse * 8;
      const gradient = context.createRadialGradient(level.gem.x, level.gem.y, 2, level.gem.x, level.gem.y, glow + 14);
      gradient.addColorStop(0, 'rgba(120, 220, 255, 0.85)');
      gradient.addColorStop(1, 'rgba(120, 220, 255, 0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(level.gem.x, level.gem.y, glow + 14, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#7dd3fc';
      context.save();
      context.translate(level.gem.x, level.gem.y);
      context.rotate(Math.PI / 4);
      context.fillRect(-9, -9, 18, 18);
      context.restore();
      context.fillStyle = '#e0f2fe';
      context.save();
      context.translate(level.gem.x, level.gem.y);
      context.rotate(Math.PI / 4);
      context.fillRect(-4, -4, 8, 8);
      context.restore();
    }
    // The service exit: locked red until the opal is taken, open green after.
    const exit = level.exit;
    context.fillStyle = world.exitOpen ? '#22c55e' : '#7f1d1d';
    roundRect(context, exit.x - 18, exit.y - 18, 36, 36, 6);
    context.fill();
    context.strokeStyle = world.exitOpen ? '#86efac' : '#fca5a5';
    context.lineWidth = 2;
    roundRect(context, exit.x - 18, exit.y - 18, 36, 36, 6);
    context.stroke();
    context.fillStyle = '#ffffff';
    context.font = 'bold 11px sans-serif';
    context.textAlign = 'center';
    context.fillText(world.exitOpen ? 'EXIT' : 'LOCK', exit.x, exit.y + 4);
  }

  function drawPebbles(world) {
    for (const pebble of world.pebbles) {
      const fade = 1 - pebble.age / 1.2;
      context.strokeStyle = `rgba(255, 255, 255, ${0.7 * fade})`;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(pebble.x, pebble.y, 6 + pebble.age * 40, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = '#d1d5db';
      context.beginPath();
      context.arc(pebble.x, pebble.y, 3, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawMinimap(world) {
    const scale = 0.14;
    const width = VIEW_W * scale;
    const height = VIEW_H * scale;
    const x0 = VIEW_W - width - 12;
    const y0 = 52;
    context.fillStyle = 'rgba(8, 10, 16, 0.78)';
    roundRect(context, x0 - 6, y0 - 6, width + 12, height + 12, 6);
    context.fill();
    const level = world.level;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const tile = tileAt(level, col, row);
        if (tile === '#') {
          context.fillStyle = '#5b6b8c';
          context.fillRect(x0 + col * TILE * scale, y0 + row * TILE * scale, TILE * scale, TILE * scale);
        }
      }
    }
    if (!world.gemTaken) {
      context.fillStyle = '#7dd3fc';
      context.fillRect(x0 + level.gem.x * scale - 2, y0 + level.gem.y * scale - 2, 4, 4);
    }
    context.fillStyle = world.exitOpen ? '#22c55e' : '#ef4444';
    context.fillRect(x0 + level.exit.x * scale - 2, y0 + level.exit.y * scale - 2, 4, 4);
    for (const guard of world.guards) {
      context.fillStyle = guard.state === GUARD_ALERT ? '#ff5040' : '#f59e0b';
      context.beginPath();
      context.arc(x0 + guard.x * scale, y0 + guard.y * scale, 3, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#14b8a6';
    context.beginPath();
    context.arc(x0 + world.player.x * scale, y0 + world.player.y * scale, 3.5, 0, Math.PI * 2);
    context.fill();
  }

  function drawHud(world, best) {
    const level = world.level;
    context.fillStyle = 'rgba(8, 10, 16, 0.82)';
    context.fillRect(0, 0, VIEW_W, 40);
    context.fillStyle = '#e5e7eb';
    context.font = 'bold 15px sans-serif';
    context.textAlign = 'left';
    context.fillText(`VELVET HOUR — ${level.name}`, 12, 26);
    context.font = '13px sans-serif';
    context.fillStyle = '#9ca3af';
    const objective = world.gemTaken ? 'Opal taken — reach the EXIT' : 'Steal the Starlight Opal';
    context.fillText(objective, 330, 26);
    context.textAlign = 'right';
    context.fillStyle = '#e5e7eb';
    const minutes = Math.floor(world.time / 60);
    const seconds = Math.floor(world.time % 60);
    context.fillText(
      `◆ ${world.artifactsTaken}/${level.artifacts.length}   ● ${world.pebbleCount}   ${minutes}:${String(seconds).padStart(2, '0')}   Score ${world.score}   Best ${best}`,
      VIEW_W - 12,
      26,
    );
    // The alarm meter: the highest suspicion among the guards.
    const suspicion = maxSuspicion(world.guards);
    const meterX = 12;
    const meterY = VIEW_H - 26;
    context.fillStyle = 'rgba(8, 10, 16, 0.7)';
    roundRect(context, meterX - 6, meterY - 6, 220, 22, 5);
    context.fill();
    context.fillStyle = suspicion >= 1 ? '#ff5040' : suspicion >= 0.55 ? '#ffb020' : '#4b5563';
    context.fillRect(meterX, meterY, 160 * suspicion, 10);
    context.strokeStyle = '#9ca3af';
    context.strokeRect(meterX, meterY, 160, 10);
    context.fillStyle = suspicion >= 1 ? '#ff6b5e' : '#d1d5db';
    context.font = 'bold 12px sans-serif';
    context.textAlign = 'left';
    context.fillText(suspicion >= 1 ? 'SPOTTED!' : suspicion >= 0.55 ? 'Suspicious…' : 'Unseen', meterX + 168, meterY + 9);
    context.textAlign = 'right';
    context.fillStyle = '#9ca3af';
    context.font = '12px sans-serif';
    context.fillText('WASD move · Shift run · C sneak · Click throw pebble · P pause · M mute', VIEW_W - 12, VIEW_H - 14);
    drawMinimap(world);
  }

  function overlay(title, lines, accent) {
    context.fillStyle = 'rgba(5, 7, 12, 0.78)';
    context.fillRect(0, 0, VIEW_W, VIEW_H);
    context.fillStyle = accent;
    context.font = 'bold 46px sans-serif';
    context.textAlign = 'center';
    context.fillText(title, VIEW_W / 2, VIEW_H / 2 - 90);
    context.fillStyle = '#e5e7eb';
    context.font = '17px sans-serif';
    lines.forEach((line, index) => {
      context.fillText(line, VIEW_W / 2, VIEW_H / 2 - 40 + index * 28);
    });
  }

  return {
    draw(world, screen, best, message = '') {
      const time = world ? world.time : 0;
      if (screen === SCREEN_TITLE && world) {
        drawFloor(world.level);
        for (const guard of world.guards) drawVisionCone(guard);
        for (const guard of world.guards) drawGuard(guard);
        drawLoot(world, time);
        drawPlayer(world, time);
        overlay('VELVET HOUR', [
          'A cat burglar. A dark gallery. One opal.',
          'Slip past the guards, lift the Starlight Opal, and reach the exit unseen.',
          '',
          'WASD / arrows — move    Shift — run (loud)    C — sneak (hard to see)',
          'Click — throw a pebble to distract a guard    P — pause    M — mute',
          '',
          'Press Enter or click to begin',
        ], '#7dd3fc');
        return;
      }
      if (!world) return;
      drawFloor(world.level);
      for (const guard of world.guards) drawVisionCone(guard);
      drawLoot(world, time);
      drawPebbles(world);
      for (const guard of world.guards) drawGuard(guard);
      drawPlayer(world, time);
      drawHud(world, best);
      if (screen === SCREEN_PAUSED) {
        overlay('PAUSED', ['Press P or Enter to keep sneaking.'], '#e5e7eb');
      } else if (screen === SCREEN_CAUGHT) {
        overlay('CAUGHT!', [
          `A guard caught Wren in ${world.level.name}.`,
          `Score ${world.score} — best ${best}.`,
          '',
          'Press Enter to try the gallery again.',
        ], '#ff6b5e');
      } else if (screen === SCREEN_LEVEL_CLEAR) {
        overlay('CLEAN GETAWAY', [
          `${world.level.name} cleared — the opal is yours.`,
          message,
          '',
          'Press Enter for the next wing.',
        ], '#86efac');
      } else if (screen === SCREEN_WIN) {
        overlay('THE OPAL IS YOURS', [
          'Wren slipped out of the Marlow Gallery with every wing behind her.',
          `Final score ${world.score} — best ${best}.`,
          '',
          'Press Enter to play again.',
        ], '#7dd3fc');
      }
    },
  };
}
