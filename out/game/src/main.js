// Solmar Bay — a neon coastal open-world crime game. Boot and the one loop:
// input is read every frame, the world advances in fixed 1/60 s steps, and
// the renderer paints what is there. The game moves between title, play,
// paused, mission list, wasted and busted screens, and saves progress to
// localStorage.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createWorld, EVENT_BUSTED, EVENT_CASH, EVENT_FAIL, EVENT_MISSION, EVENT_PICKUP, EVENT_SHOT, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_MISSIONS, ACTION_MUTE, ACTION_PAUSE, ACTION_TAXI, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_MISSIONS, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const city = createCity(createRandom(seed));
const world = createWorld(createRandom(seed + 7), city);
world.state.city = city;
const renderer = createRenderer(canvas);
const audio = createAudio();

function readJson(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function readBest() {
  const save = readJson(SAVE_KEY);
  return { cash: save?.cash ?? 0, missions: save?.missionsDone ?? 0 };
}

function cameraFor(state) {
  const player = state.player;
  return {
    x: Math.max(0, Math.min(3600 - renderer.VIEW_W, player.x - renderer.VIEW_W / 2)),
    y: Math.max(0, Math.min(2700 - renderer.VIEW_H, player.y - renderer.VIEW_H / 2)),
  };
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    const camera = name === 'start'
      ? { x: 640, y: 900 }
      : cameraFor(world.state);
    renderer.draw(world.state, scene.screen, scene.best, camera, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let showMissions = false;
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;

  const saved = readJson(SAVE_KEY);
  if (saved) world.loadSave(saved);

  function announce(message) {
    status.textContent = message;
  }

  function saveNow() {
    writeJson(SAVE_KEY, world.getSave());
    best = readBest();
  }

  function startGame() {
    world.reset();
    const fresh = readJson(SAVE_KEY);
    if (fresh) world.loadSave(fresh);
    accumulator = 0;
    showMissions = false;
    screen = SCREEN_PLAY;
    announce('Playing Solmar Bay. Steal a car and drive to Rico’s Garage.');
  }

  function handleEvents(events) {
    if (events & EVENT_SHOT) audio.gunshot();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_CASH) audio.cash();
    if (events & EVENT_MISSION) { audio.mission(); saveNow(); }
    if (events & EVENT_FAIL) audio.fail();
    if (events & EVENT_WASTED) {
      screen = SCREEN_OVER;
      announce('Wasted. Press Enter to try again.');
    } else if (events & EVENT_BUSTED) {
      world.state.player.cash = Math.max(0, world.state.player.cash - 200);
      world.state.wanted = 0;
      world.state.cops = [];
      world.state.player.x = 2230;
      world.state.player.y = 450;
      if (world.state.player.inCar) world.state.player.inCar = false;
      screen = SCREEN_BUSTED;
      announce('Busted. Press Enter to get out.');
    }
  }

  function buildCtl() {
    const held = input.held;
    const mouse = input.mouse();
    const scale = Math.min(canvas.width / renderer.VIEW_W, canvas.height / renderer.VIEW_H);
    const ox = (canvas.width - renderer.VIEW_W * scale) / 2;
    const oy = (canvas.height - renderer.VIEW_H * scale) / 2;
    const camera = cameraFor(world.state);
    const worldMouseX = camera.x + (mouse.x * (window.devicePixelRatio || 1) - ox) / scale;
    const worldMouseY = camera.y + (mouse.y * (window.devicePixelRatio || 1) - oy) / scale;
    const player = world.state.player;
    return {
      up: held.up, down: held.down, left: held.left, right: held.right,
      shift: held.shift, space: held.space,
      enterCar: false, taxi: false,
      firing: false,
      aimAngle: Math.atan2(worldMouseY - player.y, worldMouseX - player.x),
    };
  }

  function step() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_BUSTED) {
      if ((actions & ACTION_CONFIRM) || input.takeClick()) {
        audio.unlock();
        startGame();
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (actions & ACTION_MISSIONS && screen === SCREEN_PLAY) {
      showMissions = !showMissions;
      announce(showMissions ? 'Mission list open.' : 'Mission list closed.');
    }
    if (showMissions) return; // The mission list pauses the city.
    if (screen !== SCREEN_PLAY) return;
    const ctl = buildCtl();
    if (actions & ACTION_ENTER_CAR) ctl.enterCar = true;
    if (actions & ACTION_TAXI) ctl.taxi = true;
    // F on foot also shoots; click shoots too.
    if (input.mouseHeld()) ctl.firing = true;
    const events = world.step(STEP, ctl, audio);
    handleEvents(events);
    saveTimer += STEP;
    if (saveTimer > 10) {
      saveTimer = 0;
      saveNow();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (screen === SCREEN_TITLE) {
      // The title screen's city keeps moving behind the panel; step() here
      // only handles the start press, the world steps below it.
      step();
      while (accumulator >= STEP && screen === SCREEN_TITLE) {
        world.step(STEP, { up: false, down: false, left: false, right: false, shift: false, space: false, enterCar: false, firing: false, aimAngle: 0, taxi: false }, null);
        accumulator -= STEP;
      }
      if (screen !== SCREEN_TITLE) accumulator = 0;
    } else if (screen === SCREEN_PLAY && !showMissions) {
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) { accumulator = 0; break; }
      }
    } else {
      step();
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, cameraFor(world.state), showMissions);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A read-only handle for automated play-testing in the browser console.
  window.__solmar = { world, screen: () => screen };

  announce('Solmar Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
