// Neon Bay — the city itself: golden-hour sky, road grid, procedural buildings, beach,
// docks, bridge and Cayo Verde island. Everything is generated from a seed; no external
// assets. Also owns the road graph (for traffic + police) and building colliders.
import * as THREE from '../vendor/three.module.min.js';
import { WORLD } from './config.js';

const HALF = WORLD.half;
const STEP = WORLD.block;
const GRID = 5; // intersections at -5..5 * STEP
const GROUND_SPAN = 560; // ground plane covers -280..280 on both axes

// --- Canvas textures (all art is painted, never fetched) --------------------------

function facadeTexture(base, litRatio, random) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  // Subtle vertical shading so flat walls read as volumes.
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.25)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  // Windows: some lit warm, some dark.
  for (let y = 12; y < 248; y += 18) {
    for (let x = 10; x < 120; x += 18) {
      const lit = random.next() < litRatio;
      g.fillStyle = lit ? '#ffd27a' : '#1d2733';
      g.fillRect(x, y, 11, 12);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function groundTexture() {
  const S = 2048;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  const toPx = (v) => ((v + 280) / GROUND_SPAN) * S;
  // Sidewalk / block base.
  g.fillStyle = '#7d7f88';
  g.fillRect(0, 0, S, S);
  // Parks: a few green blocks.
  g.fillStyle = '#4d7a4a';
  g.fillRect(toPx(-104), toPx(-104), toPx(-52) - toPx(-104), toPx(-52) - toPx(-104));
  g.fillRect(toPx(52), toPx(156), toPx(104) - toPx(52), toPx(208) - toPx(156));
  // Roads: asphalt strips on every grid line.
  g.fillStyle = '#3d414c';
  for (let i = -GRID; i <= GRID; i += 1) {
    const p = toPx(i * STEP);
    const w = (WORLD.roadWidth / GROUND_SPAN) * S;
    g.fillRect(p - w / 2, 0, w, S);
    g.fillRect(0, p - w / 2, S, w);
  }
  // Centre dashes (yellow) and edge lines (white).
  g.fillStyle = '#d8b13c';
  g.strokeStyle = '#e8e8e8';
  g.lineWidth = 2;
  for (let i = -GRID; i <= GRID; i += 1) {
    const p = toPx(i * STEP);
    for (let v = -260; v < 260; v += 16) {
      g.fillRect(p - 2, toPx(v), 4, 8);
      g.fillRect(toPx(v), p - 2, 8, 4);
    }
  }
  // Beach sand (east strip) and docks concrete (south strip).
  g.fillStyle = '#d9b77c';
  g.fillRect(toPx(226), 0, toPx(260) - toPx(226), S);
  g.fillStyle = '#8f9299';
  g.fillRect(0, toPx(226), S, toPx(260) - toPx(226));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function labelTexture(text, bg, fg, w = 256, h = 64) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.font = `bold ${Math.floor(h * 0.55)}px Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, random) {
  const colliders = [];
  const landmarks = {};
  const waterMeshes = [];
  let lampRoomMat = null; // lighthouse lamp, blinked by update()

  // --- Sky, fog, light -------------------------------------------------------
  function addSkyAndLights() {
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 16;
    skyCanvas.height = 256;
    const sg = skyCanvas.getContext('2d');
    const skyGrad = sg.createLinearGradient(0, 0, 0, 256);
    skyGrad.addColorStop(0, '#2e3a6e');
    skyGrad.addColorStop(0.45, '#7a5a8e');
    skyGrad.addColorStop(0.72, '#e8804f');
    skyGrad.addColorStop(1, '#ffc46b');
    sg.fillStyle = skyGrad;
    sg.fillRect(0, 0, 16, 256);
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 24, 16),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
    );
    scene.add(sky);
    scene.fog = new THREE.Fog(0xe89a5e, 220, 750);

    const sun = new THREE.DirectionalLight(0xffb36b, 1.6);
    sun.position.set(WORLD.sunDir.x * 300, WORLD.sunDir.y * 300, WORLD.sunDir.z * 300);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -160;
    sun.shadow.camera.right = 160;
    sun.shadow.camera.top = 160;
    sun.shadow.camera.bottom = -160;
    sun.shadow.camera.far = 800;
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    scene.add(sun.target);
    scene.add(new THREE.HemisphereLight(0xffd9a0, 0x54456a, 1.05));
    // Sun disc.
    const sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(34, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }),
    );
    sunDisc.position.set(WORLD.sunDir.x * 820, WORLD.sunDir.y * 820, WORLD.sunDir.z * 820);
    sunDisc.lookAt(0, 0, 0);
    scene.add(sunDisc);
    return sun;
  }

  const sun = addSkyAndLights();

  // --- Ground ----------------------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GROUND_SPAN, GROUND_SPAN),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // --- Water (east ocean + south harbour) ------------------------------------
  function addWater() {
    const waterMat = new THREE.MeshLambertMaterial({ color: 0x1f8fa3, transparent: true, opacity: 0.92 });
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(420, 560), waterMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(260 + 210, -0.4, 0);
    scene.add(ocean);
    const harbour = new THREE.Mesh(new THREE.PlaneGeometry(560, 320), waterMat.clone());
    harbour.rotation.x = -Math.PI / 2;
    harbour.position.set(0, -0.4, 260 + 160);
    scene.add(harbour);
    waterMeshes.push(ocean, harbour);
    // Foam strips along the beach.
    const foamMat = new THREE.MeshBasicMaterial({ color: 0xdff2f5, transparent: true, opacity: 0.55 });
    for (let i = 0; i < 5; i += 1) {
      const foam = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 520), foamMat);
      foam.rotation.x = -Math.PI / 2;
      foam.position.set(262 + i * 7, -0.2, 0);
      scene.add(foam);
      waterMeshes.push(foam);
    }
  }
  addWater();

  // --- Buildings ---------------------------------------------------------------
  const facades = [
    facadeTexture('#8a6f5c', 0.45, random),
    facadeTexture('#5c6b7a', 0.5, random),
    facadeTexture('#7a5c6b', 0.4, random),
    facadeTexture('#6b7a5c', 0.45, random),
    facadeTexture('#9a8a6a', 0.5, random),
    facadeTexture('#4a5568', 0.55, random),
  ];
  const facadeMats = facades.map(
    (tex) =>
      new THREE.MeshLambertMaterial({
        map: tex,
        emissive: 0xffffff,
        emissiveMap: tex,
        emissiveIntensity: 0.35,
      }),
  );
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3d44 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);

  // Material order: +x, -x, +y, -y, +z, -z — sides get the facade, top/bottom the roof.
  function addBuilding(cx, cz, w, d, h, matIndex) {
    const mesh = new THREE.Mesh(boxGeo, [facadeMats[matIndex], facadeMats[matIndex], roofMat, roofMat, facadeMats[matIndex], facadeMats[matIndex]]);
    mesh.scale.set(w, h, d);
    mesh.position.set(cx, 0, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    colliders.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 });
    return mesh;
  }

  // Landmark blocks (kept clear of random buildings).
  const reserved = new Set(['1,1', '2,2', '-2,-2', '0,4', '3,0']);
  // (bx,bz) block indices: safehouse (1,1), bank (2,2), garage (-2,-2), hospital (0,4), marina (3,0).
  function addRandomBuildings() {
    for (let bx = -5; bx < 5; bx += 1) {
      for (let bz = -5; bz < 5; bz += 1) {
        if (reserved.has(`${bx},${bz}`)) continue;
        const x0 = bx * STEP + 7;
        const z0 = bz * STEP + 7;
        const x1 = (bx + 1) * STEP - 7;
        const z1 = (bz + 1) * STEP - 7;
        // Beach strip and docks strip get no buildings.
        if (x0 >= 208 || z0 >= 208) continue;
        const downtown = Math.abs(bx) <= 2 && Math.abs(bz) <= 2;
        const n = downtown ? (random.next() < 0.5 ? 1 : 2) : random.int(1, 3);
        for (let k = 0; k < n; k += 1) {
          const w = random.range(14, Math.min(30, x1 - x0 - 4));
          const d = random.range(14, Math.min(30, z1 - z0 - 4));
          const cx = random.range(x0 + w / 2 + 1, x1 - w / 2 - 1);
          const cz = random.range(z0 + d / 2 + 1, z1 - d / 2 - 1);
          const h = downtown ? random.range(28, 72) : random.range(7, 20);
          addBuilding(cx, cz, w, d, h, random.int(0, facades.length - 1));
        }
      }
    }
  }
  addRandomBuildings();

  // --- Landmarks (named buildings with signs) ---------------------------------
  function addSign(text, x, y, z, w = 26) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w / 4),
      new THREE.MeshBasicMaterial({ map: labelTexture(text, '#101018', '#ffd27a') }),
    );
    sign.position.set(x, y, z);
    scene.add(sign);
    return sign;
  }
  function addLandmarks() {
    // Safehouse: a low teal house with a neon sign.
    addBuilding(78, 78, 26, 18, 9, 3);
    landmarks.safehouse = { x: 78, z: 78 };
    addSign('SAFEHOUSE', 78, 11.5, 68.5);
    // Marina Bank: tall marble-clad tower.
    addBuilding(130, 130, 30, 24, 42, 1);
    landmarks.bank = { x: 130, z: 130 };
    addSign('MARINA BANK', 130, 44.5, 117);
    // Nia's Workshop.
    addBuilding(-78, -78, 30, 20, 10, 0);
    landmarks.garage = { x: -78, z: -78 };
    addSign("NIA'S WORKSHOP", -78, 12.5, -67);
    // Hospital.
    addBuilding(26, 234, 34, 22, 16, 5);
    landmarks.hospital = { x: 26, z: 234 };
    addSign('GENERAL HOSPITAL', 26, 18.5, 222);
    // Hotel Solaris tower on the beach road.
    addBuilding(180, 26, 24, 24, 55, 4);
    landmarks.marina = { x: 180, z: 26 };
    addSign('HOTEL SOLARIS', 180, 57, 13);
  }
  addLandmarks();

  // --- Palms -------------------------------------------------------------------
  function addPalms() {
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
    const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f7a3a, side: THREE.DoubleSide });
    function addPalm(x, z, s = 1) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.4 * s, 6 * s, 6), trunkMat);
      trunk.position.y = 3 * s;
      trunk.rotation.z = 0.08;
      trunk.castShadow = true;
      g.add(trunk);
      for (let i = 0; i < 6; i += 1) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(1.1 * s, 3.4 * s, 4), frondMat);
        const a = (i / 6) * Math.PI * 2;
        frond.position.set(Math.cos(a) * 1.2 * s, 6.2 * s, Math.sin(a) * 1.2 * s);
        frond.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
        g.add(frond);
      }
      g.position.set(x, 0, z);
      scene.add(g);
    }
    for (let z = -240; z <= 240; z += 26) {
      addPalm(232 + random.range(-3, 3), z, random.range(0.9, 1.3));
      if (random.next() < 0.5) addPalm(216 + random.range(-3, 3), z + 13, random.range(0.8, 1.1));
    }
    for (let i = 0; i < 10; i += 1) addPalm(random.range(-70, 70), random.range(-400, -300), random.range(0.9, 1.4));
  }
  addPalms();

  // --- Docks: piers, containers, cranes ----------------------------------------
  function addDocks() {
    const pierMat = new THREE.MeshLambertMaterial({ color: 0x6b5a44 });
    const containerCols = [0xb8442c, 0x2c6bb8, 0x3a9a4a, 0xd8a13c, 0x7a4a9a];
    for (let px = -180; px <= 180; px += 90) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(24, 1.5, 70), pierMat);
      pier.position.set(px, 0.4, 295);
      pier.castShadow = true;
      pier.receiveShadow = true;
      scene.add(pier);
      colliders.push({ x0: px - 12, z0: 260, x1: px + 12, z1: 330 });
    }
    for (let i = 0; i < 26; i += 1) {
      const w = 8;
      const h = random.range(2.4, 5);
      const cx = random.range(-230, 230);
      const cz = random.range(232, 254);
      const cont = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, 3.2),
        new THREE.MeshLambertMaterial({ color: containerCols[i % containerCols.length] }),
      );
      cont.position.set(cx, h / 2, cz);
      cont.rotation.y = random.next() < 0.5 ? 0 : Math.PI / 2;
      cont.castShadow = true;
      scene.add(cont);
      colliders.push({ x0: cx - 4.5, z0: cz - 4.5, x1: cx + 4.5, z1: cz + 4.5 });
    }
    // Cranes: two simple gantry frames over the water.
    const craneMat = new THREE.MeshLambertMaterial({ color: 0xc8a13c });
    for (const cx of [-90, 90]) {
      const g = new THREE.Group();
      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(2, 26, 2), craneMat);
      leg1.position.set(-8, 13, 0);
      const leg2 = leg1.clone();
      leg2.position.set(8, 13, 0);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(22, 2, 2), craneMat);
      beam.position.set(0, 26, 0);
      const jib = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 34), craneMat);
      jib.position.set(0, 26, 12);
      g.add(leg1, leg2, beam, jib);
      g.position.set(cx, 0, 268);
      g.traverse((m) => {
        m.castShadow = true;
      });
      scene.add(g);
      colliders.push({ x0: cx - 10, z0: 266, x1: cx + 10, z1: 270 });
    }
  }
  addDocks();

  // --- Bridge + Cayo Verde island ----------------------------------------------
  function addBridgeAndIsland() {
    const bridgeMat = new THREE.MeshLambertMaterial({ color: 0x3a3d44 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 90), bridgeMat);
    deck.position.set(0, 3.2, -300);
    deck.castShadow = true;
    deck.receiveShadow = true;
    scene.add(deck);
    for (let z = -268; z >= -332; z -= 16) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 3), bridgeMat);
      pillar.position.set(0, 1, z);
      scene.add(pillar);
      colliders.push({ x0: -2, z0: z - 2, x1: 2, z1: z + 2 });
    }
    // Bridge ramps.
    const rampN = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 22), bridgeMat);
    rampN.position.set(0, 1.4, -266);
    rampN.rotation.x = 0.12;
    scene.add(rampN);
    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(95, 105, 3, 24),
      new THREE.MeshLambertMaterial({ color: 0x7a9a5a }),
    );
    island.position.set(0, -1, -380);
    island.receiveShadow = true;
    scene.add(island);
    // Island sand ring + lighthouse.
    const sandRing = new THREE.Mesh(
      new THREE.TorusGeometry(96, 5, 8, 32),
      new THREE.MeshLambertMaterial({ color: 0xd9b77c }),
    );
    sandRing.rotation.x = Math.PI / 2;
    sandRing.position.set(0, -0.3, -380);
    scene.add(sandRing);
    const lighthouse = new THREE.Group();
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 4.5, 22, 12),
      new THREE.MeshLambertMaterial({ color: 0xe8e4da }),
    );
    tower.position.y = 11;
    tower.castShadow = true;
    lampRoomMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 3, 12), lampRoomMat);
    lampRoom.position.y = 23;
    lighthouse.add(tower, lampRoom);
    lighthouse.position.set(-30, 0.5, -390);
    scene.add(lighthouse);
    colliders.push({ x0: -35, z0: -395, x1: -25, z1: -385 });
    landmarks.island = { x: 0, z: -380 };
    landmarks.bridge = { x: 0, z: -300 };
  }
  addBridgeAndIsland();

  // --- Street lamps -------------------------------------------------------------
  function addLamps() {
    const lampPoleMat = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
    const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    for (let i = -GRID; i <= GRID; i += 1) {
      for (let j = -GRID; j <= GRID; j += 1) {
        if ((i + j) % 2 !== 0) continue;
        if (Math.abs(i) >= 5 || Math.abs(j) >= 5) continue;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), lampPoleMat);
        pole.position.set(i * STEP + 7, 3, j * STEP + 7);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampGlowMat);
        bulb.position.set(i * STEP + 7, 6.1, j * STEP + 7);
        scene.add(pole, bulb);
      }
    }
  }
  addLamps();

  // --- Billboard -----------------------------------------------------------------
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 9),
    new THREE.MeshBasicMaterial({ map: labelTexture('NEON BAY', '#141428', '#ff5a8a', 512, 128) }),
  );
  board.position.set(-52, 16, -128);
  board.rotation.y = Math.PI / 4;
  scene.add(board);

  // --- Road graph ------------------------------------------------------------------
  const nodes = [];
  const nodeIndex = new Map();
  function addNode(x, z) {
    const key = `${x},${z}`;
    if (nodeIndex.has(key)) return nodeIndex.get(key);
    const idx = nodes.length;
    nodes.push({ x, z, edges: [] });
    nodeIndex.set(key, idx);
    return idx;
  }
  function addEdge(a, b) {
    nodes[a].edges.push(b);
    nodes[b].edges.push(a);
  }
  for (let i = -GRID; i <= GRID; i += 1) {
    for (let j = -GRID; j <= GRID; j += 1) {
      const idx = addNode(i * STEP, j * STEP);
      if (i > -GRID) addEdge(idx, nodeIndex.get(`${(i - 1) * STEP},${j * STEP}`));
      if (j > -GRID) addEdge(idx, nodeIndex.get(`${i * STEP},${(j - 1) * STEP}`));
    }
  }
  // Bridge + island loop.
  const bn0 = addNode(0, -260);
  const bn1 = addNode(0, -312);
  const bn2 = addNode(0, -364);
  const bn3 = addNode(52, -380);
  const bn4 = addNode(-52, -380);
  const bn5 = addNode(0, -420);
  addEdge(bn0, bn1);
  addEdge(bn1, bn2);
  addEdge(bn2, bn3);
  addEdge(bn2, bn4);
  addEdge(bn3, bn5);
  addEdge(bn4, bn5);

  return {
    colliders,
    landmarks,
    nodes,
    sun,
    update(dt, time) {
      // Gentle water shimmer.
      for (const w of waterMeshes) w.position.y = -0.4 + Math.sin(time * 0.7 + w.position.x * 0.01) * 0.08;
      if (lampRoomMat) lampRoomMat.color.setHex(Math.sin(time * 2.4) > 0 ? 0xffe9a8 : 0x8a7a4a);
    },
    /** Push a circle (x, z, radius) out of every building collider it overlaps. */
    collideCircle(pos, radius) {
      for (const c of colliders) {
        const nx = Math.max(c.x0, Math.min(pos.x, c.x1));
        const nz = Math.max(c.z0, Math.min(pos.z, c.z1));
        const dx = pos.x - nx;
        const dz = pos.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            pos.x = nx + (dx / d) * radius;
            pos.z = nz + (dz / d) * radius;
          } else {
            // Centre inside the box: push out along the smallest penetration axis.
            const pl = pos.x - c.x0;
            const pr = c.x1 - pos.x;
            const pt = pos.z - c.z0;
            const pb = c.z1 - pos.z;
            const m = Math.min(pl, pr, pt, pb);
            if (m === pl) pos.x = c.x0 - radius;
            else if (m === pr) pos.x = c.x1 + radius;
            else if (m === pt) pos.z = c.z0 - radius;
            else pos.z = c.z1 + radius;
          }
        }
      }
    },
    /** Is the point on a road (within the asphalt)? */
    onRoad(x, z) {
      if (x < -HALF || x > HALF || z < -HALF || z > HALF) return false;
      const mx = Math.abs(x - Math.round(x / STEP) * STEP);
      const mz = Math.abs(z - Math.round(z / STEP) * STEP);
      return mx < WORLD.roadWidth / 2 + 1 || mz < WORLD.roadWidth / 2 + 1;
    },
    /** Nearest road-graph node to a point. */
    nearestNode(x, z) {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < nodes.length; i += 1) {
        const dx = nodes[i].x - x;
        const dz = nodes[i].z - z;
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    },
  };
}
