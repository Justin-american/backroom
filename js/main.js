/* ============================================================
   main.js
   Entry point. Sets up the renderer/scene/camera, wires together
   the player, level, events, audio and UI, and runs the loop.
   ============================================================ */

import * as THREE from 'three';
import { Level0 } from './level0.js';
import { Level1 } from './level1.js';
import { Player } from './player.js';
import { EventSystem } from './events.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';

const canvas = document.getElementById('game-canvas');

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

// --- Scene & camera ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  72, window.innerWidth / window.innerHeight, 0.1, 200
);

// --- Subsystems ---
const ui = new UI();
const audio = new AudioEngine();
let level, player, events;
let levelIndex = 0;        // 0 = The Lobby, 1 = Office Complex
let completed = false;
let started = false;
let transitioning = false;
let transitionedToL1 = false;

const clock = new THREE.Clock();

function buildLevel() {
  if (levelIndex === 1) {
    level = new Level1(scene, ui, audio);
    events = null;          // Level 1 runs its own subtle office ambience
  } else {
    // Random seed every playthrough so no two layouts are the same.
    // Arrows are generated from the layout, so they always lead to the exit.
    const seed = (Math.random() * 0xffffffff) >>> 0;
    level = new Level0(scene, seed);
    events = new EventSystem(level, audio);
    // Power outage: warn the player so they reach for the flashlight.
    events.onBlackout = (off) => {
      if (off) {
        ui.showNotice('Power outage &mdash; press <b>F</b> for your flashlight');
      } else {
        ui.hideNotice();
      }
    };
  }
  scene.add(camera);
  player = new Player(camera, renderer.domElement, level);
  attachLockEvents();   // wire pointer-lock events for the new controls
}

function teardownLevel() {
  if (player) player.dispose();
  if (level) level.dispose();
  // remove any leftover scene children except the camera
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const child = scene.children[i];
    if (child !== camera) scene.remove(child);
  }
  level = player = events = null;
}

buildLevel();

// Scene is ready -> enable the start button.
ui.setReady();

// ---------------------------------------------------------------------------
// Start / restart / pointer-lock handling
// ---------------------------------------------------------------------------
function beginGameplay() {
  audio.init();          // must happen from a user gesture
  if (events) events.start();
  player.lock();
}

ui.onStart(() => beginGameplay());

ui.onRestart(() => {
  completed = false;
  transitioning = false;
  transitionedToL1 = false;
  resetElevator();
  ui.hideNotice();
  ui.hideThought();
  ui.hideInteract();
  teardownLevel();
  levelIndex = 0;
  buildLevel();
  if (events) events.start();
  ui.hideComplete();
  ui.setReady();
  beginGameplay();
});

// PointerLockControls events
function attachLockEvents() {
  player.controls.addEventListener('lock', () => {
    player.enabled = true;
    started = true;
    ui.enterGameplay();
  });
  player.controls.addEventListener('unlock', () => {
    if (player) player.enabled = false;
    if (!completed) ui.showOverlay();
  });
}

// ---------------------------------------------------------------------------
// Elevator interaction (staged: call -> wait -> board -> ride -> arrive)
// ---------------------------------------------------------------------------
let nearExit = false;

// 'idle'    : roaming; show "call" prompt when near the doors
// 'calling' : button pressed, car is on its way (~3s wait)
// 'open'    : car arrived, doors open, waiting for the player to board + ride
// 'rising'  : doors closed, car (and rider) travelling up
// 'arrived' : reached the top, doors reopen, level complete
let elevatorState = 'idle';
let callTimer = 0;
let riseStartY = 0;

const CALL_DELAY = 3.0;   // seconds before the car arrives

window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyE' || !player || !player.enabled || completed ||
      player.mode !== 'walk') return;

  if (levelIndex === 1) {
    if (level && level.interact) level.interact(player);
    return;
  }

  if (elevatorState === 'idle' && nearExit) {
    callElevator();
  } else if (elevatorState === 'open' &&
             level.isInsideElevator(player.object.position)) {
    rideUp();
  }
});

function callElevator() {
  elevatorState = 'calling';
  callTimer = 0;
  ui.setExitPrompt('The elevator is on its way&hellip;');
  ui.showExitPrompt();
}

function rideUp() {
  elevatorState = 'rising';
  ui.hideExitPrompt();
  ui.hideNotice();
  if (events) events.stop();
  if (level) level.setLightLevel(1.0);
  riseStartY = player.object.position.y;
  const roofEye = (level.ceilingHeight || 3.2) + 1.7;
  player.rideElevator(roofEye);
}

function resetElevator() {
  elevatorState = 'idle';
  callTimer = 0;
  riseStartY = 0;
  nearExit = false;
}

function updateElevator(dt) {
  switch (elevatorState) {
    case 'idle': {
      const d = level.distanceToExit(player.object.position);
      const wasNear = nearExit;
      nearExit = d <= level.exit.radius;
      if (nearExit && !wasNear) {
        ui.setExitPrompt('Press <b>E</b> to call the elevator');
        ui.showExitPrompt();
      }
      if (!nearExit && wasNear) ui.hideExitPrompt();
      break;
    }
    case 'calling': {
      callTimer += dt;
      if (callTimer >= CALL_DELAY) {
        audio.elevatorChime();
        elevatorState = 'open';
      }
      break;
    }
    case 'open': {
      level.setElevatorDoors(true, dt);
      const inside = level.isInsideElevator(player.object.position);
      ui.setExitPrompt(inside
        ? 'Press <b>E</b> to go up'
        : 'Step inside the elevator');
      ui.showExitPrompt();
      break;
    }
    case 'rising': {
      level.setElevatorDoors(false, dt);
      // Carry the whole car up with the rider so they stay inside it.
      level.setElevatorHeight(player.object.position.y - riseStartY);
      if (player.mode === 'roof') {       // reached the target height
        audio.elevatorChime();
        elevatorState = 'arrived';
        if (!transitionedToL1) {
          transitionedToL1 = true;
          transitionToLevel1();
        }
      }
      break;
    }
    case 'arrived': {
      // Doors are open at the top; the transition to Level 1 is underway.
      level.setElevatorDoors(true, dt);
      ui.hideExitPrompt();
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Level transition: ride out of Level 0 -> arrive in Level 1 (Office Complex)
// ---------------------------------------------------------------------------
async function transitionToLevel1() {
  transitioning = true;
  if (player) player.enabled = false;
  ui.hideExitPrompt();
  ui.hideNotice();
  await ui.fadeOut();

  if (events) events.stop();
  teardownLevel();
  levelIndex = 1;
  buildLevel();

  // Resume control. The browser still holds pointer lock from Level 0, but the
  // freshly-built PointerLockControls start with isLocked=false and never
  // receive a pointerlockchange event (the lock was never released), so mouse
  // look would be dead until the player pressed Esc and clicked back in. Sync
  // the new controls to the live pointer-lock state so look works immediately.
  if (document.pointerLockElement === renderer.domElement) {
    player.controls.isLocked = true;
  } else {
    // Pointer lock was lost during the transition; re-acquire it.
    player.lock();
  }
  player.enabled = true;
  await ui.fadeIn();
  transitioning = false;
  if (level && level.begin) level.begin();
}

function completeLevel1() {
  completed = true;
  ui.setComplete('LEVEL&nbsp;1&nbsp;COMPLETE',
    'The elevator doors close. The office falls away beneath you&hellip;<br />' +
    '<em>To be continued.</em>', 'Play again from Level 0');
  ui.showComplete();
  if (player) player.unlock();
}

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  if (player && player.enabled && !transitioning) {
    player.update(dt);
    if (events) events.update(dt);

    if (levelIndex === 1) {
      if (!completed && level && level.update) {
        const done = level.update(dt, player, camera, elapsed);
        if (done) completeLevel1();
      }
    } else {
      if (!completed) updateElevator(dt);
      if (level) level.update(dt, camera.position, elapsed);
    }
  } else if (levelIndex === 0 && level) {
    level.update(dt, camera.position, elapsed);
  }

  renderer.render(scene, camera);
}
animate();

// Expose a minimal handle for debugging / automated testing.
window.__backrooms = {
  get scene() { return scene; },
  get camera() { return camera; },
  get level() { return level; },
  get player() { return player; },
  get events() { return events; },
  get levelIndex() { return levelIndex; },
  forceStart() { if (player) { player.enabled = true; started = true; if (events) events.start(); ui.enterGameplay(); } },
  gotoLevel1() { if (!transitionedToL1) { transitionedToL1 = true; transitionToLevel1(); } },
};
