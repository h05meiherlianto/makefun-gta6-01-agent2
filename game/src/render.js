// Drawing only: the world state and the current screen in, pixels out. A
// camera follows the player across the 3600 x 2700 city; the ground, roads,
// buildings with neon signs, beach and docks are painted first, then cars,
// people, bullets and particles, then the HUD — cash, health, wanted stars,
// speed, a live minimap, the mission tracker and the clock — and finally the
// title, pause, mission-list and game-over panels.

import { FONT, PALETTE, ROAD_W, WORLD } from './config.js';
import { MISSIONS, missionLabel } from './missions.js';
import { ROADS_H, ROADS_V, buildingAt } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_MISSIONS = 'missions';

const VIEW_W = 1280;
const VIEW_H = 720;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const fonts = new Map();
  // The screen-space transform of the current frame, so panels and the title
  // can draw in view coordinates after the world was drawn in camera space.
  let viewScale = 1;
  let viewOx = 0;
  let viewOy = 0;

  function text(value, x, y, size, color, align = 'left', weight = '') {
    const key = `${weight}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? `${weight} ` : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawGround(city, camera) {
    // Grass base.
    context.fillStyle = PALETTE.grass;
    context.fillRect(camera.x - 40, camera.y - 40, VIEW_W + 80, VIEW_H + 80);
    // Mow stripes for texture.
    context.fillStyle = PALETTE.grassDark;
    const stripe = 120;
    const startY = Math.floor((camera.y - 40) / stripe) * stripe;
    for (let y = startY; y < camera.y + VIEW_H + 40; y += stripe * 2) {
      context.fillRect(camera.x - 40, y, VIEW_W + 80, stripe);
    }
    // Beach and bay on the east edge.
    context.fillStyle = PALETTE.sand;
    context.fillRect(city.beachX, camera.y - 40, WORLD.width - city.beachX, VIEW_H + 80);
    context.fillStyle = PALETTE.water;
    context.fillRect(city.waterX, camera.y - 40, WORLD.width - city.waterX, VIEW_H + 80);
    context.fillStyle = PALETTE.waterDeep;
    for (let y = Math.floor((camera.y - 40) / 90) * 90; y < camera.y + VIEW_H + 40; y += 90) {
      context.fillRect(city.waterX + 20, y + 30, 46, 4);
    }
    // Parks.
    for (const b of city.buildings) {
      if (b.landmark) continue;
    }
    // Sidewalks: pale strips along every road.
    context.fillStyle = PALETTE.sidewalk;
    for (const x of ROADS_V) context.fillRect(x - ROAD_W / 2 - 20, camera.y - 40, ROAD_W + 40, VIEW_H + 80);
    for (const y of ROADS_H) context.fillRect(camera.x - 40, y - ROAD_W / 2 - 20, VIEW_W + 80, ROAD_W + 40);
    // Road surfaces.
    context.fillStyle = PALETTE.road;
    for (const x of ROADS_V) context.fillRect(x - ROAD_W / 2, camera.y - 40, ROAD_W, VIEW_H + 80);
    for (const y of ROADS_H) context.fillRect(camera.x - 40, y - ROAD_W / 2, VIEW_W + 80, ROAD_W);
    // Centre dashes.
    context.fillStyle = PALETTE.roadLine;
    for (const x of ROADS_V) {
      for (let y = Math.floor((camera.y - 40) / 64) * 64; y < camera.y + VIEW_H + 40; y += 64) {
        if (!ROADS_H.some((ry) => Math.abs(y - ry) < 70)) context.fillRect(x - 3, y, 6, 30);
      }
    }
    for (const y of ROADS_H) {
      for (let x = Math.floor((camera.x - 40) / 64) * 64; x < camera.x + VIEW_W + 40; x += 64) {
        if (!ROADS_V.some((rx) => Math.abs(x - rx) < 70)) context.fillRect(x, y - 3, 30, 6);
      }
    }
    // Crosswalks at intersections.
    context.fillStyle = 'rgba(240,240,240,0.55)';
    for (const x of ROADS_V) {
      for (const y of ROADS_H) {
        for (let i = -3; i <= 3; i += 1) {
          context.fillRect(x + i * 12 - 4, y - ROAD_W / 2 - 14, 8, 12);
          context.fillRect(x + i * 12 - 4, y + ROAD_W / 2 + 2, 8, 12);
        }
      }
    }
    // Docks piers.
    context.fillStyle = '#6b4f2a';
    for (const pier of city.piers) context.fillRect(pier.x, pier.y, pier.w, pier.h);
    context.fillStyle = '#8a6a3a';
    for (const pier of city.piers) {
      for (let y = pier.y; y < pier.y + pier.h; y += 26) context.fillRect(pier.x, y, pier.w, 3);
    }
  }

  function drawCityDetails(city, camera, time) {
    // Trees.
    for (const tree of city.trees) {
      if (tree.x < camera.x - 40 || tree.x > camera.x + VIEW_W + 40 || tree.y < camera.y - 40 || tree.y > camera.y + VIEW_H + 40) continue;
      context.fillStyle = '#14532d';
      context.beginPath();
      context.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#22c55e';
      context.beginPath();
      context.arc(tree.x - 3, tree.y - 3, tree.r * 0.6, 0, Math.PI * 2);
      context.fill();
    }
    // Shipping containers at the docks.
    for (const c of city.containers) {
      context.fillStyle = c.color;
      context.fillRect(c.x, c.y, c.w, c.h);
      context.fillStyle = 'rgba(255,255,255,0.18)';
      for (let x = c.x + 8; x < c.x + c.w; x += 12) context.fillRect(x, c.y + 4, 3, c.h - 8);
    }
    // Buildings: roof, drop shadow, windows, neon sign.
    for (const b of city.buildings) {
      if (b.x + b.w < camera.x - 60 || b.x > camera.x + VIEW_W + 60 || b.y + b.h < camera.y - 60 || b.y > camera.y + VIEW_H + 60) continue;
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.strokeStyle = PALETTE.buildingEdge;
      context.lineWidth = 2;
      context.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      // Windows.
      context.fillStyle = 'rgba(255,209,102,0.75)';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          if ((cx * 7 + cy * 3 + b.height) % 3 === 0) {
            context.fillRect(b.x + 8 + cx * 26, b.y + 8 + cy * 26, 12, 10);
          }
        }
      }
      if (b.neon) {
        context.fillStyle = b.neon;
        context.globalAlpha = 0.85 + 0.15 * Math.sin(time * 3 + b.x);
        context.fillRect(b.x + 6, b.y - 4, b.w - 12, 6);
        context.globalAlpha = 1;
      }
      if (b.landmark && b.name) {
        text(b.name, b.x + b.w / 2, b.y + b.h / 2 + 5, 15, '#ffffff', 'center', '700');
      }
    }
    // Street lamps.
    for (const lamp of city.lamps) {
      if (lamp.x < camera.x - 20 || lamp.x > camera.x + VIEW_W + 20 || lamp.y < camera.y - 20 || lamp.y > camera.y + VIEW_H + 20) continue;
      context.fillStyle = '#9aa3b5';
      context.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
      context.fillStyle = 'rgba(255,209,102,0.16)';
      context.beginPath();
      context.arc(lamp.x, lamp.y, 26, 0, Math.PI * 2);
      context.fill();
    }
    // Traffic lights.
    for (const light of city.lights) {
      const greenV = ((time + light.phase) % 8) < 4;
      context.fillStyle = '#11141b';
      context.fillRect(light.x + ROAD_W / 2 + 2, light.y - ROAD_W / 2 - 18, 10, 22);
      context.fillStyle = greenV ? '#22c55e' : '#ef4444';
      context.beginPath();
      context.arc(light.x + ROAD_W / 2 + 7, light.y - ROAD_W / 2 - 12, 3.5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = greenV ? '#ef4444' : '#22c55e';
      context.beginPath();
      context.arc(light.x + ROAD_W / 2 + 7, light.y - ROAD_W / 2 - 4, 3.5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawCar(car, time) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(0,0,0,0.4)';
    context.fillRect(-24, -13, 48, 26);
    context.fillStyle = car.color;
    roundRect(-23, -12, 46, 24, 7);
    context.fill();
    context.fillStyle = 'rgba(180,220,255,0.85)';
    roundRect(-6, -10, 16, 20, 4);
    context.fill();
    context.fillStyle = '#11141b';
    context.fillRect(-20, -12, 6, 5);
    context.fillRect(-20, 7, 6, 5);
    context.fillRect(14, -12, 6, 5);
    context.fillRect(14, 7, 6, 5);
    // Headlights.
    context.fillStyle = '#fef08a';
    context.fillRect(21, -9, 3, 5);
    context.fillRect(21, 4, 3, 5);
    if (car.kind === 'police') {
      const blink = Math.floor(time * 4) % 2 === 0;
      context.fillStyle = blink ? PALETTE.copRed : PALETTE.copBlue;
      context.fillRect(-2, -11, 8, 4);
      context.fillStyle = blink ? PALETTE.copBlue : PALETTE.copRed;
      context.fillRect(-2, 7, 8, 4);
      context.fillStyle = '#f2f4f8';
      text('PD', 0, 4, 10, '#ffffff', 'center', '700');
    }
    if (car.kind === 'taxi') {
      context.fillStyle = '#11141b';
      text('TAXI', -2, 4, 9, '#11141b', 'center', '700');
      context.fillStyle = '#ffd166';
      context.fillRect(-8, -14, 16, 5);
    }
    if (car.hp < 55 && car.hp > 0) {
      context.fillStyle = 'rgba(255,122,24,0.8)';
      context.beginPath();
      context.arc(-10 + Math.sin(time * 20) * 2, 0, 5 + Math.sin(time * 14) * 2, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawPedestrian(ped, time) {
    if (ped.down > 0) {
      context.fillStyle = ped.color;
      context.beginPath();
      context.ellipse(ped.x, ped.y, 12, 6, ped.angle, 0, Math.PI * 2);
      context.fill();
      return;
    }
    const bob = Math.sin(time * 10 + ped.x) * 1.5;
    context.fillStyle = 'rgba(0,0,0,0.35)';
    context.beginPath();
    context.ellipse(ped.x, ped.y + 8, 9, 4, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = ped.color;
    context.beginPath();
    context.arc(ped.x, ped.y + bob * 0.3, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f5c99b';
    context.beginPath();
    context.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3 + bob * 0.3, 5, 0, Math.PI * 2);
    context.fill();
  }

  function drawPlayer(player, time) {
    if (player.inCar) return;
    const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0;
    if (blink) return;
    context.save();
    context.translate(player.x, player.y);
    context.fillStyle = 'rgba(0,0,0,0.35)';
    context.beginPath();
    context.ellipse(0, 9, 10, 4, 0, 0, Math.PI * 2);
    context.fill();
    context.rotate(player.angle);
    // Pistol arm.
    context.fillStyle = '#1f2937';
    context.fillRect(8, -2, 14, 4);
    context.restore();
    context.save();
    context.translate(player.x, player.y);
    context.fillStyle = '#ff2e88';
    context.beginPath();
    context.arc(0, 0, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f5c99b';
    context.beginPath();
    context.arc(Math.cos(player.angle) * 3, Math.sin(player.angle) * 3, 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#111827';
    context.beginPath();
    context.arc(Math.cos(player.angle) * 3, Math.sin(player.angle) * 3 - 2, 6.5, Math.PI, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawWaypoint(state, city, time) {
    const target = waypointTarget(state);
    if (!target) return;
    const pulse = 1 + 0.12 * Math.sin(time * 4);
    context.strokeStyle = '#ffd166';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(target.x, target.y, 26 * pulse, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = 'rgba(255,209,102,0.25)';
    context.beginPath();
    context.arc(target.x, target.y, 26 * pulse, 0, Math.PI * 2);
    context.fill();
    // A beacon column so the marker reads from far away.
    context.fillStyle = 'rgba(255,209,102,0.10)';
    context.fillRect(target.x - 3, target.y - 260, 6, 260);
    // Edge arrow pointing at an off-screen target.
    const player = state.player;
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d > 420) {
      const ax = player.x + (dx / d) * 240;
      const ay = player.y + (dy / d) * 240;
      const a = Math.atan2(dy, dx);
      context.save();
      context.translate(ax, ay);
      context.rotate(a);
      context.fillStyle = '#ffd166';
      context.beginPath();
      context.moveTo(18, 0);
      context.lineTo(-10, -11);
      context.lineTo(-10, 11);
      context.closePath();
      context.fill();
      context.restore();
      text(`${Math.round(d)}m`, ax, ay - 22, 14, '#ffd166', 'center', '700');
    }
  }

  function waypointTarget(state) {
    if (state.taxi.active) return { x: state.taxi.x, y: state.taxi.y };
    const mission = MISSIONS[state.missionIndex];
    if (!state.missionActive || !mission) return null;
    const obj = mission.objectives[state.objectiveIndex];
    if (!obj) return null;
    if (obj.type === 'goto') return { x: obj.x, y: obj.y };
    if (obj.type === 'tail' && state.courier) return { x: state.courier.x, y: state.courier.y };
    if (obj.type === 'kill') return { x: 790, y: 2150 };
    if (obj.type === 'escape') return { x: 790, y: 2150 };
    if (obj.type === 'wait' && state.anchor) return { x: state.anchor.x, y: state.anchor.y };
    return null;
  }

  function drawHud(state, screen) {
    const player = state.player;
    // Top-left: cash, health, armour, ammo.
    context.fillStyle = 'rgba(10,12,24,0.72)';
    roundRect(12, 12, 250, 108, 10);
    context.fill();
    text(`$${player.cash.toLocaleString('en-US')}`, 26, 44, 26, PALETTE.cash, 'left', '800');
    // Health bar.
    context.fillStyle = '#2b3350';
    context.fillRect(26, 56, 180, 12);
    context.fillStyle = player.hp > 40 ? '#39ff88' : '#ff4d4d';
    context.fillRect(26, 56, 180 * clamp(player.hp / 100, 0, 1), 12);
    text('HP', 212, 67, 12, PALETTE.muted, 'left', '700');
    context.fillStyle = '#2b3350';
    context.fillRect(26, 74, 180, 8);
    context.fillStyle = '#22d3ee';
    context.fillRect(26, 74, 180 * clamp(player.armor / 50, 0, 1), 8);
    text('ARMOR', 212, 82, 11, PALETTE.muted, 'left', '700');
    text(`Ammo ${player.ammo}  •  ${player.inCar ? 'IN CAR' : 'ON FOOT'}`, 26, 106, 14, PALETTE.text, 'left', '600');
    // Top-centre: wanted stars.
    const stars = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
    text(stars, VIEW_W / 2, 44, 30, state.wanted > 0 ? '#ffd166' : '#5b6478', 'center', '800');
    if (state.wanted > 0) text('WANTED', VIEW_W / 2, 66, 13, '#ff8a8a', 'center', '700');
    // Clock.
    const totalMin = Math.floor(state.clockMinutes) % (24 * 60);
    const hh = String(Math.floor(totalMin / 60)).padStart(2, '0');
    const mm = String(totalMin % 60).padStart(2, '0');
    text(`${hh}:${mm}  •  SOLMAR BAY`, VIEW_W / 2, 88, 14, PALETTE.muted, 'center', '600');
    // Bottom-left: speed + mission tracker.
    context.fillStyle = 'rgba(10,12,24,0.72)';
    roundRect(12, VIEW_H - 96, 420, 84, 10);
    context.fill();
    const mission = MISSIONS[state.missionIndex];
    const objective = state.missionActive && mission ? mission.objectives[state.objectiveIndex] : null;
    text(state.storyComplete ? '★ STORY COMPLETE — FREE ROAM ★' : `MISSION ${missionLabel(state.missionIndex)}`, 26, VIEW_H - 66, 16, '#ffd166', 'left', '800');
    if (objective) {
      let objText = objective.text;
      if (objective.type === 'kill') objText = `Clear out the rival goons (${state.kills}/${objective.count})`;
      if (objective.type === 'tail') objText = `Tail the courier — stay close (${Math.floor(state.tailProgress)}/${objective.seconds}s)`;
      if (objective.type === 'goto' && objective.timeLimit) objText = `${objective.text} — ${Math.max(0, Math.ceil(objective.timeLimit - state.missionTimer))}s left`;
      text(objText, 26, VIEW_H - 42, 14, PALETTE.text, 'left', '600');
    }
    if (state.taxi.active) {
      text(state.taxi.phase === 'pickup' ? 'TAXI: pick up the passenger' : `TAXI: deliver the fare — ${Math.ceil(state.taxi.timer)}s`, 26, VIEW_H - 20, 14, '#ffd166', 'left', '700');
    } else {
      text(player.inCar ? `Speed ${Math.round(Math.abs(player.speed) * 0.24)} km/h` : 'WASD move • Click to shoot • E enter car • T taxi job', 26, VIEW_H - 20, 13, PALETTE.muted, 'left');
    }
    // Messages.
    let my = 140;
    for (const msg of state.messages) {
      context.globalAlpha = clamp(msg.life, 0, 1);
      text(msg.text.length > 110 ? msg.text.slice(0, 107) + '…' : msg.text, 26, my, 15, msg.color, 'left', '600');
      my += 22;
    }
    context.globalAlpha = 1;
    // Bust warning.
    if (state.bustTimer > 0) {
      text('THE POLICE ARE GRABBING YOU — RUN!', VIEW_W / 2, 130, 20, '#ff4d4d', 'center', '800');
    }
    drawMinimap(state);
  }

  function drawMinimap(state) {
    const mw = 220;
    const mh = 164;
    const mx = VIEW_W - mw - 12;
    const my = 12;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    context.fillStyle = 'rgba(10,12,24,0.8)';
    roundRect(mx - 4, my - 4, mw + 8, mh + 8, 10);
    context.fill();
    context.save();
    context.beginPath();
    context.rect(mx, my, mw, mh);
    context.clip();
    context.fillStyle = '#173d26';
    context.fillRect(mx, my, mw, mh);
    context.fillStyle = '#c9a86a';
    context.fillRect(mx + 3300 * sx, my, mw - 3300 * sx, mh);
    context.fillStyle = '#0e4d6e';
    context.fillRect(mx + 3520 * sx, my, mw - 3520 * sx, mh);
    context.fillStyle = '#23242e';
    for (const x of ROADS_V) context.fillRect(mx + (x - ROAD_W / 2) * sx, my, ROAD_W * sx, mh);
    for (const y of ROADS_H) context.fillRect(mx, my + (y - ROAD_W / 2) * sy, mw, ROAD_W * sy);
    // Buildings as faint dots.
    context.fillStyle = 'rgba(200,205,220,0.5)';
    for (const b of state.city.buildings) {
      context.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
    }
    const target = waypointTarget(state);
    if (target) {
      context.fillStyle = '#ffd166';
      context.beginPath();
      context.arc(mx + target.x * sx, my + target.y * sy, 6, 0, Math.PI * 2);
      context.fill();
    }
    // Police.
    context.fillStyle = '#3b82f6';
    for (const car of state.cars) {
      if (car.kind === 'police' && car.hp > 0 && !car.parked) {
        context.beginPath();
        context.arc(mx + car.x * sx, my + car.y * sy, 4, 0, Math.PI * 2);
        context.fill();
      }
    }
    for (const cop of state.cops) {
      context.beginPath();
      context.arc(mx + cop.x * sx, my + cop.y * sy, 3, 0, Math.PI * 2);
      context.fill();
    }
    // Player arrow.
    const px = mx + state.player.x * sx;
    const py = my + state.player.y * sy;
    context.save();
    context.translate(px, py);
    context.rotate(state.player.angle);
    context.fillStyle = '#ff2e88';
    context.beginPath();
    context.moveTo(8, 0);
    context.lineTo(-6, -5);
    context.lineTo(-6, 5);
    context.closePath();
    context.fill();
    context.restore();
    context.restore();
    text('SOLMAR BAY', mx + mw / 2, my + mh + 18, 11, PALETTE.muted, 'center', '700');
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 30;
    const x = (VIEW_W - width) / 2;
    const y = (VIEW_H - height) / 2;
    context.fillStyle = 'rgba(6,8,18,0.72)';
    context.fillRect(0, 0, VIEW_W, VIEW_H);
    context.fillStyle = PALETTE.panel;
    roundRect(x, y, width, height, 14);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.stroke();
    text(title, VIEW_W / 2, y + 62, 44, accent ?? PALETTE.text, 'center', '800');
    lines.forEach((line, i) => {
      text(line, VIEW_W / 2, y + 108 + i * 30, 18, PALETTE.muted, 'center');
    });
    text(prompt, VIEW_W / 2, y + height - 30, 18, PALETTE.neonYellow, 'center', '700');
  }

  function drawTitle(state, best, camera) {
    // A living city behind the title: the world keeps moving.
    drawWorld(state, camera, 1);
    // Back to screen space for the overlay text.
    context.setTransform(viewScale, 0, 0, viewScale, viewOx, viewOy);
    context.fillStyle = 'rgba(6,8,18,0.55)';
    context.fillRect(0, 0, VIEW_W, VIEW_H);
    text('SOLMAR BAY', VIEW_W / 2, 190, 84, '#ff2e88', 'center', '900');
    text('A NEON COASTAL OPEN-WORLD CRIME GAME', VIEW_W / 2, 232, 20, PALETTE.neonCyan, 'center', '700');
    text('Steal cars. Outrun the police. Run six story missions for Rico Vane', VIEW_W / 2, 300, 18, PALETTE.text, 'center');
    text('and Lena Marlowe — from your first stolen wheels to the Solmar Bank heist.', VIEW_W / 2, 328, 18, PALETTE.text, 'center');
    text('WASD move / drive   •   Mouse aim   •   Click / F shoot   •   E enter & steal cars', VIEW_W / 2, 386, 17, PALETTE.muted, 'center');
    text('Space handbrake   •   Shift boost   •   T taxi job   •   M missions   •   P pause', VIEW_W / 2, 414, 17, PALETTE.muted, 'center');
    if (best.cash > 0 || best.missions > 0) {
      text(`Best save: $${best.cash.toLocaleString('en-US')}  •  ${best.missions} missions done`, VIEW_W / 2, 470, 17, PALETTE.cash, 'center', '700');
    }
    text('PRESS ENTER OR CLICK TO START', VIEW_W / 2, 540, 24, PALETTE.neonYellow, 'center', '800');
    text('Original city, characters, vehicles, story, art and sound — nothing from any commercial game.', VIEW_W / 2, 690, 13, PALETTE.muted, 'center');
  }

  function drawWorld(state, camera, time) {
    const city = state.city;
    drawGround(city, camera);
    drawCityDetails(city, camera, time);
    // Waypoint beacon under the cars.
    drawWaypoint(state, city, time);
    // Pickups.
    for (const pk of state.pickups) {
      const bob = Math.sin(time * 3 + pk.bob) * 3;
      const color = pk.kind === 'health' ? '#39ff88' : pk.kind === 'ammo' ? '#ffd166' : pk.kind === 'armor' ? '#22d3ee' : '#7dff6a';
      context.fillStyle = color;
      context.beginPath();
      context.arc(pk.x, pk.y + bob, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#11141b';
      text(pk.kind === 'health' ? '+' : pk.kind === 'ammo' ? 'A' : pk.kind === 'armor' ? 'S' : '$', pk.x, pk.y + bob + 4, 12, '#11141b', 'center', '800');
    }
    // Cars, sorted so the player's car draws on top.
    const cars = [...state.cars].sort((a, b) => (a === state.player.car ? 1 : 0) - (b === state.player.car ? 1 : 0));
    for (const car of cars) {
      if (car.hp <= 0) {
        context.fillStyle = '#1a1a1a';
        context.beginPath();
        context.arc(car.x, car.y, 20, 0, Math.PI * 2);
        context.fill();
        continue;
      }
      drawCar(car, time);
    }
    for (const ped of state.peds) drawPedestrian(ped, time);
    for (const cop of state.cops) {
      context.fillStyle = '#1e3a8a';
      context.beginPath();
      context.arc(cop.x, cop.y, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#f5c99b';
      context.beginPath();
      context.arc(cop.x, cop.y, 6, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#1e3a8a';
      context.beginPath();
      context.arc(cop.x, cop.y - 3, 6.5, Math.PI, Math.PI * 2);
      context.fill();
    }
    for (const goon of state.goons) {
      context.fillStyle = goon.color;
      context.beginPath();
      context.arc(goon.x, goon.y, 12, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#f5c99b';
      context.beginPath();
      context.arc(goon.x, goon.y, 6, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#111827';
      context.fillRect(goon.x + Math.cos(goon.angle) * 8, goon.y + Math.sin(goon.angle) * 8 - 2, 14, 4);
      // Health pip.
      context.fillStyle = '#2b3350';
      context.fillRect(goon.x - 12, goon.y - 22, 24, 4);
      context.fillStyle = '#ff4d4d';
      context.fillRect(goon.x - 12, goon.y - 22, 24 * clamp(goon.hp / 70, 0, 1), 4);
    }
    drawPlayer(state.player, time);
    // Bullets.
    for (const b of state.bullets) {
      context.strokeStyle = '#ffd166';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    // Particles.
    for (const p of state.particles) {
      context.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    // Floating cash text.
    for (const f of state.floaters) {
      context.globalAlpha = clamp(f.life, 0, 1);
      text(f.text, f.x, f.y, 16, f.color, 'center', '800');
    }
    context.globalAlpha = 1;
    // Dusk tint: a warm neon wash over everything.
    context.fillStyle = 'rgba(255,80,140,0.05)';
    context.fillRect(camera.x - 40, camera.y - 40, VIEW_W + 80, VIEW_H + 80);
    context.fillStyle = 'rgba(20,20,80,0.07)';
    context.fillRect(camera.x - 40, camera.y - 40, VIEW_W + 80, VIEW_H + 80);
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
  }

  /** Paint one frame. `camera` is the world-space top-left of the view. */
  function draw(state, screen, best, camera, showMissions) {
    const scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    const ox = (canvas.width - VIEW_W * scale) / 2;
    const oy = (canvas.height - VIEW_H * scale) / 2;
    viewScale = scale;
    viewOx = ox;
    viewOy = oy;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    context.setTransform(scale, 0, 0, scale, ox - camera.x * scale + shakeX * scale, oy - camera.y * scale + shakeY * scale);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best, camera);
      return;
    }
    drawWorld(state, camera, state.time);
    context.setTransform(scale, 0, 0, scale, ox + shakeX * scale, oy + shakeY * scale);
    drawHud(state, screen);
    if (state.damageFlash > 0) {
      context.fillStyle = `rgba(255,40,40,${clamp(state.damageFlash, 0, 0.35)})`;
      context.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for you.', 'M — mission list    N — mute    P — resume'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel('WASTED', [`You went down in Solmar Bay.`, `Cash kept: $${state.player.cash.toLocaleString('en-US')}  •  Missions done: ${state.stats.missionsDone}`], 'Press Enter to try again', '#ff4d4d');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The Solmar Bay PD caught you.', `Bail cost you $200. Cash left: $${state.player.cash.toLocaleString('en-US')}`], 'Press Enter to get out', '#3b82f6');
    } else if (showMissions) {
      const lines = MISSIONS.map((m, i) => {
        const mark = i < state.missionIndex || state.storyComplete ? '✓' : i === state.missionIndex ? '►' : '·';
        return `${mark} ${m.id}. ${m.title} — ${m.giver} ($${m.reward})`;
      });
      drawPanel('Story Missions', lines, 'Press M to close');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, VIEW_W, VIEW_H };
}
