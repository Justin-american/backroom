/* ============================================================
   level1.js
   Level 1 - "Office Complex".

   An office building stretched far beyond what should be
   possible: a reception area, long hallways, cubicle clusters,
   conference rooms, a break room, manager offices, storage and
   utility closets, and a noticeably grander Executive Wing that
   ends in the CEO's office.

   Objective flow (driven by the subtitle "thought" system):
     1. Arrive from the Level 0 elevator into reception.
     2. Find the (locked) Executive Wing door.
     3. Find the Manager's Keycard in the break room.
     4. Unlock the Executive Wing.
     5. Reach the CEO office at the end of the executive hallway.
     6. Take the Elevator Keycard from the CEO's desk.
     7. Return to the elevator and ride out.

   All textures are generated procedurally on a <canvas>, so the
   project needs no external image assets.
   ============================================================ */

import * as THREE from 'three';

// --- World constants -------------------------------------------------------
const TILE = 4;          // size of one tile in world units
const WALL_H = 3.1;      // wall / ceiling height

export class Level1 {
  /**
   * @param {THREE.Scene} scene
   * @param {import('./ui.js').UI} ui   used for thoughts / prompts
   * @param {import('./audio.js').AudioEngine} audio
   */
  constructor(scene, ui, audio) {
    this.scene = scene;
    this.ui = ui;
    this.audio = audio;

    this.objects = [];          // everything added, for disposal
    this.interactables = [];    // { mesh, type } raycast targets
    this.solids = new Set();    // extra blocked tiles ("x,z") e.g. elevator body
    this.openings = new Set();  // tiles to force-passable (doorways)

    this.spawn = new THREE.Vector3(0, 1.7, 0);
    this.spawnYaw = 0;
    this.ceilingHeight = WALL_H;

    // objective / interaction state
    this.hasManagerKeycard = false;
    this.hasElevatorKeycard = false;
    this.execUnlocked = false;
    this._said = new Set();           // thoughts already shown (one-shot)
    this._started = false;

    // exit elevator staged interaction
    this.exit = { position: new THREE.Vector3(), radius: 2.6, mesh: null };
    this._elevState = 'locked';       // locked | ready | open | boarded | rising | done
    this._raycaster = new THREE.Raycaster();
    this._raycaster.far = 3.4;        // interaction reach

    // ambience scheduling
    this._eventTimer = 6 + Math.random() * 6;

    this._buildTextures();
    this._layout();           // fill the tile grid + room metadata
    this._buildShell();       // floor / ceiling / walls
    this._buildLighting();
    this._buildExecWing();    // red carpet, dark walls, warm light, plaques
    this._buildRooms();       // furniture, signage, props
    this._buildElevator();
    this._placeSpawn();
  }

  // --------------------------------------------------------------------------
  // Procedural textures
  // --------------------------------------------------------------------------
  _buildTextures() {
    this.carpetTex   = this._makeNoiseTexture('#3b4150', '#333845', 0.22);
    this.wallTex     = this._makeWallTexture('#d8d6c8', '#c7c5b6');
    this.ceilTex     = this._makeCeilingTexture();
    this.execCarpet  = this._makeNoiseTexture('#5a1414', '#43100f', 0.28);
    this.execWallTex = this._makeWoodTexture();
  }

  _makeNoiseTexture(base, fleck, amount) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 4200; i++) {
      const x = Math.random() * 128, y = Math.random() * 128;
      g.fillStyle = Math.random() > 0.5
        ? `rgba(255,255,255,${Math.random() * amount * 0.4})`
        : `rgba(0,0,0,${Math.random() * amount})`;
      g.fillRect(x, y, 2, 1);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  _makeWallTexture(base, stripe) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    // subtle wainscot line near the bottom
    g.fillStyle = stripe;
    g.fillRect(0, 104, 128, 4);
    for (let i = 0; i < 600; i++) {
      const x = Math.random() * 128, y = Math.random() * 128;
      g.fillStyle = `rgba(120,118,100,${Math.random() * 0.05})`;
      g.fillRect(x, y, 2, 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  _makeCeilingTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#e6e4d8';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(120,118,100,0.5)';
    g.lineWidth = 3;
    g.strokeRect(1, 1, 126, 126);
    for (let i = 0; i < 1600; i++) {
      const x = Math.random() * 128, y = Math.random() * 128;
      g.fillStyle = `rgba(150,148,130,${Math.random() * 0.2})`;
      g.fillRect(x, y, 2, 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  _makeWoodTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#3a2414';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 26; i++) {
      const y = Math.random() * 128;
      g.strokeStyle = `rgba(${20 + Math.random() * 40},${12 + Math.random() * 20},6,0.5)`;
      g.lineWidth = 1 + Math.random() * 2;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= 128; x += 16) {
        g.lineTo(x, y + Math.sin(x * 0.1 + i) * 3);
      }
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /**
   * Render text onto a transparent canvas for use as a sign / plaque / label.
   * @returns {THREE.CanvasTexture}
   */
  _makeTextTexture(lines, opts = {}) {
    const {
      w = 512, h = 256, bg = 'rgba(20,22,28,0.96)',
      fg = '#e8e6d0', accent = null, font = 'bold',
      size = 56, family = 'Arial, sans-serif', border = '#9a9886',
    } = opts;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    if (border) {
      g.strokeStyle = border; g.lineWidth = Math.max(4, w * 0.012);
      g.strokeRect(g.lineWidth, g.lineWidth, w - g.lineWidth * 2, h - g.lineWidth * 2);
    }
    if (accent) { g.fillStyle = accent; g.fillRect(0, 0, w, Math.max(6, h * 0.05)); }
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const arr = Array.isArray(lines) ? lines : [lines];
    const lh = h / (arr.length + 1);
    arr.forEach((ln, i) => {
      g.font = `${font} ${size}px ${family}`;
      g.fillText(ln, w / 2, lh * (i + 1));
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  // --------------------------------------------------------------------------
  // Layout: build the tile grid (1 = wall, 0 = floor) from room rectangles
  // and corridors, and remember room metadata for signage / props.
  // --------------------------------------------------------------------------
  _layout() {
    this.mapW = 37;
    this.mapH = 51;
    this.grid = Array.from({ length: this.mapH },
      () => new Array(this.mapW).fill(1));

    const carve = (x0, z0, x1, z1) => {
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++)
          if (x > 0 && z > 0 && x < this.mapW - 1 && z < this.mapH - 1)
            this.grid[z][x] = 0;
    };
    this._carve = carve;

    // --- main vertical hallway (the "spine") ---
    carve(16, 3, 18, 47);

    // --- reception (south) ---
    carve(6, 43, 30, 47);

    // --- a short cross hallway through the middle of the office ---
    carve(3, 24, 33, 26);

    this.rooms = [];
    const room = (def) => { this.rooms.push(def); carve(def.x0, def.z0, def.x1, def.z1); };

    // West rooms (interior x 3..14, doorway carved at x15)
    room({ name: 'CONFERENCE A', type: 'conference', dept: 'Conference Room A',
           x0: 3, z0: 11, x1: 14, z1: 17, door: [15, 14], side: 'W' });
    room({ name: 'CUBICLES', type: 'cubicles', dept: 'Cubicle Cluster 1',
           x0: 3, z0: 28, x1: 14, z1: 35, door: [15, 31], side: 'W' });
    room({ name: 'BREAK ROOM', type: 'break', dept: 'Break Room',
           x0: 3, z0: 37, x1: 14, z1: 42, door: [15, 39], side: 'W' });

    // East rooms (interior x 20..33, doorway carved at x19)
    room({ name: 'CONFERENCE B', type: 'conference', dept: 'Conference Room B',
           x0: 20, z0: 11, x1: 33, z1: 17, door: [19, 14], side: 'E' });
    room({ name: 'CUBICLES', type: 'cubicles', dept: 'Cubicle Cluster 2',
           x0: 20, z0: 28, x1: 33, z1: 35, door: [19, 31], side: 'E' });
    room({ name: 'MANAGER', type: 'manager', dept: "Manager's Office",
           x0: 20, z0: 37, x1: 26, z1: 42, door: [19, 39], side: 'E' });
    room({ name: 'STORAGE', type: 'storage', dept: 'Storage',
           x0: 28, z0: 37, x1: 33, z1: 42, door: [27, 39], side: 'W' });

    // Rooms off the cross hallway
    room({ name: 'MANAGER', type: 'manager', dept: "Manager's Office",
           x0: 3, z0: 19, x1: 9, z1: 23, door: [6, 23], side: 'S' });
    room({ name: 'UTILITY', type: 'utility', dept: 'Utility',
           x0: 11, z0: 19, x1: 14, z1: 23, door: [12, 23], side: 'S' });
    room({ name: 'STORAGE', type: 'storage', dept: 'Storage',
           x0: 27, z0: 19, x1: 33, z1: 23, door: [30, 23], side: 'S' });

    // --- Executive Wing (north of the spine, behind a locked door) ---
    // Vestibule -> executive hallway -> side offices -> enclosed CEO office.
    carve(13, 8, 21, 9);            // vestibule (just past the locked door)
    carve(8, 5, 28, 7);             // executive hallway (east-west, wide)
    this.execArea = { x0: 6, z0: 0, x1: 30, z1: 10 };

    // executive side offices (open alcoves off the hallway)
    carve(8, 2, 12, 4);
    carve(24, 2, 28, 4);
    // CEO office: an enclosed room at the head of the executive hallway,
    // reached through a single doorway.
    this.ceoRoom = { x0: 15, z0: 1, x1: 21, z1: 3, door: [18, 4] };
    carve(15, 1, 21, 3);

    // doorways through divider walls (force-passable openings)
    const door = (x, z) => { this.grid[z][x] = 0; this.openings.add(`${x},${z}`); };
    for (const r of this.rooms) if (r.door) door(r.door[0], r.door[1]);
    door(this.ceoRoom.door[0], this.ceoRoom.door[1]);

    // Executive Wing locked door tiles (block until unlocked): spine @ z10.
    this.execDoorTiles = [[16, 10], [17, 10], [18, 10]];
    for (const [x, z] of this.execDoorTiles) {
      this.grid[z][x] = 0;            // it is a doorway in the grid ...
      this.solids.add(`${x},${z}`);   // ... but blocked until unlocked.
    }
  }

  _placeSpawn() {
    // Spawn in reception, just in front of the elevator, facing north up the
    // spine (deeper into the office).
    this.spawn.set(17 * TILE + TILE / 2, 1.7, 45 * TILE + TILE / 2);
    this.spawnYaw = 0; // face -Z (north)
  }

  // --------------------------------------------------------------------------
  // Shell: floor, ceiling and walls built from the tile grid.
  // --------------------------------------------------------------------------
  _buildShell() {
    const worldW = this.mapW * TILE;
    const worldH = this.mapH * TILE;

    // floor (office carpet)
    this.carpetTex.repeat.set(this.mapW, this.mapH);
    this.floorMat = new THREE.MeshStandardMaterial({
      map: this.carpetTex, roughness: 0.95, metalness: 0.0,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldH), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(worldW / 2, 0, worldH / 2);
    this.scene.add(floor); this.objects.push(floor);

    // ceiling (acoustic tiles, faintly emissive)
    this.ceilTex.repeat.set(this.mapW, this.mapH);
    this.ceilMat = new THREE.MeshStandardMaterial({
      map: this.ceilTex, roughness: 1.0, metalness: 0.0,
      emissive: new THREE.Color(0x2a2c26), emissiveIntensity: 0.5,
    });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldH), this.ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(worldW / 2, WALL_H, worldH / 2);
    this.scene.add(ceil); this.objects.push(ceil);

    // walls (instanced) - skip tiles that fall inside the exec wing (those
    // get the darker wood material instead).
    const wallCells = [];
    for (let z = 0; z < this.mapH; z++)
      for (let x = 0; x < this.mapW; x++)
        if (this.grid[z][x] === 1 && !this._inExec(x, z)) wallCells.push([x, z]);

    const wallGeo = new THREE.BoxGeometry(TILE, WALL_H, TILE);
    this.wallMat = new THREE.MeshStandardMaterial({
      map: this.wallTex, roughness: 0.92, metalness: 0.0,
    });
    this._instanceWalls(wallCells, this.wallMat);

    // fluorescent ceiling light panels on a regular grid over open floor
    const panelPos = [];
    for (let z = 2; z < this.mapH - 1; z += 3)
      for (let x = 2; x < this.mapW - 1; x += 3)
        if (this.grid[z][x] === 0 && !this._inExec(x, z)) panelPos.push([x, z]);

    const panelGeo = new THREE.PlaneGeometry(TILE * 0.66, TILE * 0.3);
    this.panelMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: new THREE.Color(0xf2f4ff),
      emissiveIntensity: 1.0, roughness: 1.0, side: THREE.DoubleSide,
    });
    const panels = new THREE.InstancedMesh(panelGeo, this.panelMat, panelPos.length);
    const pm = new THREE.Matrix4();
    const rot = new THREE.Matrix4().makeRotationX(Math.PI / 2);
    panelPos.forEach(([x, z], i) => {
      const t = new THREE.Matrix4().makeTranslation(
        x * TILE + TILE / 2, WALL_H - 0.02, z * TILE + TILE / 2);
      pm.multiplyMatrices(t, rot);
      panels.setMatrixAt(i, pm);
    });
    panels.instanceMatrix.needsUpdate = true;
    this.scene.add(panels); this.objects.push(panels);
    this.lightPanels = panels;
  }

  _instanceWalls(cells, mat) {
    if (cells.length === 0) return;
    const geo = new THREE.BoxGeometry(TILE, WALL_H, TILE);
    const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
    const m = new THREE.Matrix4();
    cells.forEach(([x, z], i) => {
      m.makeTranslation(x * TILE + TILE / 2, WALL_H / 2, z * TILE + TILE / 2);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh); this.objects.push(mesh);
    return mesh;
  }

  _inExec(x, z) {
    const e = this.execArea;
    return x >= e.x0 && x <= e.x1 && z >= e.z0 && z <= e.z1;
  }

  // --------------------------------------------------------------------------
  // Lighting & atmosphere
  // --------------------------------------------------------------------------
  _buildLighting() {
    this.ambient = new THREE.AmbientLight(0xeef0ff, 0.95);
    this.scene.add(this.ambient); this.objects.push(this.ambient);

    this.hemi = new THREE.HemisphereLight(0xf0f2ff, 0x202028, 0.5);
    this.scene.add(this.hemi); this.objects.push(this.hemi);

    this.playerLight = new THREE.PointLight(0xeaf0ff, 0.5, TILE * 6, 1.4);
    this.scene.add(this.playerLight); this.objects.push(this.playerLight);

    // cool, quiet office haze; large extents -> unnaturally big feeling
    this.fogColor = new THREE.Color(0x0b0c10);
    this.scene.fog = new THREE.FogExp2(this.fogColor.clone(), 0.034);
    this.scene.background = this.fogColor.clone();

    this.baseAmbient = this.ambient.intensity;
    this.baseHemi = this.hemi.intensity;
    this.basePlayer = this.playerLight.intensity;
    this.baseEmissive = this.panelMat.emissiveIntensity;
    this.baseCeilEmissive = this.ceilMat.emissiveIntensity;
  }

  // --------------------------------------------------------------------------
  // Executive Wing: red carpet, dark wood walls, warm light, gold plaques,
  // leather furniture, awards. Should read as immediately "special".
  // --------------------------------------------------------------------------
  _buildExecWing() {
    const e = this.execArea;

    // red carpet over the exec floor (laid on top of the base carpet)
    const cw = (e.x1 - e.x0 + 1) * TILE;
    const ch = (e.z1 - e.z0 + 1) * TILE;
    this.execCarpet.repeat.set(e.x1 - e.x0 + 1, e.z1 - e.z0 + 1);
    const carpet = new THREE.Mesh(
      new THREE.PlaneGeometry(cw, ch),
      new THREE.MeshStandardMaterial({ map: this.execCarpet, roughness: 1.0 }));
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set((e.x0 + (e.x1 - e.x0) / 2) * TILE + TILE / 2, 0.02,
                        (e.z0 + (e.z1 - e.z0) / 2) * TILE + TILE / 2);
    this.scene.add(carpet); this.objects.push(carpet);

    // dark wood walls for exec-wing wall tiles
    const execWallCells = [];
    for (let z = 0; z < this.mapH; z++)
      for (let x = 0; x < this.mapW; x++)
        if (this.grid[z][x] === 1 && this._inExec(x, z)) execWallCells.push([x, z]);
    this.execWallTex.repeat.set(1, 1);
    this.execWallMat = new THREE.MeshStandardMaterial({
      map: this.execWallTex, roughness: 0.7, metalness: 0.05,
    });
    this._instanceWalls(execWallCells, this.execWallMat);

    // warm executive lighting
    this.execLight = new THREE.PointLight(0xffd9a0, 1.3, TILE * 10, 1.5);
    this.execLight.position.set(18 * TILE + TILE / 2, WALL_H - 0.4, 6 * TILE + TILE / 2);
    this.scene.add(this.execLight); this.objects.push(this.execLight);
    const execLight2 = new THREE.PointLight(0xffcf94, 0.9, TILE * 9, 1.6);
    execLight2.position.set(18 * TILE + TILE / 2, WALL_H - 0.4, 9 * TILE + TILE / 2);
    this.scene.add(execLight2); this.objects.push(execLight2);

    // warm ceiling strip over the exec hallway
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE * 4, TILE * 2.0),
      new THREE.MeshStandardMaterial({
        color: 0xfff0d0, emissive: 0xffe0b0, emissiveIntensity: 1.0,
        side: THREE.DoubleSide }));
    strip.rotation.x = Math.PI / 2;
    strip.position.set(18 * TILE + TILE / 2, WALL_H - 0.04, 6 * TILE + TILE / 2);
    this.scene.add(strip); this.objects.push(strip);

    // "EXECUTIVE WING" sign over the locked door (south face, into the office)
    this._sign(['EXECUTIVE WING'],
      17 * TILE + TILE / 2, 2.55, 10 * TILE + TILE - 0.06, 0,
      { w: 640, h: 200, bg: '#1a1208', fg: '#f0d27a', accent: '#caa033',
        border: '#caa033', size: 64 }, 4.4, 1.4);

    // gold plaques on the executive side offices + leather chairs & awards
    this._plaque('VICE PRESIDENT', 10 * TILE + TILE / 2, 4 * TILE + TILE - 0.05, 0);
    this._plaque('CFO', 26 * TILE + TILE / 2, 4 * TILE + TILE - 0.05, 0);
    this._leatherChair(10 * TILE + TILE / 2, 3 * TILE + TILE / 2, 0);
    this._leatherChair(26 * TILE + TILE / 2, 3 * TILE + TILE / 2, 0);
    this._awardShelf(8 * TILE + 0.3, 6 * TILE + TILE / 2);
    this._awardShelf(28 * TILE + TILE - 0.3, 6 * TILE + TILE / 2);

    // The locked Executive Wing door (double leaf across the 3-tile threshold).
    this._buildExecDoor();
  }

  _buildExecDoor() {
    const group = new THREE.Group();
    const cx = 17 * TILE + TILE / 2;     // centre of the 3-tile threshold
    const z = 10 * TILE + TILE / 2;
    const W = TILE * 3 - 0.3;            // total opening width
    const H = 2.7;

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x4a2e16, roughness: 0.55, metalness: 0.1 });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xc7a24a, roughness: 0.35, metalness: 0.7 });

    const leafW = W / 2;
    const leafGeo = new THREE.BoxGeometry(leafW, H, 0.16);
    const left = new THREE.Mesh(leafGeo, woodMat);
    const right = new THREE.Mesh(leafGeo, woodMat);
    left.position.set(cx - leafW / 2, H / 2, z);
    right.position.set(cx + leafW / 2, H / 2, z);
    // gold handles
    const handleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8);
    const lh = new THREE.Mesh(handleGeo, trimMat);
    lh.position.set(cx - 0.25, H / 2, z + 0.12);
    const rh = new THREE.Mesh(handleGeo, trimMat);
    rh.position.set(cx + 0.25, H / 2, z + 0.12);
    group.add(left, right, lh, rh);

    this.scene.add(group); this.objects.push(group);
    this.execDoor = {
      group, left, right, cx, z, leafW,
      leftClosedX: cx - leafW / 2, rightClosedX: cx + leafW / 2,
      t: 0,                       // 0 closed, 1 open
      mesh: left,                 // raycast target
    };
    this.interactables.push({ mesh: left, type: 'execDoor' });
    this.interactables.push({ mesh: right, type: 'execDoor' });
  }

  // --------------------------------------------------------------------------
  // Room contents: furniture, signage and props for each room type.
  // --------------------------------------------------------------------------
  _buildRooms() {
    // Reception desk + office directory near the spawn / elevator.
    this._receptionArea();

    for (const r of this.rooms) {
      const cx = (r.x0 + r.x1) / 2 * TILE + TILE / 2;
      const cz = (r.z0 + r.z1) / 2 * TILE + TILE / 2;

      // door plaque beside each room's doorway
      if (r.door) this._doorPlaque(r);

      switch (r.type) {
        case 'conference':  this._conferenceRoom(r, cx, cz); break;
        case 'cubicles':    this._cubicleCluster(r); break;
        case 'break':       this._breakRoom(r, cx, cz); break;
        case 'manager':     this._managerOffice(r, cx, cz); break;
        case 'storage':     this._storageRoom(r); break;
        case 'utility':     this._utilityCloset(r, cx, cz); break;
      }
    }

    // CEO office (most detailed room) + the Elevator Keycard.
    this._ceoOffice();

    // hallway department signage hanging in the spine
    this._hallwaySign(['\u2190 CONFERENCE', 'CUBICLES \u2192'], 17 * TILE + TILE / 2, 13 * TILE);
    this._hallwaySign(['\u2190 BREAK ROOM', 'OFFICES \u2192'], 17 * TILE + TILE / 2, 30 * TILE);
    this._hallwaySign(['EXECUTIVE WING \u2191'], 17 * TILE + TILE / 2, 24 * TILE + TILE / 2);
  }

  _receptionArea() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.8 });
    // long reception desk
    const desk = new THREE.Mesh(new THREE.BoxGeometry(TILE * 3, 1.1, 1.0), mat);
    desk.position.set(12 * TILE, 0.55, 45 * TILE + TILE / 2);
    this.scene.add(desk); this.objects.push(desk);
    this._blockBox(desk.position.x, desk.position.z, TILE * 3, 1.0);

    // backlit "office directory" board on the reception wall
    this._sign(
      ['OFFICE DIRECTORY', '', 'CONFERENCE . . . . . . 1', 'CUBICLES . . . . . . . . 2',
       'BREAK ROOM . . . . . . 3', 'MANAGERS . . . . . . . 4', 'EXECUTIVE WING . . \u2191'],
      6 * TILE + 0.1, 1.7, 45 * TILE + TILE / 2, Math.PI / 2,
      { w: 420, h: 520, bg: '#10161f', fg: '#bfe0ff', accent: '#2f6f9f',
        border: '#3a536b', size: 30 }, 2.6, 3.2);

    // a couple of waiting-area chairs
    this._simpleChair(22 * TILE, 45 * TILE, 0x33373f);
    this._simpleChair(24 * TILE, 45 * TILE, 0x33373f);
  }

  _conferenceRoom(r, cx, cz) {
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x55402a, roughness: 0.5 });
    const table = new THREE.Mesh(new THREE.BoxGeometry(TILE * 2.4, 0.9, TILE * 1.1), tableMat);
    table.position.set(cx, 0.45, cz);
    this.scene.add(table); this.objects.push(table);
    this._blockBox(cx, cz, TILE * 2.4, TILE * 1.1);
    // chairs around the table
    for (let i = -2; i <= 2; i++) {
      this._simpleChair(cx + i * 1.3, cz - TILE * 0.9, 0x222428);
      this._simpleChair(cx + i * 1.3, cz + TILE * 0.9, 0x222428);
    }
    // projector screen on the far wall
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(TILE * 1.6, 1.4),
      new THREE.MeshStandardMaterial({ color: 0xf4f4ec, emissive: 0x222222,
        emissiveIntensity: 0.2, side: THREE.DoubleSide }));
    screen.position.set(cx, 1.9, r.z0 * TILE + 0.1);
    this.scene.add(screen); this.objects.push(screen);
  }

  _cubicleCluster(r) {
    const partMat = new THREE.MeshStandardMaterial({ color: 0x8a8f7a, roughness: 0.9 });
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x9a9a90, roughness: 0.8 });
    const monMat = new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.4 });
    this._monitors = this._monitors || [];
    for (let gz = r.z0 + 1; gz <= r.z1 - 1; gz += 3) {
      for (let gx = r.x0 + 1; gx <= r.x1 - 1; gx += 3) {
        const x = gx * TILE + TILE / 2, z = gz * TILE + TILE / 2;
        // L-shaped partition
        const p1 = new THREE.Mesh(new THREE.BoxGeometry(TILE * 1.4, 1.3, 0.1), partMat);
        p1.position.set(x, 0.65, z - TILE * 0.6);
        const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, TILE * 1.2), partMat);
        p2.position.set(x - TILE * 0.6, 0.65, z);
        const desk = new THREE.Mesh(new THREE.BoxGeometry(TILE * 1.0, 0.75, 0.6), deskMat);
        desk.position.set(x, 0.38, z - TILE * 0.45);
        const mon = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.36, 0.05), monMat);
        mon.position.set(x, 1.05, z - TILE * 0.55);
        this.scene.add(p1, p2, desk, mon);
        this.objects.push(p1, p2, desk, mon);
        this._monitors.push(mon);
      }
    }
  }

  _breakRoom(r, cx, cz) {
    const counterMat = new THREE.MeshStandardMaterial({ color: 0x44484e, roughness: 0.6 });
    // counter along the back wall
    const counter = new THREE.Mesh(new THREE.BoxGeometry(TILE * 2.4, 1.0, 0.8), counterMat);
    counter.position.set(cx, 0.5, r.z0 * TILE + 0.6);
    this.scene.add(counter); this.objects.push(counter);
    this._blockBox(counter.position.x, counter.position.z, TILE * 2.4, 0.8);
    // vending machine
    const vend = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.0, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x882222, roughness: 0.5,
        emissive: 0x330808, emissiveIntensity: 0.4 }));
    vend.position.set(r.x1 * TILE - 0.3, 1.0, r.z0 * TILE + 0.6);
    this.scene.add(vend); this.objects.push(vend);
    // small round table + chairs
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.9, 16),
      new THREE.MeshStandardMaterial({ color: 0x6a6a60, roughness: 0.7 }));
    table.position.set(cx, 0.45, cz + 0.5);
    this.scene.add(table); this.objects.push(table);
    this._simpleChair(cx - 1.2, cz + 0.5, 0x222428);
    this._simpleChair(cx + 1.2, cz + 0.5, 0x222428);

    // *** Manager's Keycard sits on the counter ***
    const card = this._makeKeycard(0xe0a83a, 'MGR');
    card.position.set(cx + TILE * 0.7, 1.06, r.z0 * TILE + 0.6);
    card.rotation.x = -Math.PI / 2;
    card.rotation.z = 0.4;
    this.scene.add(card); this.objects.push(card);
    this.managerCard = card;
    this.interactables.push({ mesh: card, type: 'managerKeycard' });
  }

  _managerOffice(r, cx, cz) {
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x5a4730, roughness: 0.5 });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(TILE * 1.4, 0.95, 0.9), deskMat);
    desk.position.set(cx, 0.47, cz);
    this.scene.add(desk); this.objects.push(desk);
    this._blockBox(cx, cz, TILE * 1.4, 0.9);
    this._simpleChair(cx, cz + 1.1, 0x222428);
    // monitor + filing cabinet
    const mon = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x101216 }));
    mon.position.set(cx, 1.15, cz - 0.3);
    this.scene.add(mon); this.objects.push(mon);
    this._monitors = this._monitors || [];
    this._monitors.push(mon);
  }

  _storageRoom(r) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b6256, roughness: 0.9 });
    for (let gx = r.x0 + 1; gx <= r.x1 - 1; gx += 2) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.2, TILE * 1.2), mat);
      const x = gx * TILE + TILE / 2, z = (r.z0 + r.z1) / 2 * TILE + TILE / 2;
      shelf.position.set(x, 1.1, z);
      this.scene.add(shelf); this.objects.push(shelf);
      this._blockBox(x, z, 0.7, TILE * 1.2);
    }
  }

  _utilityCloset(r, cx, cz) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a4a50, roughness: 0.7,
      metalness: 0.3 });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.3), mat);
    panel.position.set(cx, 1.2, r.z0 * TILE + 0.3);
    this.scene.add(panel); this.objects.push(panel);
    // pipes
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, WALL_H, 10),
      new THREE.MeshStandardMaterial({ color: 0x707078, metalness: 0.6, roughness: 0.4 }));
    pipe.position.set(r.x1 * TILE - 0.4, WALL_H / 2, cz);
    this.scene.add(pipe); this.objects.push(pipe);
  }

  // --------------------------------------------------------------------------
  // CEO office: the most detailed room in the level.
  // --------------------------------------------------------------------------
  _ceoOffice() {
    const r = this.ceoRoom;
    const cx = (r.x0 + r.x1) / 2 * TILE + TILE / 2;
    const cz = (r.z0 + r.z1) / 2 * TILE + TILE / 2;

    // "CEO" gold plaque above the door (faces south, toward the approach)
    this._sign(['CEO'], r.door[0] * TILE + TILE / 2, 2.5,
      r.door[1] * TILE + TILE - 0.05, 0,
      { w: 256, h: 200, bg: '#15100a', fg: '#f0d27a', accent: '#caa033',
        border: '#caa033', size: 84 }, 1.4, 1.1);
    this.ceoDoorSignZ = r.door[1] * TILE;

    // large executive desk
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3a2414, roughness: 0.4,
      metalness: 0.1 });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(TILE * 2.0, 1.0, 1.2), woodMat);
    desk.position.set(cx, 0.5, cz - 0.4);
    this.scene.add(desk); this.objects.push(desk);
    this._blockBox(cx, cz - 0.4, TILE * 2.0, 1.2);

    // executive leather chair behind the desk
    this._leatherChair(cx, cz - 1.6, Math.PI);

    // desk lamp (warm glow)
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.5, 10),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.5 }));
    lampBase.position.set(cx - TILE * 0.7, 1.25, cz - 0.5);
    const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.25, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x2f6f4f, side: THREE.DoubleSide }));
    lampShade.position.set(cx - TILE * 0.7, 1.55, cz - 0.5);
    const lampGlow = new THREE.PointLight(0xffe6b0, 0.8, 6, 2);
    lampGlow.position.set(cx - TILE * 0.7, 1.4, cz - 0.5);
    this.scene.add(lampBase, lampShade, lampGlow);
    this.objects.push(lampBase, lampShade, lampGlow);

    // bookshelves along the back wall
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x2e1d10, roughness: 0.6 });
    for (let i = -1; i <= 1; i += 2) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.4), shelfMat);
      shelf.position.set(cx + i * TILE * 1.1, 1.2, r.z0 * TILE + 0.25);
      this.scene.add(shelf); this.objects.push(shelf);
      // colourful "books"
      for (let b = 0; b < 6; b++) {
        const book = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.3),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(Math.random(), 0.5, 0.4) }));
        book.position.set(cx + i * TILE * 1.1 - 0.6 + b * 0.18, 1.7, r.z0 * TILE + 0.25);
        this.scene.add(book); this.objects.push(book);
      }
    }

    // awards / certificates framed on the wall
    this._framed(cx - 1.4, 2.0, r.z0 * TILE + 0.06, '#d8c060');
    this._framed(cx + 1.4, 2.0, r.z0 * TILE + 0.06, '#c0c8d0');
    // a small golden trophy on the desk
    const trophy = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.3, 10),
      new THREE.MeshStandardMaterial({ color: 0xd9b13a, metalness: 0.8, roughness: 0.3 }));
    trophy.position.set(cx + TILE * 0.7, 1.15, cz - 0.5);
    this.scene.add(trophy); this.objects.push(trophy);
    // family photo frame on the desk
    const photo = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x8a7a4a }));
    photo.position.set(cx - 0.4, 1.12, cz - 0.7);
    photo.rotation.y = -0.3;
    this.scene.add(photo); this.objects.push(photo);

    // *** Elevator Keycard sitting on the desk, clearly visible ***
    const card = this._makeKeycard(0x4aa3ff, 'ELV');
    card.position.set(cx + 0.4, 1.02, cz - 0.4);
    card.rotation.x = -Math.PI / 2;
    card.rotation.z = -0.2;
    this.scene.add(card); this.objects.push(card);
    this.elevatorCard = card;
    this.interactables.push({ mesh: card, type: 'elevatorKeycard' });
    this.ceoCenter = new THREE.Vector3(cx, 1.7, cz);
  }

  // --------------------------------------------------------------------------
  // The exit elevator (reception). Built with proper collision so the player
  // cannot walk through its walls; only the doorway is passable.
  // --------------------------------------------------------------------------
  _buildElevator() {
    const group = new THREE.Group();
    const x = 17 * TILE + TILE / 2;
    const z = 47 * TILE + TILE - 0.2;     // against the south reception wall
    this.exit.position.set(x, 0, z);

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xb8bcc4, metalness: 0.55, roughness: 0.4 });
    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x6a6f76, metalness: 0.6, roughness: 0.5 });
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0xccd0d6, metalness: 0.5, roughness: 0.32 });
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0xbabec4, metalness: 0.45, roughness: 0.45,
      emissive: new THREE.Color(0x202028), emissiveIntensity: 0.4,
      side: THREE.DoubleSide });
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: new THREE.Color(0xfdfbe8), emissiveIntensity: 1.2 });

    const OPEN_W = 1.7, OPEN_H = 2.5, FRAME_T = 0.22;
    const CAB_W = OPEN_W + 0.5, CAB_D = 2.0, CAB_H = OPEN_H + 0.25, SHELL = 0.12;
    const frontZ = 0, backZ = -CAB_D;     // doors face +... cabin recedes toward -Z (south)

    const add = (geo, mat, px, py, pz) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz);
      group.add(m); return m;
    };

    // frame
    add(new THREE.BoxGeometry(OPEN_W + FRAME_T * 2, FRAME_T, FRAME_T), darkSteelMat,
      0, OPEN_H + FRAME_T / 2, frontZ);
    add(new THREE.BoxGeometry(FRAME_T, OPEN_H + FRAME_T, FRAME_T), darkSteelMat,
      -(OPEN_W / 2 + FRAME_T / 2), OPEN_H / 2, frontZ);
    add(new THREE.BoxGeometry(FRAME_T, OPEN_H + FRAME_T, FRAME_T), darkSteelMat,
      (OPEN_W / 2 + FRAME_T / 2), OPEN_H / 2, frontZ);

    // doors
    const leafW = OPEN_W / 2;
    const doorGeo = new THREE.BoxGeometry(leafW, OPEN_H, 0.08);
    const leftDoor = add(doorGeo, doorMat, -leafW / 2, OPEN_H / 2, frontZ);
    const rightDoor = add(doorGeo, doorMat, leafW / 2, OPEN_H / 2, frontZ);

    // cabin shell (recedes toward -Z)
    add(new THREE.BoxGeometry(CAB_W, CAB_H, SHELL), cabinMat, 0, CAB_H / 2, backZ);
    add(new THREE.BoxGeometry(SHELL, CAB_H, CAB_D), cabinMat, -CAB_W / 2, CAB_H / 2, backZ / 2);
    add(new THREE.BoxGeometry(SHELL, CAB_H, CAB_D), cabinMat, CAB_W / 2, CAB_H / 2, backZ / 2);
    add(new THREE.BoxGeometry(CAB_W, SHELL, CAB_D), cabinMat, 0, CAB_H, backZ / 2);
    add(new THREE.BoxGeometry(CAB_W, SHELL, CAB_D), steelMat, 0, 0.01, backZ / 2);
    add(new THREE.PlaneGeometry(CAB_W * 0.7, CAB_D * 0.6), panelMat,
      0, CAB_H - SHELL - 0.02, backZ / 2).rotation.x = Math.PI / 2;

    // call panel + a keycard reader beside the doors (lit red while locked)
    add(new THREE.BoxGeometry(0.22, 0.5, 0.08), darkSteelMat,
      OPEN_W / 2 + FRAME_T + 0.2, 1.2, frontZ);
    this.readerLight = add(new THREE.PlaneGeometry(0.12, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0xff2020,
        emissiveIntensity: 1.0 }),
      OPEN_W / 2 + FRAME_T + 0.2, 1.35, frontZ - 0.05);

    const glow = new THREE.PointLight(0xfff6d8, 1.2, TILE * 5, 1.4);
    glow.position.set(0, CAB_H - 0.4, backZ / 2);
    group.add(glow);

    // orient: doors face +Z (north, into reception)
    group.position.set(x, 0, z);
    group.rotation.y = 0;

    this.scene.add(group); this.objects.push(group);
    this.exit.mesh = group;
    this.exit.doors = {
      left: leftDoor, right: rightDoor,
      leftClosedX: -leafW / 2, rightClosedX: leafW / 2, slide: leafW, t: 0,
    };
    this.exit.cabin = { width: CAB_W, depth: CAB_D };

    // raycast target for the elevator (the right door leaf)
    this.interactables.push({ mesh: rightDoor, type: 'elevator' });
    this.interactables.push({ mesh: leftDoor, type: 'elevator' });

    // collision: block the elevator footprint tiles, keep the doorway open.
    // The cabin sits on tiles around (16..18, 47..48); only (17,47) doorway open.
    this._blockBox(x, z - 1.0, OPEN_W + 0.4, CAB_D + 0.4);
    this.openings.add(`${17},${46}`); // the tile the player boards through
    this.openings.add(`${17},${47}`);
  }

  // --------------------------------------------------------------------------
  // Small reusable prop / sign builders
  // --------------------------------------------------------------------------
  _makeKeycard(color, label) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.52, 0.02),
      new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.4,
        emissive: new THREE.Color(color).multiplyScalar(0.15) }));
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.025),
      new THREE.MeshStandardMaterial({ color: 0x222222 }));
    stripe.position.y = 0.14;
    group.add(body, stripe);
    group.userData.spin = true;     // gently bob/rotate to draw the eye
    group.userData.baseY = 0;
    return group;
  }

  _simpleChair(x, z, color) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), mat);
    seat.position.set(x, 0.5, z);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.08), mat);
    back.position.set(x, 0.8, z - 0.2);
    this.scene.add(seat, back); this.objects.push(seat, back);
  }

  _leatherChair(x, z, yaw) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.35,
      metalness: 0.1 });
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.6), mat);
    seat.position.y = 0.55;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.14), mat);
    back.position.set(0, 0.95, -0.24);
    g.add(seat, back);
    g.position.set(x, 0, z); g.rotation.y = yaw || 0;
    this.scene.add(g); this.objects.push(g);
  }

  _awardShelf(x, z) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x2e1d10, roughness: 0.6 });
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 1.4), mat);
    shelf.position.set(x, 0.8, z);
    this.scene.add(shelf); this.objects.push(shelf);
    for (let i = 0; i < 3; i++) {
      const award = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.25, 8),
        new THREE.MeshStandardMaterial({ color: 0xd9b13a, metalness: 0.8, roughness: 0.3 }));
      award.position.set(x, 0.7 + i * 0.45, z - 0.4 + i * 0.4);
      this.scene.add(award); this.objects.push(award);
    }
  }

  _framed(x, y, z, color) {
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9),
      new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3,
        side: THREE.DoubleSide }));
    frame.position.set(x, y, z);
    this.scene.add(frame); this.objects.push(frame);
  }

  /** A wall-mounted sign mesh facing a yaw direction (front = +Z when yaw 0). */
  _sign(lines, x, y, z, yaw, opts, w = 2.0, h = 1.0) {
    const tex = this._makeTextTexture(lines, opts);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true,
        side: THREE.DoubleSide }));
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw || 0;
    this.scene.add(mesh); this.objects.push(mesh);
    return mesh;
  }

  /** A department door plaque mounted on the wall beside a room's doorway. */
  _doorPlaque(r) {
    const [dx, dz] = r.door;
    const x = dx * TILE + TILE / 2;
    const z = dz * TILE + TILE / 2;
    // face toward the spine (the side the player approaches from)
    let yaw = 0, ox = 0, oz = 0;
    if (r.side === 'W') { yaw = Math.PI / 2; ox = 0.06; }
    else if (r.side === 'E') { yaw = -Math.PI / 2; ox = -0.06; }
    else { yaw = 0; oz = 0.06; }   // 'S'
    this._sign([r.dept], x + ox, 2.2, z + oz, yaw,
      { w: 384, h: 110, bg: '#1a1c22', fg: '#dfe6ee', border: '#5a6270', size: 38 },
      1.5, 0.43);
  }

  _plaque(text, x, z, yaw) {
    this._sign([text], x, 2.2, z, yaw,
      { w: 360, h: 110, bg: '#15100a', fg: '#f0d27a', border: '#caa033', size: 42 },
      1.4, 0.43);
  }

  /** A sign hung from the ceiling in a hallway, readable from both directions. */
  _hallwaySign(lines, x, z) {
    const tex = this._makeTextTexture(lines,
      { w: 512, h: 160, bg: 'rgba(16,18,24,0.95)', fg: '#cfe6ff',
        border: '#3a536b', size: 38 });
    // Two single-sided planes back-to-back so the text never appears mirrored.
    for (const yaw of [0, Math.PI]) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.8),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true,
          side: THREE.FrontSide }));
      mesh.position.set(x, 2.5, z);
      mesh.rotation.y = yaw;
      this.scene.add(mesh); this.objects.push(mesh);
    }
  }

  // --------------------------------------------------------------------------
  // Collision helpers
  // --------------------------------------------------------------------------
  /** Mark the tiles covered by an axis-aligned box (world space) as solid. */
  _blockBox(cx, cz, w, d) {
    const x0 = Math.floor((cx - w / 2) / TILE);
    const x1 = Math.floor((cx + w / 2) / TILE);
    const z0 = Math.floor((cz - d / 2) / TILE);
    const z1 = Math.floor((cz + d / 2) / TILE);
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++)
        this.solids.add(`${x},${z}`);
  }

  /** True if the given world position is blocked. */
  isBlocked(worldX, worldZ) {
    const gx = Math.floor(worldX / TILE);
    const gz = Math.floor(worldZ / TILE);
    if (gx < 0 || gz < 0 || gx >= this.mapW || gz >= this.mapH) return true;
    const key = `${gx},${gz}`;
    if (this.openings.has(key)) {
      // doorway: blocked only if a *locked* exec-door tile
      if (!this.execUnlocked && this._isExecDoorTile(gx, gz)) return true;
      return false;
    }
    if (this.grid[gz][gx] === 1) return true;
    if (this.solids.has(key)) {
      if (this.execUnlocked && this._isExecDoorTile(gx, gz)) return false;
      return true;
    }
    return false;
  }

  _isExecDoorTile(x, z) {
    return this.execDoorTiles.some(([tx, tz]) => tx === x && tz === z);
  }

  distanceToExit(pos) {
    const dx = pos.x - this.exit.position.x;
    const dz = pos.z - this.exit.position.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  isInsideElevator(pos) {
    if (!this.exit.mesh || !this.exit.cabin) return false;
    const local = this.exit.mesh.worldToLocal(pos.clone());
    const halfW = this.exit.cabin.width / 2 - 0.15;
    return local.z < -0.2 && local.z > -this.exit.cabin.depth + 0.1 &&
           Math.abs(local.x) < halfW;
  }

  setElevatorDoors(open, dt) {
    const d = this.exit.doors;
    if (!d) return;
    const target = open ? 1 : 0;
    const step = Math.min(1, (dt || 0.016) * 1.5);
    d.t += (target - d.t) * step;
    d.left.position.x = d.leftClosedX - d.slide * d.t;
    d.right.position.x = d.rightClosedX + d.slide * d.t;
  }

  setElevatorHeight(y) { if (this.exit.mesh) this.exit.mesh.position.y = y; }

  // --------------------------------------------------------------------------
  // Objective / interaction logic
  // --------------------------------------------------------------------------
  begin() {
    this._started = true;
    // close the elevator doors the player just stepped out of
    this.exit.doors.t = 1;
    this._thinkOnce('start', 'I need a keycard to use the elevator.', 1.2);
  }

  _thinkOnce(key, text, delay = 0) {
    if (this._said.has(key)) return;
    this._said.add(key);
    if (delay > 0) setTimeout(() => this.ui.showThought(text), delay * 1000);
    else this.ui.showThought(text);
  }

  /**
   * Handle a player interaction (the E key). Returns true if something was
   * interacted with.
   */
  interact(player) {
    const target = this._lookTarget;
    if (!target) {
      // allow boarding / riding the elevator even without a precise look
      this._tryElevator(player);
      return false;
    }
    switch (target.type) {
      case 'managerKeycard':
        if (!this.hasManagerKeycard) {
          this.hasManagerKeycard = true;
          this._removeInteractable(this.managerCard);
          this.scene.remove(this.managerCard);
          this.ui.showThought('A manager\u2019s keycard. This should open that door.');
        }
        return true;
      case 'elevatorKeycard':
        if (!this.hasElevatorKeycard) {
          this.hasElevatorKeycard = true;
          this._removeInteractable(this.elevatorCard);
          this.scene.remove(this.elevatorCard);
          this.readerLight.material.color.set(0x30ff60);
          this.readerLight.material.emissive.set(0x20ff40);
          this.ui.showThought('An elevator keycard. Finally.');
        }
        return true;
      case 'execDoor':
        if (!this.execUnlocked && this.hasManagerKeycard) {
          this.execUnlocked = true;
          this.ui.showThought('This place looks different\u2026');
        }
        return true;
      case 'elevator':
        this._tryElevator(player);
        return true;
    }
    return false;
  }

  _tryElevator(player) {
    if (!this.hasElevatorKeycard) {
      this.ui.showThought('The elevator needs a keycard.', 2.0);
      return;
    }
    if (this._elevState === 'ready') {
      this._elevState = 'open';
      this.audio.elevatorChime();
    } else if (this._elevState === 'open' &&
               this.isInsideElevator(player.object.position)) {
      this._elevState = 'rising';
      this._riseStartY = player.object.position.y;
      player.rideElevator((this.ceilingHeight || WALL_H) + 1.7);
      this.ui.hideExitPrompt();
    }
  }

  _removeInteractable(mesh) {
    this.interactables = this.interactables.filter((it) => {
      let hit = it.mesh === mesh;
      mesh.traverse?.((c) => { if (c === it.mesh) hit = true; });
      return !hit;
    });
  }

  /**
   * Per-frame update. Drives the player light, doors, ambience, the look-at
   * interaction prompt, objective thoughts and the exit elevator.
   * @returns {boolean} true once the player has ridden the elevator out.
   */
  update(dt, player, camera, elapsed) {
    if (this.playerLight) this.playerLight.position.copy(camera.position);

    // animate the exec door
    if (this.execDoor) {
      const tgt = this.execUnlocked ? 1 : 0;
      const d = this.execDoor;
      d.t += (tgt - d.t) * Math.min(1, dt * 2.0);
      d.left.position.x = d.leftClosedX - d.leafW * d.t;
      d.right.position.x = d.rightClosedX + d.leafW * d.t;
    }

    // bob the keycards so they catch the eye
    const bob = Math.sin((elapsed || 0) * 2.0) * 0.03;
    [this.managerCard, this.elevatorCard].forEach((c) => {
      if (c && c.parent) { c.rotation.z += dt * 0.6; }
    });

    this._updateThoughtsAndInteraction(player, camera);
    this._updateAmbience(dt);
    return this._updateElevator(dt, player);
  }

  _updateThoughtsAndInteraction(player, camera) {
    const pos = player.object.position;

    // proximity thought: discovering the (locked) Executive Wing door
    const execDist = Math.hypot(pos.x - this.execDoor.cx, pos.z - this.execDoor.z);
    if (execDist < 5 && !this.execUnlocked) {
      const msg = this.hasManagerKeycard ? null
        : 'Locked. Looks like I need a manager\u2019s keycard.';
      if (msg) this._thinkOnce('execLocked', msg);
    }

    // proximity thought: seeing the CEO door inside the executive wing
    if (this.execUnlocked && this.ceoCenter) {
      const ceoDist = Math.hypot(pos.x - this.ceoCenter.x, pos.z - this.ceoCenter.z);
      if (ceoDist < 8) this._thinkOnce('ceoSeen', 'CEO. This has to be it.');
    }

    // approaching the elevator with the keycard
    if (this.hasElevatorKeycard && this._elevState === 'locked') {
      if (this.distanceToExit(pos) < this.exit.radius) {
        this._thinkOnce('elevReady', 'Now I can get out of here.');
        this._elevState = 'ready';
      }
    }

    // look-at interaction prompt (raycast against interactables)
    this._raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const meshes = this.interactables.map((it) => it.mesh);
    const hits = this._raycaster.intersectObjects(meshes, true);
    let target = null;
    if (hits.length) {
      const hitObj = hits[0].object;
      target = this.interactables.find((it) =>
        it.mesh === hitObj || this._isDescendant(it.mesh, hitObj));
    }
    this._lookTarget = target;
    this._showInteractPrompt(target, player);
  }

  _isDescendant(root, obj) {
    let found = false;
    root.traverse?.((c) => { if (c === obj) found = true; });
    return found;
  }

  _showInteractPrompt(target, player) {
    if (!target) { this.ui.hideInteract(); return; }
    switch (target.type) {
      case 'managerKeycard':
        this.ui.showInteract("Manager's Keycard", '<b>E</b> Pick Up');
        break;
      case 'elevatorKeycard':
        this.ui.showInteract('Elevator Keycard', '<b>E</b> Pick Up');
        break;
      case 'execDoor':
        if (this.execUnlocked) this.ui.hideInteract();
        else if (this.hasManagerKeycard)
          this.ui.showInteract('Executive Wing Door', '<b>E</b> Unlock');
        else
          this.ui.showInteract('Executive Wing Door', 'Locked', true);
        break;
      case 'elevator':
        if (!this.hasElevatorKeycard)
          this.ui.showInteract('Elevator', 'Locked', true);
        else if (this._elevState === 'ready')
          this.ui.showInteract('Elevator', '<b>E</b> Open');
        else if (this._elevState === 'open' &&
                 this.isInsideElevator(player.object.position))
          this.ui.showInteract('Elevator', '<b>E</b> Go Up');
        else this.ui.hideInteract();
        break;
      default:
        this.ui.hideInteract();
    }
  }

  _updateElevator(dt, player) {
    switch (this._elevState) {
      case 'open':
        this.setElevatorDoors(true, dt);
        break;
      case 'rising':
        this.setElevatorDoors(false, dt);
        this.setElevatorHeight(player.object.position.y - this._riseStartY);
        if (player.mode === 'roof') {
          this.audio.elevatorChime();
          this._elevState = 'done';
          return true;
        }
        break;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // Office ambience: subtle, rare random events.
  // --------------------------------------------------------------------------
  _updateAmbience(dt) {
    this._eventTimer -= dt;
    if (this._eventTimer > 0) return;
    this._eventTimer = 12 + Math.random() * 22;   // rare

    const r = Math.random();
    if (r < 0.22) {
      this.audio.phoneRing();
    } else if (r < 0.42) {
      this.audio.printerNoise();
    } else if (r < 0.58) {
      this.audio.ventRattle();
    } else if (r < 0.74) {
      this.audio.distantSound();
    } else if (r < 0.88) {
      this._flickerLights();
    } else {
      this._monitorBlink();
    }
  }

  _flickerLights() {
    if (this._flicker) return;
    this._flicker = { t: 0, dur: 0.5 + Math.random() * 0.6 };
    this.audio.flickerBuzz();
    const start = performance.now();
    const tick = () => {
      const e = (performance.now() - start) / 1000;
      if (e >= this._flicker.dur) {
        this.setLightLevel(1.0); this._flicker = null; return;
      }
      this.setLightLevel(Math.random() < 0.5 ? 0.25 + Math.random() * 0.3 : 1.0);
      requestAnimationFrame(tick);
    };
    tick();
  }

  _monitorBlink() {
    if (!this._monitors || !this._monitors.length) return;
    const mon = this._monitors[Math.floor(Math.random() * this._monitors.length)];
    const mat = mon.material;
    mat.emissive = mat.emissive || new THREE.Color(0x000000);
    mat.emissive.set(0x2a4a8a);
    mat.emissiveIntensity = 1.0;
    mat.needsUpdate = true;
    setTimeout(() => {
      mat.emissive.set(0x000000);
      mat.emissiveIntensity = 0;
      mat.needsUpdate = true;
    }, 600 + Math.random() * 1400);
  }

  setLightLevel(factor) {
    if (this.ambient) this.ambient.intensity = this.baseAmbient * factor;
    if (this.hemi) this.hemi.intensity = this.baseHemi * factor;
    if (this.playerLight) this.playerLight.intensity = this.basePlayer * (0.3 + 0.7 * factor);
    if (this.panelMat) this.panelMat.emissiveIntensity = this.baseEmissive * factor;
    if (this.ceilMat) this.ceilMat.emissiveIntensity = this.baseCeilEmissive * factor;
  }

  update_legacy() {}

  dispose() {
    for (const obj of this.objects) {
      this.scene.remove(obj);
      obj.traverse?.((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mm) => mm.dispose());
        }
      });
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((mm) => mm.dispose());
      }
    }
    this.objects = [];
    [this.carpetTex, this.wallTex, this.ceilTex, this.execCarpet, this.execWallTex]
      .forEach((t) => t && t.dispose());
    this.scene.fog = null;
  }
}

export { TILE, WALL_H };
