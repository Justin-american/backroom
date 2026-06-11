/* ============================================================
   player.js
   First-person controller: pointer-lock mouse look, WASD
   movement, sprinting, head-bob and tile-based collision
   resolution against the level.
   ============================================================ */

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const EYE_HEIGHT = 1.7;
const RADIUS = 0.45;          // player collision radius
const WALK_SPEED = 3.2;       // units / second
const SPRINT_SPEED = 6.0;
const ACCEL = 12.0;           // movement smoothing

export class Player {
  /**
   * @param {THREE.Camera} camera
   * @param {HTMLElement} domElement
   * @param {Level0} level
   */
  constructor(camera, domElement, level) {
    this.camera = camera;
    this.level = level;
    this.controls = new PointerLockControls(camera, domElement);

    this.velocity = new THREE.Vector3();
    this.keys = { forward: false, back: false, left: false, right: false, sprint: false };
    this.enabled = false;

    this.bobTime = 0;
    this.baseEye = EYE_HEIGHT;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    this.reset();
  }

  get object() { return this.controls.object || this.controls.getObject(); }

  reset() {
    const s = this.level.spawn;
    this.object.position.set(s.x, this.baseEye, s.z);
    this.velocity.set(0, 0, 0);
    this.bobTime = 0;
    // Face down an open hallway from the spawn.
    this.camera.rotation.set(0, this.level.spawnYaw || 0, 0);
  }

  lock()   { this.controls.lock(); }
  unlock() { this.controls.unlock(); }

  _onKeyDown(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    this.keys.forward = true; break;
      case 'KeyS': case 'ArrowDown':  this.keys.back = true; break;
      case 'KeyA': case 'ArrowLeft':  this.keys.left = true; break;
      case 'KeyD': case 'ArrowRight': this.keys.right = true; break;
      case 'ShiftLeft': case 'ShiftRight': this.keys.sprint = true; break;
    }
  }

  _onKeyUp(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    this.keys.forward = false; break;
      case 'KeyS': case 'ArrowDown':  this.keys.back = false; break;
      case 'KeyA': case 'ArrowLeft':  this.keys.left = false; break;
      case 'KeyD': case 'ArrowRight': this.keys.right = false; break;
      case 'ShiftLeft': case 'ShiftRight': this.keys.sprint = false; break;
    }
  }

  /** Whether the player is currently moving (for audio / bob). */
  get isMoving() {
    return (this.keys.forward || this.keys.back || this.keys.left || this.keys.right);
  }

  update(dt) {
    if (!this.enabled) return;

    // --- desired movement in local space ---
    const dir = new THREE.Vector3();
    const front = (this.keys.forward ? 1 : 0) - (this.keys.back ? 1 : 0);
    const side  = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    dir.z = front;
    dir.x = side;
    if (dir.lengthSq() > 0) dir.normalize();

    const speed = this.keys.sprint ? SPRINT_SPEED : WALK_SPEED;

    // Build a world-space movement vector from camera orientation (XZ only).
    const forwardVec = new THREE.Vector3();
    this.camera.getWorldDirection(forwardVec);
    forwardVec.y = 0;
    forwardVec.normalize();
    const rightVec = new THREE.Vector3().crossVectors(forwardVec, new THREE.Vector3(0, 1, 0)).normalize();

    const wishVel = new THREE.Vector3();
    wishVel.addScaledVector(forwardVec, dir.z * speed);
    wishVel.addScaledVector(rightVec, dir.x * speed);

    // Smoothly approach the desired velocity.
    this.velocity.x += (wishVel.x - this.velocity.x) * Math.min(1, ACCEL * dt);
    this.velocity.z += (wishVel.z - this.velocity.z) * Math.min(1, ACCEL * dt);

    // --- collision-resolved movement (axis separated) ---
    const pos = this.object.position;
    const nextX = pos.x + this.velocity.x * dt;
    if (!this._collides(nextX, pos.z)) {
      pos.x = nextX;
    } else {
      this.velocity.x = 0;
    }
    const nextZ = pos.z + this.velocity.z * dt;
    if (!this._collides(pos.x, nextZ)) {
      pos.z = nextZ;
    } else {
      this.velocity.z = 0;
    }

    // --- head bob ---
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizSpeed > 0.4) {
      this.bobTime += dt * (this.keys.sprint ? 13 : 9);
      const bob = Math.sin(this.bobTime) * 0.045;
      pos.y = this.baseEye + bob;
    } else {
      this.bobTime = 0;
      pos.y += (this.baseEye - pos.y) * Math.min(1, 10 * dt);
    }
  }

  /** Circle-vs-tile collision: sample the player's bounding box corners. */
  _collides(x, z) {
    const offs = [
      [ RADIUS, 0], [-RADIUS, 0], [0,  RADIUS], [0, -RADIUS],
      [ RADIUS * 0.7,  RADIUS * 0.7], [-RADIUS * 0.7,  RADIUS * 0.7],
      [ RADIUS * 0.7, -RADIUS * 0.7], [-RADIUS * 0.7, -RADIUS * 0.7],
    ];
    for (const [ox, oz] of offs) {
      if (this.level.isBlocked(x + ox, z + oz)) return true;
    }
    return false;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.controls.dispose?.();
  }
}
