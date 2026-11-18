# Solmar Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/h05meiherlianto/makefun-gta6-01-agent2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/h05meiherlianto/makefun-gta6-01-agent2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar Bay — an open-world crime game in the spirit of GTA 6, built as a make.fun [gta6-01](https://make.fun/bounty/gta6-01) entry. Explore a neon coastal city on foot and by car, steal cars, dodge the police as your wanted level rises, run missions for the crew, and fight your way up the streets. Everything here — the city, characters, vehicles, names, story, art and sound — is original.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no network, plain static files under `game/`. Node 22 or newer, standard library only.

## Controls

- **W A S D** — move / drive
- **Mouse** — look / aim
- **Shift** — sprint / boost
- **E** — enter / exit a car, steal a parked car
- **Space** — jump / handbrake
- **F or Left click** — shoot (on foot)
- **M** — mission list, **P** — pause, **Tab** — map

## Layout

- `main.ts` — entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `game/` — the game itself (static files, ES modules, no network)
- `screenshots/` — real renders of the game
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
