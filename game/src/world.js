// The game's rules and state, with no drawing and no browser in it: the
// player on foot and in cars, traffic and pedestrians, police and the wanted
// level, combat, pickups, particles, the story missions and taxi fares.
// step() advances one fixed step and returns what happened as bit flags, so
// the caller can react (sounds, announcements) without the world knowing
// about screens or sound. Nothing here allocates after createWorld returns
// except the small particle and message lists, which are capped.

import { CAR, CAR_COLORS, CLOCK, PED_COLORS, PLAYER, WANTED, WORLD } from './config.js';
import { ROADS_H, ROADS_V, buildingAt, clampToWorld, landmark, randomRoadPoint, randomSidewalkPoint, resolveBuildingCollision } from './city.js';
import { MISSIONS } from './missions.js';
import { intBetween, pick } from './random.js';

export const EVENT_SHOT = 1;
export const EVENT_ENEMY_SHOT = 2;
export const EVENT_CRASH = 4;
export const EVENT_PICKUP = 8;
export const EVENT_CASH = 16;
export const EVENT_MISSION = 32;
export const EVENT_FAIL = 64;
export const EVENT_WASTED = 128;
export const EVENT_BUSTED = 256;
export const EVENT_WANTED = 512;
export const EVENT_EXPLOSION = 1024;

const TRAFFIC_COUNT = 16;
const PED_COUNT = 26;
const MAX_PARTICLES = 220;
const MAX_BULLETS = 60;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createWorld(random, city) {
  const state = {
    time: 0,
    clockMinutes: CLOCK.startHour * 60 + CLOCK.startMinute,
    player: {
      x: 1000, y: 700, angle: 0, radius: PLAYER.radius,
      hp: PLAYER.hp, armor: PLAYER.armor, cash: PLAYER.startCash, ammo: PLAYER.startAmmo,
      inCar: false, car: null, fireTimer: 0, invulnerable: 0, speed: 0,
    },
    cars: [],
    peds: [],
    cops: [],
    goons: [],
    bullets: [],
    particles: [],
    floaters: [],
    pickups: [],
    wanted: 0,
    lastCrime: -999,
    wantedTimer: 0,
    bustTimer: 0,
    missionIndex: 0,
    objectiveIndex: 0,
    objectiveTimer: 0,
    missionTimer: 0,
    tailProgress: 0,
    kills: 0,
    courier: null,
    courierLost: 0,
    anchor: null,
    missionActive: true,
    storyComplete: false,
    taxi: { active: false, phase: 'idle', x: 0, y: 0, timer: 0, fare: 0 },
    messages: [],
    shake: 0,
    damageFlash: 0,
    stats: { carsStolen: 0, missionsDone: 0, fares: 0, earned: 0 },
  };

  let carId = 0;

  function makeCar(x, y, kind, traffic) {
    const colors = CAR_COLORS[kind] ?? CAR_COLORS.sedan;
    const car = {
      id: carId += 1, x, y, angle: random() * Math.PI * 2, speed: 0,
      color: pick(random, colors), kind, traffic: !!traffic,
      hp: 100, radius: 22, parked: !traffic, crashTimer: 0,
      axis: random() < 0.5 ? 'v' : 'h', dir: random() < 0.5 ? 1 : -1,
      targetSpeed: 150 + random() * 110, turnTimer: 0,
    };
    if (traffic) {
      // Snap traffic cars onto a road, driving along it.
      if (car.axis === 'v') { car.x = pick(random, ROADS_V); car.y = 120 + random() * (WORLD.height - 240); car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      else { car.y = pick(random, ROADS_H); car.x = 120 + random() * (WORLD.width - 240); car.angle = car.dir > 0 ? 0 : Math.PI; }
    }
    return car;
  }

  function spawnParkedCars() {
    const spots = [
      [940, 700, 'sedan'], [1060, 700, 'sports'], [640, 900, 'taxi'], [1720, 700, 'van'],
      [2080, 1060, 'sedan'], [2440, 1400, 'truck'], [2800, 620, 'sedan'], [1000, 1400, 'taxi'],
      [1360, 1700, 'sports'], [3160, 1300, 'sedan'], [640, 1300, 'van'], [2080, 1980, 'sedan'],
      [2440, 960, 'taxi'], [2800, 1980, 'sports'], [1360, 620, 'sedan'], [1720, 2320, 'van'],
    ];
    for (const [x, y, kind] of spots) {
      const car = makeCar(x, y, kind, false);
      // Face along the nearest road, so a fresh driver can pull away.
      const dv = Math.min(...ROADS_V.map((rx) => Math.abs(x - rx)));
      const dh = Math.min(...ROADS_H.map((ry) => Math.abs(y - ry)));
      car.angle = dv <= dh ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI);
      state.cars.push(car);
    }
  }

  function spawnTraffic() {
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
      const kind = random() < 0.12 ? 'taxi' : random() < 0.12 ? 'van' : random() < 0.1 ? 'truck' : 'sedan';
      state.cars.push(makeCar(0, 0, kind, true));
    }
  }

  function spawnPeds() {
    for (let i = 0; i < PED_COUNT; i += 1) {
      const p = randomSidewalkPoint(random);
      state.peds.push({
        x: p.x, y: p.y, angle: random() * Math.PI * 2, speed: 40 + random() * 35,
        color: pick(random, PED_COLORS), radius: 10, down: 0, walkTimer: 0,
        target: randomSidewalkPoint(random),
      });
    }
  }

  function spawnPickups() {
    const spots = [
      [1000, 560, 'health'], [1720, 1240, 'ammo'], [640, 1920, 'armor'], [3160, 900, 'health'],
      [2080, 220, 'ammo'], [2800, 1640, 'armor'], [1360, 960, 'cash'], [2440, 1980, 'cash'],
      [1000, 1640, 'health'], [3160, 1980, 'ammo'], [640, 620, 'cash'], [2080, 1300, 'armor'],
    ];
    for (const [x, y, kind] of spots) state.pickups.push({ x, y, kind, amount: kind === 'cash' ? 60 : kind === 'health' ? 40 : kind === 'ammo' ? 30 : 25, bob: random() * 6 });
  }

  function pushMessage(text, color = '#f2f4f8') {
    state.messages.push({ text, color, life: 4.5 });
    if (state.messages.length > 5) state.messages.shift();
  }

  function addParticles(x, y, color, count, speed, life = 0.6, size = 4) {
    for (let i = 0; i < count; i += 1) {
      if (state.particles.length >= MAX_PARTICLES) return;
      const a = random() * Math.PI * 2;
      const s = speed * (0.3 + random() * 0.7);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + random() * 0.5), maxLife: life, color, size: size * (0.6 + random() * 0.8) });
    }
  }

  function addFloater(x, y, text, color) {
    state.floaters.push({ x, y, text, color, life: 1.4 });
    if (state.floaters.length > 24) state.floaters.shift();
  }

  function addWanted(amount) {
    const before = state.wanted;
    state.wanted = Math.min(WANTED.max, state.wanted + amount);
    state.lastCrime = state.time;
    state.wantedTimer = 0;
    if (state.wanted > before) return EVENT_WANTED;
    return 0;
  }

  function explodeCar(car) {
    addParticles(car.x, car.y, '#ff7a18', 26, 260, 0.9, 7);
    addParticles(car.x, car.y, '#3a3b46', 18, 120, 1.4, 9);
    addParticles(car.x, car.y, '#ffd166', 12, 200, 0.5, 5);
    state.shake = Math.max(state.shake, 14);
    if (state.player.car === car) exitCar(true);
    car.hp = 0;
    car.parked = true;
    car.traffic = false;
    return EVENT_EXPLOSION;
  }

  function exitCar(ejected) {
    const player = state.player;
    const car = player.car;
    if (!car) return;
    player.inCar = false;
    player.car = null;
    const side = random() < 0.5 ? -1 : 1;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34 * side;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34 * side;
    player.angle = car.angle;
    if (ejected) {
      player.hp = Math.max(1, player.hp - 15);
      state.damageFlash = 0.6;
    }
    resolveBuildingCollision(city, player);
    clampToWorld(player);
  }

  function nearestCar(x, y, maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of state.cars) {
      if (car.hp <= 0) continue;
      const d = dist2(x, y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function enterCar() {
    const player = state.player;
    const car = nearestCar(player.x, player.y, 64);
    if (!car) return 0;
    player.inCar = true;
    player.car = car;
    car.parked = false;
    if (car.traffic) {
      car.traffic = false;
      addFloater(car.x, car.y - 30, 'CAR STOLEN!', '#ff4d4d');
      pushMessage('You stole a car! The owner ran off.', '#ff8a8a');
      state.stats.carsStolen += 1;
      return addWanted(1);
    }
    if (car.kind === 'taxi') pushMessage('Taxi — press T to start picking up fares.', '#ffd166');
    return 0;
  }

  function fireBullet(from, x, y, angle, damage) {
    if (state.bullets.length >= MAX_BULLETS) return;
    state.bullets.push({
      x: x + Math.cos(angle) * 20, y: y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * PLAYER.bulletSpeed, vy: Math.sin(angle) * PLAYER.bulletSpeed,
      life: 0.9, from, damage,
    });
  }

  function damagePlayer(amount) {
    const player = state.player;
    if (player.invulnerable > 0) return 0;
    let rest = amount;
    if (player.armor > 0) {
      const absorbed = Math.min(player.armor, rest * 0.6);
      player.armor -= absorbed;
      rest -= absorbed;
    }
    player.hp -= rest;
    state.damageFlash = Math.max(state.damageFlash, 0.45);
    state.shake = Math.max(state.shake, 5);
    if (player.hp <= 0) {
      player.hp = 0;
      return EVENT_WASTED;
    }
    return 0;
  }

  function currentMission() {
    return state.missionActive ? MISSIONS[state.missionIndex] ?? null : null;
  }

  function currentObjective() {
    const mission = currentMission();
    if (!mission) return null;
    return mission.objectives[state.objectiveIndex] ?? null;
  }

  function startMission(index) {
    const mission = MISSIONS[index];
    state.missionIndex = index;
    state.objectiveIndex = 0;
    state.objectiveTimer = 0;
    state.missionTimer = 0;
    state.tailProgress = 0;
    state.kills = 0;
    state.courier = null;
    state.courierLost = 0;
    state.anchor = null;
    state.missionActive = true;
    state.goons = [];
    if (mission) pushMessage(`${mission.title} — ${mission.giver}: ${mission.brief}`, '#ffd166');
  }

  function completeObjective() {
    const mission = currentMission();
    const obj = currentObjective();
    if (obj && (obj.type === 'goto' || obj.type === 'wait')) {
      state.anchor = { x: obj.x ?? state.player.x, y: obj.y ?? state.player.y };
    }
    state.objectiveIndex += 1;
    state.objectiveTimer = 0;
    state.missionTimer = 0;
    if (mission && state.objectiveIndex >= mission.objectives.length) {
      // Mission complete.
      const reward = mission.reward;
      state.player.cash += reward;
      state.stats.missionsDone += 1;
      state.stats.earned += reward;
      addFloater(state.player.x, state.player.y - 40, `+$${reward}`, '#7dff6a');
      pushMessage(`Mission complete: ${mission.title} — +$${reward}`, '#7dff6a');
      if (state.missionIndex + 1 >= MISSIONS.length) {
        state.storyComplete = true;
        state.missionActive = false;
        pushMessage('Story complete! Solmar Bay is yours — free roam, taxi fares and chaos await.', '#39ff88');
      } else {
        startMission(state.missionIndex + 1);
      }
      return EVENT_MISSION | EVENT_CASH;
    }
    return EVENT_MISSION;
  }

  function failMission(reason) {
    pushMessage(`Mission failed: ${reason}. Try again — Rico is waiting.`, '#ff8a8a');
    const index = state.missionIndex;
    startMission(index);
    return EVENT_FAIL;
  }

  function spawnCourier() {
    const p = randomRoadPoint(random);
    const courier = makeCar(p.x, p.y, 'sports', true);
    courier.targetSpeed = 300;
    state.courier = courier;
    state.cars.push(courier);
    pushMessage('There he is — the courier in the pink sports car. Get on his tail!', '#ffd166');
  }

  function spawnGoons() {
    const base = landmark(city, 'Safehouse');
    const spots = [
      [base.x - 260, base.y - 40], [base.x - 180, base.y + 60], [base.x - 320, base.y + 80], [base.x - 140, base.y - 90],
    ];
    // Mission 5 plays at the docks, around the Safehouse block.
    for (const [x, y] of spots) {
      state.goons.push({ x, y, angle: 0, hp: 70, fireTimer: 1 + random() * 2, radius: 13, color: '#7c2d12' });
    }
    pushMessage('Rival goons at the docks — take them all out!', '#ff8a8a');
  }

  function updateMission(dt) {
    const mission = currentMission();
    if (!mission) return 0;
    const obj = currentObjective();
    if (!obj) return 0;
    const player = state.player;
    let events = 0;
    if (obj.type === 'enterCar') {
      if (player.inCar) events |= completeObjective();
      return events;
    }
    if (obj.type === 'goto') {
      const dx = player.x - obj.x;
      const dy = player.y - obj.y;
      if (dx * dx + dy * dy < obj.radius * obj.radius) {
        events |= completeObjective();
        return events;
      }
      if (obj.timeLimit) {
        state.missionTimer += dt;
        if (state.missionTimer >= obj.timeLimit) events |= failMission('Out of time on the delivery.');
      }
      return events;
    }
    if (obj.type === 'wait') {
      const ax = state.anchor ? state.anchor.x : player.x;
      const ay = state.anchor ? state.anchor.y : player.y;
      const dx = player.x - ax;
      const dy = player.y - ay;
      if (dx * dx + dy * dy < 220 * 220) {
        state.objectiveTimer += dt;
        if (state.objectiveTimer >= obj.seconds) {
          events |= completeObjective();
          // Mission 6: cracking the vault raises the heat to 4 stars.
          if (mission.id === 6 && state.objectiveIndex === 2) {
            state.wanted = 4;
            state.lastCrime = state.time;
            pushMessage('The vault is open — the whole city is coming for you!', '#ff4d4d');
            events |= EVENT_WANTED;
          }
        }
      } else {
        state.objectiveTimer = Math.max(0, state.objectiveTimer - dt * 2);
      }
      return events;
    }
    if (obj.type === 'tail') {
      if (!state.courier) { spawnCourier(); return 0; }
      const c = state.courier;
      const d = Math.sqrt(dist2(player.x, player.y, c.x, c.y));
      if (d < 170 && player.inCar) {
        state.tailProgress += dt;
        state.courierLost = 0;
        if (state.tailProgress >= obj.seconds) events |= completeObjective();
      } else {
        state.courierLost += dt;
        if (state.courierLost > 6) events |= failMission('You lost the courier.');
      }
      return events;
    }
    if (obj.type === 'kill') {
      if (state.goons.length === 0 && state.kills === 0 && state.objectiveTimer === 0) {
        spawnGoons();
        state.objectiveTimer = 0.001; // mark spawned
      }
      if (state.kills >= obj.count) events |= completeObjective();
      return events;
    }
    if (obj.type === 'escape') {
      const safe = landmark(city, 'Safehouse');
      const dx = player.x - safe.x;
      const dy = player.y - safe.y;
      if (dx * dx + dy * dy < 200 * 200) {
        state.wanted = 0;
        state.lastCrime = state.time;
        events |= completeObjective();
      }
      return events;
    }
    return events;
  }

  function updateTaxi(dt) {
    const taxi = state.taxi;
    const player = state.player;
    if (!taxi.active) return 0;
    if (!player.inCar || player.car.kind !== 'taxi') {
      taxi.active = false;
      taxi.phase = 'idle';
      pushMessage('Taxi job ended — you left the cab.', '#9aa3b5');
      return 0;
    }
    if (taxi.phase === 'pickup') {
      const d = Math.sqrt(dist2(player.x, player.y, taxi.x, taxi.y));
      if (d < 70) {
        taxi.phase = 'dropoff';
        const dest = randomRoadPoint(random);
        taxi.x = dest.x;
        taxi.y = dest.y;
        taxi.timer = 75;
        taxi.fare = 60 + intBetween(random, 0, 90);
        pushMessage(`Passenger aboard — fare $${taxi.fare}. Drive to the marker!`, '#ffd166');
      }
    } else if (taxi.phase === 'dropoff') {
      taxi.timer -= dt;
      const d = Math.sqrt(dist2(player.x, player.y, taxi.x, taxi.y));
      if (d < 80) {
        player.cash += taxi.fare;
        state.stats.fares += 1;
        state.stats.earned += taxi.fare;
        addFloater(player.x, player.y - 40, `+$${taxi.fare}`, '#7dff6a');
        pushMessage(`Fare complete — +$${taxi.fare}`, '#7dff6a');
        const next = randomSidewalkPoint(random);
        taxi.x = next.x;
        taxi.y = next.y;
        taxi.phase = 'pickup';
        return EVENT_CASH;
      }
      if (taxi.timer <= 0) {
        taxi.phase = 'pickup';
        pushMessage('Passenger got impatient and left. New fare waiting.', '#9aa3b5');
      }
    }
    return 0;
  }

  function updateTraffic(dt) {
    const player = state.player;
    for (const car of state.cars) {
      if (!car.traffic || car.hp <= 0) continue;
      // Courier flees from the player; other traffic cruises its road.
      let target = car.targetSpeed;
      let desiredAngle = car.angle;
      if (state.courier === car) {
        desiredAngle = angleTo(car.x, car.y, car.x + Math.cos(car.angle) * 100, car.y + Math.sin(car.angle) * 100);
        // Flee: steer away from the player along roads.
        const away = angleTo(player.x, player.y, car.x, car.y);
        const axisV = Math.abs(Math.cos(away)) < Math.abs(Math.sin(away));
        if (axisV) { car.axis = 'v'; car.dir = Math.sin(away) > 0 ? 1 : -1; }
        else { car.axis = 'h'; car.dir = Math.cos(away) > 0 ? 1 : -1; }
        target = 330;
      }
      // Traffic light ahead: stop on red.
      const aheadX = car.x + Math.cos(car.angle) * 70;
      const aheadY = car.y + Math.sin(car.angle) * 70;
      for (const light of city.lights) {
        if (Math.abs(aheadX - light.x) < 60 && Math.abs(aheadY - light.y) < 60) {
          const greenV = ((state.time + light.phase) % 8) < 4;
          const greenForCar = car.axis === 'v' ? greenV : !greenV;
          if (!greenForCar) target = 0;
          break;
        }
      }
      // Slow for the car ahead.
      for (const other of state.cars) {
        if (other === car || other.hp <= 0) continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const forward = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (forward > 0 && forward < 90 && side < 30) { target = Math.min(target, 0); break; }
      }
      car.speed += Math.max(-400 * dt, Math.min(260 * dt, target - car.speed));
      // Random turns at intersections.
      car.turnTimer -= dt;
      const nearIntersection = ROADS_V.some((rx) => Math.abs(car.x - rx) < 40) && ROADS_H.some((ry) => Math.abs(car.y - ry) < 40);
      if (nearIntersection && car.turnTimer <= 0 && random() < 0.02) {
        if (car.axis === 'v') { car.axis = 'h'; car.dir = random() < 0.5 ? 1 : -1; }
        else { car.axis = 'v'; car.dir = random() < 0.5 ? 1 : -1; }
        car.turnTimer = 2;
      }
      if (car.axis === 'v') desiredAngle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      else desiredAngle = car.dir > 0 ? 0 : Math.PI;
      const diff = angleDiff(desiredAngle, car.angle);
      car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.x = Math.max(60, Math.min(WORLD.width - 60, car.x));
      car.y = Math.max(60, Math.min(WORLD.height - 60, car.y));
      // Buildings stop traffic cars that drift off-road (should not happen).
      if (buildingAt(city, car.x, car.y, 10)) {
        car.angle += Math.PI / 2;
        car.x -= Math.cos(car.angle) * 30;
        car.y -= Math.sin(car.angle) * 30;
      }
    }
  }

  function updatePeds(dt) {
    const player = state.player;
    for (const ped of state.peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        if (ped.down <= 0) {
          ped.x = randomSidewalkPoint(random).x;
          ped.y = randomSidewalkPoint(random).y;
        }
        continue;
      }
      ped.walkTimer -= dt;
      const dx = ped.target.x - ped.x;
      const dy = ped.target.y - ped.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 24 || ped.walkTimer <= 0) {
        ped.target = randomSidewalkPoint(random);
        ped.walkTimer = 6 + random() * 6;
        continue;
      }
      ped.angle = Math.atan2(dy, dx);
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      // Flee from a speeding player car.
      if (player.inCar && player.car) {
        const pd = Math.sqrt(dist2(ped.x, ped.y, player.x, player.y));
        if (pd < 90 && Math.abs(player.car.speed) > 250) {
          ped.x += (ped.x - player.x) / pd * 160 * dt;
          ped.y += (ped.y - player.y) / pd * 160 * dt;
        }
      }
    }
  }

  function updatePolice(dt, audio) {
    const player = state.player;
    // Foot cops: one per wanted star, capped at 3.
    const wantFoot = Math.min(3, state.wanted);
    while (state.cops.length < wantFoot) {
      const a = random() * Math.PI * 2;
      state.cops.push({ x: player.x + Math.cos(a) * 500, y: player.y + Math.sin(a) * 500, radius: 13, speed: 205 });
    }
    while (state.cops.length > wantFoot) state.cops.pop();
    // Police cars: one per star above 1, capped at 3.
    const wantCars = state.wanted >= 2 ? Math.min(3, state.wanted - 1) : 0;
    let policeCars = state.cars.filter((c) => c.kind === 'police' && c.hp > 0 && !c.parked).length;
    while (policeCars < wantCars) {
      const a = random() * Math.PI * 2;
      const car = makeCar(player.x + Math.cos(a) * 620, player.y + Math.sin(a) * 620, 'police', false);
      car.parked = false;
      car.speed = 200;
      state.cars.push(car);
      policeCars += 1;
    }
    let events = 0;
    // Foot cops chase and try to bust the player on foot.
    let nearestCop = Infinity;
    for (const cop of state.cops) {
      const d = Math.sqrt(dist2(cop.x, cop.y, player.x, player.y));
      nearestCop = Math.min(nearestCop, d);
      const a = angleTo(cop.x, cop.y, player.x, player.y);
      cop.x += Math.cos(a) * cop.speed * dt;
      cop.y += Math.sin(a) * cop.speed * dt;
      resolveBuildingCollision(city, cop);
      if (!player.inCar && d < WANTED.bustDistance) {
        state.bustTimer += dt;
        if (state.bustTimer >= WANTED.bustTime) {
          return EVENT_BUSTED;
        }
      }
    }
    if (player.inCar || nearestCop > WANTED.bustDistance) state.bustTimer = 0;
    // Police cars chase the player.
    for (const car of state.cars) {
      if (car.kind !== 'police' || car.hp <= 0 || car.parked) continue;
      const targetAngle = angleTo(car.x, car.y, player.x, player.y);
      const diff = angleDiff(targetAngle, car.angle);
      car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
      const targetSpeed = Math.min(700, 420 + state.wanted * 60);
      car.speed += Math.max(-500 * dt, Math.min(500 * dt, targetSpeed - car.speed));
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      resolveBuildingCollision(city, car);
      // Ram the player's car.
      if (player.inCar && player.car) {
        const d = Math.sqrt(dist2(car.x, car.y, player.car.x, player.car.y));
        if (d < 46) {
          player.car.hp -= 4 * dt * 2.5;
          player.car.speed *= 0.94;
          if (Math.abs(car.speed) > 200) events |= EVENT_CRASH;
          if (player.car.hp <= 0) events |= explodeCar(player.car);
        }
      }
    }
    if (audio) audio.setSiren(state.wanted > 0, state.time);
    // Wanted cooldown: far from every cop and quiet for a while.
    if (state.wanted > 0 && state.time - state.lastCrime > WANTED.decayDelay) {
      const nearestPoliceCar = state.cars.reduce((min, c) => {
        if (c.kind !== 'police' || c.hp <= 0 || c.parked) return min;
        return Math.min(min, Math.sqrt(dist2(c.x, c.y, player.x, player.y)));
      }, Infinity);
      if (Math.min(nearestCop, nearestPoliceCar) > WANTED.evadeDistance) {
        state.wantedTimer += dt;
        if (state.wantedTimer >= WANTED.decayInterval) {
          state.wanted -= 1;
          state.wantedTimer = 0;
          pushMessage(`Heat cooling off… wanted level ${state.wanted}`, '#9aa3b5');
        }
      } else {
        state.wantedTimer = 0;
      }
    }
    return events;
  }

  function updateGoons(dt, audio) {
    const player = state.player;
    let events = 0;
    for (const goon of state.goons) {
      const d = Math.sqrt(dist2(goon.x, goon.y, player.x, player.y));
      goon.angle = angleTo(goon.x, goon.y, player.x, player.y);
      goon.fireTimer -= dt;
      if (d < 430 && goon.fireTimer <= 0) {
        fireBullet('enemy', goon.x, goon.y, goon.angle + (random() - 0.5) * 0.22, 9);
        goon.fireTimer = 0.9 + random() * 0.9;
        events |= EVENT_ENEMY_SHOT;
      }
      if (d > 60 && d < 380) {
        goon.x += Math.cos(goon.angle) * 70 * dt;
        goon.y += Math.sin(goon.angle) * 70 * dt;
      }
    }
    return events;
  }

  function updateBullets(dt) {
    const player = state.player;
    let events = 0;
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0;
      if (!dead && buildingAt(city, b.x, b.y, 0)) {
        addParticles(b.x, b.y, '#ffd166', 4, 120, 0.3, 3);
        dead = true;
      }
      if (!dead && b.from === 'player') {
        for (const goon of state.goons) {
          if (dist2(b.x, b.y, goon.x, goon.y) < 20 * 20) {
            goon.hp -= b.damage;
            addParticles(b.x, b.y, '#ff4d4d', 6, 160, 0.4, 4);
            if (goon.hp <= 0) {
              state.goons.splice(state.goons.indexOf(goon), 1);
              state.kills += 1;
              player.cash += 50;
              addFloater(goon.x, goon.y - 24, '+$50', '#7dff6a');
              events |= EVENT_CASH;
            }
            dead = true;
            break;
          }
        }
        if (!dead) {
          for (const car of state.cars) {
            if (car.hp <= 0) continue;
            if (dist2(b.x, b.y, car.x, car.y) < 24 * 24) {
              car.hp -= b.damage;
              addParticles(b.x, b.y, '#ffd166', 5, 140, 0.3, 3);
              if (car.hp <= 0) events |= explodeCar(car);
              dead = true;
              break;
            }
          }
        }
        if (!dead) {
          for (const ped of state.peds) {
            if (ped.down > 0) continue;
            if (dist2(b.x, b.y, ped.x, ped.y) < 14 * 14) {
              ped.down = 999;
              addParticles(b.x, b.y, '#ff4d4d', 8, 160, 0.5, 4);
              events |= addWanted(1);
              dead = true;
              break;
            }
          }
        }
      }
      if (!dead && b.from === 'enemy') {
        if (!player.inCar && dist2(b.x, b.y, player.x, player.y) < 16 * 16) {
          events |= damagePlayer(b.damage);
          dead = true;
        } else if (player.inCar && player.car && dist2(b.x, b.y, player.car.x, player.car.y) < 24 * 24) {
          player.car.hp -= b.damage;
          if (player.car.hp <= 0) events |= explodeCar(player.car);
          dead = true;
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
    return events;
  }

  function updatePlayer(dt, ctl, audio) {
    const player = state.player;
    let events = 0;
    player.fireTimer = Math.max(0, player.fireTimer - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (ctl.enterCar && !player.inCar) events |= enterCar();
    else if (ctl.enterCar && player.inCar) {
      exitCar(false);
      if (state.taxi.active) { state.taxi.active = false; state.taxi.phase = 'idle'; }
    }
    if (player.inCar && player.car) {
      const car = player.car;
      car.crashTimer = Math.max(0, car.crashTimer - dt);
      const boost = ctl.shift ? 1.35 : 1;
      const maxSpeed = CAR.maxSpeed * boost * (car.kind === 'police' ? 1.1 : 1);
      if (ctl.up) car.speed += CAR.accel * boost * dt;
      else if (ctl.down) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
      else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 180 * dt);
      if (ctl.space) {
        car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 500 * dt);
        if (Math.abs(car.speed) > 200 && random() < 0.6) {
          addParticles(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, '#9aa3b5', 1, 40, 0.5, 5);
        }
      }
      car.speed = Math.max(-220, Math.min(maxSpeed, car.speed));
      const steerDir = ctl.left ? -1 : ctl.right ? 1 : 0;
      const grip = ctl.space ? CAR.handbrakeGrip : CAR.grip;
      const steerAmount = CAR.steer * steerDir * Math.min(1, Math.abs(car.speed) / 180) * (car.speed < 0 ? -1 : 1);
      car.angle += steerAmount * dt * (ctl.space ? 1.6 : 1);
      const prevX = car.x;
      const prevY = car.y;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const body = { x: car.x, y: car.y, radius: 20 };
      if (resolveBuildingCollision(city, body)) {
        // One thud per scrape, not one per frame: sliding along a wall is
        // not a crash.
        if (Math.abs(car.speed) > 260 && car.crashTimer <= 0) {
          events |= EVENT_CRASH;
          car.hp -= 8;
          car.crashTimer = 0.6;
          addParticles(car.x, car.y, '#ffd166', 8, 180, 0.4, 4);
          if (audio) audio.crash();
          if (car.hp <= 0) events |= explodeCar(car);
        }
        car.x = body.x;
        car.y = body.y;
        car.speed *= 0.55;
      }
      clampToWorld(car);
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      player.speed = Math.abs(car.speed);
      // Car-car collisions.
      for (const other of state.cars) {
        if (other === car || other.hp <= 0) continue;
        const d = Math.sqrt(dist2(car.x, car.y, other.x, other.y));
        if (d < 44 && d > 0.01) {
          const push = (44 - d) / 2;
          const nx = (car.x - other.x) / d;
          const ny = (car.y - other.y) / d;
          car.x += nx * push;
          car.y += ny * push;
          other.x -= nx * push;
          other.y -= ny * push;
          const impact = Math.abs(car.speed - other.speed);
          if (impact > 240 && car.crashTimer <= 0) {
            events |= EVENT_CRASH;
            car.hp -= 6;
            other.hp -= 6;
            car.crashTimer = 0.6;
            if (audio) audio.crash();
            if (other.hp <= 0) events |= explodeCar(other);
            if (car.hp <= 0) events |= explodeCar(car);
          }
          car.speed *= 0.92;
          other.speed *= 0.9;
        }
      }
      // Hitting pedestrians while driving.
      for (const ped of state.peds) {
        if (ped.down > 0) continue;
        if (dist2(car.x, car.y, ped.x, ped.y) < 26 * 26 && Math.abs(car.speed) > 60) {
          ped.down = 999;
          addParticles(ped.x, ped.y, '#ff4d4d', 10, 200, 0.6, 4);
          events |= addWanted(1);
          pushMessage('You hit a pedestrian!', '#ff8a8a');
          state.shake = Math.max(state.shake, 6);
        }
      }
      if (audio) audio.setEngine(Math.abs(car.speed) / CAR.maxSpeed, true);
    } else {
      const speed = ctl.shift ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      let mx = (ctl.right ? 1 : 0) - (ctl.left ? 1 : 0);
      let my = (ctl.down ? 1 : 0) - (ctl.up ? 1 : 0);
      const len = Math.hypot(mx, my);
      if (len > 0) { mx /= len; my /= len; }
      player.x += mx * speed * dt;
      player.y += my * speed * dt;
      player.speed = len > 0 ? speed : 0;
      player.angle = ctl.aimAngle;
      resolveBuildingCollision(city, player);
      clampToWorld(player);
      if (ctl.firing && player.fireTimer <= 0) {
        if (player.ammo > 0) {
          player.ammo -= 1;
          player.fireTimer = PLAYER.fireInterval;
          fireBullet('player', player.x, player.y, player.angle, PLAYER.pistolDamage);
          addParticles(player.x + Math.cos(player.angle) * 22, player.y + Math.sin(player.angle) * 22, '#ffd166', 3, 140, 0.15, 4);
          state.shake = Math.max(state.shake, 2);
          events |= EVENT_SHOT | addWanted(0) | (state.wanted === 0 ? addWanted(1) : 0);
        } else {
          player.fireTimer = 0.3;
          pushMessage('Out of ammo — find an ammo pickup (yellow crates).', '#ffd166');
        }
      }
      if (audio) audio.setEngine(0, false);
    }
    // Pickups.
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pk = state.pickups[i];
      if (dist2(player.x, player.y, pk.x, pk.y) < 30 * 30) {
        if (pk.kind === 'health') player.hp = Math.min(PLAYER.hp, player.hp + pk.amount);
        else if (pk.kind === 'ammo') player.ammo += pk.amount;
        else if (pk.kind === 'armor') player.armor = Math.min(PLAYER.armor, player.armor + pk.amount);
        else if (pk.kind === 'cash') { player.cash += pk.amount; state.stats.earned += pk.amount; }
        addFloater(pk.x, pk.y - 20, pk.kind === 'cash' ? `+$${pk.amount}` : pk.kind.toUpperCase(), '#7dff6a');
        state.pickups.splice(i, 1);
        events |= EVENT_PICKUP;
      }
    }
    return events;
  }

  function reset() {
    state.time = 0;
    state.clockMinutes = CLOCK.startHour * 60 + CLOCK.startMinute;
    state.cars = [];
    state.peds = [];
    state.cops = [];
    state.goons = [];
    state.bullets = [];
    state.particles = [];
    state.floaters = [];
    state.pickups = [];
    state.wanted = 0;
    state.lastCrime = -999;
    state.wantedTimer = 0;
    state.bustTimer = 0;
    state.missionIndex = 0;
    state.objectiveIndex = 0;
    state.objectiveTimer = 0;
    state.missionTimer = 0;
    state.tailProgress = 0;
    state.kills = 0;
    state.courier = null;
    state.missionActive = true;
    state.storyComplete = false;
    state.taxi = { active: false, phase: 'idle', x: 0, y: 0, timer: 0, fare: 0 };
    state.messages = [];
    state.shake = 0;
    state.damageFlash = 0;
    state.stats = { carsStolen: 0, missionsDone: 0, fares: 0, earned: 0 };
    const player = state.player;
    player.x = 1000;
    player.y = 700;
    player.angle = 0;
    player.hp = PLAYER.hp;
    player.armor = PLAYER.armor;
    player.cash = PLAYER.startCash;
    player.ammo = PLAYER.startAmmo;
    player.inCar = false;
    player.car = null;
    player.fireTimer = 0;
    player.invulnerable = 0;
    spawnParkedCars();
    spawnTraffic();
    spawnPeds();
    spawnPickups();
    startMission(0);
  }

  function step(dt, ctl, audio) {
    let events = 0;
    state.time += dt;
    state.clockMinutes += dt * CLOCK.minutesPerSecond;
    state.shake = Math.max(0, state.shake - dt * 26);
    state.damageFlash = Math.max(0, state.damageFlash - dt * 1.4);
    for (let i = state.messages.length - 1; i >= 0; i -= 1) {
      state.messages[i].life -= dt;
      if (state.messages[i].life <= 0) state.messages.splice(i, 1);
    }
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const f = state.floaters[i];
      f.y -= 34 * dt;
      f.life -= dt;
      if (f.life <= 0) state.floaters.splice(i, 1);
    }
    // Taxi toggle.
    if (ctl.taxi && state.player.inCar && state.player.car && state.player.car.kind === 'taxi' && !state.taxi.active) {
      state.taxi.active = true;
      state.taxi.phase = 'pickup';
      const p = randomSidewalkPoint(random);
      state.taxi.x = p.x;
      state.taxi.y = p.y;
      pushMessage('Taxi job started — pick up the passenger at the marker!', '#ffd166');
    }
    events |= updatePlayer(dt, ctl, audio);
    if (events & EVENT_WASTED) return events;
    events |= updateTraffic(dt);
    events |= updatePeds(dt);
    events |= updatePolice(dt, audio);
    if (events & EVENT_BUSTED) return events;
    events |= updateGoons(dt, audio);
    events |= updateBullets(dt);
    events |= updateMission(dt);
    events |= updateTaxi(dt);
    return events;
  }

  function getSave() {
    return {
      cash: state.player.cash,
      hp: state.player.hp,
      ammo: state.player.ammo,
      armor: state.player.armor,
      missionIndex: state.missionIndex,
      missionsDone: state.stats.missionsDone,
      earned: state.stats.earned,
      fares: state.stats.fares,
    };
  }

  function loadSave(save) {
    if (!save) return;
    state.player.cash = save.cash ?? state.player.cash;
    state.player.hp = save.hp ?? state.player.hp;
    state.player.ammo = save.ammo ?? state.player.ammo;
    state.player.armor = save.armor ?? state.player.armor;
    state.stats.missionsDone = save.missionsDone ?? 0;
    state.stats.earned = save.earned ?? 0;
    state.stats.fares = save.fares ?? 0;
    if (typeof save.missionIndex === 'number' && save.missionIndex > 0 && save.missionIndex < MISSIONS.length) {
      startMission(save.missionIndex);
    }
  }

  reset();
  return {
    state, reset, step, startMission, currentMission, currentObjective,
    pushMessage, addWanted, getSave, loadSave, nearestCar,
  };
}
