// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one
// plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a simple autopilot, so the frame is what a short game
// really looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const DRIVE_SECONDS = 3;
const CHASE_SECONDS = 2.5;
const MISSION_SECONDS = 5;

function idleCtl() {
  return { up: false, down: false, left: false, right: false, shift: false, space: false, enterCar: false, firing: false, aimAngle: 0, taxi: false };
}

/** Remove every car but the player's from the road the shots drive up. */
function clearCorridor(state) {
  const mine = state.player.car;
  state.cars = state.cars.filter((c) => c === mine || Math.abs(c.x - 1000) > 120 || c.y < 400 || c.y > 2400);
}

/** Drive straight up a road: the road is straight, so no steering is needed. */
function driveCtl(world, dt) {
  const ctl = idleCtl();
  ctl.up = true;
  return ctl;
}

/**
 * Set `world` to the named scene (start, drive, chase or mission; any other
 * name is start) and return the screen to draw over it and the camera focus.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'drive' && name !== 'chase' && name !== 'mission') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, idleCtl(), null);
    return { screen: SCREEN_TITLE, best: { cash: 1250, missions: 2 } };
  }
  if (name === 'drive') {
    // Put the player in the sports car near Rico's Garage and drive north
    // up the road, through traffic.
    const car = state.cars.find((c) => c.kind === 'sports' && c.x > 1000 && c.x < 1100);
    state.player.x = car.x;
    state.player.y = car.y;
    world.step(STEP, { ...idleCtl(), enterCar: true }, null);
    state.player.car.x = 1000;
    state.player.car.y = 2000;
    state.player.car.angle = -Math.PI / 2;
    // Clear the road ahead so the drive shot is a clean run, not a jam.
    clearCorridor(state);
    for (let i = 0; i < DRIVE_SECONDS / STEP; i += 1) world.step(STEP, driveCtl(world), null);
    return { screen: SCREEN_PLAY, best: { cash: state.player.cash, missions: 0 } };
  }
  if (name === 'chase') {
    // Player in a fast car, 3 wanted stars, police cars closing in.
    const car = state.cars.find((c) => c.kind === 'sports');
    state.player.x = car.x;
    state.player.y = car.y;
    world.step(STEP, { ...idleCtl(), enterCar: true }, null);
    state.player.car.x = 1000;
    state.player.car.y = 2000;
    state.player.car.angle = -Math.PI / 2;
    state.wanted = 3;
    state.lastCrime = state.time;
    clearCorridor(state);
    // Let the police spawn and close in for a second, then pull them into
    // frame behind the player so the chase reads in the shot.
    for (let i = 0; i < 30; i += 1) world.step(STEP, { ...idleCtl(), up: true }, null);
    const police = state.cars.filter((c) => c.kind === 'police' && c.hp > 0);
    const offsets = [[-120, 160], [120, 200], [-40, 250]];
    police.forEach((pc, i) => {
      const [ox, oy] = offsets[i % offsets.length];
      pc.x = state.player.x + ox;
      pc.y = state.player.y + oy;
      pc.angle = -Math.PI / 2;
      pc.speed = 640;
    });
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      const ctl = idleCtl();
      ctl.up = true;
      world.step(STEP, ctl, null);
    }
    return { screen: SCREEN_PLAY, best: { cash: state.player.cash, missions: 1 } };
  }
  // mission: dockside shootout — mission 5 in progress, goons firing.
  world.startMission(4);
  state.objectiveIndex = 1;
  state.kills = 0;
  state.goons = [];
  // Place the player at the docks on foot with a pistol, goons around.
  state.player.x = 700;
  state.player.y = 2100;
  const spots = [[560, 2020], [820, 2160], [520, 2200], [900, 2000]];
  for (const [x, y] of spots) {
    state.goons.push({ x, y, angle: 0, hp: 70, fireTimer: 0.5, radius: 13, color: '#7c2d12' });
  }
  for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
    const ctl = idleCtl();
    const goon = state.goons[0];
    if (goon) {
      ctl.aimAngle = Math.atan2(goon.y - state.player.y, goon.x - state.player.x);
      ctl.firing = i % 20 < 4;
    }
    world.step(STEP, ctl, null);
    if (state.goons.length === 0) break;
  }
  return { screen: SCREEN_PLAY, best: { cash: state.player.cash, missions: 4 } };
}
