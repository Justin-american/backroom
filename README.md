# The Backrooms — Levels 0 & 1

A browser-playable, 3D first-person **Backrooms**-inspired exploration game built with
plain **HTML, CSS, JavaScript** and **[Three.js](https://threejs.org/)**.
No frameworks, no TypeScript, no build tools, no npm install required.

> You noclipped out of reality into Level 0 — *"The Lobby."* Endless yellow
> rooms, buzzing fluorescent lights, damp carpet. Find the exit elevator, ride
> it up, and discover that the next floor — *Level 1, the Office Complex* — is
> an office building stretched far beyond anything that should be possible.

## Features

- **First-person movement** — `WASD` / arrow keys
- **Mouse look** via Pointer Lock
- **Sprinting** — hold `Shift`
- **Tile-based collision detection**
- **Randomly generated levels** — every playthrough has a unique layout;
  guidance arrows are regenerated each time so they always lead to the exit
- **Atmosphere** — warm fog, flat liminal lighting, realistic scale
- **Random event system** — light flickers, distant/ambient sounds and a
  prolonged power outage (~1 minute of darkness)
- **Flashlight** — toggle with `F`; essential for surviving a power outage
- **Procedural audio** — a constant fluorescent hum and stingers generated
  with the Web Audio API (no audio files needed)
- **Elevator exit** — call the elevator with `E`, wait for it to arrive
  (chime + doors open), step inside, press `E` to ride up, then the doors
  reopen with a chime and you progress to the next level
- **Level 1 — Office Complex** — arrive from the Level 0 elevator into a
  reception area and explore a vast, quiet office of hallways, cubicle
  clusters, conference rooms, a break room, manager offices, storage and
  utility rooms. Find the **Manager's Keycard** in the break room, unlock the
  ornate **Executive Wing** (red carpet, dark wood, warm lighting, gold
  plaques), reach the **CEO office** at the end of the executive hallway, take
  the **Elevator Keycard** from the desk, and ride the elevator out.
- **Thought system** — subtitle-style "thoughts" fade in at the bottom-centre
  of the screen at key moments to guide you (no voice acting)
- **Interaction prompts** — looking at keycards and locked doors shows a
  contextual `[E]` prompt (Pick Up / Unlock / Locked)
- **Environmental storytelling** — office directories, department signs, door
  plaques and Executive Wing / CEO signage guide you instead of objective markers
- **Responsive** — resizes to any browser window

## Controls

| Action | Key |
| --- | --- |
| Move | `W` `A` `S` `D` / Arrow keys |
| Look | Mouse |
| Sprint | `Shift` |
| Flashlight | `F` |
| Interact / use exit | `E` |
| Release mouse | `Esc` |

## How to play

1. Open the game (see "Run locally" or the GitHub Pages URL below).
2. Click **Click to Enter** to lock the mouse.
3. Walk around, soak in the atmosphere, and find the elevator.
4. Stand near the elevator and press **`E`** to call it. Wait for it to
   arrive, step inside, then press **`E`** again to ride up.
5. **Level 1 (Office Complex):** step out of the elevator and follow your
   thoughts and the office signage. Find the **Manager's Keycard** in the
   break room, look at the **Executive Wing** door and press **`E`** to
   **Unlock** it, walk to the **CEO office** at the end of the executive
   hallway, press **`E`** to **Pick Up** the **Elevator Keycard** from the
   desk, then return to the elevator and ride it out.

## Project structure

```
/index.html         Entry page + import map for Three.js
/css/style.css      UI / overlay styling
/js/main.js         Bootstraps renderer, scene, loop and wiring
/js/player.js       First-person controller + collision
/js/level0.js       Level 0 generation, textures, lighting, exit
/js/level1.js       Level 1 (Office Complex): layout, exec wing, CEO office,
                    keycards, thought + interaction logic, office ambience
/js/events.js       Random event scheduler (flicker / blackout / sound)
/js/audio.js        Procedural ambient audio (Web Audio API)
/js/ui.js           UI overlay controller (incl. thought + interaction prompts)
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
- This build ships **two levels**: Level 0 (*The Lobby*) and Level 1 (*Office
  Complex*), which focuses on atmosphere, exploration, navigation and
  environmental storytelling. No entities, monsters, combat or inventory
  systems — just the liminal experience.
