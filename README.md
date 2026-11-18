# Solmar Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/h05meiherlianto/makefun-gta6-01-agent2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/h05meiherlianto/makefun-gta6-01-agent2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar Bay** — an open-world crime game in the spirit of GTA 6, built as a make.fun [gta6-01](https://make.fun/bounty/gta6-01) entry. Explore a neon coastal city on foot and by car, steal cars, outrun the Solmar Bay PD as your wanted level climbs, run six story missions for fixer Rico Vane and Lena Marlowe — from your first stolen wheels to the Solmar Bank heist — and pick up taxi fares between jobs. Everything here — the city, characters, vehicles, names, story, art and sound — is original.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no network, plain static files under `game/`. Node 22 or newer, standard library only.

## Controls

| Key | Action |
| --- | --- |
| **W A S D** | Move on foot / drive |
| **Mouse** | Aim (on foot) |
| **Click** or **F** | Shoot pistol (on foot) |
| **E** | Enter / exit a car, steal a parked car |
| **Space** | Handbrake (in a car) |
| **Shift** | Sprint (on foot) / boost (in a car) |
| **T** | Start / stop the taxi job (in a taxi) |
| **M** | Mission list |
| **P** / **Esc** | Pause |
| **N** | Mute sound |

## The city

Solmar Bay is a 3600 × 2700 open world: a street grid with traffic lights and crosswalks, blocks of buildings with neon signs, parks, a beach and bay on the east edge, and a docks district of warehouses and shipping containers in the south-west. Traffic cars follow the roads and stop at red lights; pedestrians walk the sidewalks and flee speeding cars. The in-game clock runs from neon dusk onward.

## Features

- **On foot and by car** — car physics with acceleration, steering, drift, handbrake, boost, collisions and damage; steal any parked car (or a traffic car, if you don't mind the heat).
- **Wanted level 0–5 stars** — stealing cars, shooting and hitting pedestrians raise it; foot cops chase and try to bust you, police cars ram you; break line of sight and stay quiet to cool down.
- **Six story missions** — *First Wheels*, *The Pickup*, *Hot Delivery* (timed), *Tail the Courier*, *Dockside Trouble* (shootout with rival goons), *The Solmar Heist* (4-star escape) — with briefings, waypoints, timers, success/fail and cash rewards.
- **Taxi fares** — drive a taxi, press T, pick up passengers and deliver them before the timer runs out.
- **Combat** — pistol with ammo, enemy goons who shoot back, health / ammo / armour / cash pickups around the city.
- **HUD** — cash, health and armour bars, ammo, wanted stars, clock, speed, a live minimap (player, police, mission marker), mission tracker and message log.
- **Menus and save** — start screen, pause, mission list, Wasted / Busted screens, and progress (cash, missions, best) saved in localStorage.
- **Sound** — synthesised WebAudio only: engine hum, gunshots, sirens, pickup blips, explosions and a bassline music loop. No audio files.
- **Polish** — skid smoke, muzzle flashes, explosions, screen shake, damage flash, floating cash text, waypoint beacons and an off-screen direction arrow.

## Missions

1. **First Wheels** — steal a car and bring it to Rico's Garage.
2. **The Pickup** — collect a crate at the docks and deliver it.
3. **Hot Delivery** — reach Marina Café in 75 seconds.
4. **Tail the Courier** — stay on the rival courier's tail for 8 seconds.
5. **Dockside Trouble** — clear four rival goons from the docks.
6. **The Solmar Heist** — crack Solmar Bank's vault, then escape a 4-star manhunt to the Safehouse.

## Layout

- `main.ts` — entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `game/` — the game itself (static files, ES modules, no network)
  - `game/src/config.js` — tuning numbers, palette, key bindings
  - `game/src/random.js` — seeded random (repeatable city and screenshots)
  - `game/src/city.js` — street grid, buildings, parks, beach, docks, collisions
  - `game/src/world.js` — player, cars, traffic AI, pedestrians, police, combat, missions, taxi
  - `game/src/missions.js` — the six-mission story
  - `game/src/render.js` — canvas drawing, HUD, minimap, panels
  - `game/src/audio.js` — synthesised WebAudio sound and music
  - `game/src/input.js` — keyboard and mouse
  - `game/src/shots.js` — staged screenshot scenes (`?shot=start|drive|chase|mission`)
  - `game/src/main.js` — boot, game loop, screens, save/load
- `screenshots/` — real renders of the game
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `serve.ts` — dev server (`node serve.ts` → http://localhost:8080)

## Screenshots

The cover shows the title screen over the living city; the rest show driving through traffic, a 3-star police chase, and the dockside shootout — all real renders of the game's own code (`?shot=` scenes plus live play).
