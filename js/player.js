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

    // Movement mode: 'walk' (normal), 'rising' (elevator going up),
    // 'roof' (free flight above the roof, for testing the floor transition).
    this.mode = 'walk';
    this.riseTargetY = EYE_HEIGHT;

    this.bobTime = 0;
    this.baseEye = EYE_HEIGHT;

    this._buildFlashlight();

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    this.reset();
  }

  get object() { return this.controls.object || this.controls.getObject(); }

  /**
   * Build a head-mounted flashlight: a spotlight parented to the camera so it
   * always points where the player looks. Off by default; toggled with `F`
   * and most useful during a power outage.
   */
  _buildFlashlight() {
    const cam = this.camera;
    this.flashlight = new THREE.SpotLight(
      0xfff3d6, 0, 28, Math.PI / 6, 0.45, 1.2);
    this.flashlight.position.set(0.2, -0.15, 0.1);
    this.flashlightTarget = new THREE.Object3D();
    this.flashlightTarget.position.set(0, 0, -1);
    cam.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;
    cam.add(this.flashlight);
    this.flashlightOn = false;
    this._flashlightIntensity = 6.0;
  }

  /** Toggle the flashlight on/off. */
  toggleFlashlight() {
    this.flashlightOn = !this.flashlightOn;
    this.flashlight.intensity = this.flashlightOn ? this._flashlightIntensity : 0;
    return this.flashlightOn;
  }

  reset() {
    const s = this.level.spawn;
    this.object.position.set(s.x, this.baseEye, s.z);
    this.velocity.set(0, 0, 0);
    this.bobTime = 0;
    this.mode = 'walk';
    // Face down an open hallway from the spawn.
    this.camera.rotation.set(0, this.level.spawnYaw || 0, 0);
  }

  /**
   * Start the elevator ride: the player rises straight up. For now this just
   * lifts them above the roof (placeholder for an actual floor transition).
   * @param {number} targetY eye height to rise to.
   */
  rideElevator(targetY) {
    if (this.mode !== 'walk') return;
    this.mode = 'rising';
    this.riseTargetY = targetY;
    this.velocity.set(0, 0, 0);
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
      case 'KeyF': if (this.enabled) this.toggleFlashlight(); break;
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

    const pos = this.object.position;

    // --- elevator ride: rise straight up, ignore input/collision/bob ---
    if (this.mode === 'rising') {
      this.velocity.set(0, 0, 0);
      const RISE_SPEED = 2.2;
      pos.y += RISE_SPEED * dt;
      if (pos.y >= this.riseTargetY) {
        pos.y = this.riseTargetY;
        this.mode = 'roof';
      }
      return;
    }

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

    // Above the roof we fly freely (no walls); on the ground we collide.
    const noClip = this.mode === 'roof';

    // --- collision-resolved movement (axis separated) ---
    const nextX = pos.x + this.velocity.x * dt;
    if (noClip || !this._collides(nextX, pos.z)) {
      pos.x = nextX;
    } else {
      this.velocity.x = 0;
    }
    const nextZ = pos.z + this.velocity.z * dt;
    if (noClip || !this._collides(pos.x, nextZ)) {
      pos.z = nextZ;
    } else {
      this.velocity.z = 0;
    }

    if (noClip) {
      // Hold altitude above the roof, no head-bob.
      pos.y = this.riseTargetY;
      return;
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
    if (this.flashlight) this.camera.remove(this.flashlight);
    if (this.flashlightTarget) this.camera.remove(this.flashlightTarget);
    this.controls.dispose?.();
  }
}
