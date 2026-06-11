/* ============================================================
   level0.js
   Builds "Level 0 - The Lobby": a procedurally generated maze
   of yellow rooms and hallways, stained carpet, a fluorescent
   ceiling, fog and an exit.

   All textures are generated procedurally on a <canvas>, so the
   project needs no external image assets (GitHub Pages friendly).
   ============================================================ */

import * as THREE from 'three';

// --- World constants -------------------------------------------------------
const TILE = 4;          // size of one tile in world units
const WALL_H = 3.2;      // wall / ceiling height
const COLS = 13;         // logical maze cells (x)
const ROWS = 13;         // logical maze cells (z)

// Deterministic RNG so the layout is consistent between sessions.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Level0 {
  /**
   * @param {THREE.Scene} scene
   * @param {number} seed
   */
  constructor(scene, seed = 1337) {
    this.scene = scene;
    this.rand = mulberry32(seed);

    // tile map dimensions (walls live on even indices)
    this.mapW = COLS * 2 + 1;
    this.mapH = ROWS * 2 + 1;
    this.grid = [];          // 1 = wall, 0 = floor

    this.objects = [];       // everything added, for disposal
    this.lightPanels = null; // InstancedMesh of glowing ceiling panels

    this.spawn = new THREE.Vector3(0, 1.7, 0);
    this.spawnYaw = 0;
    this.exit = { position: new THREE.Vector3(), radius: 2.2, mesh: null };

    this._generateGrid();
    this._buildTextures();
    this._buildGeometry();
    this._buildLighting();
    this._placeSpawnAndExit();
  }

  // --------------------------------------------------------------------------
  // Maze generation: recursive backtracker, then carve a few extra openings
  // to create more open "room" areas (very backrooms-like).
  // --------------------------------------------------------------------------
  _generateGrid() {
    // start fully walled
    for (let y = 0; y < this.mapH; y++) {
      const row = [];
      for (let x = 0; x < this.mapW; x++) row.push(1);
      this.grid.push(row);
    }

    const visited = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
    const cellToMap = (cx, cy) => [cx * 2 + 1, cy * 2 + 1];

    const stack = [[0, 0]];
    visited[0][0] = true;
    {
      const [mx, my] = cellToMap(0, 0);
      this.grid[my][mx] = 0;
    }

    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      // gather unvisited neighbours
      const options = [];
      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && !visited[ny][nx]) {
          options.push([nx, ny, dx, dy]);
        }
      }
      if (options.length === 0) { stack.pop(); continue; }

      const [nx, ny, dx, dy] = options[Math.floor(this.rand() * options.length)];
      // carve passage between current cell and neighbour
      const [mx, my] = cellToMap(cx, cy);
      this.grid[my + dy][mx + dx] = 0;       // wall between
      const [nmx, nmy] = cellToMap(nx, ny);
      this.grid[nmy][nmx] = 0;               // neighbour cell
      visited[ny][nx] = true;
      stack.push([nx, ny]);
    }

    // Carve extra openings to break up the perfect maze into rooms.
    const extra = Math.floor(COLS * ROWS * 0.55);
    for (let i = 0; i < extra; i++) {
      const x = 1 + Math.floor(this.rand() * (this.mapW - 2));
      const y = 1 + Math.floor(this.rand() * (this.mapH - 2));
      // only remove interior walls, keep the outer boundary intact
      if (x > 0 && x < this.mapW - 1 && y > 0 && y < this.mapH - 1) {
        this.grid[y][x] = 0;
      }
    }

    // Guarantee a solid outer boundary.
    for (let x = 0; x < this.mapW; x++) { this.grid[0][x] = 1; this.grid[this.mapH - 1][x] = 1; }
    for (let y = 0; y < this.mapH; y++) { this.grid[y][0] = 1; this.grid[y][this.mapW - 1] = 1; }
  }

  // --------------------------------------------------------------------------
  // Procedural canvas textures
  // --------------------------------------------------------------------------
  _buildTextures() {
    this.wallTex   = this._makeWallTexture();
    this.carpetTex = this._makeCarpetTexture();
    this.ceilTex   = this._makeCeilingTexture();
    this.stainTex  = this._makeStainTexture();
    this.arrowTex  = this._makeArrowTexture();
  }

  _makeWallTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#c4b14e';
    g.fillRect(0, 0, 256, 256);
    // subtle vertical wallpaper stripes
    for (let x = 0; x < 256; x += 8) {
      g.fillStyle = (x % 16 === 0) ? 'rgba(150,135,55,0.18)' : 'rgba(210,196,110,0.12)';
      g.fillRect(x, 0, 4, 256);
    }
    // grime / noise
    for (let i = 0; i < 1400; i++) {
      const x = Math.random() * 256, y = Math.random() * 256;
      const a = Math.random() * 0.08;
      g.fillStyle = `rgba(90,80,30,${a})`;
      g.fillRect(x, y, 2, 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _makeCarpetTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#9a8f3c';
    g.fillRect(0, 0, 256, 256);
    // fibrous noise
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * 256, y = Math.random() * 256;
      const v = Math.random();
      g.fillStyle = v > 0.5 ? 'rgba(120,110,45,0.25)' : 'rgba(70,64,25,0.25)';
      g.fillRect(x, y, 2, 1);
    }
    // NOTE: dark stains are no longer baked into this (per-tile) repeating
    // texture, which previously put a stain on every single floor panel.
    // Stains are now placed sparsely as separate decals (see _placeStains).
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  _makeCeilingTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#cfc9a8';
    g.fillRect(0, 0, 256, 256);
    // ceiling tile grid
    g.strokeStyle = 'rgba(120,115,90,0.5)';
    g.lineWidth = 4;
    g.strokeRect(2, 2, 252, 252);
    // speckle
    for (let i = 0; i < 2200; i++) {
      const x = Math.random() * 256, y = Math.random() * 256;
      g.fillStyle = `rgba(150,145,120,${Math.random() * 0.25})`;
      g.fillRect(x, y, 2, 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // A single soft, irregular dark carpet stain on a transparent canvas.
  // Used as a sparse decal so stains appear "once in a while", not on
  // every floor panel.
  _makeStainTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 128, 128);
    // a few overlapping soft blobs for an organic edge
    const blobs = 4 + Math.floor(this.rand() * 4);
    for (let i = 0; i < blobs; i++) {
      const x = 64 + (this.rand() - 0.5) * 46;
      const y = 64 + (this.rand() - 0.5) * 46;
      const r = 22 + this.rand() * 30;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(28,24,8,0.55)');
      grad.addColorStop(0.6, 'rgba(32,27,10,0.32)');
      grad.addColorStop(1, 'rgba(32,27,10,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // A hand-drawn-looking blue marker arrow, pointing toward the TOP of the
  // canvas. Drawn with a few jittered, overlapping strokes so it reads as
  // scrawled-on graffiti rather than a clean vector arrow.
  _makeArrowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 256, 256);
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // Draw a slightly wiggly line as several short segments.
    const scrawl = (x1, y1, x2, y2, width, alpha) => {
      g.strokeStyle = `rgba(26,40,110,${alpha})`;
      g.lineWidth = width;
      const segs = 6;
      g.beginPath();
      g.moveTo(x1, y1);
      for (let s = 1; s <= segs; s++) {
        const t = s / segs;
        const jx = (this.rand() - 0.5) * 7;
        const jy = (this.rand() - 0.5) * 7;
        g.lineTo(x1 + (x2 - x1) * t + jx, y1 + (y2 - y1) * t + jy);
      }
      g.stroke();
    };

    const tipX = 128, tipY = 40;
    // main shaft (drawn twice for a marker-ish double stroke)
    scrawl(128, 224, tipX, tipY, 9, 0.9);
    scrawl(130, 222, tipX + 2, tipY + 4, 5, 0.55);
    // arrow head
    scrawl(tipX, tipY, 80, 104, 9, 0.9);
    scrawl(tipX, tipY, 176, 104, 9, 0.9);
    // small feathered tail strokes (like the reference sketch)
    scrawl(128, 210, 104, 178, 5, 0.7);
    scrawl(128, 210, 152, 178, 5, 0.7);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  _buildGeometry() {
    const worldW = this.mapW * TILE;
    const worldH = this.mapH * TILE;

    // ---- Floor (stained carpet) ----
    this.carpetTex.repeat.set(this.mapW, this.mapH);
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.carpetTex, roughness: 1.0, metalness: 0.0,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldH), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(worldW / 2, 0, worldH / 2);
    this.scene.add(floor);
    this.objects.push(floor);

    // ---- Ceiling ----
    this.ceilTex.repeat.set(this.mapW, this.mapH);
    this.ceilMat = new THREE.MeshStandardMaterial({
      map: this.ceilTex, roughness: 1.0, metalness: 0.0,
      emissive: new THREE.Color(0x3a3826), emissiveIntensity: 0.6,
    });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldH), this.ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(worldW / 2, WALL_H, worldH / 2);
    this.scene.add(ceil);
    this.objects.push(ceil);

    // ---- Walls (instanced) ----
    const wallCells = [];
    for (let y = 0; y < this.mapH; y++) {
      for (let x = 0; x < this.mapW; x++) {
        if (this.grid[y][x] === 1) wallCells.push([x, y]);
      }
    }
    const wallGeo = new THREE.BoxGeometry(TILE, WALL_H, TILE);
    this.wallMat = new THREE.MeshStandardMaterial({
      map: this.wallTex, roughness: 0.95, metalness: 0.0,
    });
    const walls = new THREE.InstancedMesh(wallGeo, this.wallMat, wallCells.length);
    const m = new THREE.Matrix4();
    wallCells.forEach(([x, y], i) => {
      m.makeTranslation(x * TILE + TILE / 2, WALL_H / 2, y * TILE + TILE / 2);
      walls.setMatrixAt(i, m);
    });
    walls.instanceMatrix.needsUpdate = true;
    this.scene.add(walls);
    this.objects.push(walls);

    // ---- Fluorescent ceiling light panels (emissive, on a regular grid) ----
    const panelPositions = [];
    for (let y = 2; y < this.mapH - 1; y += 3) {
      for (let x = 2; x < this.mapW - 1; x += 3) {
        if (this.grid[y][x] === 0) panelPositions.push([x, y]);
      }
    }
    const panelGeo = new THREE.PlaneGeometry(TILE * 0.7, TILE * 0.7);
    this.panelMat = new THREE.MeshStandardMaterial({
      color: 0xfff7d0,
      emissive: new THREE.Color(0xfff3c0),
      emissiveIntensity: 1.0,
      roughness: 1.0,
      side: THREE.DoubleSide,
    });
    this.lightPanels = new THREE.InstancedMesh(panelGeo, this.panelMat, panelPositions.length);
    const pm = new THREE.Matrix4();
    const rot = new THREE.Matrix4().makeRotationX(Math.PI / 2);
    panelPositions.forEach(([x, y], i) => {
      const t = new THREE.Matrix4().makeTranslation(
        x * TILE + TILE / 2, WALL_H - 0.02, y * TILE + TILE / 2
      );
      pm.multiplyMatrices(t, rot);
      this.lightPanels.setMatrixAt(i, pm);
    });
    this.lightPanels.instanceMatrix.needsUpdate = true;
    this.scene.add(this.lightPanels);
    this.objects.push(this.lightPanels);

    this._placeStains();
  }

  // --------------------------------------------------------------------------
  // Sparse carpet stains: occasional dark decals on random open floor tiles
  // (instead of a stain baked into every repeating carpet panel).
  // --------------------------------------------------------------------------
  _placeStains() {
    const STAIN_CHANCE = 0.12;   // ~1 in 8 floor tiles gets a stain
    const tiles = [];
    for (let y = 1; y < this.mapH - 1; y++) {
      for (let x = 1; x < this.mapW - 1; x++) {
        if (this.grid[y][x] === 0 && this.rand() < STAIN_CHANCE) tiles.push([x, y]);
      }
    }
    if (tiles.length === 0) return;

    const stainMat = new THREE.MeshBasicMaterial({
      map: this.stainTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    });
    const stainGeo = new THREE.PlaneGeometry(1, 1);
    const stains = new THREE.InstancedMesh(stainGeo, stainMat, tiles.length);
    const mat = new THREE.Matrix4();
    const flat = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    tiles.forEach(([x, y], i) => {
      const size = TILE * (0.55 + this.rand() * 0.7);
      const yaw = this.rand() * Math.PI * 2;
      const t = new THREE.Matrix4().makeTranslation(
        x * TILE + TILE / 2 + (this.rand() - 0.5) * TILE * 0.3,
        0.02,
        y * TILE + TILE / 2 + (this.rand() - 0.5) * TILE * 0.3
      );
      const r = new THREE.Matrix4().multiplyMatrices(
        new THREE.Matrix4().makeRotationY(yaw), flat
      );
      const s = new THREE.Matrix4().makeScale(size, size, 1);
      mat.multiplyMatrices(t, new THREE.Matrix4().multiplyMatrices(r, s));
      stains.setMatrixAt(i, mat);
    });
    stains.instanceMatrix.needsUpdate = true;
    this.scene.add(stains);
    this.objects.push(stains);
  }

  // --------------------------------------------------------------------------
  // Lighting & atmosphere
  // --------------------------------------------------------------------------
  _buildLighting() {
    // Flat, sickly fluorescent ambience.
    this.ambient = new THREE.AmbientLight(0xfff4cf, 1.15);
    this.scene.add(this.ambient);
    this.objects.push(this.ambient);

    this.hemi = new THREE.HemisphereLight(0xfff3c0, 0x3a3414, 0.55);
    this.scene.add(this.hemi);
    this.objects.push(this.hemi);

    // A soft point light that follows the player for a little local depth.
    this.playerLight = new THREE.PointLight(0xfff0c0, 0.6, TILE * 6, 1.2);
    this.scene.add(this.playerLight);
    this.objects.push(this.playerLight);

    // Fog: hazy, warm, hides the extents -> endless feeling.
    this.fogColor = new THREE.Color(0x121008);
    this.scene.fog = new THREE.FogExp2(this.fogColor.clone(), 0.045);
    this.scene.background = this.fogColor.clone();

    // remember base intensities for the event system
    this.baseAmbient = this.ambient.intensity;
    this.baseHemi = this.hemi.intensity;
    this.basePlayer = this.playerLight.intensity;
    this.baseEmissive = this.panelMat.emissiveIntensity;
    this.baseCeilEmissive = this.ceilMat.emissiveIntensity;
  }

  // --------------------------------------------------------------------------
  // Spawn + exit placement (exit is the farthest reachable tile from spawn)
  // --------------------------------------------------------------------------
  _placeSpawnAndExit() {
    // spawn at first open cell near (1,1)
    const start = [1, 1];
    this.spawn.set(start[0] * TILE + TILE / 2, 1.7, start[1] * TILE + TILE / 2);

    // Face an open neighbouring tile so we don't start nose-to-wall.
    // yaw: north(-Z)=0, south(+Z)=PI, east(+X)=-PI/2, west(-X)=+PI/2
    const [sx, sy] = start;
    if (this.grid[sy - 1] && this.grid[sy - 1][sx] === 0) this.spawnYaw = 0;
    else if (this.grid[sy][sx + 1] === 0) this.spawnYaw = -Math.PI / 2;
    else if (this.grid[sy + 1] && this.grid[sy + 1][sx] === 0) this.spawnYaw = Math.PI;
    else if (this.grid[sy][sx - 1] === 0) this.spawnYaw = Math.PI / 2;
    else this.spawnYaw = 0;

    // BFS to find the farthest open tile
    const dist = Array.from({ length: this.mapH }, () => new Array(this.mapW).fill(-1));
    const q = [start];
    dist[start[1]][start[0]] = 0;
    let far = start, farD = 0;
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= this.mapW || ny >= this.mapH) continue;
        if (this.grid[ny][nx] !== 0 || dist[ny][nx] !== -1) continue;
        dist[ny][nx] = dist[y][x] + 1;
        if (dist[ny][nx] > farD) { farD = dist[ny][nx]; far = [nx, ny]; }
        q.push([nx, ny]);
      }
    }

    const ex = far[0] * TILE + TILE / 2;
    const ez = far[1] * TILE + TILE / 2;
    this.exit.position.set(ex, 0, ez);
    this._buildExitDoor(ex, ez);

    this._placeArrows(start, far);
  }

  // --------------------------------------------------------------------------
  // Directional arrows: scrawled on walls along the path to the exit, spaced
  // out so the player follows them one after another, like a breadcrumb trail.
  // --------------------------------------------------------------------------
  _placeArrows(start, exitCell) {
    // BFS from the exit -> distance-to-exit for every open tile.
    const distToExit = Array.from(
      { length: this.mapH }, () => new Array(this.mapW).fill(-1)
    );
    const q = [exitCell];
    distToExit[exitCell[1]][exitCell[0]] = 0;
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= this.mapW || ny >= this.mapH) continue;
        if (this.grid[ny][nx] !== 0 || distToExit[ny][nx] !== -1) continue;
        distToExit[ny][nx] = distToExit[y][x] + 1;
        q.push([nx, ny]);
      }
    }

    // Walk the shortest path from spawn to exit, always stepping to the
    // neighbour closer to the exit. Place an arrow every few steps, on a side
    // wall, pointing in the direction of travel.
    const ARROW_SPACING = 5;
    let cx = start[0], cy = start[1];
    let steps = 0, guard = 0;
    const limit = this.mapW * this.mapH;
    while (distToExit[cy][cx] > 0 && guard++ < limit) {
      let best = null, bestD = distToExit[cy][cx];
      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= this.mapW || ny >= this.mapH) continue;
        if (this.grid[ny][nx] !== 0 || distToExit[ny][nx] < 0) continue;
        if (distToExit[ny][nx] < bestD) { bestD = distToExit[ny][nx]; best = [dx, dy]; }
      }
      if (!best) break;
      if (steps % ARROW_SPACING === 0) this._tryBuildArrow(cx, cy, best);
      cx += best[0]; cy += best[1]; steps++;
    }
  }

  // Place a wall arrow at path tile (tx,ty) pointing along travel dir [dx,dy].
  // The arrow is drawn on a side wall (perpendicular to travel) so it can
  // visibly point forward in the wall's plane.
  _tryBuildArrow(tx, ty, [dx, dy]) {
    // The two sides perpendicular to the travel direction.
    const sides = [[dy, -dx], [-dy, dx]];
    for (const [sx, sy] of sides) {
      const wx = tx + sx, wy = ty + sy;
      if (wx < 0 || wy < 0 || wx >= this.mapW || wy >= this.mapH) continue;
      if (this.grid[wy][wx] !== 1) continue;   // need a wall on this side

      const mat = this.arrowMat || (this.arrowMat = new THREE.MeshBasicMaterial({
        map: this.arrowTex, transparent: true, depthWrite: false, opacity: 0.9,
      }));
      const geo = this.arrowGeo ||
        (this.arrowGeo = new THREE.PlaneGeometry(1.0, 1.4));
      const mesh = new THREE.Mesh(geo, mat);

      // Position on the wall face, just in front of it, at eye height.
      const px = tx * TILE + TILE / 2 + sx * (TILE / 2 - 0.03);
      const pz = ty * TILE + TILE / 2 + sy * (TILE / 2 - 0.03);

      // Orient: front (+Z) faces the path tile (-side); up (+Y) = travel dir.
      const n = new THREE.Vector3(-sx, 0, -sy).normalize();
      const up = new THREE.Vector3(dx, 0, dy).normalize();
      const right = new THREE.Vector3().crossVectors(up, n).normalize();
      const basis = new THREE.Matrix4().makeBasis(right, up, n);
      mesh.quaternion.setFromRotationMatrix(basis);
      mesh.position.set(px, 1.6, pz);

      this.scene.add(mesh);
      this.objects.push(mesh);
      return;   // one arrow per chosen tile
    }
  }

  _buildExitDoor(x, z) {
    const group = new THREE.Group();

    // A bright void doorway: dark plane framed by glowing white light.
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: new THREE.Color(0xffffff), emissiveIntensity: 1.4,
    });
    const portalMat = new THREE.MeshBasicMaterial({
      color: 0xfffdf0, side: THREE.DoubleSide, fog: false,
    });

    const doorW = 1.6, doorH = 2.6, frameT = 0.18;

    const portal = new THREE.Mesh(new THREE.PlaneGeometry(doorW, doorH), portalMat);
    portal.position.set(0, doorH / 2, 0);
    group.add(portal);

    // frame pieces
    const mkBar = (w, h, px, py) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, frameT), frameMat);
      bar.position.set(px, py, 0);
      return bar;
    };
    group.add(mkBar(doorW + frameT * 2, frameT, 0, doorH + frameT / 2));     // top
    group.add(mkBar(frameT, doorH + frameT, -(doorW / 2 + frameT / 2), doorH / 2)); // left
    group.add(mkBar(frameT, doorH + frameT, (doorW / 2 + frameT / 2), doorH / 2));  // right

    // a glow light at the exit so it reads as a beacon through the fog
    const glow = new THREE.PointLight(0xffffff, 1.2, TILE * 5, 1.5);
    glow.position.set(0, doorH / 2, 0);
    group.add(glow);

    group.position.set(x, 0, z);
    this.scene.add(group);
    this.objects.push(group);
    this.exit.mesh = group;
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /** True if the given world position is inside a wall tile or out of bounds. */
  isBlocked(worldX, worldZ) {
    const gx = Math.floor(worldX / TILE);
    const gy = Math.floor(worldZ / TILE);
    if (gx < 0 || gy < 0 || gx >= this.mapW || gy >= this.mapH) return true;
    return this.grid[gy][gx] === 1;
  }

  /** Distance from a world position to the exit (XZ plane). */
  distanceToExit(pos) {
    const dx = pos.x - this.exit.position.x;
    const dz = pos.z - this.exit.position.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /** Per-frame updates (player light follows the camera, exit shimmer). */
  update(dt, cameraPos, elapsed) {
    if (this.playerLight) this.playerLight.position.copy(cameraPos);
    if (this.exit.mesh) this.exit.mesh.rotation.y = Math.sin(elapsed * 0.5) * 0.05;
  }

  /**
   * Set overall light level (0 = blackout, 1 = normal). Used by events.js.
   */
  setLightLevel(factor) {
    if (this.ambient) this.ambient.intensity = this.baseAmbient * factor;
    if (this.hemi) this.hemi.intensity = this.baseHemi * factor;
    if (this.playerLight) this.playerLight.intensity = this.basePlayer * (0.3 + 0.7 * factor);
    if (this.panelMat) this.panelMat.emissiveIntensity = this.baseEmissive * factor;
    if (this.ceilMat) this.ceilMat.emissiveIntensity = this.baseCeilEmissive * factor;
  }

  /** Remove everything this level added to the scene and free GPU memory. */
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
    [this.wallTex, this.carpetTex, this.ceilTex, this.stainTex, this.arrowTex]
      .forEach((t) => t && t.dispose());
    this.scene.fog = null;
  }
}

export { TILE, WALL_H };
