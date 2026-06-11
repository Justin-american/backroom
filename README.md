# The Backrooms — Level 0

A browser-playable, 3D first-person **Backrooms**-inspired exploration game built with
plain **HTML, CSS, JavaScript** and **[Three.js](https://threejs.org/)**.
No frameworks, no TypeScript, no build tools, no npm install required.

> You noclipped out of reality into Level 0 — *"The Lobby."* Endless yellow
> rooms, buzzing fluorescent lights, damp carpet. Explore, find the exit, and
> step through it.

## Features

- **First-person movement** — `WASD` / arrow keys
- **Mouse look** via Pointer Lock
- **Sprinting** — hold `Shift`
- **Tile-based collision detection**
- **Procedurally generated Level 0** — yellow walls, stained carpet,
  fluorescent ceiling panels, long hallways and open rooms
- **Atmosphere** — warm fog, flat liminal lighting, realistic scale
- **Random event system** — light flickers, temporary blackouts and
  distant/ambient sounds (subtle and rare)
- **Procedural audio** — a constant fluorescent hum and stingers generated
  with the Web Audio API (no audio files needed)
- **Exit system** — reach the glowing exit, press `E`, and see
  **"Level Complete"**
- **Responsive** — resizes to any browser window

## Controls

| Action | Key |
| --- | --- |
| Move | `W` `A` `S` `D` / Arrow keys |
| Look | Mouse |
| Sprint | `Shift` |
| Interact / use exit | `E` |
| Release mouse | `Esc` |

## How to play

1. Open the game (see "Run locally" or the GitHub Pages URL below).
2. Click **Click to Enter** to lock the mouse.
3. Walk around, soak in the atmosphere, and find the glowing exit.
4. Stand near the exit and press **`E`** to complete the level.

## Project structure

```
/index.html         Entry page + import map for Three.js
/css/style.css      UI / overlay styling
/js/main.js         Bootstraps renderer, scene, loop and wiring
/js/player.js       First-person controller + collision
/js/level0.js       Level 0 generation, textures, lighting, exit
/js/events.js       Random event scheduler (flicker / blackout / sound)
/js/audio.js        Procedural ambient audio (Web Audio API)
/js/ui.js           UI overlay controller
```

Three.js is loaded from a CDN via an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap)
in `index.html`, so there are no dependencies to install.

## Run locally

Because the game uses ES modules, it must be served over HTTP (opening
`index.html` directly with `file://` will be blocked by the browser). Any static
file server works:

**Python 3**

```bash
python3 -m http.server 8000
```

**Node.js**

```bash
npx serve .
```

Then open <http://localhost:8000> in your browser.

## Deploy with GitHub Pages

This repository is ready to be served as a static site — all paths are
relative, so it works from a project subpath.

1. Push the project to your GitHub repository (the files at the repository root).
2. On GitHub, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose the branch (e.g. `main`) and the `/ (root)` folder, then **Save**.
5. Wait a minute for the deployment, then open the published URL:

   ```
   https://<your-username>.github.io/<your-repo>/
   ```

That URL loads `index.html`, which pulls in the CSS/JS and Three.js from the CDN.
No further configuration is required.

## Notes

- An internet connection is needed the first time so the browser can fetch
  Three.js from the CDN.
- All visuals (wall, carpet and ceiling textures) and all audio are generated
  procedurally at runtime — there are no binary assets in the repo.
- This is **Version 1**: a single, polished Level 0. No entities, monsters,
  combat or other levels — just the liminal experience.
