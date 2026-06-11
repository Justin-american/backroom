/* ============================================================
   main.js
   Entry point. Sets up the renderer/scene/camera, wires together
   the player, level, events, audio and UI, and runs the loop.
   ============================================================ */

import * as THREE from 'three';
import { Level0 } from './level0.js';
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
let completed = false;
let started = false;

const clock = new THREE.Clock();

function buildLevel() {
  level = new Level0(scene, 1337);
  scene.add(camera);
  player = new Player(camera, renderer.domElement, level);
  events = new EventSystem(level, audio);
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
  nearExit = false;
  teardownLevel();
  buildLevel();
  events.start();
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
// Exit interaction
// ---------------------------------------------------------------------------
let nearExit = false;

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && nearExit && player && player.enabled && !completed) {
    completeLevel();
  }
});

function completeLevel() {
  completed = true;
  if (events) events.stop();
  if (level) level.setLightLevel(1.0);
  player.enabled = false;
  player.unlock();
  ui.showComplete();
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

  if (player && player.enabled) {
    player.update(dt);
    events.update(dt);

    // exit proximity check
    const d = level.distanceToExit(player.object.position);
    const wasNear = nearExit;
    nearExit = d <= level.exit.radius;
    if (nearExit && !wasNear) ui.showExitPrompt();
    if (!nearExit && wasNear) ui.hideExitPrompt();
  }

  if (level) level.update(dt, camera.position, elapsed);

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
  forceStart() { if (player) { player.enabled = true; started = true; if (events) events.start(); ui.enterGameplay(); } },
};
