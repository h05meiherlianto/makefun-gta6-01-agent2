// Solmar Bay itself: the street grid, the blocks between the streets, the
// buildings, parks, beach, docks and traffic lights. Pure data built once
// from a seeded random — no drawing and no browser in here — plus the
// collision and road queries the world and the traffic AI use.

import { NEON, ROAD_W, WORLD } from './config.js';
import { intBetween, pick } from './random.js';

/** Centrelines of the vertical streets (x) and horizontal streets (y). */
export const ROADS_V = [280, 640, 1000, 1360, 1720, 2080, 2440, 2800, 3160];
export const ROADS_H = [280, 620, 960, 1300, 1640, 1980, 2320];

const BEACH_X = 3300;
const WATER_X = 3520;
/** Blocks (by their grid column/row) that are parks instead of buildings. */
const PARKS = new Set(['3,2', '5,4', '1,5']);
/** Blocks that are the docks district: warehouses and shipping containers. */
const DOCKS = new Set(['0,5', '1,5', '0,4']);

export function createCity(random) {
  const buildings = [];
  const trees = [];
  const lamps = [];
  const containers = [];
  const piers = [];

  // Buildings fill every block that is not a park or the docks.
  for (let col = 0; col < ROADS_V.length - 1; col += 1) {
    for (let row = 0; row < ROADS_H.length - 1; row += 1) {
      const key = `${col},${row}`;
      const x0 = ROADS_V[col] + ROAD_W / 2 + 22;
      const y0 = ROADS_H[row] + ROAD_W / 2 + 22;
      const x1 = ROADS_V[col + 1] - ROAD_W / 2 - 22;
      const y1 = ROADS_H[row + 1] - ROAD_W / 2 - 22;
      if (PARKS.has(key)) {
        for (let t = 0; t < 14; t += 1) {
          trees.push({ x: x0 + random() * (x1 - x0), y: y0 + random() * (y1 - y0), r: 12 + random() * 10 });
        }
        continue;
      }
      if (DOCKS.has(key)) {
        // Two warehouses and a yard of containers.
        buildings.push(makeBuilding(random, x0, y0, (x1 - x0) * 0.55, (y1 - y0) * 0.42, '#5b4a35', true));
        buildings.push(makeBuilding(random, x0 + (x1 - x0) * 0.58, y0 + (y1 - y0) * 0.5, (x1 - x0) * 0.4, (y1 - y0) * 0.45, '#4a3f2e', true));
        for (let c = 0; c < 8; c += 1) {
          containers.push({ x: x0 + 10 + random() * (x1 - x0 - 90), y: y0 + (y1 - y0) * 0.45 + random() * (y1 - y0) * 0.4, w: 62, h: 26, color: pick(random, ['#b45309', '#0e7490', '#991b1b', '#166534']) });
        }
        continue;
      }
      // Ordinary blocks: a 2x2 cluster of buildings with an alley between them.
      const midX = (x0 + x1) / 2;
      const midY = (y0 + y1) / 2;
      const quads = [
        [x0, y0, midX - 8, midY - 8], [midX + 8, y0, x1, midY - 8],
        [x0, midY + 8, midX - 8, y1], [midX + 8, midY + 8, x1, y1],
      ];
      for (const [bx0, by0, bx1, by1] of quads) {
        if (random() < 0.12) {
          trees.push({ x: (bx0 + bx1) / 2, y: (by0 + by1) / 2, r: 14 + random() * 8 });
          continue;
        }
        buildings.push(makeBuilding(random, bx0, by0, bx1 - bx0, by1 - by0, pick(random, ['#2c2f3d', '#33364a', '#3d2f3a', '#2f3d3a', '#40342c']), false));
      }
    }
  }

  // Landmark buildings with names the HUD and missions can point at.
  const landmarks = [
    { name: 'Rico’s Garage', x: 1150, y: 790, w: 150, h: 110 },
    { name: 'Solmar Bank', x: 1870, y: 1470, w: 170, h: 120 },
    { name: 'Marina Café', x: 3010, y: 1130, w: 130, h: 90 },
    { name: 'Safehouse', x: 790, y: 2150, w: 120, h: 90 },
    { name: 'St. Mara Hospital', x: 2230, y: 450, w: 180, h: 120 },
  ];
  for (const lm of landmarks) {
    buildings.push({
      x: lm.x - lm.w / 2, y: lm.y - lm.h / 2, w: lm.w, h: lm.h,
      color: '#3a3f5c', neon: pick(random, NEON), height: 26, name: lm.name, landmark: true,
    });
  }

  // Docks piers jutting into the bay at the south-east corner.
  for (let p = 0; p < 3; p += 1) {
    piers.push({ x: 2500 + p * 220, y: 2320, w: 60, h: 300 });
  }

  // Street lamps along every road, alternating sides.
  for (const x of ROADS_V) {
    for (const y of ROADS_H) lamps.push({ x: x + ROAD_W / 2 + 6, y: y - ROAD_W / 2 - 6 });
  }

  // Traffic lights at every intersection, cycling on a shared clock.
  const lights = [];
  for (const x of ROADS_V) for (const y of ROADS_H) lights.push({ x, y, phase: random() * 8 });

  const city = {
    buildings, trees, lamps, containers, piers, lights, landmarks,
    beachX: BEACH_X, waterX: WATER_X,
  };
  return city;
}

function makeBuilding(random, x, y, w, h, color, warehouse) {
  return {
    x, y, w, h, color,
    neon: random() < 0.55 ? pick(random, NEON) : null,
    height: warehouse ? 14 : intBetween(random, 10, 34),
    warehouse: !!warehouse,
  };
}

/** True when the point is on a road surface (not sidewalk or block). */
export function isOnRoad(x, y) {
  const onV = ROADS_V.some((rx) => Math.abs(x - rx) <= ROAD_W / 2);
  const onH = ROADS_H.some((ry) => Math.abs(y - ry) <= ROAD_W / 2);
  return onV || onH;
}

/** True when the point is on a sidewalk strip beside a road. */
export function isOnSidewalk(x, y) {
  const nearV = ROADS_V.some((rx) => Math.abs(x - rx) > ROAD_W / 2 && Math.abs(x - rx) <= ROAD_W / 2 + 20);
  const nearH = ROADS_H.some((ry) => Math.abs(y - ry) > ROAD_W / 2 && Math.abs(y - ry) <= ROAD_W / 2 + 20);
  return (nearV && ROADS_H.some((ry) => Math.abs(y - ry) <= ROAD_W / 2 + 20)) ||
    (nearH && ROADS_V.some((rx) => Math.abs(x - rx) <= ROAD_W / 2 + 20));
}

/** The building (if any) whose rectangle contains the point, with margin r. */
export function buildingAt(city, x, y, r = 0) {
  for (const b of city.buildings) {
    if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) return b;
  }
  return null;
}

/** Push a circle out of every building it overlaps; returns true if it hit one. */
export function resolveBuildingCollision(city, body) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= body.radius * body.radius) continue;
    hit = true;
    if (d2 > 0.01) {
      const d = Math.sqrt(d2);
      body.x = cx + (dx / d) * body.radius;
      body.y = cy + (dy / d) * body.radius;
    } else {
      // Centre inside the rectangle: push out along the shortest side.
      const left = body.x - b.x;
      const right = b.x + b.w - body.x;
      const top = body.y - b.y;
      const bottom = b.y + b.h - body.y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) body.x = b.x - body.radius;
      else if (min === right) body.x = b.x + b.w + body.radius;
      else if (min === top) body.y = b.y - body.radius;
      else body.y = b.y + b.h + body.radius;
    }
  }
  return hit;
}

/** Clamp a body inside the world, keeping it out of the deep water. */
export function clampToWorld(body) {
  body.x = Math.max(20, Math.min(WORLD.width - 20, body.x));
  body.y = Math.max(20, Math.min(WORLD.height - 20, body.y));
}

/** A random point on a road centreline. */
export function randomRoadPoint(random) {
  if (random() < 0.5) {
    return { x: pick(random, ROADS_V), y: 120 + random() * (WORLD.height - 240) };
  }
  return { x: 120 + random() * (WORLD.width - 240), y: pick(random, ROADS_H) };
}

/** A random point on a sidewalk, for pedestrians. */
export function randomSidewalkPoint(random) {
  if (random() < 0.5) {
    const x = pick(random, ROADS_V) + (random() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 10);
    return { x, y: 120 + random() * (WORLD.height - 240) };
  }
  const y = pick(random, ROADS_H) + (random() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 10);
  return { x: 120 + random() * (WORLD.width - 240), y };
}

/** The landmark with this name, or null. */
export function landmark(city, name) {
  return city.landmarks.find((lm) => lm.name === name) ?? null;
}
